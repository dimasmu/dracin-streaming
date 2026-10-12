import { Injectable, signal } from '@angular/core';
import type { Bookmark } from '../models/bookmark';

const STORAGE_KEY = 'dracin-bookmarks';

@Injectable({ providedIn: 'root' })
export class BookmarkService {
  private readonly bookmarks = signal<Bookmark[]>(this.load());

  readonly list = this.bookmarks.asReadonly();

  get count(): number {
    return this.bookmarks().length;
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
    this.persist(next);
    return !exists;
  }

  remove(dramaId: string): void {
    const next = this.bookmarks().filter((b) => b.dramaId !== dramaId);
    this.bookmarks.set(next);
    this.persist(next);
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
