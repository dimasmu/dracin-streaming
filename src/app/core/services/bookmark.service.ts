import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Bookmark } from '../models/bookmark';

const STORAGE_KEY = 'dracin-bookmarks';

@Injectable({ providedIn: 'root' })
export class BookmarkService {
  private readonly http = inject(HttpClient);
  private readonly bookmarks = signal<Bookmark[]>(this.load());
  private readonly authenticated = signal(false);

  readonly list = this.bookmarks.asReadonly();

  get count(): number {
    return this.bookmarks().length;
  }

  setAuthenticated(isAuth: boolean): void {
    this.authenticated.set(isAuth);
    if (isAuth) {
      void this.loadFromApi();
    } else {
      this.bookmarks.set(this.load());
    }
  }

  async loadFromApi(): Promise<void> {
    try {
      const rows = await firstValueFrom(
        this.http.get<Array<{ dramaId: string; addedAt: string }>>('/api/bookmarks'),
      );
      if (Array.isArray(rows)) {
        this.bookmarks.set(rows.map((r) => ({ dramaId: r.dramaId, addedAt: r.addedAt })));
      }
    } catch {
      /* fallback to local state */
    }
  }

  isBookmarked(dramaId: string): boolean {
    return this.bookmarks().some((b) => b.dramaId === dramaId);
  }

  toggle(dramaId: string): boolean {
    const current = this.bookmarks();
    const exists = current.some((b) => b.dramaId === dramaId);
    const next = exists
      ? current.filter((b) => b.dramaId !== dramaId)
      : [...current, { dramaId, addedAt: new Date().toISOString() }];
    this.bookmarks.set(next);

    if (this.authenticated()) {
      const req = exists
        ? this.http.delete(`/api/bookmarks/${encodeURIComponent(dramaId)}`)
        : this.http.put(`/api/bookmarks/${encodeURIComponent(dramaId)}`, {});
      void firstValueFrom(req).catch(() => undefined);
    } else {
      this.persist(next);
    }
    return !exists;
  }

  remove(dramaId: string): void {
    const next = this.bookmarks().filter((b) => b.dramaId !== dramaId);
    this.bookmarks.set(next);
    if (this.authenticated()) {
      void firstValueFrom(
        this.http.delete(`/api/bookmarks/${encodeURIComponent(dramaId)}`),
      ).catch(() => undefined);
    } else {
      this.persist(next);
    }
  }

  private load(): Bookmark[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(list: Bookmark[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }
}
