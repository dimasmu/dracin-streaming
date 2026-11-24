import { z } from 'zod';
import { VideoLangSchema } from './drama.js';

export const CmsRoleSchema = z.enum(['admin', 'editor', 'user']);
export type CmsRole = z.infer<typeof CmsRoleSchema>;

export const CMS_PERMISSION_KEYS = [
  'viewAdmin',
  'createDrama',
  'editDrama',
  'deleteDrama',
  'editEpisodes',
  'editTaxonomy',
  'moderateRequests',
  'manageUsers',
  'manageSettings',
] as const;

export const CmsPermissionSchema = z.enum(CMS_PERMISSION_KEYS);
export type CmsPermission = z.infer<typeof CmsPermissionSchema>;

export type CmsRolePermissions = Record<CmsPermission, boolean>;

export const DEFAULT_ROLE_PERMISSIONS: Record<CmsRole, CmsRolePermissions> = {
  admin: {
    viewAdmin: true,
    createDrama: true,
    editDrama: true,
    deleteDrama: true,
    editEpisodes: true,
    editTaxonomy: true,
    moderateRequests: true,
    manageUsers: true,
    manageSettings: true,
  },
  editor: {
    viewAdmin: true,
    createDrama: true,
    editDrama: true,
    deleteDrama: false,
    editEpisodes: true,
    editTaxonomy: true,
    moderateRequests: true,
    manageUsers: false,
    manageSettings: false,
  },
  user: {
    viewAdmin: false,
    createDrama: false,
    editDrama: false,
    deleteDrama: false,
    editEpisodes: false,
    editTaxonomy: false,
    moderateRequests: false,
    manageUsers: false,
    manageSettings: false,
  },
};

export const UserStatusSchema = z.enum(['Aktif', 'Ditangguhkan', 'Menunggu Verifikasi']);
export const ScheduleSlotStatusSchema = z.enum(['Terjadwal', 'Tayang', 'Ditunda']);
export const PrioritySchema = z.enum(['Tinggi', 'Normal', 'Rendah']);
export const RequestStatusSchema = z.enum(['Ditinjau', 'Terjadwal', 'Tersedia', 'Ditolak']);
export const CommentFlagSchema = z.enum(['Normal', 'Spoiler', 'Spam/Promosi', 'Kata Kasar']);
export const CommentStatusSchema = z.enum(['Tampil', 'Ditinjau', 'Disembunyikan']);
export const TicketStatusSchema = z.enum(['Terbuka', 'Diproses', 'Selesai', 'Ditolak']);

export const ScheduleDayNameSchema = z.enum([
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
]);

export const DAY_NAME_TO_NUMBER: Record<z.infer<typeof ScheduleDayNameSchema>, number> = {
  Minggu: 0,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
};

export const UpsertScheduleSlotSchema = z.object({
  dramaId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  timeWib: z.string().trim().min(1),
  episodeNumber: z.number().int().min(1),
  note: z.string().trim().nullable().optional(),
  status: ScheduleSlotStatusSchema.default('Terjadwal'),
});

export const CreateCommentSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  parentId: z.string().uuid().nullable().optional(),
  replyToAuthor: z.string().trim().nullable().optional(),
});

export const UpdateCommentModerationSchema = z.object({
  body: z.string().trim().min(1).max(1000).optional(),
  status: CommentStatusSchema.optional(),
  flagReason: CommentFlagSchema.optional(),
  adminReply: z.string().trim().nullable().optional(),
});

export const CreateDramaRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  platformName: z.string().trim().min(1).max(80),
  lang: z.enum(['ID', 'EN']).default('ID'),
  episodeCount: z.number().int().min(1).max(1000).optional(),
  note: z.string().trim().max(1000).optional().default(''),
});

export const UpdateDramaRequestSchema = z.object({
  title: z.string().trim().min(1).optional(),
  platformName: z.string().trim().min(1).optional(),
  lang: z.enum(['ID', 'EN']).optional(),
  priority: PrioritySchema.optional(),
  status: RequestStatusSchema.optional(),
  episodeCount: z.number().int().min(1).optional(),
  note: z.string().trim().optional(),
});

export const ContactTicketSubmitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  subject: z.string().trim().min(1).max(200),
  category: z.enum(['metadata', 'bug', 'request', 'copyright', 'feedback', 'other']),
  message: z.string().trim().max(3000).optional().default(''),
  evidenceUrl: z.string().trim().url().nullable().optional(),
});

export const UpsertTicketSchema = z.object({
  target: z.string().trim().min(1),
  senderEmail: z.string().trim().email(),
  senderName: z.string().trim().nullable().optional(),
  category: z.string().trim().default('copyright'),
  type: z.string().trim().min(1),
  message: z.string().trim().nullable().optional(),
  priority: PrioritySchema.default('Normal'),
  status: TicketStatusSchema.default('Terbuka'),
  evidenceUrl: z.string().trim().nullable().optional(),
  resolutionNote: z.string().trim().nullable().optional(),
});

export const UpsertTaxonomySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().optional().default(''),
  tone: z.string().trim().default('oklch(68% .16 155)'),
});

export const UpsertAdminUserSchema = z.object({
  name: z.string().trim().min(1),
  username: z.string().trim().min(2).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).optional(),
  role: CmsRoleSchema.default('editor'),
  department: z.string().trim().default('Tim Editorial & Sub'),
  phone: z.string().trim().nullable().optional(),
  twoFactorEnabled: z.boolean().default(false),
  status: UserStatusSchema.default('Aktif'),
  notes: z.string().trim().nullable().optional(),
});

export const UpdateRbacMatrixSchema = z.object({
  resetDefault: z.boolean().optional(),
  matrix: z
    .record(CmsRoleSchema, z.record(CmsPermissionSchema, z.boolean()))
    .optional(),
});

export const SiteSettingsSchema = z.object({
  siteAnnouncement: z.string().trim().min(1),
  maintenanceMode: z.boolean(),
  defaultVideoLang: VideoLangSchema,
  defaultQuality: z.enum(['1080p', '720p']),
  autoModerateComments: z.boolean(),
  playerWatermark: z.boolean(),
  supportEmail: z.string().trim().email(),
  dmcaEmail: z.string().trim().email(),
  cdnBaseUrl: z.string().trim().url(),
  freeDailyEpisodeLimit: z.number().int().min(1).max(500),
  guestDailyEpisodeLimit: z.number().int().min(0).max(50),
});

export const PresignUploadSchema = z.object({
  kind: z.enum(['poster', 'backdrop', 'subtitle']),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
});
