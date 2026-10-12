export interface ReleaseScheduleItem {
  id: string;
  dramaSlug: string;
  dramaTitle: string;
  platformId: string;
  episodeNumber: number;
  subtitleStatus: string;
  releaseDate: string;
  releaseTime?: string;
  isDemo: boolean;
}
