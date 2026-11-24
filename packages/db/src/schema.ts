import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  real,
  timestamp,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ── Enums (1:1 dengan Angular models & CmsService) ──────────────────────────
export const dramaStatusEnum = pgEnum('drama_status', [
  'ongoing',
  'completed',
  'upcoming',
  'unknown',
]);

export const videoLangEnum = pgEnum('video_lang', ['id', 'en']);

export const episodeStatusEnum = pgEnum('episode_status', ['Tayang', 'Draft']);

export const cmsRoleEnum = pgEnum('cms_role', ['admin', 'editor', 'user']);

export const userStatusEnum = pgEnum('user_status', [
  'Aktif',
  'Ditangguhkan',
  'Menunggu Verifikasi',
]);

export const scheduleSlotStatusEnum = pgEnum('schedule_slot_status', [
  'Terjadwal',
  'Tayang',
  'Ditunda',
]);

export const priorityEnum = pgEnum('priority_level', ['Tinggi', 'Normal', 'Rendah']);

export const requestStatusEnum = pgEnum('request_status', [
  'Ditinjau',
  'Terjadwal',
  'Tersedia',
  'Ditolak',
]);

export const commentFlagEnum = pgEnum('comment_flag_reason', [
  'Normal',
  'Spoiler',
  'Spam/Promosi',
  'Kata Kasar',
]);

export const commentStatusEnum = pgEnum('comment_status', [
  'Tampil',
  'Ditinjau',
  'Disembunyikan',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'Terbuka',
  'Diproses',
  'Selesai',
  'Ditolak',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'expired',
  'cancelled',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'expired',
]);

// ── 1. Auth, Users & RBAC (Better Auth compatible + CmsUserAccount) ─────────
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    username: text('username').notNull().default(''),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: cmsRoleEnum('role').notNull().default('user'),
    department: text('department').notNull().default('Komunitas Penonton'),
    phone: text('phone'),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    status: userStatusEnum('status').notNull().default('Aktif'),
    notes: text('notes'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_uidx').on(t.email),
    index('users_username_idx').on(t.username),
    index('users_role_status_idx').on(t.role, t.status),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sessions_token_uidx').on(t.token), index('sessions_user_idx').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
);

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const twoFactors = pgTable(
  'two_factors',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: boolean('verified').default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
  },
  (t) => [index('two_factors_user_idx').on(t.userId)],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    role: cmsRoleEnum('role').notNull(),
    permission: text('permission').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.role, t.permission] })],
);

// ── 2. Taxonomy (Platforms & Genres) ────────────────────────────────────────
export const platforms = pgTable(
  'platforms',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    tone: text('tone').notNull().default('oklch(68% .16 155)'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('platforms_name_uidx').on(t.name)],
);

export const genres = pgTable(
  'genres',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    tone: text('tone').notNull().default('oklch(68% .16 155)'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('genres_name_uidx').on(t.name)],
);

// ── 3. Dramas, Episodes & Streams ───────────────────────────────────────────
export const dramas = pgTable(
  'dramas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    originalTitle: text('original_title'),
    alternateTitles: text('alternate_titles').array().notNull().default([]),
    synopsis: text('synopsis').notNull(),
    description: text('description'),
    posterUrl: text('poster_url'),
    backdropUrl: text('backdrop_url'),
    platformId: text('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    releaseYear: integer('release_year'),
    releaseDate: date('release_date'),
    totalEpisodes: integer('total_episodes').notNull().default(1),
    latestEpisode: integer('latest_episode').notNull().default(1),
    status: dramaStatusEnum('status').notNull().default('ongoing'),
    subtitleLanguages: text('subtitle_languages').array().notNull().default(['ID']),
    videoLanguages: videoLangEnum('video_languages').array().notNull().default(['id']),
    rating: real('rating').notNull().default(8.0),
    ratingSource: text('rating_source'),
    ratingIsDemo: boolean('rating_is_demo').notNull().default(false),
    durationMinutes: integer('duration_minutes').notNull().default(1),
    country: text('country').default('China'),
    productionStudio: text('production_studio'),
    ageRating: text('age_rating').default('13+'),
    trailerUrl: text('trailer_url'),
    cast: text('cast').array().notNull().default([]),
    director: text('director'),
    tags: text('tags').array().notNull().default([]),
    featured: boolean('featured').notNull().default(false),
    trendingScore: integer('trending_score').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    likeCount: integer('like_count').notNull().default(0),
    tone: text('tone').notNull().default('oklch(68% .16 155)'),
    dataSource: text('data_source'),
    isDemoData: boolean('is_demo_data').notNull().default(false),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('dramas_slug_uidx').on(t.slug),
    index('dramas_platform_idx').on(t.platformId),
    index('dramas_status_featured_idx').on(t.status, t.featured),
    index('dramas_trending_idx').on(t.trendingScore),
    index('dramas_release_year_idx').on(t.releaseYear),
  ],
);

export const dramaGenres = pgTable(
  'drama_genres',
  {
    dramaId: uuid('drama_id')
      .notNull()
      .references(() => dramas.id, { onDelete: 'cascade' }),
    genreId: text('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.dramaId, t.genreId] }), index('dg_genre_idx').on(t.genreId)],
);

export const episodes = pgTable(
  'episodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dramaId: uuid('drama_id')
      .notNull()
      .references(() => dramas.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(1),
    airDate: date('air_date'),
    status: episodeStatusEnum('status').notNull().default('Tayang'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('episodes_drama_num_uidx').on(t.dramaId, t.number),
    index('episodes_drama_status_idx').on(t.dramaId, t.status),
  ],
);

export const episodeStreams = pgTable(
  'episode_streams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    videoLang: videoLangEnum('video_lang').notNull(),
    streamUrl: text('stream_url').notNull(),
    subtitleUrl: text('subtitle_url'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ep_streams_ep_lang_uidx').on(t.episodeId, t.videoLang)],
);

// ── 4. Release Schedule ─────────────────────────────────────────────────────
export const scheduleSlots = pgTable(
  'schedule_slots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dramaId: uuid('drama_id')
      .notNull()
      .references(() => dramas.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    timeWib: text('time_wib').notNull(),
    episodeNumber: integer('episode_number').notNull(),
    note: text('note'),
    status: scheduleSlotStatusEnum('status').notNull().default('Terjadwal'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('schedule_day_idx').on(t.dayOfWeek, t.timeWib)],
);

// ── 5. Viewer Interactions & Moderation ─────────────────────────────────────
export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dramaId: uuid('drama_id')
      .notNull()
      .references(() => dramas.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dramaId] })],
);

export const dramaVotes = pgTable(
  'drama_votes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dramaId: uuid('drama_id')
      .notNull()
      .references(() => dramas.id, { onDelete: 'cascade' }),
    vote: text('vote'),
    score: integer('score'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dramaId] })],
);

export const episodeComments = pgTable(
  'episode_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dramaId: uuid('drama_id')
      .notNull()
      .references(() => dramas.id, { onDelete: 'cascade' }),
    episodeNumber: integer('episode_number').notNull(),
    parentId: uuid('parent_id'),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    replyToAuthor: text('reply_to_author'),
    body: text('body').notNull(),
    flagReason: commentFlagEnum('flag_reason').notNull().default('Normal'),
    likesCount: integer('likes_count').notNull().default(0),
    adminReply: text('admin_reply'),
    status: commentStatusEnum('status').notNull().default('Tampil'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('comments_drama_ep_idx').on(t.dramaId, t.episodeNumber, t.status),
    index('comments_parent_idx').on(t.parentId),
  ],
);

export const commentLikes = pgTable(
  'comment_likes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => episodeComments.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] })],
);

export const dramaRequests = pgTable(
  'drama_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    platformName: text('platform_name').notNull(),
    lang: text('lang').notNull().default('ID'),
    requesterUserId: text('requester_user_id').references(() => users.id, { onDelete: 'set null' }),
    requesterEmail: text('requester_email').notNull(),
    priority: priorityEnum('priority').notNull().default('Normal'),
    episodeCount: integer('episode_count'),
    note: text('note').notNull().default(''),
    status: requestStatusEnum('status').notNull().default('Ditinjau'),
    votesCount: integer('votes_count').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('requests_status_votes_idx').on(t.status, t.votesCount)],
);

export const dramaRequestVotes = pgTable(
  'drama_request_votes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestId: uuid('request_id')
      .notNull()
      .references(() => dramaRequests.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.requestId] })],
);

export const dmcaTickets = pgTable(
  'dmca_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketCode: text('ticket_code').notNull(),
    target: text('target').notNull(),
    senderEmail: text('sender_email').notNull(),
    senderName: text('sender_name'),
    category: text('category').notNull().default('copyright'),
    type: text('type').notNull(),
    message: text('message'),
    priority: priorityEnum('priority').notNull().default('Normal'),
    evidenceUrl: text('evidence_url'),
    resolutionNote: text('resolution_note'),
    status: ticketStatusEnum('status').notNull().default('Terbuka'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('tickets_code_uidx').on(t.ticketCode),
    index('tickets_status_priority_idx').on(t.status, t.priority),
  ],
);

// ── 6. Monetization & Daily Quota ───────────────────────────────────────────
export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceIdr: integer('price_idr').notNull(),
  durationDays: integer('duration_days').notNull().default(30),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('subs_user_status_exp_idx').on(t.userId, t.status, t.expiresAt)],
);

export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    provider: text('provider').notNull(),
    merchantRef: text('merchant_ref').notNull(),
    providerRef: text('provider_ref'),
    amountIdr: integer('amount_idr').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    checkoutUrl: text('checkout_url'),
    rawWebhook: jsonb('raw_webhook'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pay_merchant_ref_uidx').on(t.merchantRef),
    index('pay_user_status_idx').on(t.userId, t.status),
  ],
);

export const dailyEpisodeUnlocks = pgTable(
  'daily_episode_unlocks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    unlockDateWib: date('unlock_date_wib').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('daily_unlock_user_ep_date_uidx').on(t.userId, t.episodeId, t.unlockDateWib),
    index('daily_unlock_user_date_idx').on(t.userId, t.unlockDateWib),
  ],
);

// ── 7. Analytics, Activity Log & System Settings ────────────────────────────
export const viewEvents = pgTable(
  'view_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dramaId: uuid('drama_id')
      .notNull()
      .references(() => dramas.id, { onDelete: 'cascade' }),
    episodeNumber: integer('episode_number').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    actorKey: text('actor_key').notNull(),
    watchSeconds: integer('watch_seconds').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    watchedDateWib: date('watched_date_wib').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('view_events_date_idx').on(t.watchedDateWib, t.dramaId),
    index('view_events_drama_ep_idx').on(t.dramaId, t.episodeNumber),
  ],
);

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorLabel: text('actor_label').notNull(),
    action: text('action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activity_logs_created_idx').on(t.createdAt)],
);

export const siteSettings = pgTable('site_settings', {
  id: text('id').primaryKey().default('default'),
  siteAnnouncement: text('site_announcement').notNull(),
  maintenanceMode: boolean('maintenance_mode').notNull().default(false),
  defaultVideoLang: videoLangEnum('default_video_lang').notNull().default('id'),
  defaultQuality: text('default_quality').notNull().default('1080p'),
  autoModerateComments: boolean('auto_moderate_comments').notNull().default(true),
  playerWatermark: boolean('player_watermark').notNull().default(true),
  supportEmail: text('support_email').notNull().default('support@tiraiplay.example'),
  dmcaEmail: text('dmca_email').notNull().default('legal@tiraiplay.example'),
  cdnBaseUrl: text('cdn_base_url').notNull().default('https://cdn.tiraiplay.example/streams'),
  freeDailyEpisodeLimit: integer('free_daily_episode_limit').notNull().default(10),
  guestDailyEpisodeLimit: integer('guest_daily_episode_limit').notNull().default(3),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
