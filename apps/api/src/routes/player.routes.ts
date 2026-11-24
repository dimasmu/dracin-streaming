import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { and, dramas, episodes, episodeStreams, eq, sql, viewEvents } from '@tiraiplay/db';
import {
  getWibDateString,
  PlayEpisodeRequestSchema,
  PlayEpisodeResponseSchema,
  ViewEventSchema,
} from '@tiraiplay/shared';
import { checkAndConsumeEpisodeQuota, DbQuotaBackend } from '../lib/quota.js';
import { getSiteSettings } from '../lib/settings.js';
import {
  createStreamToken,
  rewriteHlsManifest,
  verifyStreamToken,
} from '../lib/stream-token.js';
import type { ApiDeps, AppBindings } from '../middleware/rbac.js';

export function createPlayerRoutes(deps: ApiDeps) {
  const app = new OpenAPIHono<AppBindings>();

  app.openapi(
    createRoute({
      method: 'post',
      path: '/episodes/{episodeId}/play',
      tags: ['Player'],
      summary: 'Cek kuota harian (10 ep/hari Free, 3 ep Guest) / VIP & terbitkan URL stream proxy bertoken',
      request: {
        params: z.object({ episodeId: z.string().uuid() }),
        body: {
          content: { 'application/json': { schema: PlayEpisodeRequestSchema } },
        },
      },
      responses: {
        200: {
          description: 'Stream access granted',
          content: { 'application/json': { schema: PlayEpisodeResponseSchema } },
        },
        401: { description: 'Guest quota exhausted; login required for 10/day quota' },
        403: { description: 'Free daily 10-episode quota exhausted' },
        404: { description: 'Episode or video language stream not found' },
      },
    }),
    async (c) => {
      const { episodeId } = c.req.valid('param');
      const { videoLang } = c.req.valid('json');

      const [ep] = await deps.db
        .select()
        .from(episodes)
        .where(eq(episodes.id, episodeId))
        .limit(1);
      if (!ep) {
        return c.json({ code: 'NOT_FOUND', message: 'Episode tidak ditemukan.' }, 404);
      }

      const streams = await deps.db
        .select()
        .from(episodeStreams)
        .where(eq(episodeStreams.episodeId, ep.id));

      const chosenStream =
        streams.find((s) => s.videoLang === videoLang) ?? streams[0];
      if (!chosenStream) {
        return c.json({ code: 'STREAM_UNAVAILABLE', message: 'Tautan stream belum tersedia.' }, 404);
      }

      const user = c.get('user');
      const guestKey = c.get('guestKey');
      const settings = await getSiteSettings(deps.db);
      const backend = new DbQuotaBackend(deps.db, deps.kv);

      const decision = await checkAndConsumeEpisodeQuota(
        backend,
        { userId: user?.id ?? null, guestKey },
        ep.id,
        {
          freeDailyLimit: settings.freeDailyEpisodeLimit,
          guestDailyLimit: settings.guestDailyEpisodeLimit,
        },
      );

      if (!decision.allowed) {
        if (decision.reason === 'LOGIN_REQUIRED_FOR_QUOTA') {
          return c.json(
            {
              code: 'LOGIN_REQUIRED_FOR_QUOTA',
              message: `Kuota coba-coba guest (${settings.guestDailyEpisodeLimit} ep) habis. Login gratis untuk mendapat ${settings.freeDailyEpisodeLimit} episode/hari!`,
              quota: decision.quota,
            },
            401,
          );
        }
        return c.json(
          {
            code: 'QUOTA_EXCEEDED',
            message: `Kuota harian gratis (${settings.freeDailyEpisodeLimit} episode) sudah habis. Tunggu reset besok pukul 00:00 WIB atau upgrade VIP Bulanan.`,
            quota: decision.quota,
          },
          403,
        );
      }

      const actorKey = user?.id ?? guestKey;
      const { token, expiresAt } = createStreamToken(
        {
          actorKey,
          episodeId: ep.id,
          videoLang: chosenStream.videoLang,
          streamUrl: chosenStream.streamUrl,
          subtitleUrl: chosenStream.subtitleUrl,
        },
        deps.env.STREAM_SIGNING_SECRET,
      );

      // Increment drama view count asynchronously (best-effort)
      void deps.db
        .update(dramas)
        .set({ viewCount: sql`${dramas.viewCount} + 1` })
        .where(eq(dramas.id, ep.dramaId))
        .catch(() => undefined);

      return c.json(
        {
          episodeId: ep.id,
          dramaId: ep.dramaId,
          number: ep.number,
          videoLang: chosenStream.videoLang,
          streamProxyUrl: `/api/streams/${token}/master.m3u8`,
          subtitleProxyUrl: chosenStream.subtitleUrl
            ? `/api/streams/${token}/subtitle.vtt`
            : null,
          expiresAt,
          quota: decision.quota,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/streams/{token}/master.m3u8',
      tags: ['Player'],
      summary: 'HLS manifest proxy tervalidasi token HMAC',
      request: {
        params: z.object({ token: z.string() }),
      },
      responses: {
        200: { description: 'Rewritten HLS playlist' },
        403: { description: 'Invalid or expired stream token' },
        502: { description: 'Upstream CDN failed' },
      },
    }),
    async (c) => {
      const { token } = c.req.valid('param');
      const payload = verifyStreamToken(token, deps.env.STREAM_SIGNING_SECRET);
      const actorKey = c.get('user')?.id ?? c.get('guestKey');
      if (!payload || payload.actorKey !== actorKey) {
        return c.json({ code: 'INVALID_STREAM_TOKEN', message: 'Token stream tidak valid atau kadaluarsa.' }, 403);
      }

      try {
        const upstreamRes = await fetch(payload.streamUrl);
        if (!upstreamRes.ok) {
          return c.json({ code: 'UPSTREAM_ERROR', message: 'Sumber video tidak merespons.' }, 502);
        }
        const manifest = await upstreamRes.text();
        const rewritten = rewriteHlsManifest(manifest, payload.streamUrl);
        return c.text(rewritten, 200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'private, no-store',
        });
      } catch {
        return c.json({ code: 'UPSTREAM_ERROR', message: 'Gagal mengambil manifest HLS.' }, 502);
      }
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/streams/{token}/subtitle.vtt',
      tags: ['Player'],
      summary: 'Subtitle VTT proxy tervalidasi token HMAC',
      request: {
        params: z.object({ token: z.string() }),
      },
      responses: {
        200: { description: 'WebVTT subtitle file' },
        403: { description: 'Invalid or expired stream token' },
        404: { description: 'Subtitle not configured' },
      },
    }),
    async (c) => {
      const { token } = c.req.valid('param');
      const payload = verifyStreamToken(token, deps.env.STREAM_SIGNING_SECRET);
      const actorKey = c.get('user')?.id ?? c.get('guestKey');
      if (!payload || payload.actorKey !== actorKey) {
        return c.json({ code: 'INVALID_STREAM_TOKEN', message: 'Token tidak valid.' }, 403);
      }
      if (!payload.subtitleUrl) {
        return c.json({ code: 'NOT_FOUND', message: 'Subtitle tidak tersedia.' }, 404);
      }

      const upstreamRes = await fetch(payload.subtitleUrl);
      if (!upstreamRes.ok) {
        return c.json({ code: 'UPSTREAM_ERROR', message: 'Gagal mengambil subtitle.' }, 502);
      }
      const vtt = await upstreamRes.text();
      return c.text(vtt, 200, {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      });
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/events/view',
      tags: ['Player'],
      summary: 'Catat durasi tonton & penyelesaian episode untuk analitik',
      request: {
        body: { content: { 'application/json': { schema: ViewEventSchema } } },
      },
      responses: {
        204: { description: 'Recorded' },
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const user = c.get('user');
      const actorKey = user?.id ?? c.get('guestKey');
      const todayWib = getWibDateString();

      await deps.db.insert(viewEvents).values({
        dramaId: body.dramaId,
        episodeNumber: body.episodeNumber,
        userId: user?.id ?? null,
        actorKey,
        watchSeconds: body.watchSeconds,
        completed: body.completed,
        watchedDateWib: todayWib,
      });

      if (body.completed) {
        await deps.db
          .update(dramas)
          .set({ trendingScore: sql`${dramas.trendingScore} + 1` })
          .where(and(eq(dramas.id, body.dramaId)));
      }
      return c.body(null, 204);
    },
  );

  return app;
}
