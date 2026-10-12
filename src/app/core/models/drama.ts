export type DramaStatus = 'ongoing' | 'completed' | 'upcoming' | 'unknown';

export interface DramaEpisode {
  number: number;
  title?: string;
  airDate?: string;
  durationMinutes?: number;
}

export interface Drama {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  alternateTitles?: string[];
  synopsis: string;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  genres: string[];
  platformId: string;
  releaseYear?: number;
  releaseDate?: string;
  totalEpisodes?: number;
  latestEpisode?: number;
  status: DramaStatus;
  subtitleLanguages: string[];
  rating?: number;
  ratingSource?: string;
  ratingIsDemo: boolean;
  durationMinutes?: number;
  country?: string;
  cast?: string[];
  director?: string;
  tags?: string[];
  featured: boolean;
  trendingScore?: number;
  addedAt?: string;
  updatedAt?: string;
  episodes?: DramaEpisode[];
  dataSource?: string;
  isDemoData: boolean;
  /** oklch color string used to drive the generated card/hero artwork. */
  tone: string;
}
