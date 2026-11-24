import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq, isNull, like, or } from 'drizzle-orm';
import { DEFAULT_ROLE_PERMISSIONS, type CmsRole, type CmsPermission } from '@tiraiplay/shared';

for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}
import { createDb } from './client.js';
import {
  rolePermissions,
  siteSettings,
  subscriptionPlans,
  platforms,
  genres,
  dramas,
  dramaGenres,
  episodes,
  episodeStreams,
  scheduleSlots,
} from './schema.js';
import { GENRES } from '../../../src/app/data/genres.js';
import { PLATFORMS } from '../../../src/app/data/platforms.js';
import { DRAMAS } from '../../../src/app/data/dramas.js';
import { SCHEDULE_SLOTS } from '../../../src/app/data/schedule.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://tiraiplay:tiraiplay@localhost:5432/tiraiplay';

async function seed() {
  const db = createDb(DATABASE_URL);
  console.log('Seeding TiraiPlay database...');

  // 1. RBAC Matrix
  const rbacRows: Array<{ role: CmsRole; permission: CmsPermission; enabled: boolean }> = [];
  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS) as Array<
    [CmsRole, Record<CmsPermission, boolean>]
  >) {
    for (const [permission, enabled] of Object.entries(perms) as Array<[CmsPermission, boolean]>) {
      rbacRows.push({ role, permission, enabled });
    }
  }
  await db.insert(rolePermissions).values(rbacRows).onConflictDoNothing();

  // 2. Site Settings
  await db
    .insert(siteSettings)
    .values({
      id: 'default',
      siteAnnouncement:
        'Selamat datang di TiraiPlay — Katalog Drama Pendek Tiongkok Tema Tirai Bambu!',
      maintenanceMode: false,
      defaultVideoLang: 'id',
      defaultQuality: '1080p',
      autoModerateComments: true,
      playerWatermark: true,
      supportEmail: 'support@tiraiplay.example',
      dmcaEmail: 'legal@tiraiplay.example',
      cdnBaseUrl: 'https://cdn.tiraiplay.example/streams',
      freeDailyEpisodeLimit: 10,
      guestDailyEpisodeLimit: 3,
    })
    .onConflictDoNothing();

  // 3. Subscription Plans
  await db
    .insert(subscriptionPlans)
    .values([
      {
        id: 'vip-monthly',
        name: 'VIP Bulanan',
        priceIdr: 29000,
        durationDays: 30,
        features: [
          'Nonton semua episode tanpa batas kuota harian',
          'Kualitas Full HD 1080p & multi-bahasa ID/EN',
          'Bebas iklan & akses cepat rilis terbaru',
        ],
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  // 4. Platforms & Genres
  await db.insert(platforms).values(PLATFORMS).onConflictDoNothing();
  await db.insert(genres).values(GENRES).onConflictDoNothing();

  const platformNameToId = new Map(PLATFORMS.map((p) => [p.name.toLowerCase(), p.id]));
  const genreNameToId = new Map(GENRES.map((g) => [g.name.toLowerCase(), g.id]));
  const slugToDramaId = new Map<string, string>();

  // 5. Dramas + initial Episode 1..min(5, latestEpisode) demo streams
  for (const d of DRAMAS) {
    const platformId = platformNameToId.get(d.platformId.toLowerCase()) ?? PLATFORMS[0].id;
    const [inserted] = await db
      .insert(dramas)
      .values({
        slug: d.slug,
        title: d.title,
        originalTitle: d.originalTitle ?? null,
        alternateTitles: d.alternateTitles ?? [],
        synopsis: d.synopsis,
        description: d.description ?? null,
        posterUrl: d.posterUrl ?? null,
        backdropUrl: d.backdropUrl ?? null,
        platformId,
        releaseYear: d.releaseYear ?? null,
        releaseDate: d.releaseDate ?? null,
        totalEpisodes: d.totalEpisodes ?? 1,
        latestEpisode: d.latestEpisode ?? 1,
        status: d.status,
        subtitleLanguages: d.subtitleLanguages,
        videoLanguages: d.videoLanguages,
        rating: d.rating ?? 8.0,
        ratingSource: d.ratingSource ?? null,
        ratingIsDemo: d.ratingIsDemo,
        durationMinutes: d.durationMinutes ?? 1,
        country: d.country ?? 'China',
        productionStudio: d.productionStudio ?? null,
        ageRating: d.ageRating ?? '13+',
        trailerUrl: d.trailerUrl ?? null,
        cast: d.cast ?? [],
        director: d.director ?? null,
        tags: d.tags ?? [],
        featured: d.featured,
        trendingScore: d.trendingScore ?? 0,
        tone: d.tone,
        dataSource: d.dataSource ?? null,
        isDemoData: d.isDemoData,
      })
      .onConflictDoNothing({ target: dramas.slug })
      .returning({ id: dramas.id, slug: dramas.slug });

    if (!inserted) continue;
    slugToDramaId.set(inserted.slug, inserted.id);

    const gRows = d.genres
      .map((name) => genreNameToId.get(name.toLowerCase()))
      .filter((gid): gid is string => Boolean(gid))
      .map((genreId) => ({ dramaId: inserted.id, genreId }));
    if (gRows.length) {
      await db.insert(dramaGenres).values(gRows).onConflictDoNothing();
    }

    const total = Math.max(1, d.totalEpisodes ?? 1);
    const published = Math.min(total, d.latestEpisode ?? total);
    const epCountToSeed = Math.min(total, 15);
    for (let epNum = 1; epNum <= epCountToSeed; epNum++) {
      const [ep] = await db
        .insert(episodes)
        .values({
          dramaId: inserted.id,
          number: epNum,
          title: `Episode ${epNum}`,
          durationMinutes: d.durationMinutes ?? 1,
          airDate: d.releaseDate ?? null,
          status: epNum <= published ? 'Tayang' : 'Draft',
        })
        .onConflictDoNothing()
        .returning({ id: episodes.id });

      if (ep) {
        const prefix = d.slug.slice(0, 14);
        await db
          .insert(episodeStreams)
          .values(
            d.videoLanguages.map((lang) => ({
              episodeId: ep.id,
              videoLang: lang,
              streamUrl: `https://cdn.tiraiplay.example/streams/${prefix}-ep${epNum}-${lang}.m3u8`,
              subtitleUrl: `https://cdn.tiraiplay.example/subs/${prefix}-ep${epNum}-${lang}.vtt`,
            })),
          )
          .onConflictDoNothing();
      }
    }
  }

  // 6. Schedule slots
  for (const slot of SCHEDULE_SLOTS) {
    const dramaId = slugToDramaId.get(slot.dramaSlug);
    if (!dramaId) continue;
    await db.insert(scheduleSlots).values({
      dramaId,
      dayOfWeek: slot.day,
      timeWib: slot.time.replace(' WIB', ''),
      episodeNumber: slot.episodeNumber,
      status: 'Terjadwal',
      isDemo: true,
    });
  }

  // 7. Sync missing or old SVG artwork URLs from DRAMAS fixture
  const fixtureBySlug = new Map(DRAMAS.map((d) => [d.slug, d]));
  const rowsNeedingUrls = await db
    .select({
      id: dramas.id,
      slug: dramas.slug,
      posterUrl: dramas.posterUrl,
      backdropUrl: dramas.backdropUrl,
    })
    .from(dramas)
    .where(
      or(
        isNull(dramas.posterUrl),
        isNull(dramas.backdropUrl),
        like(dramas.posterUrl, '/api/artwork/%'),
        like(dramas.backdropUrl, '/api/artwork/%'),
      ),
    );

  let updatedArtCount = 0;
  for (const row of rowsNeedingUrls) {
    const fixture = fixtureBySlug.get(row.slug);
    if (!fixture?.posterUrl && !fixture?.backdropUrl) continue;
    await db
      .update(dramas)
      .set({
        posterUrl: fixture.posterUrl ?? row.posterUrl,
        backdropUrl: fixture.backdropUrl ?? fixture.posterUrl ?? row.backdropUrl,
        updatedAt: new Date(),
      })
      .where(eq(dramas.id, row.id));
    updatedArtCount++;
  }

  console.log(
    `Seeded ${PLATFORMS.length} platforms, ${GENRES.length} genres, ${slugToDramaId.size} new dramas, updated ${updatedArtCount} image URLs.`,
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
