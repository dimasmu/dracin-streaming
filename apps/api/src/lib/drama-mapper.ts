import {
  dramaGenres,
  genres,
  inArray,
  platforms,
  type Database,
} from '@tiraiplay/db';
import type { DramaDto } from '@tiraiplay/shared';

type DramaRow = typeof import('@tiraiplay/db').dramas.$inferSelect;

/**
 * Hydrates DB drama rows into DramaDto objects matching the Angular Drama
 * interface (platformId resolved to display name, genres resolved to name[]).
 */
export async function hydrateDramas(db: Database, rows: DramaRow[]): Promise<DramaDto[]> {
  if (!rows.length) return [];

  const dramaIds = rows.map((r) => r.id);
  const platformIds = [...new Set(rows.map((r) => r.platformId))];

  const [platRows, dgRows, genreRows] = await Promise.all([
    db.select().from(platforms).where(inArray(platforms.id, platformIds)),
    db.select().from(dramaGenres).where(inArray(dramaGenres.dramaId, dramaIds)),
    db.select().from(genres),
  ]);

  const platNameMap = new Map(platRows.map((p) => [p.id, p.name]));
  const genreNameMap = new Map(genreRows.map((g) => [g.id, g.name]));
  const genresByDrama = new Map<string, string[]>();

  for (const dg of dgRows) {
    const name = genreNameMap.get(dg.genreId);
    if (!name) continue;
    const list = genresByDrama.get(dg.dramaId) ?? [];
    list.push(name);
    genresByDrama.set(dg.dramaId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    originalTitle: r.originalTitle,
    alternateTitles: r.alternateTitles ?? [],
    synopsis: r.synopsis,
    description: r.description,
    posterUrl: r.posterUrl,
    backdropUrl: r.backdropUrl,
    genres: genresByDrama.get(r.id) ?? [],
    platformId: platNameMap.get(r.platformId) ?? r.platformId,
    releaseYear: r.releaseYear,
    releaseDate: r.releaseDate,
    totalEpisodes: r.totalEpisodes,
    latestEpisode: r.latestEpisode,
    status: r.status,
    subtitleLanguages: r.subtitleLanguages ?? [],
    videoLanguages: r.videoLanguages ?? ['id'],
    rating: r.rating,
    ratingSource: r.ratingSource,
    ratingIsDemo: r.ratingIsDemo,
    durationMinutes: r.durationMinutes,
    country: r.country,
    productionStudio: r.productionStudio,
    ageRating: r.ageRating,
    trailerUrl: r.trailerUrl,
    cast: r.cast ?? [],
    director: r.director,
    tags: r.tags ?? [],
    featured: r.featured,
    trendingScore: r.trendingScore,
    addedAt: r.addedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    dataSource: r.dataSource,
    isDemoData: r.isDemoData,
    tone: r.tone,
  }));
}
