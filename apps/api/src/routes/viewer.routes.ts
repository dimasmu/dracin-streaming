import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  and,
  bookmarks,
  commentLikes,
  desc,
  dmcaTickets,
  dramaRequests,
  dramaRequestVotes,
  dramas,
  dramaVotes,
  episodeComments,
  eq,
  gt,
  inArray,
  sql,
  userSubscriptions,
} from '@tiraiplay/db';
import {
  ContactTicketSubmitSchema,
  CreateCommentSchema,
  CreateDramaRequestSchema,
  DramaVoteSchema,
} from '@tiraiplay/shared';
import { hydrateDramas } from '../lib/drama-mapper.js';
import { DbQuotaBackend, getActorQuotaStatus } from '../lib/quota.js';
import { getSiteSettings } from '../lib/settings.js';
import { requireAuth, type ApiDeps, type AppBindings } from '../middleware/rbac.js';

export function createViewerRoutes(deps: ApiDeps) {
  const app = new OpenAPIHono<AppBindings>();

  app.openapi(
    createRoute({
      method: 'get',
      path: '/me',
      tags: ['Auth'],
      summary: 'Profil user aktif, RBAC permissions, subscription status, & sisa kuota harian',
      responses: {
        200: { description: 'Current viewer/admin session & quota status' },
      },
    }),
    async (c) => {
      const user = c.get('user');
      const guestKey = c.get('guestKey');
      const permissions = c.get('permissions');
      const settings = await getSiteSettings(deps.db);
      const quota = await getActorQuotaStatus(
        new DbQuotaBackend(deps.db, deps.kv),
        { userId: user?.id ?? null, guestKey },
        {
          freeDailyLimit: settings.freeDailyEpisodeLimit,
          guestDailyLimit: settings.guestDailyEpisodeLimit,
        },
      );

      let activeSubscription: { planId: string; expiresAt: string } | null = null;
      if (user) {
        const [sub] = await deps.db
          .select()
          .from(userSubscriptions)
          .where(
            and(
              eq(userSubscriptions.userId, user.id),
              eq(userSubscriptions.status, 'active'),
              gt(userSubscriptions.expiresAt, new Date()),
            ),
          )
          .orderBy(desc(userSubscriptions.expiresAt))
          .limit(1);
        if (sub) {
          activeSubscription = {
            planId: sub.planId,
            expiresAt: sub.expiresAt.toISOString(),
          };
        }
      }

      return c.json(
        {
          user,
          permissions,
          subscription: activeSubscription,
          quota,
        },
        200,
      );
    },
  );

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  app.use('/bookmarks', requireAuth());
  app.use('/bookmarks/*', requireAuth());

  app.openapi(
    createRoute({
      method: 'get',
      path: '/bookmarks',
      tags: ['Viewer'],
      summary: 'Daftar bookmark milik user',
      responses: { 200: { description: 'Bookmarks list' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const bmRows = await deps.db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.userId, user.id))
        .orderBy(desc(bookmarks.addedAt));
      const ids = bmRows.map((b) => b.dramaId);
      const dramaRows = ids.length
        ? await deps.db.select().from(dramas).where(inArray(dramas.id, ids))
        : [];
      const hydrated = await hydrateDramas(deps.db, dramaRows);
      const byId = new Map(hydrated.map((d) => [d.id, d]));

      return c.json(
        bmRows.map((b) => ({
          dramaId: b.dramaId,
          addedAt: b.addedAt.toISOString(),
          drama: byId.get(b.dramaId) ?? null,
        })),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/bookmarks/sync',
      tags: ['Viewer'],
      summary: 'Sinkronkan daftar dramaId/slug dari localStorage saat user login',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ dramaIdsOrSlugs: z.array(z.string()).max(200) }),
            },
          },
        },
      },
      responses: { 200: { description: 'Synced bookmark count' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const { dramaIdsOrSlugs } = c.req.valid('json');
      if (dramaIdsOrSlugs.length) {
        const matched = await deps.db
          .select({ id: dramas.id })
          .from(dramas)
          .where(inArray(dramas.slug, dramaIdsOrSlugs));
        if (matched.length) {
          await deps.db
            .insert(bookmarks)
            .values(matched.map((d) => ({ userId: user.id, dramaId: d.id })))
            .onConflictDoNothing();
        }
      }
      const all = await deps.db.select().from(bookmarks).where(eq(bookmarks.userId, user.id));
      return c.json({ count: all.length }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: '/bookmarks/{dramaId}',
      tags: ['Viewer'],
      summary: 'Tambah bookmark drama',
      request: { params: z.object({ dramaId: z.string().uuid() }) },
      responses: { 200: { description: 'Bookmarked' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const { dramaId } = c.req.valid('param');
      await deps.db
        .insert(bookmarks)
        .values({ userId: user.id, dramaId })
        .onConflictDoNothing();
      return c.json({ bookmarked: true }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/bookmarks/{dramaId}',
      tags: ['Viewer'],
      summary: 'Hapus bookmark drama',
      request: { params: z.object({ dramaId: z.string().uuid() }) },
      responses: { 204: { description: 'Removed' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const { dramaId } = c.req.valid('param');
      await deps.db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.dramaId, dramaId)));
      return c.body(null, 204);
    },
  );

  // ── Drama Vote & Score ────────────────────────────────────────────────────
  app.use('/dramas/*/vote', requireAuth());
  app.openapi(
    createRoute({
      method: 'put',
      path: '/dramas/{dramaId}/vote',
      tags: ['Viewer'],
      summary: 'Simpan like/dislike atau skor 1-5 bintang pada WatchComponent',
      request: {
        params: z.object({ dramaId: z.string().uuid() }),
        body: { content: { 'application/json': { schema: DramaVoteSchema } } },
      },
      responses: { 200: { description: 'Vote saved' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const { dramaId } = c.req.valid('param');
      const body = c.req.valid('json');
      await deps.db
        .insert(dramaVotes)
        .values({
          userId: user.id,
          dramaId,
          vote: body.vote ?? null,
          score: body.score ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [dramaVotes.userId, dramaVotes.dramaId],
          set: {
            vote: body.vote !== undefined ? body.vote : undefined,
            score: body.score !== undefined ? body.score : undefined,
            updatedAt: new Date(),
          },
        });
      return c.json({ ok: true }, 200);
    },
  );

  // ── Comments & Replies ────────────────────────────────────────────────────
  app.openapi(
    createRoute({
      method: 'get',
      path: '/dramas/{dramaId}/episodes/{epNumber}/comments',
      tags: ['Comments'],
      summary: 'Ambil daftar komentar & nested replies per episode',
      request: {
        params: z.object({
          dramaId: z.string().uuid(),
          epNumber: z.coerce.number().int().min(1),
        }),
        query: z.object({ sort: z.enum(['new', 'top']).default('new') }),
      },
      responses: { 200: { description: 'Nested comments' } },
    }),
    async (c) => {
      const { dramaId, epNumber } = c.req.valid('param');
      const { sort } = c.req.valid('query');
      const user = c.get('user');

      const rows = await deps.db
        .select()
        .from(episodeComments)
        .where(
          and(
            eq(episodeComments.dramaId, dramaId),
            eq(episodeComments.episodeNumber, epNumber),
            eq(episodeComments.status, 'Tampil'),
          ),
        )
        .orderBy(
          sort === 'top' ? desc(episodeComments.likesCount) : desc(episodeComments.createdAt),
        );

      const likedIds = new Set<string>();
      if (user && rows.length) {
        const likes = await deps.db
          .select({ commentId: commentLikes.commentId })
          .from(commentLikes)
          .where(
            and(
              eq(commentLikes.userId, user.id),
              inArray(
                commentLikes.commentId,
                rows.map((r) => r.id),
              ),
            ),
          );
        for (const l of likes) likedIds.add(l.commentId);
      }

      const repliesByParent = new Map<string, typeof rows>();
      const roots: typeof rows = [];
      for (const r of rows) {
        if (r.parentId) {
          const list = repliesByParent.get(r.parentId) ?? [];
          list.push(r);
          repliesByParent.set(r.parentId, list);
        } else {
          roots.push(r);
        }
      }

      return c.json(
        roots.map((root) => ({
          id: root.id,
          author: root.authorName,
          time: root.createdAt.toISOString(),
          body: root.body,
          likes: root.likesCount,
          likedByMe: likedIds.has(root.id),
          isOwn: Boolean(user && root.userId === user.id),
          adminReply: root.adminReply,
          replies: (repliesByParent.get(root.id) ?? []).reverse().map((rep) => ({
            id: rep.id,
            author: rep.authorName,
            time: rep.createdAt.toISOString(),
            body: rep.body,
            likes: rep.likesCount,
            likedByMe: likedIds.has(rep.id),
            replyTo: rep.replyToAuthor,
            isOwn: Boolean(user && rep.userId === user.id),
          })),
        })),
        200,
      );
    },
  );

  app.use('/dramas/*/episodes/*/comments', async (c, next) => {
    if (c.req.method === 'POST') return requireAuth()(c, next);
    return next();
  });

  app.openapi(
    createRoute({
      method: 'post',
      path: '/dramas/{dramaId}/episodes/{epNumber}/comments',
      tags: ['Comments'],
      summary: 'Kirim komentar baru atau reply',
      request: {
        params: z.object({
          dramaId: z.string().uuid(),
          epNumber: z.coerce.number().int().min(1),
        }),
        body: { content: { 'application/json': { schema: CreateCommentSchema } } },
      },
      responses: { 201: { description: 'Created comment' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const { dramaId, epNumber } = c.req.valid('param');
      const body = c.req.valid('json');
      const settings = await getSiteSettings(deps.db);
      const looksSpam =
        settings.autoModerateComments && /(http:\/\/|https:\/\/|togel|slot\d*)/i.test(body.body);

      const [created] = await deps.db
        .insert(episodeComments)
        .values({
          dramaId,
          episodeNumber: epNumber,
          parentId: body.parentId ?? null,
          userId: user.id,
          authorName: user.name,
          replyToAuthor: body.replyToAuthor ?? null,
          body: body.body,
          flagReason: looksSpam ? 'Spam/Promosi' : 'Normal',
          status: looksSpam ? 'Ditinjau' : 'Tampil',
        })
        .returning();

      return c.json(created, 201);
    },
  );

  app.use('/comments/*/like', requireAuth());
  app.openapi(
    createRoute({
      method: 'post',
      path: '/comments/{commentId}/like',
      tags: ['Comments'],
      summary: 'Toggle like komentar',
      request: { params: z.object({ commentId: z.string().uuid() }) },
      responses: { 200: { description: 'Like toggled' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const { commentId } = c.req.valid('param');
      const [existing] = await deps.db
        .select()
        .from(commentLikes)
        .where(and(eq(commentLikes.userId, user.id), eq(commentLikes.commentId, commentId)))
        .limit(1);

      if (existing) {
        await deps.db
          .delete(commentLikes)
          .where(and(eq(commentLikes.userId, user.id), eq(commentLikes.commentId, commentId)));
        const [updated] = await deps.db
          .update(episodeComments)
          .set({ likesCount: sql`GREATEST(0, ${episodeComments.likesCount} - 1)` })
          .where(eq(episodeComments.id, commentId))
          .returning({ likesCount: episodeComments.likesCount });
        return c.json({ liked: false, likes: updated?.likesCount ?? 0 }, 200);
      }

      await deps.db.insert(commentLikes).values({ userId: user.id, commentId });
      const [updated] = await deps.db
        .update(episodeComments)
        .set({ likesCount: sql`${episodeComments.likesCount} + 1` })
        .where(eq(episodeComments.id, commentId))
        .returning({ likesCount: episodeComments.likesCount });
      return c.json({ liked: true, likes: updated?.likesCount ?? 1 }, 200);
    },
  );

  // ── Drama Requests & Contact/DMCA Tickets ─────────────────────────────────
  app.openapi(
    createRoute({
      method: 'get',
      path: '/requests',
      tags: ['Requests'],
      summary: 'Daftar request drama penonton',
      responses: { 200: { description: 'Drama requests list' } },
    }),
    async (c) => {
      const rows = await deps.db
        .select()
        .from(dramaRequests)
        .orderBy(desc(dramaRequests.votesCount), desc(dramaRequests.createdAt));
      return c.json(rows, 200);
    },
  );

  app.use('/requests', async (c, next) => {
    if (c.req.method === 'POST') return requireAuth()(c, next);
    return next();
  });

  app.openapi(
    createRoute({
      method: 'post',
      path: '/requests',
      tags: ['Requests'],
      summary: 'Kirim request drama baru',
      request: { body: { content: { 'application/json': { schema: CreateDramaRequestSchema } } } },
      responses: { 201: { description: 'Created drama request' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      const [created] = await deps.db
        .insert(dramaRequests)
        .values({
          title: body.title,
          platformName: body.platformName,
          lang: body.lang,
          episodeCount: body.episodeCount ?? null,
          note: body.note,
          requesterUserId: user.id,
          requesterEmail: user.email,
        })
        .returning();
      return c.json(created, 201);
    },
  );

  app.use('/requests/*/vote', requireAuth());
  app.openapi(
    createRoute({
      method: 'post',
      path: '/requests/{requestId}/vote',
      tags: ['Requests'],
      summary: 'Toggle upvote pada request drama',
      request: { params: z.object({ requestId: z.string().uuid() }) },
      responses: { 200: { description: 'Vote toggled' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const { requestId } = c.req.valid('param');
      const [existing] = await deps.db
        .select()
        .from(dramaRequestVotes)
        .where(and(eq(dramaRequestVotes.userId, user.id), eq(dramaRequestVotes.requestId, requestId)))
        .limit(1);

      if (existing) {
        await deps.db
          .delete(dramaRequestVotes)
          .where(
            and(eq(dramaRequestVotes.userId, user.id), eq(dramaRequestVotes.requestId, requestId)),
          );
        const [updated] = await deps.db
          .update(dramaRequests)
          .set({ votesCount: sql`GREATEST(0, ${dramaRequests.votesCount} - 1)` })
          .where(eq(dramaRequests.id, requestId))
          .returning({ votesCount: dramaRequests.votesCount });
        return c.json({ voted: false, votes: updated?.votesCount ?? 0 }, 200);
      }

      await deps.db.insert(dramaRequestVotes).values({ userId: user.id, requestId });
      const [updated] = await deps.db
        .update(dramaRequests)
        .set({ votesCount: sql`${dramaRequests.votesCount} + 1` })
        .where(eq(dramaRequests.id, requestId))
        .returning({ votesCount: dramaRequests.votesCount });
      return c.json({ voted: true, votes: updated?.votesCount ?? 1 }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/tickets',
      tags: ['Support'],
      summary: 'Kirim laporan Contact / DMCA (tersimpan ke moderasi tiket CMS)',
      request: { body: { content: { 'application/json': { schema: ContactTicketSubmitSchema } } } },
      responses: {
        201: { description: 'Ticket created' },
        429: { description: 'Too many submissions' },
      },
    }),
    async (c) => {
      const guestKey = c.get('guestKey');
      const attempts = await deps.kv.incrWithTtl(`ticket_rl:${guestKey}`, 600);
      if (attempts > 5) {
        return c.json(
          { code: 'RATE_LIMITED', message: 'Terlalu banyak laporan dalam waktu singkat.' },
          429,
        );
      }

      const body = c.req.valid('json');
      const prefix =
        body.category === 'copyright'
          ? 'DMCA'
          : body.category === 'metadata'
            ? 'META'
            : body.category === 'bug'
              ? 'BUG'
              : 'SUP';
      const ticketCode = `${prefix}-${Math.floor(100 + Math.random() * 899)}-${Date.now().toString().slice(-3)}`;

      const [created] = await deps.db
        .insert(dmcaTickets)
        .values({
          ticketCode,
          target: body.subject,
          senderEmail: body.email,
          senderName: body.name,
          category: body.category,
          type: body.subject,
          message: body.message,
          priority: body.category === 'copyright' ? 'Tinggi' : 'Normal',
          evidenceUrl: body.evidenceUrl ?? null,
          status: 'Terbuka',
        })
        .returning();

      return c.json(created, 201);
    },
  );

  return app;
}
