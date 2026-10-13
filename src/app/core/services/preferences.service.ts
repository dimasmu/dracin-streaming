import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
/** Language of the video itself. Each episode has its own video per language. */
export type VideoLang = 'id' | 'en';

export const VIDEO_LANGS: readonly VideoLang[] = ['id', 'en'];

const THEME_KEY = 'dracin-theme';
const VIDEO_LANG_KEY = 'dracin-video-lang';
/** Legacy key from when the navbar toggle meant "subtitle language". Read once as a starting value. */
const LEGACY_SUBTITLE_KEY = 'dracin-subtitle';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly theme = signal<Theme>(this.loadTheme());

  /** The viewer's chosen video language, or null if they never chose one. */
  readonly videoLang = signal<VideoLang | null>(this.loadVideoLang());

  constructor() {
    this.applyTheme(this.theme());
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    this.applyTheme(theme);
    this.store(THEME_KEY, theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setVideoLang(value: VideoLang): void {
    this.videoLang.set(value);
    this.store(VIDEO_LANG_KEY, value);
  }

  private store(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.classList.toggle('app-dark', theme === 'dark');
  }

  private loadTheme(): Theme {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  private loadVideoLang(): VideoLang | null {
    try {
      const saved = localStorage.getItem(VIDEO_LANG_KEY) ?? localStorage.getItem(LEGACY_SUBTITLE_KEY);
      const v = saved?.toLowerCase();
      return v === 'id' || v === 'en' ? v : null;
    } catch {
      return null;
    }
  }
}
