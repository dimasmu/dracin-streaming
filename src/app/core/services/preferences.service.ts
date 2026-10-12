import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
export type SubtitlePreference = 'EN' | 'ID';

const THEME_KEY = 'dracin-theme';
const SUBTITLE_KEY = 'dracin-subtitle';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly theme = signal<Theme>(this.loadTheme());

  readonly subtitle = signal<SubtitlePreference>(this.loadSubtitle());

  constructor() {
    this.applyTheme(this.theme());
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    this.applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setSubtitle(value: SubtitlePreference): void {
    this.subtitle.set(value);
    try {
      localStorage.setItem(SUBTITLE_KEY, value);
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

  private loadSubtitle(): SubtitlePreference {
    try {
      return localStorage.getItem(SUBTITLE_KEY) === 'ID' ? 'ID' : 'EN';
    } catch {
      return 'EN';
    }
  }
}
