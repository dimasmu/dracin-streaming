import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { EpisodePublicMeta } from '@tiraiplay/shared';
import { DRAMAS } from '../../data/dramas';
import { GENRES } from '../../data/genres';
import { PLATFORMS } from '../../data/platforms';
import type { Drama } from '../models/drama';
import type { DramaGenre } from '../models/genre';
import type { DramaPlatform } from '../models/platform';
import { AuthService } from './auth.service';

export interface DramaDetailApiResponse {
  drama: Drama;
  episodes: EpisodePublicMeta[];
  related: Drama[];
  viewerState: {
    bookmarked: boolean;
    vote: 'like' | 'dislike' | null;
    userScore: number | null;
  };
}

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
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly dramasState = signal<Drama[]>(DRAMAS);
  private readonly genresState = signal<DramaGenre[]>(GENRES);
  private readonly platformsState = signal<DramaPlatform[]>(PLATFORMS);
  readonly fromApi = signal(false);

  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.refreshFromApi();
    }
    return this.initPromise;
  }

  async refreshFromApi(): Promise<void> {
    try {
      const [dramasRes, genresRes, platformsRes] = await Promise.all([
        firstValueFrom(this.http.get<{ items: Drama[] }>('/api/dramas?limit=100')),
        firstValueFrom(this.http.get<DramaGenre[]>('/api/genres')),
        firstValueFrom(this.http.get<DramaPlatform[]>('/api/platforms')),
      ]);
      if (Array.isArray(dramasRes?.items) && dramasRes.items.length > 0) {
        this.dramasState.set(dramasRes.items);
        this.fromApi.set(true);
      }
      if (Array.isArray(genresRes) && genresRes.length > 0) {
        this.genresState.set(genresRes);
      }
      if (Array.isArray(platformsRes) && platformsRes.length > 0) {
        this.platformsState.set(platformsRes);
      }
    } catch {
      // Keep local fixture catalog when API server is offline.
      this.fromApi.set(false);
    }
  }

  async fetchDramaDetail(slug: string): Promise<DramaDetailApiResponse | null> {
    try {
      return await firstValueFrom(
        this.http.get<DramaDetailApiResponse>(`/api/dramas/${encodeURIComponent(slug)}`),
      );
    } catch {
      return null;
    }
  }

  get dramas(): Drama[] {
    return this.dramasState();
  }

  get genres(): DramaGenre[] {
    return this.genresState();
  }

  get platforms(): DramaPlatform[] {
    return this.platformsState();
  }

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
    const picked = this.dramas.filter((d) => d.featured);
    if (picked.length >= 3) return picked.slice(0, 5);
    const ids = new Set(picked.map((d) => d.id));
    const fill = [...this.dramas]
      .filter((d) => !ids.has(d.id))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.trendingScore ?? 0) - (a.trendingScore ?? 0))
      .slice(0, Math.max(0, 3 - picked.length));
    return [...picked, ...fill];
  }

  upsertDrama(drama: Drama, isEdit?: boolean): void {
    const existsLocally = isEdit ?? this.dramas.some((item) => item.id === drama.id);
    this.dramasState.update((list) => {
      const idx = list.findIndex((item) => item.id === drama.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = drama;
        return next;
      }
      return [drama, ...list];
    });

    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      const payload = {
        slug: drama.slug,
        title: drama.title,
        originalTitle: drama.originalTitle ?? null,
        alternateTitles: drama.alternateTitles ?? [],
        synopsis: drama.synopsis,
        description: drama.description ?? null,
        posterUrl: drama.posterUrl ?? null,
        backdropUrl: drama.backdropUrl ?? null,
        genres: drama.genres,
        platformId: drama.platformId,
        releaseYear: drama.releaseYear ?? null,
        releaseDate: drama.releaseDate ?? null,
        totalEpisodes: drama.totalEpisodes ?? 1,
        latestEpisode: drama.latestEpisode ?? 1,
        status: drama.status,
        subtitleLanguages: drama.subtitleLanguages,
        videoLanguages: drama.videoLanguages,
        rating: drama.rating ?? 8.0,
        durationMinutes: drama.durationMinutes ?? 1,
        country: drama.country ?? 'China',
        productionStudio: drama.productionStudio ?? null,
        ageRating: drama.ageRating ?? '13+',
        trailerUrl: drama.trailerUrl ?? null,
        cast: drama.cast ?? [],
        director: drama.director ?? null,
        tags: drama.tags ?? [],
        featured: drama.featured,
        trendingScore: drama.trendingScore ?? 0,
        tone: drama.tone,
      };
      const req = existsLocally
        ? this.http.put<Drama>(`/api/admin/dramas/${drama.id}`, payload)
        : this.http.post<Drama>('/api/admin/dramas', payload);
      void firstValueFrom(req)
        .then((saved) => {
          if (!saved?.id) return;
          this.dramasState.update((list) =>
            list.map((d) => (d.id === drama.id || d.slug === saved.slug ? saved : d)),
          );
        })
        .catch(() => undefined);
    }
  }

  deleteDrama(id: string): void {
    this.dramasState.update((list) => list.filter((d) => d.id !== id));
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(this.http.delete(`/api/admin/dramas/${id}`)).catch(() => undefined);
    }
  }

  toggleFeatured(id: string): Drama | undefined {
    let updated: Drama | undefined;
    this.dramasState.update((list) =>
      list.map((d) => {
        if (d.id !== id) return d;
        updated = { ...d, featured: !d.featured };
        return updated;
      }),
    );
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(this.http.patch(`/api/admin/dramas/${id}/featured`, {})).catch(
        () => undefined,
      );
    }
    return updated;
  }

  bulkUpdateDramas(ids: ReadonlySet<string>, action: 'featured' | 'completed' | 'delete'): void {
    if (!ids.size) return;
    if (action === 'delete') {
      this.dramasState.update((list) => list.filter((d) => !ids.has(d.id)));
    } else {
      this.dramasState.update((list) =>
        list.map((d) => {
          if (!ids.has(d.id)) return d;
          if (action === 'featured') return { ...d, featured: true };
          return { ...d, status: 'completed' };
        }),
      );
    }
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(
        this.http.post('/api/admin/dramas/bulk', { ids: [...ids], action }),
      ).catch(() => undefined);
    }
  }

  addPlatform(name: string, tone = 'oklch(68% .16 155)', description?: string): boolean {
    const clean = name.trim();
    if (!clean || this.platforms.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return false;
    const id = clean
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    const desc = description?.trim() || `${clean} short drama source.`;
    this.platformsState.update((list) => [
      ...list,
      {
        id: id || `plat-${Date.now()}`,
        name: clean,
        description: desc,
        tone,
      },
    ]);
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(
        this.http.post<DramaPlatform>('/api/admin/platforms', { name: clean, description: desc, tone }),
      ).catch(() => undefined);
    }
    return true;
  }

  updatePlatform(id: string, patch: { name: string; description: string; tone: string }): boolean {
    const clean = patch.name.trim();
    if (!clean) return false;
    const existing = this.platforms.find((p) => p.id === id);
    if (!existing) return false;
    if (this.platforms.some((p) => p.id !== id && p.name.toLowerCase() === clean.toLowerCase())) {
      return false;
    }
    const oldName = existing.name;
    const desc = patch.description.trim() || `${clean} short drama source.`;
    const tone = patch.tone || existing.tone;
    this.platformsState.update((list) =>
      list.map((p) => (p.id === id ? { ...p, name: clean, description: desc, tone } : p)),
    );
    if (oldName !== clean) {
      this.dramasState.update((list) =>
        list.map((d) => (d.platformId === oldName ? { ...d, platformId: clean } : d)),
      );
    }
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(
        this.http.put(`/api/admin/platforms/${encodeURIComponent(id)}`, {
          name: clean,
          description: desc,
          tone,
        }),
      ).catch(() => undefined);
    }
    return true;
  }

  deletePlatform(id: string): boolean {
    if (!this.platforms.some((p) => p.id === id)) return false;
    this.platformsState.update((list) => list.filter((p) => p.id !== id));
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(
        this.http.delete(`/api/admin/platforms/${encodeURIComponent(id)}`),
      ).catch(() => undefined);
    }
    return true;
  }

  addGenre(name: string, tone = 'oklch(68% .16 155)', description?: string): boolean {
    const clean = name.trim();
    if (!clean || this.genres.some((g) => g.name.toLowerCase() === clean.toLowerCase())) return false;
    const id = clean
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    const desc = description?.trim() || `${clean} short dramas.`;
    this.genresState.update((list) => [
      ...list,
      {
        id: id || `genre-${Date.now()}`,
        name: clean,
        description: desc,
        tone,
      },
    ]);
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(
        this.http.post<DramaGenre>('/api/admin/genres', { name: clean, description: desc, tone }),
      ).catch(() => undefined);
    }
    return true;
  }

  updateGenre(id: string, patch: { name: string; description: string; tone: string }): boolean {
    const clean = patch.name.trim();
    if (!clean) return false;
    const existing = this.genres.find((g) => g.id === id);
    if (!existing) return false;
    if (this.genres.some((g) => g.id !== id && g.name.toLowerCase() === clean.toLowerCase())) {
      return false;
    }
    const oldName = existing.name;
    const desc = patch.description.trim() || `${clean} short dramas.`;
    const tone = patch.tone || existing.tone;
    this.genresState.update((list) =>
      list.map((g) => (g.id === id ? { ...g, name: clean, description: desc, tone } : g)),
    );
    if (oldName !== clean) {
      this.dramasState.update((list) =>
        list.map((d) =>
          d.genres.includes(oldName)
            ? { ...d, genres: d.genres.map((g) => (g === oldName ? clean : g)) }
            : d,
        ),
      );
    }
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(
        this.http.put(`/api/admin/genres/${encodeURIComponent(id)}`, {
          name: clean,
          description: desc,
          tone,
        }),
      ).catch(() => undefined);
    }
    return true;
  }

  deleteGenre(id: string): boolean {
    if (!this.genres.some((g) => g.id === id)) return false;
    this.genresState.update((list) => list.filter((g) => g.id !== id));
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void firstValueFrom(
        this.http.delete(`/api/admin/genres/${encodeURIComponent(id)}`),
      ).catch(() => undefined);
    }
    return true;
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

  private matchesQuery(d: Drama, q: string): boolean {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const hay = [
      d.title,
      d.originalTitle ?? '',
      (d.alternateTitles ?? []).join(' '),
      d.platformId,
      d.genres.join(' '),
      (d.tags ?? []).join(' '),
      (d.cast ?? []).join(' '),
      d.director ?? '',
      d.synopsis,
      d.country ?? '',
      d.productionStudio ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  }

  search(query: string, limit = 6): Drama[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.dramas.filter((d) => this.matchesQuery(d, q)).slice(0, limit);
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
      if (query && !this.matchesQuery(d, query)) return false;
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
