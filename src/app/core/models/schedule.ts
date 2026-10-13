export interface ReleaseScheduleItem {
  id: string;
  dramaSlug: string;
  dramaTitle: string;
  platformId: string;
  episodeNumber: number;
  releaseDate: string;
  releaseTime?: string;
  isDemo: boolean;
}
