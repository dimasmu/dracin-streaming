import { eq, siteSettings, type Database } from '@tiraiplay/db';

export interface EffectiveSettings {
  siteAnnouncement: string;
  maintenanceMode: boolean;
  defaultVideoLang: 'id' | 'en';
  defaultQuality: '1080p' | '720p';
  autoModerateComments: boolean;
  playerWatermark: boolean;
  supportEmail: string;
  dmcaEmail: string;
  cdnBaseUrl: string;
  freeDailyEpisodeLimit: number;
  guestDailyEpisodeLimit: number;
}

const FALLBACK_SETTINGS: EffectiveSettings = {
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
};

export async function getSiteSettings(db: Database): Promise<EffectiveSettings> {
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, 'default'))
    .limit(1);

  if (!row) return FALLBACK_SETTINGS;
  return {
    siteAnnouncement: row.siteAnnouncement,
    maintenanceMode: row.maintenanceMode,
    defaultVideoLang: row.defaultVideoLang,
    defaultQuality: row.defaultQuality === '720p' ? '720p' : '1080p',
    autoModerateComments: row.autoModerateComments,
    playerWatermark: row.playerWatermark,
    supportEmail: row.supportEmail,
    dmcaEmail: row.dmcaEmail,
    cdnBaseUrl: row.cdnBaseUrl,
    freeDailyEpisodeLimit: row.freeDailyEpisodeLimit,
    guestDailyEpisodeLimit: row.guestDailyEpisodeLimit,
  };
}
