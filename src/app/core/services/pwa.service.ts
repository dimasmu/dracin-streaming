import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { MessageService } from 'primeng/api';
import { filter } from 'rxjs';
import { I18nService } from './i18n.service';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Progressive Web App lifecycle service:
 * - Supports modern `navigator.install()` with `beforeinstallprompt` fallback
 * - Listens to Angular `SwUpdate` version-ready events for seamless reloads
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(I18nService);

  private readonly supportsWebInstall =
    typeof Navigator !== 'undefined' &&
    typeof (Navigator.prototype as unknown as { install?: unknown }).install === 'function';

  private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly isStandalone = signal(false);
  readonly installing = signal(false);
  readonly updateAvailable = signal(false);

  /** True only when a native install mechanism (`navigator.install` or `beforeinstallprompt`) is available. */
  readonly canInstall = computed(
    () => !this.isStandalone() && (this.supportsWebInstall || this.deferredPrompt() !== null),
  );

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.isStandalone.set(this.detectStandalone());

    const win = this.doc.defaultView;
    if (win) {
      const displayMql = win.matchMedia('(display-mode: standalone)');
      const onDisplayChange = (e: MediaQueryListEvent) => this.isStandalone.set(e.matches);
      displayMql.addEventListener?.('change', onDisplayChange);

      const onBeforeInstall = (event: Event) => {
        event.preventDefault();
        this.deferredPrompt.set(event as BeforeInstallPromptEvent);
      };

      const onAppInstalled = () => {
        this.deferredPrompt.set(null);
        this.isStandalone.set(true);
        this.messages.add({
          severity: 'success',
          summary: this.i18n.t('pwa.installedTitle'),
          detail: this.i18n.t('pwa.installedDetail'),
          life: 3200,
        });
      };

      win.addEventListener('beforeinstallprompt', onBeforeInstall);
      win.addEventListener('appinstalled', onAppInstalled);

      this.destroyRef.onDestroy(() => {
        displayMql.removeEventListener?.('change', onDisplayChange);
        win.removeEventListener('beforeinstallprompt', onBeforeInstall);
        win.removeEventListener('appinstalled', onAppInstalled);
      });
    }

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter((evt) => evt.type === 'VERSION_READY'),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => {
          this.updateAvailable.set(true);
          this.messages.add({
            severity: 'info',
            summary: this.i18n.t('pwa.updateReady'),
            detail: this.i18n.t('pwa.updateAction'),
            life: 6000,
          });
        });
    }
  }

  /** Must be invoked directly from a user click/tap handler to keep transient user activation. */
  async install(): Promise<void> {
    if (this.installing() || !isPlatformBrowser(this.platformId)) return;
    this.installing.set(true);

    try {
      if (this.supportsWebInstall) {
        const nav = navigator as unknown as { install: () => Promise<void> };
        await nav.install();
        this.isStandalone.set(true);
        return;
      }

      const promptEvent = this.deferredPrompt();
      if (promptEvent) {
        // Clear the single-use deferred event before awaiting user choice.
        this.deferredPrompt.set(null);
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          this.isStandalone.set(true);
        }
      }
    } catch (error) {
      const name = (error as Error | undefined)?.name;
      if (name !== 'AbortError') {
        console.error('PWA install error:', error);
      }
    } finally {
      this.installing.set(false);
    }
  }

  reloadForUpdate(): void {
    this.doc.location?.reload();
  }

  private detectStandalone(): boolean {
    const win = this.doc.defaultView;
    if (!win) return false;
    const standaloneMatch = win.matchMedia('(display-mode: standalone)').matches;
    const safariStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
    return standaloneMatch || safariStandalone;
  }
}
