import { Injectable } from '@angular/core';
import { DRAMAS } from '../../data/dramas';
import { GENRES } from '../../data/genres';
import { PLATFORMS } from '../../data/platforms';
import type { Drama } from '../models/drama';
import type { DramaGenre } from '../models/genre';
import type { DramaPlatform } from '../models/platform';

export type SortKey = 'popular' | 'new' | 'rating' | 'az' | 'full';

export interface DramaFilters {
  genres?: string[];
  platforms?: string[];
  years?: number[];
  subtitleLanguages?: string[];
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  sort?: SortKey;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly dramas: Drama[] = DRAMAS;

  readonly genres: DramaGenre[] = GENRES;

  readonly platforms: DramaPlatform[] = PLATFORMS;

  getBySlug(slug: string): Drama | undefined {
    return this.dramas.find((d) => d.slug === slug);
  }

  getGenre(name: string): DramaGenre | undefined {
    return this.genres.find((g) => g.name === name);
  }

  getPlatform(id: string): DramaPlatform | undefined {
    return this.platforms.find((p) => p.id === id) ?? this.platforms.find((p) => p.name === id);
  }

  countByGenre(name: string): number {
    return this.dramas.filter((d) => d.genres.includes(name)).length;
  }

  countByPlatform(idOrName: string): number {
    const platform = this.getPlatform(idOrName);
    if (!platform) return 0;
    return this.dramas.filter((d) => d.platformId === platform.name).length;
  }

  featured(): Drama[] {
    return this.dramas.filter((d) => d.featured);
  }

  recent(limit = 12): Drama[] {
    return [...this.dramas]
      .sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || (b.latestEpisode ?? 0) - (a.latestEpisode ?? 0))
      .slice(0, limit);
  }

  trending(limit = 12): Drama[] {
    return [...this.dramas].sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0)).slice(0, limit);
  }

  mostViewed(limit = 10): Drama[] {
    return [...this.dramas]
      .sort((a, b) => (b.latestEpisode ?? 0) * 3 + (b.releaseYear ?? 0) - ((a.latestEpisode ?? 0) * 3 + (a.releaseYear ?? 0)))
      .slice(0, limit);
  }

  mostLiked(limit = 10): Drama[] {
    return [...this.dramas]
      .sort((a, b) => (b.releaseYear ?? 0) * 4 + ((b.latestEpisode ?? 0) % 90) - ((a.releaseYear ?? 0) * 4 + ((a.latestEpisode ?? 0) % 90)))
      .slice(0, limit);
  }

  related(drama: Drama, limit = 8): Drama[] {
    const primaryGenre = drama.genres[0];
    const scored = this.dramas
      .filter((d) => d.id !== drama.id)
      .map((d) => {
        let score = 0;
        if (primaryGenre && d.genres.includes(primaryGenre)) score += 3;
        if (d.platformId === drama.platformId) score += 1;
        score += Math.random();
        return { d, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.d);
  }

  search(query: string, limit = 6): Drama[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.dramas
      .filter((d) => {
        const hay = [d.title, d.genres.join(' '), d.platformId, d.synopsis].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, limit);
  }

  filter(filters: DramaFilters = {}): Drama[] {
    const { genres = [], platforms = [], years = [], subtitleLanguages = [], dateFrom, dateTo, query, sort } = filters;

    let list = this.dramas.filter((d) => {
      if (genres.length && !genres.some((g) => d.genres.includes(g))) return false;
      if (platforms.length && !platforms.includes(d.platformId)) return false;
      if (years.length && d.releaseYear !== undefined && !years.includes(d.releaseYear)) return false;
      if (subtitleLanguages.length && !subtitleLanguages.some((s) => d.subtitleLanguages.includes(s))) return false;
      if (dateFrom && d.releaseDate && d.releaseDate < dateFrom) return false;
      if (dateTo && d.releaseDate && d.releaseDate > dateTo) return false;
      if (query) {
        const hay = [d.title, d.platformId, d.genres.join(' ')].join(' ').toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'new':
          return (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || (b.latestEpisode ?? 0) - (a.latestEpisode ?? 0);
        case 'rating':
          return (b.rating ?? 0) - (a.rating ?? 0);
        case 'az':
          return a.title.localeCompare(b.title);
        case 'full':
          return (b.totalEpisodes ?? 0) - (a.totalEpisodes ?? 0);
        default:
          return (b.trendingScore ?? 0) - (a.trendingScore ?? 0);
      }
    });

    return list;
  }

  availableYears(): number[] {
    return [...new Set(this.dramas.map((d) => d.releaseYear).filter((y): y is number => y !== undefined))].sort(
      (a, b) => b - a,
    );
  }

  availableSubtitleLanguages(): string[] {
    return [...new Set(this.dramas.flatMap((d) => d.subtitleLanguages))].sort();
  }
}
