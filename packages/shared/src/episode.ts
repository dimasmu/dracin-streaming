import { z } from 'zod';
import { EpisodeStatusSchema, VideoLangSchema } from './drama.js';

export const EpisodePublicMetaSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().min(1),
  title: z.string(),
  durationMinutes: z.number().int().min(1),
  airDate: z.string().nullable(),
  status: EpisodeStatusSchema,
  availableVideoLangs: z.array(VideoLangSchema),
  unlockedToday: z.boolean().default(false),
});
export type EpisodePublicMeta = z.infer<typeof EpisodePublicMetaSchema>;

export const CmsEpisodeItemSchema = z.object({
  id: z.string().uuid().optional(),
  number: z.number().int().min(1),
  title: z.string().trim().min(1),
  durationMinutes: z.number().int().min(1).default(1),
  airDate: z.string().nullable().optional(),
  videoLang: VideoLangSchema.default('id'),
  streamUrl: z.string().trim().url(),
  subtitleUrl: z.string().trim().url().nullable().optional(),
  status: EpisodeStatusSchema.default('Tayang'),
});
export type CmsEpisodeItemDto = z.infer<typeof CmsEpisodeItemSchema>;

export const QuotaTierSchema = z.enum(['guest', 'free', 'vip']);
export type QuotaTier = z.infer<typeof QuotaTierSchema>;

export const QuotaInfoSchema = z.object({
  tier: QuotaTierSchema,
  unlimited: z.boolean(),
  usedToday: z.number().int().min(0),
  dailyLimit: z.number().int().min(0).nullable(),
  remainingToday: z.number().int().min(0).nullable(),
  resetAtWib: z.string(),
});
export type QuotaInfo = z.infer<typeof QuotaInfoSchema>;

export const PlayEpisodeRequestSchema = z.object({
  videoLang: VideoLangSchema.default('id'),
});

export const PlayEpisodeResponseSchema = z.object({
  episodeId: z.string().uuid(),
  dramaId: z.string().uuid(),
  number: z.number().int().min(1),
  videoLang: VideoLangSchema,
  streamProxyUrl: z.string(),
  subtitleProxyUrl: z.string().nullable(),
  expiresAt: z.string(),
  quota: QuotaInfoSchema,
});
export type PlayEpisodeResponse = z.infer<typeof PlayEpisodeResponseSchema>;

export const ViewEventSchema = z.object({
  dramaId: z.string().uuid(),
  episodeNumber: z.number().int().min(1),
  watchSeconds: z.number().int().min(0).max(36000),
  completed: z.boolean().default(false),
});
