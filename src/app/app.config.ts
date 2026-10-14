import { ViewportScroller } from '@angular/common';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { PRIMEUI_LICENSE_KEY } from './core/license';
import { I18nLoader } from './core/i18n/i18n.loader';
import { I18nService, SITE_LANGS } from './core/services/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideTransloco({
      config: {
        availableLangs: SITE_LANGS.map((l) => l.id),
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: I18nLoader,
    }),
    provideAppInitializer(() => inject(I18nService).init()),
    // The header is sticky (68px). Without an offset, anchored headings end up underneath it.
    provideAppInitializer(() => inject(ViewportScroller).setOffset([0, 84])),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    providePrimeNG({
      license: PRIMEUI_LICENSE_KEY,
      ripple: true,
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: '.app-dark',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
    }),
    MessageService,
  ],
};
