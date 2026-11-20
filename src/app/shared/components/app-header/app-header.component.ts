import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
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
import { PwaService } from '../../../core/services/pwa.service';
import { I18nService, SiteLang } from '../../../core/services/i18n.service';
import type { Drama } from '../../../core/models/drama';
import { monogram, videoLangLabel } from '../../../core/utils/format';

export type SearchQuickTab = 'all' | 'id' | 'en' | 'completed';

@Component({
  selector: 'app-header',
  imports: [RouterLink, DrawerModule, SkeletonModule, TranslocoPipe, NgOptimizedImage],
  templateUrl: './app-header.component.html',
  host: {
    '(document:keydown)': 'onGlobalKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class AppHeaderComponent {
  protected readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly pwa = inject(PwaService);
  protected readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  private readonly searchWrap = viewChild<ElementRef<HTMLElement>>('searchWrap');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly accountWrap = viewChild<ElementRef<HTMLElement>>('accountWrap');

  protected readonly drawerVisible = signal(false);
  protected readonly accountOpen = signal(false);

  protected readonly query = signal('');
  protected readonly searchOpen = signal(false);
  protected readonly searchLoading = signal(false);
  protected readonly searchTab = signal<SearchQuickTab>('all');
  protected readonly activeResultIndex = signal(-1);
  protected readonly rawResults = signal<Drama[]>([]);

  protected readonly navItems = computed(() => [
    { path: '/', labelKey: 'nav.home' },
    { path: '/genre', labelKey: 'nav.genre' },
    { path: '/platform', labelKey: 'nav.platform' },
    { path: '/release-schedule', labelKey: 'nav.schedule' },
    { path: '/browse', labelKey: 'nav.browse' },
  ]);

  protected readonly quickTabs = computed(() => {
    const isId = this.i18n.lang() === 'id';
    return [
      { id: 'all' as SearchQuickTab, label: isId ? 'Semua' : 'All' },
      { id: 'id' as SearchQuickTab, label: isId ? 'Indonesia' : 'Sub ID' },
      { id: 'en' as SearchQuickTab, label: isId ? 'Inggris' : 'Sub EN' },
      { id: 'completed' as SearchQuickTab, label: isId ? 'Tamat' : 'Completed' },
    ];
  });

  protected readonly filteredResults = computed(() => {
    const q = this.query().trim();
    const tab = this.searchTab();
    const base: Drama[] =
      q.length >= 2
        ? this.rawResults()
        : q.length === 1
          ? this.catalog.search(q, 24)
          : [...this.catalog.dramas].sort(
              (a, b) => (b.trendingScore ?? b.rating ?? 0) - (a.trendingScore ?? a.rating ?? 0),
            );

    const byTab = base.filter((d) => {
      if (tab === 'id') return d.videoLanguages.includes('id') || d.subtitleLanguages.includes('id');
      if (tab === 'en') return d.videoLanguages.includes('en') || d.subtitleLanguages.includes('en');
      if (tab === 'completed') return d.status === 'completed';
      return true;
    });
    return byTab;
  });

  protected readonly visibleResults = computed(() => this.filteredResults().slice(0, 6));
  protected readonly totalMatches = computed(() => this.filteredResults().length);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected dramaMonogram(d: Drama): string {
    return monogram(d.title);
  }

  protected videoLangs(d: Drama): string {
    return videoLangLabel(d.videoLanguages);
  }

  protected hasLang(d: Drama, lang: 'id' | 'en'): boolean {
    return d.videoLanguages.includes(lang) || d.subtitleLanguages.includes(lang);
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
    if (!all.length) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    this.router.navigate(['/watch', pick.slug, 1]);
  }

  protected openSearchPopup(): void {
    this.searchOpen.set(true);
    this.activeResultIndex.set(-1);
  }

  protected setSearchTab(tab: SearchQuickTab): void {
    this.searchTab.set(tab);
    this.activeResultIndex.set(-1);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.activeResultIndex.set(-1);
    const q = value.trim();
    this.searchOpen.set(true);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (q.length < 2) {
      this.searchLoading.set(false);
      this.rawResults.set([]);
      return;
    }

    this.searchLoading.set(true);
    this.rawResults.set([]);
    this.debounceTimer = setTimeout(() => {
      this.rawResults.set(this.catalog.search(q, 24));
      this.searchLoading.set(false);
    }, 150);
  }

  protected clearSearch(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.query.set('');
    this.rawResults.set([]);
    this.searchLoading.set(false);
    this.activeResultIndex.set(-1);
    this.searchInput()?.nativeElement.focus();
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const list = this.visibleResults();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.searchOpen()) this.searchOpen.set(true);
      if (list.length) {
        this.activeResultIndex.update((i) => (i + 1) % list.length);
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) {
        this.activeResultIndex.update((i) => (i <= 0 ? list.length - 1 : i - 1));
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch();
      this.searchInput()?.nativeElement.blur();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.activeResultIndex();
      if (idx >= 0 && list[idx]) {
        const picked = list[idx];
        this.closeSearch();
        void this.router.navigate(['/watch', picked.slug, 1]);
        return;
      }
      this.submitSearch();
    }
  }

  protected submitSearch(): void {
    const q = this.query().trim();
    const tab = this.searchTab();
    const queryParams: Record<string, string> = {};
    if (q) queryParams['q'] = q;
    if (tab === 'id' || tab === 'en') queryParams['lang'] = tab;
    if (tab === 'completed') queryParams['status'] = 'completed';
    this.closeSearch();
    void this.router.navigate(['/browse'], { queryParams });
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
    this.searchLoading.set(false);
    this.activeResultIndex.set(-1);
  }

  protected onGlobalKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTyping =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    if (!isTyping && (event.key === '/' || event.key.toLowerCase() === 's') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.searchInput()?.nativeElement.focus();
      this.openSearchPopup();
      return;
    }
    if (event.key === 'Escape') {
      if (this.searchOpen()) this.closeSearch();
      if (this.accountOpen()) this.accountOpen.set(false);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;
    const searchEl = this.searchWrap()?.nativeElement;
    if (this.searchOpen() && searchEl && !searchEl.contains(target)) {
      this.closeSearch();
    }
    const accountEl = this.accountWrap()?.nativeElement;
    if (this.accountOpen() && accountEl && !accountEl.contains(target)) {
      this.accountOpen.set(false);
    }
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
