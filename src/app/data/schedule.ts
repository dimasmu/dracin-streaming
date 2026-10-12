import type { ReleaseScheduleItem } from '../core/models/schedule';

// Illustrative weekly release slots. These are DEMO entries only — they map
// real catalogue titles to fictional air-times so the schedule page is usable.
// They are not sourced release information.
export interface ScheduleSlot {
  day: number; // 0 = Sunday … 6 = Saturday
  time: string;
  dramaSlug: string;
  episodeNumber: number;
  subtitleStatus: string;
}

export const SCHEDULE_SLOTS: ScheduleSlot[] = [
  { day: 1, time: '19.00 WIB', dramaSlug: 'singgasana-bayangan-sulih-suara', episodeNumber: 143, subtitleStatus: 'EN' },
  { day: 1, time: '20.30 WIB', dramaSlug: 'dulu-diremehkan-kini-berjaya', episodeNumber: 101, subtitleStatus: 'EN' },
  { day: 2, time: '21.00 WIB', dramaSlug: 'suami-nikah-kilatku-memanjakanku', episodeNumber: 101, subtitleStatus: 'ID' },
  { day: 3, time: '21.45 WIB', dramaSlug: 'wah-suamiku-ternyata-bos-besar', episodeNumber: 101, subtitleStatus: 'EN' },
  { day: 4, time: '22.15 WIB', dramaSlug: 'legenda-tak-terkalahkan-sulih-suara', episodeNumber: 95, subtitleStatus: 'ID' },
  { day: 5, time: '19.30 WIB', dramaSlug: 'cinta-di-balik-luka-lama', episodeNumber: 100, subtitleStatus: 'ID' },
  { day: 6, time: '20.00 WIB', dramaSlug: 'istriku-aku-memang-dewa-sulih-suara', episodeNumber: 89, subtitleStatus: 'ID' },
  { day: 6, time: '21.30 WIB', dramaSlug: 'putri-yang-tak-akan-tunduk', episodeNumber: 81, subtitleStatus: 'EN' },
];

export function buildScheduleItems(slots: ScheduleSlot[], now: Date): ReleaseScheduleItem[] {
  const day = now.getDay();
  return slots
    .map((slot) => {
      const delta = slot.day - day;
      const date = new Date(now);
      date.setDate(now.getDate() + delta);
      const iso = date.toISOString().slice(0, 10);
      return {
        id: `${iso}-${slot.dramaSlug}-${slot.episodeNumber}`,
        dramaSlug: slot.dramaSlug,
        dramaTitle: '',
        platformId: '',
        episodeNumber: slot.episodeNumber,
        subtitleStatus: slot.subtitleStatus,
        releaseDate: iso,
        releaseTime: slot.time,
        isDemo: true,
      } satisfies ReleaseScheduleItem;
    })
    .sort((a, b) => (a.releaseDate + a.releaseTime).localeCompare(b.releaseDate + b.releaseTime));
}
