import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { DrawerModule } from 'primeng/drawer';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { CatalogService } from '../../../core/services/catalog.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { PreferencesService } from '../../../core/services/preferences.service';
import { I18nService, SiteLang } from '../../../core/services/i18n.service';
import type { Drama } from '../../../core/models/drama';
import { videoLangLabel } from '../../../core/utils/format';

@Component({
  selector: 'app-header',
  imports: [RouterLink, DrawerModule, SkeletonModule, TranslocoPipe],
  templateUrl: './app-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  protected readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  protected readonly drawerVisible = signal(false);
  protected readonly accountOpen = signal(false);

  protected readonly query = signal('');
  protected readonly searchOpen = signal(false);
  protected readonly searchLoading = signal(false);
  protected readonly searchResults = signal<Drama[]>([]);

  protected readonly navItems = computed(() => [
    { path: '/', labelKey: 'nav.home' },
    { path: '/genre', labelKey: 'nav.genre' },
    { path: '/platform', labelKey: 'nav.platform' },
    { path: '/release-schedule', labelKey: 'nav.schedule' },
    { path: '/browse', labelKey: 'nav.browse' },
  ]);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The current URL as a *signal*.
   *
   * `router.url` is a plain getter, so reading it from the template created no
   * reactive dependency. Under OnPush + zoneless the header therefore only
   * refreshed when one of its own events fired, leaving the active underline
   * pointing at the previously active item whenever navigation was triggered
   * from outside the header (footer, cards, hero CTAs, browser history).
   * Deriving it from NavigationEnd makes the binding update on every
   * navigation, wherever it came from.
   */
  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected videoLangs(d: Drama): string {
    return videoLangLabel(d.videoLanguages);
  }

  protected isActive(path: string): boolean {
    const url = this.currentUrl();
    if (path === '/') return url === '/';
    return url === path || url.startsWith(`${path}/`);
  }

  protected setLang(value: SiteLang): void {
    void this.i18n.setLang(value);
  }

  protected random(): void {
    const all = this.catalog.dramas;
    const pick = all[Math.floor(Math.random() * all.length)];
    this.router.navigate(['/watch', pick.slug, 1]);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    const q = value.trim();
    if (q.length < 2) {
      this.closeSearch();
      return;
    }
    this.searchOpen.set(true);
    this.searchLoading.set(true);
    this.searchResults.set([]);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.searchResults.set(this.catalog.search(q, 6));
      this.searchLoading.set(false);
    }, 180);
  }

  protected submitSearch(): void {
    const q = this.query().trim();
    if (!q) return;
    this.closeSearch();
    this.router.navigate(['/browse'], { queryParams: { q } });
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
    this.searchResults.set([]);
    this.searchLoading.set(false);
  }

  protected prototypeNotice(detailKey: string): void {
    this.accountOpen.set(false);
    this.messages.add({
      severity: 'info',
      summary: this.i18n.t('common.prototype'),
      detail: this.i18n.t(detailKey),
      life: 3000,
    });
  }
}
