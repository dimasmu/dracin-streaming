import { z } from 'zod';

export const DramaStatusSchema = z.enum(['ongoing', 'completed', 'upcoming', 'unknown']);
export type DramaStatus = z.infer<typeof DramaStatusSchema>;

export const VideoLangSchema = z.enum(['id', 'en']);
export type VideoLang = z.infer<typeof VideoLangSchema>;

export const EpisodeStatusSchema = z.enum(['Tayang', 'Draft']);
export type EpisodeStatus = z.infer<typeof EpisodeStatusSchema>;

export const SortKeySchema = z.enum(['popular', 'new', 'rating', 'az', 'full']);
export type SortKey = z.infer<typeof SortKeySchema>;

export const DramaDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  originalTitle: z.string().nullable().optional(),
  alternateTitles: z.array(z.string()).default([]),
  synopsis: z.string(),
  description: z.string().nullable().optional(),
  posterUrl: z.string().nullable().optional(),
  backdropUrl: z.string().nullable().optional(),
  genres: z.array(z.string()),
  platformId: z.string(),
  releaseYear: z.number().int().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  totalEpisodes: z.number().int().min(1),
  latestEpisode: z.number().int().min(0),
  status: DramaStatusSchema,
  subtitleLanguages: z.array(z.string()),
  videoLanguages: z.array(VideoLangSchema),
  rating: z.number(),
  ratingSource: z.string().nullable().optional(),
  ratingIsDemo: z.boolean(),
  durationMinutes: z.number().int().min(1),
  country: z.string().nullable().optional(),
  productionStudio: z.string().nullable().optional(),
  ageRating: z.string().nullable().optional(),
  trailerUrl: z.string().nullable().optional(),
  cast: z.array(z.string()).default([]),
  director: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  featured: z.boolean(),
  trendingScore: z.number().int(),
  addedAt: z.string(),
  updatedAt: z.string(),
  dataSource: z.string().nullable().optional(),
  isDemoData: z.boolean(),
  tone: z.string(),
});
export type DramaDto = z.infer<typeof DramaDtoSchema>;

export const DramaGenreDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tone: z.string(),
  count: z.number().int().optional(),
});
export type DramaGenreDto = z.infer<typeof DramaGenreDtoSchema>;

export const DramaPlatformDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tone: z.string(),
  count: z.number().int().optional(),
});
export type DramaPlatformDto = z.infer<typeof DramaPlatformDtoSchema>;

export const DramaFilterQuerySchema = z.object({
  query: z.string().optional(),
  genres: z.string().optional(),
  platforms: z.string().optional(),
  years: z.string().optional(),
  subtitleLanguages: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: SortKeySchema.optional().default('popular'),
  featured: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
});

export const UpsertDramaSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  originalTitle: z.string().trim().nullable().optional(),
  alternateTitles: z.array(z.string().trim()).optional().default([]),
  synopsis: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  posterUrl: z.string().trim().nullable().optional(),
  backdropUrl: z.string().trim().nullable().optional(),
  genres: z.array(z.string().trim().min(1)).min(1),
  platformId: z.string().trim().min(1),
  releaseYear: z.number().int().min(1900).max(2100).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  totalEpisodes: z.number().int().min(1).max(1000).default(1),
  latestEpisode: z.number().int().min(0).max(1000).default(1),
  status: DramaStatusSchema.default('ongoing'),
  subtitleLanguages: z.array(z.string().trim().min(1)).min(1).default(['ID']),
  videoLanguages: z.array(VideoLangSchema).min(1).default(['id']),
  rating: z.number().min(0).max(10).default(8.0),
  durationMinutes: z.number().int().min(1).max(240).default(1),
  country: z.string().trim().nullable().optional(),
  productionStudio: z.string().trim().nullable().optional(),
  ageRating: z.string().trim().nullable().optional(),
  trailerUrl: z.string().trim().nullable().optional(),
  cast: z.array(z.string().trim()).optional().default([]),
  director: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim()).optional().default([]),
  featured: z.boolean().default(false),
  trendingScore: z.number().int().min(0).default(0),
  tone: z.string().trim().default('oklch(68% .16 155)'),
  initialStreamUrl: z.string().trim().optional(),
});

export const BulkDramaActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(['featured', 'completed', 'delete']),
});
