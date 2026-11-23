export type DramaStatus = 'ongoing' | 'completed' | 'upcoming' | 'unknown';

export interface DramaEpisode {
  number: number;
  title?: string;
  airDate?: string;
  durationMinutes?: number;
  streamUrl?: string;
  subtitleUrl?: string;
  status?: 'Tayang' | 'Draft';
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
  /** Subtitle languages of the drama's source, used by the Browse filter. */
  subtitleLanguages: string[];
  /** Languages the video is available in. Every language has its own video per episode. */
  videoLanguages: ('id' | 'en')[];
  rating?: number;
  ratingSource?: string;
  ratingIsDemo: boolean;
  durationMinutes?: number;
  country?: string;
  productionStudio?: string;
  ageRating?: 'SU' | '13+' | '17+' | '21+' | string;
  trailerUrl?: string;
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
