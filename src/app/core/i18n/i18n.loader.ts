import { Injectable } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';

/**
 * Loads one translation file per language. Each language is its own lazy
 * chunk, so only the active language (plus the English fallback) is fetched.
 * To add a language: add `src/i18n/<code>.json`, a `case` below and an entry
 * in `SITE_LANGS`.
 */
@Injectable({ providedIn: 'root' })
export class I18nLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    switch (lang) {
      case 'id':
        return import('../../../i18n/id.json').then((m) => m.default as Translation);
      default:
        return import('../../../i18n/en.json').then((m) => m.default as Translation);
    }
  }
}
