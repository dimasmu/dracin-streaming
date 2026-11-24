import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  asc,
  bookmarks,
  desc,
  dramaGenres,
  dramas,
  dramaVotes,
  episodeStreams,
  episodes,
  eq,
  genres,
  inArray,
  platforms,
  scheduleSlots,
  sql,
} from '@tiraiplay/db';
import {
  DAY_NAME_TO_NUMBER,
  DramaDtoSchema,
  DramaFilterQuerySchema,
  DramaGenreDtoSchema,
  DramaPlatformDtoSchema,
  EpisodePublicMetaSchema,
  getWibDateString,
} from '@tiraiplay/shared';
import { hydrateDramas } from '../lib/drama-mapper.js';
import { DbQuotaBackend } from '../lib/quota.js';
import { getSiteSettings } from '../lib/settings.js';
import type { ApiDeps, AppBindings } from '../middleware/rbac.js';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export function createPublicRoutes(deps: ApiDeps) {
  const app = new OpenAPIHono<AppBindings>();

  app.openapi(
    createRoute({
      method: 'get',
      path: '/settings/public',
      tags: ['Public'],
      summary: 'Konfigurasi publik situs & player',
      responses: {
        200: {
          description: 'Public site settings',
          content: {
            'application/json': {
              schema: z.object({
                siteAnnouncement: z.string(),
                maintenanceMode: z.boolean(),
                defaultVideoLang: z.enum(['id', 'en']),
                defaultQuality: z.enum(['1080p', '720p']),
                playerWatermark: z.boolean(),
                supportEmail: z.string(),
                dmcaEmail: z.string(),
                freeDailyEpisodeLimit: z.number().int(),
                guestDailyEpisodeLimit: z.number().int(),
              }),
            },
          },
        },
      },
    }),
    async (c) => {
      const s = await getSiteSettings(deps.db);
      return c.json(
        {
          siteAnnouncement: s.siteAnnouncement,
          maintenanceMode: s.maintenanceMode,
          defaultVideoLang: s.defaultVideoLang,
          defaultQuality: s.defaultQuality,
          playerWatermark: s.playerWatermark,
          supportEmail: s.supportEmail,
          dmcaEmail: s.dmcaEmail,
          freeDailyEpisodeLimit: s.freeDailyEpisodeLimit,
          guestDailyEpisodeLimit: s.guestDailyEpisodeLimit,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/dramas',
      tags: ['Catalog'],
      summary: 'Daftar katalog drama dengan filter, search, sort & paginasi',
      request: {
        query: DramaFilterQuerySchema,
      },
      responses: {
        200: {
          description: 'Paginated catalog response',
          content: {
            'application/json': {
              schema: z.object({
                items: z.array(DramaDtoSchema),
                total: z.number().int(),
                page: z.number().int(),
                limit: z.number().int(),
                facets: z.object({
                  years: z.array(z.number().int()),
                  subtitleLanguages: z.array(z.string()),
                }),
              }),
            },
          },
        },
      },
    }),
    async (c) => {
      const q = c.req.valid('query');
      const allRows = await deps.db.select().from(dramas).orderBy(desc(dramas.trendingScore));
      const hydrated = await hydrateDramas(deps.db, allRows);

      const wantedGenres = q.genres ? q.genres.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const wantedPlatforms = q.platforms
        ? q.platforms.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const wantedYears = q.years
        ? q.years.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
        : [];
      const wantedSubs = q.subtitleLanguages
        ? q.subtitleLanguages.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const needle = q.query?.trim().toLowerCase() ?? '';

      const filtered = hydrated.filter((d) => {
        if (q.featured !== undefined && d.featured !== q.featured) return false;
        if (wantedGenres.length && !wantedGenres.some((g) => d.genres.includes(g))) return false;
        if (wantedPlatforms.length && !wantedPlatforms.includes(d.platformId)) return false;
        if (wantedYears.length && d.releaseYear && !wantedYears.includes(d.releaseYear)) return false;
        if (wantedSubs.length && !wantedSubs.some((s) => d.subtitleLanguages.includes(s))) return false;
        if (q.dateFrom && d.releaseDate && d.releaseDate < q.dateFrom) return false;
        if (q.dateTo && d.releaseDate && d.releaseDate > q.dateTo) return false;
        if (needle) {
          const hay = [
            d.title,
            d.originalTitle ?? '',
            d.alternateTitles.join(' '),
            d.platformId,
            d.genres.join(' '),
            d.tags.join(' '),
            d.cast.join(' '),
            d.director ?? '',
            d.synopsis,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });

      filtered.sort((a, b) => {
        switch (q.sort) {
          case 'new':
            return (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || b.latestEpisode - a.latestEpisode;
          case 'rating':
            return b.rating - a.rating;
          case 'az':
            return a.title.localeCompare(b.title);
          case 'full':
            return b.totalEpisodes - a.totalEpisodes;
          default:
            return b.trendingScore - a.trendingScore;
        }
      });

      const start = (q.page - 1) * q.limit;
      const items = filtered.slice(start, start + q.limit);
      const years = [
        ...new Set(hydrated.map((d) => d.releaseYear).filter((y): y is number => y != null)),
      ].sort((a, b) => b - a);
      const subtitleLanguages = [...new Set(hydrated.flatMap((d) => d.subtitleLanguages))].sort();

      return c.json(
        {
          items,
          total: filtered.length,
          page: q.page,
          limit: q.limit,
          facets: { years, subtitleLanguages },
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/dramas/{slug}',
      tags: ['Catalog'],
      summary: 'Detail drama, episode publik (tanpa streamUrl mentah), & drama terkait',
      request: {
        params: z.object({ slug: z.string() }),
      },
      responses: {
        200: {
          description: 'Drama detail',
          content: {
            'application/json': {
              schema: z.object({
                drama: DramaDtoSchema,
                episodes: z.array(EpisodePublicMetaSchema),
                related: z.array(DramaDtoSchema),
                viewerState: z.object({
                  bookmarked: z.boolean(),
                  vote: z.enum(['like', 'dislike']).nullable(),
                  userScore: z.number().int().nullable(),
                }),
              }),
            },
          },
        },
        404: { description: 'Drama not found' },
      },
    }),
    async (c) => {
      const { slug } = c.req.valid('param');
      const [row] = await deps.db.select().from(dramas).where(eq(dramas.slug, slug)).limit(1);
      if (!row) return c.json({ code: 'NOT_FOUND', message: 'Drama tidak ditemukan.' }, 404);

      const [drama] = await hydrateDramas(deps.db, [row]);
      const epRows = await deps.db
        .select()
        .from(episodes)
        .where(eq(episodes.dramaId, row.id))
        .orderBy(asc(episodes.number));

      const epIds = epRows.map((e) => e.id);
      const streamRows = epIds.length
        ? await deps.db
            .select({ episodeId: episodeStreams.episodeId, videoLang: episodeStreams.videoLang })
            .from(episodeStreams)
            .where(inArray(episodeStreams.episodeId, epIds))
        : [];

      const langsByEp = new Map<string, Array<'id' | 'en'>>();
      for (const s of streamRows) {
        const list = langsByEp.get(s.episodeId) ?? [];
        list.push(s.videoLang);
        langsByEp.set(s.episodeId, list);
      }

      const user = c.get('user');
      const guestKey = c.get('guestKey');
      const todayWib = getWibDateString();
      const quotaBackend = new DbQuotaBackend(deps.db, deps.kv);
      const unlockedSet = new Set<string>();
      if (!user) {
        for (const id of await quotaBackend.getGuestUnlockedIds(guestKey, todayWib)) {
          unlockedSet.add(id);
        }
      } else {
        for (const ep of epRows) {
          if (await quotaBackend.isUserEpisodeUnlocked(user.id, ep.id, todayWib)) {
            unlockedSet.add(ep.id);
          }
        }
      }

      const publicEpisodes = epRows.map((e) => ({
        id: e.id,
        number: e.number,
        title: e.title,
        durationMinutes: e.durationMinutes,
        airDate: e.airDate,
        status: e.status,
        availableVideoLangs: langsByEp.get(e.id) ?? ['id'],
        unlockedToday: unlockedSet.has(e.id),
      }));

      // Related dramas
      const candidateRows = await deps.db
        .select()
        .from(dramas)
        .where(sql`${dramas.id} != ${row.id}`)
        .orderBy(desc(dramas.trendingScore))
        .limit(12);
      const related = (await hydrateDramas(deps.db, candidateRows)).slice(0, 8);

      let bookmarked = false;
      let vote: 'like' | 'dislike' | null = null;
      let userScore: number | null = null;
      if (user) {
        const [bm] = await deps.db
          .select()
          .from(bookmarks)
          .where(sql`${bookmarks.userId} = ${user.id} AND ${bookmarks.dramaId} = ${row.id}`)
          .limit(1);
        bookmarked = Boolean(bm);
        const [vt] = await deps.db
          .select()
          .from(dramaVotes)
          .where(sql`${dramaVotes.userId} = ${user.id} AND ${dramaVotes.dramaId} = ${row.id}`)
          .limit(1);
        vote = vt?.vote === 'like' || vt?.vote === 'dislike' ? vt.vote : null;
        userScore = vt?.score ?? null;
      }

      return c.json(
        {
          drama,
          episodes: publicEpisodes,
          related,
          viewerState: { bookmarked, vote, userScore },
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/genres',
      tags: ['Catalog'],
      summary: 'Daftar genre beserta jumlah drama',
      responses: {
        200: {
          description: 'Genres list',
          content: { 'application/json': { schema: z.array(DramaGenreDtoSchema) } },
        },
      },
    }),
    async (c) => {
      const [genreRows, counts] = await Promise.all([
        deps.db.select().from(genres).orderBy(asc(genres.name)),
        deps.db
          .select({ genreId: dramaGenres.genreId, cnt: sql<number>`count(*)::int` })
          .from(dramaGenres)
          .groupBy(dramaGenres.genreId),
      ]);
      const countMap = new Map(counts.map((x) => [x.genreId, x.cnt]));
      return c.json(
        genreRows.map((g) => ({ ...g, count: countMap.get(g.id) ?? 0 })),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/platforms',
      tags: ['Catalog'],
      summary: 'Daftar platform sumber beserta jumlah drama',
      responses: {
        200: {
          description: 'Platforms list',
          content: { 'application/json': { schema: z.array(DramaPlatformDtoSchema) } },
        },
      },
    }),
    async (c) => {
      const [platRows, counts] = await Promise.all([
        deps.db.select().from(platforms).orderBy(asc(platforms.name)),
        deps.db
          .select({ platformId: dramas.platformId, cnt: sql<number>`count(*)::int` })
          .from(dramas)
          .groupBy(dramas.platformId),
      ]);
      const countMap = new Map(counts.map((x) => [x.platformId, x.cnt]));
      return c.json(
        platRows.map((p) => ({ ...p, count: countMap.get(p.id) ?? 0 })),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/schedule',
      tags: ['Catalog'],
      summary: 'Jadwal rilis mingguan',
      request: {
        query: z.object({
          day: z.coerce.number().int().min(0).max(6).optional(),
        }),
      },
      responses: {
        200: {
          description: 'Schedule slots',
          content: {
            'application/json': {
              schema: z.array(
                z.object({
                  id: z.string(),
                  dramaId: z.string(),
                  dramaSlug: z.string(),
                  dramaTitle: z.string(),
                  platformId: z.string(),
                  dayOfWeek: z.number().int(),
                  dayName: z.string(),
                  timeWib: z.string(),
                  episodeNumber: z.number().int(),
                  note: z.string().nullable(),
                  status: z.string(),
                  isDemo: z.boolean(),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const { day } = c.req.valid('query');
      const rows = await deps.db
        .select({
          id: scheduleSlots.id,
          dramaId: scheduleSlots.dramaId,
          dayOfWeek: scheduleSlots.dayOfWeek,
          timeWib: scheduleSlots.timeWib,
          episodeNumber: scheduleSlots.episodeNumber,
          note: scheduleSlots.note,
          status: scheduleSlots.status,
          isDemo: scheduleSlots.isDemo,
          dramaSlug: dramas.slug,
          dramaTitle: dramas.title,
          platformName: platforms.name,
        })
        .from(scheduleSlots)
        .innerJoin(dramas, eq(scheduleSlots.dramaId, dramas.id))
        .innerJoin(platforms, eq(dramas.platformId, platforms.id))
        .where(day !== undefined ? eq(scheduleSlots.dayOfWeek, day) : undefined)
        .orderBy(asc(scheduleSlots.dayOfWeek), asc(scheduleSlots.timeWib));

      return c.json(
        rows.map((r) => ({
          id: r.id,
          dramaId: r.dramaId,
          dramaSlug: r.dramaSlug,
          dramaTitle: r.dramaTitle,
          platformId: r.platformName,
          dayOfWeek: r.dayOfWeek,
          dayName: DAY_NAMES[r.dayOfWeek] ?? DAY_NAMES[1],
          timeWib: r.timeWib,
          episodeNumber: r.episodeNumber,
          note: r.note,
          status: r.status,
          isDemo: r.isDemo,
        })),
        200,
      );
    },
  );

  // Keep reference to DAY_NAME_TO_NUMBER imported cleanly
  void DAY_NAME_TO_NUMBER;

  return app;
}
