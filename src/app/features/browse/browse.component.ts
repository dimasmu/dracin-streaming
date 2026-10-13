import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { PaginatorModule } from 'primeng/paginator';
import { CatalogService, SortKey } from '../../core/services/catalog.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { I18nService } from '../../core/services/i18n.service';

interface Option {
  label: string;
  value: string | number;
}

@Component({
  imports: [
    FormsModule,
    SelectModule,
    PaginatorModule,
    TranslocoPipe,
    DramaCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './browse.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowseComponent implements OnInit {
  protected readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly selectedGenres = signal<string[]>([]);
  protected readonly selectedPlatforms = signal<string[]>([]);
  protected readonly selectedYears = signal<number[]>([]);
  protected readonly selectedSubtitles = signal<string[]>([]);
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly query = signal('');
  protected readonly sort = signal<SortKey>('popular');

  protected readonly rows = signal(24);
  protected readonly first = signal(0);

  /** Values stay the data names (used as filters); only the labels follow the website language. */
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

  private readonly sortValues: SortKey[] = ['popular', 'new', 'rating', 'az', 'full'];
  private readonly sortKeys: Record<SortKey, string> = {
    popular: 'browse.sortPopular',
    new: 'browse.sortNew',
    rating: 'browse.sortRating',
    az: 'browse.sortAz',
    full: 'browse.sortEpisodes',
  };
  protected readonly sortOptions = computed<Option[]>(() =>
    this.sortValues.map((v) => ({ label: this.i18n.t(this.sortKeys[v]), value: v })),
  );

  protected readonly filtered = computed(() =>
    this.catalog.filter({
      genres: this.selectedGenres(),
      platforms: this.selectedPlatforms(),
      years: this.selectedYears(),
      subtitleLanguages: this.selectedSubtitles(),
      dateFrom: this.dateFrom() || undefined,
      dateTo: this.dateTo() || undefined,
      query: this.query(),
      sort: this.sort(),
    }),
  );

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

    const sub = params.get('subtitle');
    if (sub) this.selectedSubtitles.set(sub.split(',').filter(Boolean));

    const sortParam = params.get('sort');
    if (sortParam && this.sortValues.includes(sortParam as SortKey))
      this.sort.set(sortParam as SortKey);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected setGenres(value: unknown): void {
    this.selectedGenres.set(Array.isArray(value) ? [...value] : []);
  }

  protected setPlatforms(value: unknown): void {
    this.selectedPlatforms.set(Array.isArray(value) ? [...value] : []);
  }

  protected setYears(value: unknown): void {
    this.selectedYears.set(Array.isArray(value) ? [...value] : []);
  }

  protected setSubtitles(value: unknown): void {
    this.selectedSubtitles.set(Array.isArray(value) ? [...value] : []);
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
    this.dateFrom.set('');
    this.dateTo.set('');
    this.query.set('');
    this.sort.set('popular');
    this.first.set(0);
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
}
