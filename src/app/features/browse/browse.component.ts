import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { CatalogService, SortKey } from '../../core/services/catalog.service';
import { BookmarkService } from '../../core/services/bookmark.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { I18nService } from '../../core/services/i18n.service';
import type { Drama, DramaStatus } from '../../core/models/drama';
import { monogram } from '../../core/utils/format';

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

@Component({
  imports: [
    FormsModule,
    RouterLink,
    SelectModule,
    PaginatorModule,
    TranslocoPipe,
    DramaCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './browse.component.html',
})
export class BrowseComponent implements OnInit {
  protected readonly catalog = inject(CatalogService);
  private readonly bookmarks = inject(BookmarkService);
  private readonly messages = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly selectedGenres = signal<string[]>([]);
  protected readonly selectedPlatforms = signal<string[]>([]);
  protected readonly selectedYears = signal<number[]>([]);
  protected readonly selectedSubtitles = signal<string[]>([]);
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly activeLetter = signal<string>('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly query = signal('');
  protected readonly sort = signal<SortKey>('popular');
  protected readonly viewMode = signal<BrowseViewMode>('grid');

  protected readonly rows = signal(10);
  protected readonly first = signal(0);
  protected readonly mobileFiltersOpen = signal(false);

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
          this.first.set(0);
        },
      });
    }
    if (this.dateFrom() || this.dateTo()) {
      chips.push({
        key: 'date',
        label: `${this.dateFrom() || '…'} → ${this.dateTo() || '…'}`,
        remove: () => {
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
    if (q) this.query.set(q);

    const genre = params.get('genre');
    if (genre) this.selectedGenres.set(genre.split(',').filter(Boolean));

    const platform = params.get('platform');
    if (platform) this.selectedPlatforms.set(platform.split(',').filter(Boolean));

    const year = params.get('year');
    if (year) this.selectedYears.set(year.split(',').map(Number).filter(Boolean));

    const sub = params.get('subtitle') ?? params.get('lang');
    if (sub) this.selectedSubtitles.set(sub.split(',').filter(Boolean));

    const status = params.get('status');
    if (status === 'completed' || status === 'ongoing') {
      this.statusFilter.set(status);
    }

    const sortParam = params.get('sort');
    if (sortParam && this.sortValues.includes(sortParam as SortKey))
      this.sort.set(sortParam as SortKey);
  }

  protected dramaMonogram(d: Drama): string {
    return monogram(d.title);
  }

  protected platformTone(platformId: string): string {
    return this.catalog.getPlatform(platformId)?.tone ?? 'var(--d-accent)';
  }

  protected hasLang(d: Drama, lang: 'id' | 'en'): boolean {
    return d.videoLanguages.includes(lang) || d.subtitleLanguages.includes(lang);
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

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.first.set(0);
  }

  protected setGenres(value: unknown): void {
    this.selectedGenres.set(Array.isArray(value) ? [...value] : []);
    this.first.set(0);
  }

  protected setPlatforms(value: unknown): void {
    this.selectedPlatforms.set(Array.isArray(value) ? [...value] : []);
    this.first.set(0);
  }

  protected setYears(value: unknown): void {
    this.selectedYears.set(Array.isArray(value) ? [...value] : []);
    this.first.set(0);
  }

  protected setSubtitles(value: unknown): void {
    this.selectedSubtitles.set(Array.isArray(value) ? [...value] : []);
    this.first.set(0);
  }

  protected setStatus(status: StatusFilter): void {
    this.statusFilter.set(status);
    this.first.set(0);
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
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
}
