import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { PrimeNG } from 'primeng/config';
import { firstValueFrom } from 'rxjs';

/** Website languages. Adding one here (plus its JSON file and loader case) is all the UI needs. */
export const SITE_LANGS = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'id', label: 'ID', name: 'Bahasa Indonesia' },
] as const;

export type SiteLang = (typeof SITE_LANGS)[number]['id'];

const STORAGE_KEY = 'dracin-lang';
const FALLBACK: SiteLang = 'en';

/** PrimeNG's own built-in strings (empty select list etc.). */
const PRIME_TEXT: Record<SiteLang, { emptyMessage: string; emptyFilterMessage: string }> = {
  en: { emptyMessage: 'No results found', emptyFilterMessage: 'No results found' },
  id: { emptyMessage: 'Tidak ada hasil', emptyFilterMessage: 'Tidak ada hasil' },
};

/**
 * Language of the *website* (menus, buttons, messages). This is independent of
 * the language of the video, which is chosen on the watch page.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly transloco = inject(TranslocoService);
  private readonly primeng = inject(PrimeNG);
  private readonly doc = inject(DOCUMENT);

  readonly langs = SITE_LANGS;
  /** Active language as a signal; reading it inside `computed` makes the result follow language changes. */
  readonly lang = this.transloco.activeLang;

  /** Runs before the app renders so no screen ever shows raw keys. */
  async init(): Promise<void> {
    const lang = this.initialLang();
    await Promise.all([
      firstValueFrom(this.transloco.load(lang)),
      firstValueFrom(this.transloco.load(FALLBACK)),
    ]);
    this.transloco.setActiveLang(lang);
    this.apply(lang);
  }

  async setLang(lang: SiteLang): Promise<void> {
    if (!this.isSupported(lang) || lang === this.lang()) return;
    // Load first, then switch, so the UI never renders half-translated text.
    await firstValueFrom(this.transloco.load(lang));
    this.transloco.setActiveLang(lang);
    this.apply(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable: the choice just lasts for this visit */
    }
  }

  /** Translate in TypeScript (toasts, computed labels). Tracks the active language. */
  t(key: string, params?: Record<string, unknown>): string {
    this.lang();
    return this.transloco.translate(key, params);
  }

  private apply(lang: SiteLang): void {
    this.doc.documentElement.lang = lang;
    this.primeng.setTranslation(PRIME_TEXT[lang]);
  }

  private isSupported(value: unknown): value is SiteLang {
    return SITE_LANGS.some((l) => l.id === value);
  }

  /** Saved choice, else the first browser language we support, else English. */
  private initialLang(): SiteLang {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (this.isSupported(saved)) return saved;
    } catch {
      /* ignore */
    }
    const browser = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
    for (const tag of browser) {
      const primary = tag?.toLowerCase().split('-')[0];
      if (this.isSupported(primary)) return primary;
    }
    return FALLBACK;
  }
}
