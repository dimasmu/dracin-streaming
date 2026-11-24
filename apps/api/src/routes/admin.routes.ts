import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { randomUUID } from 'node:crypto';
import {
  activityLogs,
  and,
  asc,
  desc,
  dmcaTickets,
  dramaGenres,
  dramaRequests,
  dramas,
  episodeComments,
  episodes,
  episodeStreams,
  eq,
  genres,
  inArray,
  platforms,
  rolePermissions,
  scheduleSlots,
  siteSettings,
  sql,
  users,
  viewEvents,
} from '@tiraiplay/db';
import {
  BulkDramaActionSchema,
  CmsEpisodeItemSchema,
  DEFAULT_ROLE_PERMISSIONS,
  PresignUploadSchema,
  SiteSettingsSchema,
  UpdateCommentModerationSchema,
  UpdateDramaRequestSchema,
  UpdateRbacMatrixSchema,
  UpsertAdminUserSchema,
  UpsertDramaSchema,
  UpsertScheduleSlotSchema,
  UpsertTaxonomySchema,
  UpsertTicketSchema,
  type CmsPermission,
  type CmsRole,
} from '@tiraiplay/shared';
import { hydrateDramas } from '../lib/drama-mapper.js';
import { createR2PresignedUpload } from '../lib/r2.js';
import { getSiteSettings } from '../lib/settings.js';
import {
  getRolePermissionsMap,
  requirePermission,
  type ApiDeps,
  type AppBindings,
  type AuthUserContext,
} from '../middleware/rbac.js';

function toSlugId(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-') || `item-${Date.now()}`
  );
}

export function createAdminRoutes(deps: ApiDeps) {
  const app = new OpenAPIHono<AppBindings>();

  async function logActivity(user: AuthUserContext, action: string): Promise<void> {
    await deps.db.insert(activityLogs).values({
      actorUserId: user.id,
      actorLabel: `${user.name} (${user.role})`,
      action,
    });
  }

  // Every /admin route requires at least viewAdmin
  app.use('/admin/*', requirePermission('viewAdmin'));

  // ── Dashboard & Analytics ─────────────────────────────────────────────────
  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/dashboard',
      tags: ['Admin'],
      summary: 'KPI Dashboard, Top 5 Dramas, & Activity Log',
      responses: { 200: { description: 'Dashboard data' } },
    }),
    async (c) => {
      const [allDramas, logs] = await Promise.all([
        deps.db.select().from(dramas).orderBy(desc(dramas.trendingScore)),
        deps.db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(20),
      ]);
      const hydrated = await hydrateDramas(deps.db, allDramas);
      const totalDramas = hydrated.length;
      const heroCount = hydrated.filter((d) => d.featured).length;
      const ongoingCount = hydrated.filter((d) => d.status === 'ongoing').length;
      const totalEpisodesSum = hydrated.reduce((acc, d) => acc + d.totalEpisodes, 0);

      return c.json(
        {
          kpis: {
            totalDramas,
            heroCount,
            ongoingCount,
            totalEpisodesSum,
            avgEpisodes: Math.round(totalEpisodesSum / Math.max(1, totalDramas)),
          },
          top5Dramas: hydrated.slice(0, 5),
          activityLog: logs.map((l) => ({
            id: l.id,
            time: l.createdAt.toISOString(),
            actor: l.actorLabel,
            action: l.action,
          })),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/analytics',
      tags: ['Admin'],
      summary: 'Analitik mingguan, distribusi genre, & retention funnel',
      responses: { 200: { description: 'Analytics metrics' } },
    }),
    async (c) => {
      const [genreCounts, dailyViews, funnelRows] = await Promise.all([
        deps.db
          .select({
            name: genres.name,
            count: sql<number>`count(${dramaGenres.dramaId})::int`,
          })
          .from(genres)
          .leftJoin(dramaGenres, eq(genres.id, dramaGenres.genreId))
          .groupBy(genres.name)
          .orderBy(desc(sql`count(${dramaGenres.dramaId})`)),
        deps.db
          .select({
            day: viewEvents.watchedDateWib,
            views: sql<number>`count(*)::int`,
            completed: sql<number>`sum(case when ${viewEvents.completed} then 1 else 0 end)::int`,
          })
          .from(viewEvents)
          .groupBy(viewEvents.watchedDateWib)
          .orderBy(desc(viewEvents.watchedDateWib))
          .limit(7),
        deps.db
          .select({
            ep1: sql<number>`count(distinct case when ${viewEvents.episodeNumber} >= 1 then ${viewEvents.actorKey} end)::int`,
            ep25: sql<number>`count(distinct case when ${viewEvents.episodeNumber} >= 25 then ${viewEvents.actorKey} end)::int`,
            ep50: sql<number>`count(distinct case when ${viewEvents.episodeNumber} >= 50 then ${viewEvents.actorKey} end)::int`,
            ep75: sql<number>`count(distinct case when ${viewEvents.episodeNumber} >= 75 then ${viewEvents.actorKey} end)::int`,
          })
          .from(viewEvents),
      ]);

      const maxGenre = Math.max(1, genreCounts[0]?.count ?? 1);
      const funnel = funnelRows[0] ?? { ep1: 0, ep25: 0, ep50: 0, ep75: 0 };
      const base = Math.max(1, funnel.ep1);

      return c.json(
        {
          weeklyBars: dailyViews.reverse(),
          genreStats: genreCounts.map((g) => ({
            ...g,
            pct: Math.round((g.count / maxGenre) * 100),
          })),
          retentionFunnel: [
            { step: 'Mulai Ep 1', pct: funnel.ep1 ? 100 : 0 },
            { step: 'Lanjut Ep 25', pct: Math.round((funnel.ep25 / base) * 100) },
            { step: 'Pertengahan Ep 50', pct: Math.round((funnel.ep50 / base) * 100) },
            { step: 'Klimaks Ep 75', pct: Math.round((funnel.ep75 / base) * 100) },
          ],
        },
        200,
      );
    },
  );

  // ── Presigned Media Upload (Cloudflare R2) ────────────────────────────────
  app.use('/admin/uploads/*', requirePermission('editDrama'));
  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/uploads/presign',
      tags: ['Admin'],
      summary: 'Generate presigned PUT URL ke Cloudflare R2 untuk poster/backdrop/subtitle',
      request: { body: { content: { 'application/json': { schema: PresignUploadSchema } } } },
      responses: {
        200: { description: 'Presigned URL' },
        503: { description: 'R2 not configured' },
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      try {
        const result = await createR2PresignedUpload(deps.env, body);
        return c.json(result, 200);
      } catch (err) {
        return c.json({ code: 'R2_UNCONFIGURED', message: (err as Error).message }, 503);
      }
    },
  );

  // ── Dramas CRUD + Bulk ────────────────────────────────────────────────────
  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/dramas',
      tags: ['Admin'],
      summary: 'Daftar lengkap drama untuk tabel Admin CMS',
      responses: { 200: { description: 'Dramas' } },
    }),
    async (c) => {
      const rows = await deps.db.select().from(dramas).orderBy(desc(dramas.updatedAt));
      return c.json(await hydrateDramas(deps.db, rows), 200);
    },
  );

  app.use('/admin/dramas', async (c, next) => {
    if (c.req.method === 'POST') return requirePermission('createDrama')(c, next);
    return next();
  });

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/dramas',
      tags: ['Admin'],
      summary: 'Buat drama baru & sinkronkan genre/episode awal',
      request: { body: { content: { 'application/json': { schema: UpsertDramaSchema } } } },
      responses: { 201: { description: 'Drama created' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      const [plat] = await deps.db
        .select()
        .from(platforms)
        .where(eq(platforms.name, body.platformId))
        .limit(1);
      const platformId = plat?.id ?? toSlugId(body.platformId);

      const [created] = await deps.db
        .insert(dramas)
        .values({
          slug: body.slug,
          title: body.title,
          originalTitle: body.originalTitle ?? null,
          alternateTitles: body.alternateTitles,
          synopsis: body.synopsis,
          description: body.description ?? null,
          posterUrl: body.posterUrl?.trim() || null,
          backdropUrl: body.backdropUrl?.trim() || null,
          platformId,
          releaseYear: body.releaseYear ?? null,
          releaseDate: body.releaseDate ?? null,
          totalEpisodes: body.totalEpisodes,
          latestEpisode: body.latestEpisode,
          status: body.status,
          subtitleLanguages: body.subtitleLanguages,
          videoLanguages: body.videoLanguages,
          rating: body.rating,
          durationMinutes: body.durationMinutes,
          country: body.country ?? 'China',
          productionStudio: body.productionStudio ?? null,
          ageRating: body.ageRating ?? '13+',
          trailerUrl: body.trailerUrl ?? null,
          cast: body.cast,
          director: body.director ?? null,
          tags: body.tags,
          featured: body.featured,
          trendingScore: body.trendingScore,
          tone: body.tone,
        })
        .returning();

      const allGenres = await deps.db.select().from(genres);
      const genreByName = new Map(allGenres.map((g) => [g.name.toLowerCase(), g.id]));
      const dgRows = body.genres
        .map((n) => genreByName.get(n.toLowerCase()))
        .filter((id): id is string => Boolean(id))
        .map((genreId) => ({ dramaId: created.id, genreId }));
      if (dgRows.length) await deps.db.insert(dramaGenres).values(dgRows).onConflictDoNothing();

      await logActivity(user, `Menerbitkan drama baru "${created.title}"`);
      const [hydrated] = await hydrateDramas(deps.db, [created]);
      return c.json(hydrated, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/dramas/bulk',
      tags: ['Admin'],
      summary: 'Aksi massal featured / completed / delete pada katalog drama',
      request: { body: { content: { 'application/json': { schema: BulkDramaActionSchema } } } },
      responses: { 200: { description: 'Bulk applied' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const perms = c.get('permissions');
      const body = c.req.valid('json');

      if (body.action === 'delete') {
        if (!perms.deleteDrama) {
          return c.json({ code: 'FORBIDDEN', message: 'Izin deleteDrama diperlukan.' }, 403);
        }
        await deps.db.delete(dramas).where(inArray(dramas.id, body.ids));
      } else {
        if (!perms.editDrama) {
          return c.json({ code: 'FORBIDDEN', message: 'Izin editDrama diperlukan.' }, 403);
        }
        await deps.db
          .update(dramas)
          .set(
            body.action === 'featured'
              ? { featured: true, updatedAt: new Date() }
              : { status: 'completed', updatedAt: new Date() },
          )
          .where(inArray(dramas.id, body.ids));
      }

      await logActivity(user, `Aksi massal "${body.action}" pada ${body.ids.length} judul`);
      return c.json({ ok: true, affected: body.ids.length }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: '/admin/dramas/{dramaId}',
      tags: ['Admin'],
      summary: 'Update metadata drama (perm editDrama)',
      request: {
        params: z.object({ dramaId: z.string().uuid() }),
        body: { content: { 'application/json': { schema: UpsertDramaSchema } } },
      },
      responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
    }),
    async (c) => {
      if (!c.get('permissions').editDrama) {
        return c.json({ code: 'FORBIDDEN', message: 'Izin editDrama diperlukan.' }, 403);
      }
      const user = c.get('user')!;
      const { dramaId } = c.req.valid('param');
      const body = c.req.valid('json');
      const [plat] = await deps.db
        .select()
        .from(platforms)
        .where(eq(platforms.name, body.platformId))
        .limit(1);

      const [updated] = await deps.db
        .update(dramas)
        .set({
          slug: body.slug,
          title: body.title,
          originalTitle: body.originalTitle ?? null,
          alternateTitles: body.alternateTitles,
          synopsis: body.synopsis,
          description: body.description ?? null,
          posterUrl: body.posterUrl ?? null,
          backdropUrl: body.backdropUrl ?? null,
          platformId: plat?.id ?? toSlugId(body.platformId),
          releaseYear: body.releaseYear ?? null,
          releaseDate: body.releaseDate ?? null,
          totalEpisodes: body.totalEpisodes,
          latestEpisode: body.latestEpisode,
          status: body.status,
          subtitleLanguages: body.subtitleLanguages,
          videoLanguages: body.videoLanguages,
          rating: body.rating,
          durationMinutes: body.durationMinutes,
          country: body.country ?? 'China',
          productionStudio: body.productionStudio ?? null,
          ageRating: body.ageRating ?? '13+',
          trailerUrl: body.trailerUrl ?? null,
          cast: body.cast,
          director: body.director ?? null,
          tags: body.tags,
          featured: body.featured,
          trendingScore: body.trendingScore,
          tone: body.tone,
          updatedAt: new Date(),
        })
        .where(eq(dramas.id, dramaId))
        .returning();

      if (!updated) return c.json({ code: 'NOT_FOUND', message: 'Drama tidak ditemukan.' }, 404);

      const allGenres = await deps.db.select().from(genres);
      const genreByName = new Map(allGenres.map((g) => [g.name.toLowerCase(), g.id]));
      await deps.db.delete(dramaGenres).where(eq(dramaGenres.dramaId, dramaId));
      const dgRows = body.genres
        .map((n) => genreByName.get(n.toLowerCase()))
        .filter((id): id is string => Boolean(id))
        .map((genreId) => ({ dramaId, genreId }));
      if (dgRows.length) await deps.db.insert(dramaGenres).values(dgRows);

      await logActivity(user, `Memperbarui metadata "${updated.title}"`);
      const [hydrated] = await hydrateDramas(deps.db, [updated]);
      return c.json(hydrated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/dramas/{dramaId}',
      tags: ['Admin'],
      summary: 'Hapus drama permanen (perm deleteDrama)',
      request: { params: z.object({ dramaId: z.string().uuid() }) },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      if (!c.get('permissions').deleteDrama) {
        return c.json({ code: 'FORBIDDEN', message: 'Izin deleteDrama diperlukan.' }, 403);
      }
      const user = c.get('user')!;
      const { dramaId } = c.req.valid('param');
      const [del] = await deps.db.delete(dramas).where(eq(dramas.id, dramaId)).returning();
      if (del) await logActivity(user, `Menghapus drama "${del.title}"`);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/admin/dramas/{dramaId}/featured',
      tags: ['Admin'],
      summary: 'Toggle Hero Spotlight (perm editDrama)',
      request: { params: z.object({ dramaId: z.string().uuid() }) },
      responses: { 200: { description: 'Toggled' }, 404: { description: 'Not found' } },
    }),
    async (c) => {
      if (!c.get('permissions').editDrama) {
        return c.json({ code: 'FORBIDDEN', message: 'Izin editDrama diperlukan.' }, 403);
      }
      const { dramaId } = c.req.valid('param');
      const [cur] = await deps.db.select().from(dramas).where(eq(dramas.id, dramaId)).limit(1);
      if (!cur) return c.json({ code: 'NOT_FOUND', message: 'Drama tidak ditemukan.' }, 404);
      const [updated] = await deps.db
        .update(dramas)
        .set({ featured: !cur.featured, updatedAt: new Date() })
        .where(eq(dramas.id, dramaId))
        .returning();
      return c.json({ featured: updated.featured }, 200);
    },
  );

  // ── Episodes & Stream URLs ────────────────────────────────────────────────
  app.use('/admin/dramas/*/episodes*', requirePermission('editEpisodes'));

  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/dramas/{dramaId}/episodes',
      tags: ['Admin'],
      summary: 'Daftar episode beserta streamUrl & subtitleUrl mentah untuk CMS',
      request: { params: z.object({ dramaId: z.string().uuid() }) },
      responses: { 200: { description: 'Episodes with streams' } },
    }),
    async (c) => {
      const { dramaId } = c.req.valid('param');
      const epRows = await deps.db
        .select()
        .from(episodes)
        .where(eq(episodes.dramaId, dramaId))
        .orderBy(desc(episodes.number));
      const epIds = epRows.map((e) => e.id);
      const streamRows = epIds.length
        ? await deps.db
            .select()
            .from(episodeStreams)
            .where(inArray(episodeStreams.episodeId, epIds))
        : [];
      const streamsByEp = new Map<string, typeof streamRows>();
      for (const s of streamRows) {
        const list = streamsByEp.get(s.episodeId) ?? [];
        list.push(s);
        streamsByEp.set(s.episodeId, list);
      }
      return c.json(
        epRows.map((ep) => ({
          ...ep,
          streams: streamsByEp.get(ep.id) ?? [],
        })),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/dramas/{dramaId}/episodes',
      tags: ['Admin'],
      summary: 'Upsert episode & streamUrl per videoLang',
      request: {
        params: z.object({ dramaId: z.string().uuid() }),
        body: { content: { 'application/json': { schema: CmsEpisodeItemSchema } } },
      },
      responses: { 201: { description: 'Episode saved' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const { dramaId } = c.req.valid('param');
      const body = c.req.valid('json');

      const [ep] = await deps.db
        .insert(episodes)
        .values({
          dramaId,
          number: body.number,
          title: body.title,
          durationMinutes: body.durationMinutes,
          airDate: body.airDate ?? null,
          status: body.status,
        })
        .onConflictDoUpdate({
          target: [episodes.dramaId, episodes.number],
          set: {
            title: body.title,
            durationMinutes: body.durationMinutes,
            airDate: body.airDate ?? null,
            status: body.status,
            updatedAt: new Date(),
          },
        })
        .returning();

      await deps.db
        .insert(episodeStreams)
        .values({
          episodeId: ep.id,
          videoLang: body.videoLang,
          streamUrl: body.streamUrl,
          subtitleUrl: body.subtitleUrl ?? null,
        })
        .onConflictDoUpdate({
          target: [episodeStreams.episodeId, episodeStreams.videoLang],
          set: {
            streamUrl: body.streamUrl,
            subtitleUrl: body.subtitleUrl ?? null,
            updatedAt: new Date(),
          },
        });

      await logActivity(user, `Menyimpan Ep ${body.number} (${body.videoLang})`);
      return c.json(ep, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/admin/dramas/{dramaId}/episodes/{epNumber}/status',
      tags: ['Admin'],
      summary: 'Toggle status Tayang / Draft episode',
      request: {
        params: z.object({
          dramaId: z.string().uuid(),
          epNumber: z.coerce.number().int().min(1),
        }),
      },
      responses: { 200: { description: 'Toggled' }, 404: { description: 'Not found' } },
    }),
    async (c) => {
      const { dramaId, epNumber } = c.req.valid('param');
      const [ep] = await deps.db
        .select()
        .from(episodes)
        .where(and(eq(episodes.dramaId, dramaId), eq(episodes.number, epNumber)))
        .limit(1);
      if (!ep) return c.json({ code: 'NOT_FOUND', message: 'Episode tidak ditemukan.' }, 404);
      const nextStatus = ep.status === 'Tayang' ? 'Draft' : 'Tayang';
      const [updated] = await deps.db
        .update(episodes)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(episodes.id, ep.id))
        .returning();
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/dramas/{dramaId}/episodes/{epNumber}',
      tags: ['Admin'],
      summary: 'Hapus episode',
      request: {
        params: z.object({
          dramaId: z.string().uuid(),
          epNumber: z.coerce.number().int().min(1),
        }),
      },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      const { dramaId, epNumber } = c.req.valid('param');
      await deps.db
        .delete(episodes)
        .where(and(eq(episodes.dramaId, dramaId), eq(episodes.number, epNumber)));
      return c.body(null, 204);
    },
  );

  // ── Schedule & Taxonomy ───────────────────────────────────────────────────
  app.use('/admin/schedule*', requirePermission('editTaxonomy'));
  app.use('/admin/platforms*', requirePermission('editTaxonomy'));
  app.use('/admin/genres*', requirePermission('editTaxonomy'));

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/schedule',
      tags: ['Admin'],
      summary: 'Tambah slot jadwal rilis',
      request: { body: { content: { 'application/json': { schema: UpsertScheduleSlotSchema } } } },
      responses: { 201: { description: 'Created' } },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const [created] = await deps.db.insert(scheduleSlots).values(body).returning();
      return c.json(created, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: '/admin/schedule/{slotId}',
      tags: ['Admin'],
      summary: 'Update slot jadwal',
      request: {
        params: z.object({ slotId: z.string().uuid() }),
        body: { content: { 'application/json': { schema: UpsertScheduleSlotSchema } } },
      },
      responses: { 200: { description: 'Updated' } },
    }),
    async (c) => {
      const { slotId } = c.req.valid('param');
      const body = c.req.valid('json');
      const [updated] = await deps.db
        .update(scheduleSlots)
        .set(body)
        .where(eq(scheduleSlots.id, slotId))
        .returning();
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/schedule/{slotId}',
      tags: ['Admin'],
      summary: 'Hapus slot jadwal',
      request: { params: z.object({ slotId: z.string().uuid() }) },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      const { slotId } = c.req.valid('param');
      await deps.db.delete(scheduleSlots).where(eq(scheduleSlots.id, slotId));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/platforms',
      tags: ['Admin'],
      summary: 'Tambah platform sumber',
      request: { body: { content: { 'application/json': { schema: UpsertTaxonomySchema } } } },
      responses: { 201: { description: 'Created' } },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const [created] = await deps.db
        .insert(platforms)
        .values({
          id: toSlugId(body.name),
          name: body.name,
          description: body.description || `${body.name} short drama source.`,
          tone: body.tone,
        })
        .returning();
      return c.json(created, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: '/admin/platforms/{platformId}',
      tags: ['Admin'],
      summary: 'Update platform sumber',
      request: {
        params: z.object({ platformId: z.string() }),
        body: { content: { 'application/json': { schema: UpsertTaxonomySchema } } },
      },
      responses: { 200: { description: 'Updated' } },
    }),
    async (c) => {
      const { platformId } = c.req.valid('param');
      const body = c.req.valid('json');
      const [updated] = await deps.db
        .update(platforms)
        .set({ name: body.name, description: body.description, tone: body.tone })
        .where(eq(platforms.id, platformId))
        .returning();
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/platforms/{platformId}',
      tags: ['Admin'],
      summary: 'Hapus platform sumber',
      request: { params: z.object({ platformId: z.string() }) },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      const { platformId } = c.req.valid('param');
      await deps.db.delete(platforms).where(eq(platforms.id, platformId));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/genres',
      tags: ['Admin'],
      summary: 'Tambah genre',
      request: { body: { content: { 'application/json': { schema: UpsertTaxonomySchema } } } },
      responses: { 201: { description: 'Created' } },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const [created] = await deps.db
        .insert(genres)
        .values({
          id: toSlugId(body.name),
          name: body.name,
          description: body.description || `${body.name} short dramas.`,
          tone: body.tone,
        })
        .returning();
      return c.json(created, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: '/admin/genres/{genreId}',
      tags: ['Admin'],
      summary: 'Update genre',
      request: {
        params: z.object({ genreId: z.string() }),
        body: { content: { 'application/json': { schema: UpsertTaxonomySchema } } },
      },
      responses: { 200: { description: 'Updated' } },
    }),
    async (c) => {
      const { genreId } = c.req.valid('param');
      const body = c.req.valid('json');
      const [updated] = await deps.db
        .update(genres)
        .set({ name: body.name, description: body.description, tone: body.tone })
        .where(eq(genres.id, genreId))
        .returning();
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/genres/{genreId}',
      tags: ['Admin'],
      summary: 'Hapus genre',
      request: { params: z.object({ genreId: z.string() }) },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      const { genreId } = c.req.valid('param');
      await deps.db.delete(genres).where(eq(genres.id, genreId));
      return c.body(null, 204);
    },
  );

  // ── Moderation: Requests, Comments, DMCA Tickets ──────────────────────────
  app.use('/admin/requests*', requirePermission('moderateRequests'));
  app.use('/admin/comments*', requirePermission('moderateRequests'));
  app.use('/admin/tickets*', requirePermission('moderateRequests'));

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/admin/requests/{requestId}',
      tags: ['Admin'],
      summary: 'Update status/prioritas request drama',
      request: {
        params: z.object({ requestId: z.string().uuid() }),
        body: { content: { 'application/json': { schema: UpdateDramaRequestSchema } } },
      },
      responses: { 200: { description: 'Updated' } },
    }),
    async (c) => {
      const { requestId } = c.req.valid('param');
      const body = c.req.valid('json');
      const [updated] = await deps.db
        .update(dramaRequests)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(dramaRequests.id, requestId))
        .returning();
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/requests/{requestId}',
      tags: ['Admin'],
      summary: 'Hapus request drama',
      request: { params: z.object({ requestId: z.string().uuid() }) },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      const { requestId } = c.req.valid('param');
      await deps.db.delete(dramaRequests).where(eq(dramaRequests.id, requestId));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/comments',
      tags: ['Admin'],
      summary: 'List komentar untuk moderasi CMS',
      responses: { 200: { description: 'Comments' } },
    }),
    async (c) => {
      const rows = await deps.db
        .select()
        .from(episodeComments)
        .orderBy(desc(episodeComments.createdAt))
        .limit(100);
      return c.json(rows, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/admin/comments/{commentId}',
      tags: ['Admin'],
      summary: 'Edit status, flagReason, & balasan admin pada komentar',
      request: {
        params: z.object({ commentId: z.string().uuid() }),
        body: { content: { 'application/json': { schema: UpdateCommentModerationSchema } } },
      },
      responses: { 200: { description: 'Updated' } },
    }),
    async (c) => {
      const { commentId } = c.req.valid('param');
      const body = c.req.valid('json');
      const [updated] = await deps.db
        .update(episodeComments)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(episodeComments.id, commentId))
        .returning();
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/comments/{commentId}',
      tags: ['Admin'],
      summary: 'Hapus komentar',
      request: { params: z.object({ commentId: z.string().uuid() }) },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      const { commentId } = c.req.valid('param');
      await deps.db.delete(episodeComments).where(eq(episodeComments.id, commentId));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/tickets',
      tags: ['Admin'],
      summary: 'Daftar tiket DMCA & support',
      responses: { 200: { description: 'Tickets' } },
    }),
    async (c) => {
      const rows = await deps.db.select().from(dmcaTickets).orderBy(desc(dmcaTickets.createdAt));
      return c.json(rows, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/tickets',
      tags: ['Admin'],
      summary: 'Buat tiket DMCA/support manual dari CMS',
      request: { body: { content: { 'application/json': { schema: UpsertTicketSchema } } } },
      responses: { 201: { description: 'Created' } },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const ticketCode = `DMCA-${Math.floor(300 + Math.random() * 699)}`;
      const [created] = await deps.db
        .insert(dmcaTickets)
        .values({ ...body, ticketCode })
        .returning();
      return c.json(created, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/admin/tickets/{ticketId}',
      tags: ['Admin'],
      summary: 'Update tiket DMCA/support',
      request: {
        params: z.object({ ticketId: z.string().uuid() }),
        body: { content: { 'application/json': { schema: UpsertTicketSchema.partial() } } },
      },
      responses: { 200: { description: 'Updated' } },
    }),
    async (c) => {
      const { ticketId } = c.req.valid('param');
      const body = c.req.valid('json');
      const [updated] = await deps.db
        .update(dmcaTickets)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(dmcaTickets.id, ticketId))
        .returning();
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/tickets/{ticketId}',
      tags: ['Admin'],
      summary: 'Hapus tiket DMCA/support',
      request: { params: z.object({ ticketId: z.string().uuid() }) },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      const { ticketId } = c.req.valid('param');
      await deps.db.delete(dmcaTickets).where(eq(dmcaTickets.id, ticketId));
      return c.body(null, 204);
    },
  );

  // ── Users & RBAC Matrix ───────────────────────────────────────────────────
  app.use('/admin/users*', requirePermission('manageUsers'));
  app.use('/admin/rbac*', requirePermission('manageUsers'));

  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/users',
      tags: ['Admin'],
      summary: 'Daftar pengguna tim & penonton',
      responses: { 200: { description: 'Users list' } },
    }),
    async (c) => {
      const rows = await deps.db.select().from(users).orderBy(desc(users.createdAt));
      return c.json(rows, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/users',
      tags: ['Admin'],
      summary: 'Buat akun pengguna baru dari CMS',
      request: { body: { content: { 'application/json': { schema: UpsertAdminUserSchema } } } },
      responses: { 201: { description: 'User created' } },
    }),
    async (c) => {
      const actor = c.get('user')!;
      const body = c.req.valid('json');
      const username = body.username ?? body.email.split('@')[0].toLowerCase();
      const [created] = await deps.db
        .insert(users)
        .values({
          id: randomUUID(),
          name: body.name,
          username,
          email: body.email,
          role: body.role,
          department: body.department,
          phone: body.phone ?? null,
          twoFactorEnabled: body.twoFactorEnabled,
          status: body.status,
          notes: body.notes ?? null,
        })
        .returning();
      await logActivity(actor, `Menambahkan akun "${created.name}" (${created.role})`);
      return c.json(created, 201);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/admin/users/{userId}',
      tags: ['Admin'],
      summary: 'Update profil, role, & status pengguna',
      request: {
        params: z.object({ userId: z.string() }),
        body: { content: { 'application/json': { schema: UpsertAdminUserSchema.partial() } } },
      },
      responses: { 200: { description: 'Updated' } },
    }),
    async (c) => {
      const actor = c.get('user')!;
      const { userId } = c.req.valid('param');
      const body = c.req.valid('json');
      const [updated] = await deps.db
        .update(users)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      if (updated) await logActivity(actor, `Memperbarui akun "${updated.name}" (${updated.role})`);
      return c.json(updated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/admin/users/{userId}',
      tags: ['Admin'],
      summary: 'Hapus akun pengguna',
      request: { params: z.object({ userId: z.string() }) },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      const { userId } = c.req.valid('param');
      await deps.db.delete(users).where(eq(users.id, userId));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/rbac',
      tags: ['Admin'],
      summary: 'Ambil matriks permission RBAC',
      responses: { 200: { description: 'RBAC matrix' } },
    }),
    async (c) => {
      return c.json(await getRolePermissionsMap(deps.db), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: '/admin/rbac',
      tags: ['Admin'],
      summary: 'Simpan atau reset matriks permission RBAC',
      request: { body: { content: { 'application/json': { schema: UpdateRbacMatrixSchema } } } },
      responses: { 200: { description: 'RBAC updated' } },
    }),
    async (c) => {
      const actor = c.get('user')!;
      const body = c.req.valid('json');
      const source = body.resetDefault || !body.matrix ? DEFAULT_ROLE_PERMISSIONS : body.matrix;

      const rows: Array<{ role: CmsRole; permission: CmsPermission; enabled: boolean }> = [];
      for (const [role, perms] of Object.entries(source) as Array<
        [CmsRole, Record<CmsPermission, boolean>]
      >) {
        for (const [permission, enabled] of Object.entries(perms) as Array<
          [CmsPermission, boolean]
        >) {
          rows.push({ role, permission, enabled });
        }
      }
      for (const row of rows) {
        await deps.db
          .insert(rolePermissions)
          .values(row)
          .onConflictDoUpdate({
            target: [rolePermissions.role, rolePermissions.permission],
            set: { enabled: row.enabled, updatedAt: new Date() },
          });
      }
      await logActivity(actor, body.resetDefault ? 'Mereset matriks RBAC default' : 'Memperbarui matriks RBAC');
      return c.json(await getRolePermissionsMap(deps.db), 200);
    },
  );

  // ── Settings & Catalog JSON Export ────────────────────────────────────────
  app.use('/admin/settings*', requirePermission('manageSettings'));
  app.use('/admin/catalog/*', requirePermission('manageSettings'));

  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/settings',
      tags: ['Admin'],
      summary: 'Ambil pengaturan penuh sistem CMS',
      responses: { 200: { description: 'Full settings' } },
    }),
    async (c) => {
      return c.json(await getSiteSettings(deps.db), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: '/admin/settings',
      tags: ['Admin'],
      summary: 'Update konfigurasi sistem, CDN, moderasi, & batas kuota harian',
      request: { body: { content: { 'application/json': { schema: SiteSettingsSchema } } } },
      responses: { 200: { description: 'Saved settings' } },
    }),
    async (c) => {
      const actor = c.get('user')!;
      const body = c.req.valid('json');
      await deps.db
        .insert(siteSettings)
        .values({ id: 'default', ...body, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteSettings.id,
          set: { ...body, updatedAt: new Date() },
        });
      await logActivity(actor, 'Menyimpan konfigurasi sistem & pemutar TiraiPlay');
      return c.json(await getSiteSettings(deps.db), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/admin/catalog/export',
      tags: ['Admin'],
      summary: 'Ekspor seluruh katalog drama sebagai JSON',
      responses: { 200: { description: 'JSON bundle' } },
    }),
    async (c) => {
      const [allDramas, allPlatforms, allGenres] = await Promise.all([
        deps.db.select().from(dramas).orderBy(asc(dramas.title)),
        deps.db.select().from(platforms).orderBy(asc(platforms.name)),
        deps.db.select().from(genres).orderBy(asc(genres.name)),
      ]);
      return c.json(
        {
          exportedAt: new Date().toISOString(),
          dramas: await hydrateDramas(deps.db, allDramas),
          platforms: allPlatforms,
          genres: allGenres,
        },
        200,
      );
    },
  );

  return app;
}
