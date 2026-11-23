import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePicker, DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect, MultiSelectModule } from 'primeng/multiselect';
import { TranslocoPipe } from '@jsverse/transloco';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { CatalogService, SortKey } from '../../core/services/catalog.service';
import { BookmarkService } from '../../core/services/bookmark.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { I18nService } from '../../core/services/i18n.service';
import type { Drama, DramaStatus } from '../../core/models/drama';
import { isPlaceholderImage, monogram, toIsoDate } from '../../core/utils/format';

interface Option {
  label: string;
  value: string | number;
}

export type BrowseViewMode = 'grid' | 'compact' | 'list';
export type StatusFilter = 'all' | 'completed' | 'ongoing';

interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((v, idx) => v === b[idx]);
}

@Component({
  imports: [
    FormsModule,
    RouterLink,
    DatePickerModule,
    InputTextModule,
    MultiSelectModule,
    PaginatorModule,
    TranslocoPipe,
    DramaCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './browse.component.html',
  host: {
    '(window:scroll)': 'onWindowScroll()',
  },
})
export class BrowseComponent implements OnInit {
  protected readonly catalog = inject(CatalogService);
  private readonly bookmarks = inject(BookmarkService);
  private readonly messages = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  private readonly multiSelects = viewChildren(MultiSelect);
  private readonly datePickers = viewChildren(DatePicker);
  private lastOverlayOpenedAt = 0;
  private lastOverlayScrollY = 0;

  // Applied filter state (only updated when clicking Apply Filter, Reset, or removing a chip)
  protected readonly selectedGenres = signal<string[]>([]);
  protected readonly selectedPlatforms = signal<string[]>([]);
  protected readonly selectedYears = signal<number[]>([]);
  protected readonly selectedSubtitles = signal<string[]>([]);
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly activeLetter = signal<string>('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly query = signal('');

  // Draft sidebar filter state (edited freely without auto-filtering until "Filter" is clicked)
  protected readonly draftGenres = signal<string[]>([]);
  protected readonly draftPlatforms = signal<string[]>([]);
  protected readonly draftYears = signal<number[]>([]);
  protected readonly draftSubtitles = signal<string[]>([]);
  protected readonly draftStatus = signal<StatusFilter>('all');
  protected readonly draftDateFromObj = signal<Date | null>(null);
  protected readonly draftDateToObj = signal<Date | null>(null);
  protected readonly draftQuery = signal('');

  protected readonly sort = signal<SortKey>('popular');
  protected readonly viewMode = signal<BrowseViewMode>('grid');

  protected readonly rows = signal(10);
  protected readonly first = signal(0);
  protected readonly mobileFiltersOpen = signal(false);
  private readonly brokenPosterUrls = signal<ReadonlySet<string>>(new Set());

  protected readonly alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  protected readonly genreOptions = computed<Option[]>(() =>
    this.catalog.genres.map((g) => ({ label: this.i18n.t('genre.' + g.name), value: g.name })),
  );
  protected readonly platformOptions: Option[] = this.catalog.platforms.map((p) => ({
    label: p.name,
    value: p.name,
  }));
  protected readonly yearOptions: Option[] = this.catalog
    .availableYears()
    .map((y) => ({ label: String(y), value: y }));
  protected readonly subtitleOptions = computed<Option[]>(() =>
    this.catalog.availableSubtitleLanguages().map((s) => ({
      label: this.i18n.t('browse.subtitleOption', { lang: s }),
      value: s,
    })),
  );

  protected readonly statusOptions = computed(() => {
    const isId = this.i18n.lang() === 'id';
    return [
      { value: 'all' as StatusFilter, label: isId ? 'Semua' : 'All' },
      { value: 'completed' as StatusFilter, label: isId ? 'Tamat' : 'Completed' },
      { value: 'ongoing' as StatusFilter, label: 'Ongoing' },
    ];
  });

  private readonly sortValues: SortKey[] = ['popular', 'new', 'rating', 'az', 'full'];
  private readonly sortKeys: Record<SortKey, string> = {
    popular: 'browse.sortPopular',
    new: 'browse.sortNew',
    rating: 'browse.sortRating',
    az: 'browse.sortAz',
    full: 'browse.sortEpisodes',
  };
  protected readonly sortOptions = computed<{ label: string; value: SortKey }[]>(() =>
    this.sortValues.map((v) => ({ label: this.i18n.t(this.sortKeys[v]), value: v })),
  );

  protected readonly hasPendingChanges = computed(() => {
    if (this.draftQuery().trim() !== this.query().trim()) return true;
    if (this.draftStatus() !== this.statusFilter()) return true;
    if (!sameItems(this.draftGenres(), this.selectedGenres())) return true;
    if (!sameItems(this.draftPlatforms(), this.selectedPlatforms())) return true;
    if (!sameItems(this.draftYears(), this.selectedYears())) return true;
    if (!sameItems(this.draftSubtitles(), this.selectedSubtitles())) return true;
    if (toIsoDate(this.draftDateFromObj()) !== this.dateFrom()) return true;
    if (toIsoDate(this.draftDateToObj()) !== this.dateTo()) return true;
    return false;
  });

  protected readonly filtered = computed(() => {
    const base = this.catalog.filter({
      genres: this.selectedGenres(),
      platforms: this.selectedPlatforms(),
      years: this.selectedYears(),
      subtitleLanguages: this.selectedSubtitles(),
      dateFrom: this.dateFrom() || undefined,
      dateTo: this.dateTo() || undefined,
      query: this.query(),
      sort: this.sort(),
    });

    const st = this.statusFilter();
    const letter = this.activeLetter();

    return base.filter((d) => {
      if (st !== 'all' && d.status !== (st as DramaStatus)) return false;
      if (letter) {
        const ch = d.title.trim().charAt(0).toUpperCase();
        if (letter === '#') {
          if (/[A-Z]/.test(ch)) return false;
        } else if (ch !== letter) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly activeChips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    const isId = this.i18n.lang() === 'id';

    if (this.query().trim()) {
      chips.push({
        key: 'q',
        label: `"${this.query().trim()}"`,
        remove: () => {
          this.query.set('');
          this.draftQuery.set('');
          this.first.set(0);
        },
      });
    }
    if (this.statusFilter() !== 'all') {
      chips.push({
        key: 'status',
        label:
          this.statusFilter() === 'completed'
            ? isId
              ? 'Status: Tamat'
              : 'Status: Completed'
            : 'Status: Ongoing',
        remove: () => {
          this.statusFilter.set('all');
          this.draftStatus.set('all');
          this.first.set(0);
        },
      });
    }
    if (this.activeLetter()) {
      chips.push({
        key: 'az',
        label: `${isId ? 'Huruf' : 'Letter'}: ${this.activeLetter()}`,
        remove: () => {
          this.activeLetter.set('');
          this.first.set(0);
        },
      });
    }
    for (const g of this.selectedGenres()) {
      chips.push({
        key: `g-${g}`,
        label: this.i18n.t(`genre.${g}`),
        remove: () => {
          this.selectedGenres.update((list) => list.filter((x) => x !== g));
          this.draftGenres.update((list) => list.filter((x) => x !== g));
          this.first.set(0);
        },
      });
    }
    for (const p of this.selectedPlatforms()) {
      chips.push({
        key: `p-${p}`,
        label: p,
        remove: () => {
          this.selectedPlatforms.update((list) => list.filter((x) => x !== p));
          this.draftPlatforms.update((list) => list.filter((x) => x !== p));
          this.first.set(0);
        },
      });
    }
    for (const y of this.selectedYears()) {
      chips.push({
        key: `y-${y}`,
        label: String(y),
        remove: () => {
          this.selectedYears.update((list) => list.filter((x) => x !== y));
          this.draftYears.update((list) => list.filter((x) => x !== y));
          this.first.set(0);
        },
      });
    }
    for (const s of this.selectedSubtitles()) {
      chips.push({
        key: `s-${s}`,
        label: `SUB ${s.toUpperCase()}`,
        remove: () => {
          this.selectedSubtitles.update((list) => list.filter((x) => x !== s));
          this.draftSubtitles.update((list) => list.filter((x) => x !== s));
          this.first.set(0);
        },
      });
    }
    if (this.dateFrom() || this.dateTo()) {
      chips.push({
        key: 'date',
        label: `${this.dateFrom() || '…'} → ${this.dateTo() || '…'}`,
        remove: () => {
          this.draftDateFromObj.set(null);
          this.draftDateToObj.set(null);
          this.dateFrom.set('');
          this.dateTo.set('');
          this.first.set(0);
        },
      });
    }
    return chips;
  });

  protected readonly hasActiveFilters = computed(() => this.activeChips().length > 0);

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.rows())),
  );

  protected readonly paged = computed(() => {
    const start = this.first();
    return this.filtered().slice(start, start + this.rows());
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const q = params.get('q');
    if (q) {
      this.query.set(q);
      this.draftQuery.set(q);
    }

    const genre = params.get('genre');
    if (genre) {
      const list = genre.split(',').filter(Boolean);
      this.selectedGenres.set(list);
      this.draftGenres.set(list);
    }

    const platform = params.get('platform');
    if (platform) {
      const list = platform.split(',').filter(Boolean);
      this.selectedPlatforms.set(list);
      this.draftPlatforms.set(list);
    }

    const year = params.get('year');
    if (year) {
      const list = year.split(',').map(Number).filter(Boolean);
      this.selectedYears.set(list);
      this.draftYears.set(list);
    }

    const sub = params.get('subtitle') ?? params.get('lang');
    if (sub) {
      const list = sub.split(',').filter(Boolean);
      this.selectedSubtitles.set(list);
      this.draftSubtitles.set(list);
    }

    const status = params.get('status');
    if (status === 'completed' || status === 'ongoing') {
      this.statusFilter.set(status);
      this.draftStatus.set(status);
    }

    const sortParam = params.get('sort');
    if (sortParam && this.sortValues.includes(sortParam as SortKey))
      this.sort.set(sortParam as SortKey);
  }

  protected onOverlayShow(): void {
    this.lastOverlayOpenedAt = Date.now();
    this.lastOverlayScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  }

  protected onWindowScroll(): void {
    if (typeof window === 'undefined') return;
    const elapsed = Date.now() - this.lastOverlayOpenedAt;
    const deltaY = Math.abs(window.scrollY - this.lastOverlayScrollY);
    if (elapsed < 180 && deltaY < 24) return;
    this.closeOpenOverlays();
  }

  protected closeOpenOverlays(): void {
    for (const ms of this.multiSelects()) {
      if (ms.overlayVisible()) ms.hide(false);
    }
    for (const dp of this.datePickers()) {
      if (dp.overlayVisible()) dp.hideOverlay();
    }
  }

  protected dramaMonogram(d: Drama): string {
    return monogram(d.title);
  }

  protected platformTone(platformId: string): string {
    return this.catalog.getPlatform(platformId)?.tone ?? '#16a34a';
  }

  protected listPosterSrc(d: Drama): string | null {
    const url = d.posterUrl?.trim();
    return url && !this.brokenPosterUrls().has(url) ? url : null;
  }

  protected markPosterBroken(url: string): void {
    this.brokenPosterUrls.update((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }

  protected onListPosterLoad(url: string, event: Event): void {
    if (isPlaceholderImage(event)) {
      this.markPosterBroken(url);
    }
  }

  protected onDraftDateFromChange(value: Date | null): void {
    this.draftDateFromObj.set(value);
  }

  protected onDraftDateToChange(value: Date | null): void {
    this.draftDateToObj.set(value);
  }

  protected isBookmarked(dramaId: string): boolean {
    return this.bookmarks.isBookmarked(dramaId);
  }

  protected toggleBookmark(d: Drama, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const added = this.bookmarks.toggle(d.id);
    const isId = this.i18n.lang() === 'id';
    this.messages.add({
      severity: added ? 'success' : 'info',
      summary: added
        ? isId
          ? 'Ditambahkan ke Markah'
          : 'Saved to Bookmarks'
        : isId
          ? 'Dihapus dari Markah'
          : 'Removed from Bookmarks',
      detail: d.title,
      life: 2400,
    });
  }

  protected onDraftQuery(event: Event): void {
    this.draftQuery.set((event.target as HTMLInputElement).value);
  }

  protected setDraftGenres(value: unknown): void {
    this.draftGenres.set(Array.isArray(value) ? [...value] : []);
  }

  protected setDraftPlatforms(value: unknown): void {
    this.draftPlatforms.set(Array.isArray(value) ? [...value] : []);
  }

  protected setDraftYears(value: unknown): void {
    this.draftYears.set(Array.isArray(value) ? [...value] : []);
  }

  protected setDraftSubtitles(value: unknown): void {
    this.draftSubtitles.set(Array.isArray(value) ? [...value] : []);
  }

  protected setDraftStatus(status: StatusFilter): void {
    this.draftStatus.set(status);
  }

  protected applyFilters(event?: Event): void {
    event?.preventDefault();
    this.closeOpenOverlays();
    this.query.set(this.draftQuery().trim());
    this.statusFilter.set(this.draftStatus());
    this.selectedGenres.set([...this.draftGenres()]);
    this.selectedPlatforms.set([...this.draftPlatforms()]);
    this.selectedYears.set([...this.draftYears()]);
    this.selectedSubtitles.set([...this.draftSubtitles()]);
    this.dateFrom.set(toIsoDate(this.draftDateFromObj()));
    this.dateTo.set(toIsoDate(this.draftDateToObj()));
    this.first.set(0);
    this.mobileFiltersOpen.set(false);
  }

  protected setLetter(letter: string): void {
    this.activeLetter.set(this.activeLetter() === letter ? '' : letter);
    this.first.set(0);
  }

  protected setSort(sort: SortKey): void {
    this.sort.set(sort);
    this.first.set(0);
  }

  protected setViewMode(mode: BrowseViewMode): void {
    this.viewMode.set(mode);
  }

  protected onPageChange(event: { first?: number; rows?: number }): void {
    this.first.set(event.first ?? 0);
    if (event.rows) this.rows.set(event.rows);
  }

  protected reset(): void {
    this.closeOpenOverlays();
    this.draftGenres.set([]);
    this.draftPlatforms.set([]);
    this.draftYears.set([]);
    this.draftSubtitles.set([]);
    this.draftStatus.set('all');
    this.draftDateFromObj.set(null);
    this.draftDateToObj.set(null);
    this.draftQuery.set('');

    this.selectedGenres.set([]);
    this.selectedPlatforms.set([]);
    this.selectedYears.set([]);
    this.selectedSubtitles.set([]);
    this.statusFilter.set('all');
    this.activeLetter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.query.set('');
    this.sort.set('popular');
    this.first.set(0);
    this.mobileFiltersOpen.set(false);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
}
