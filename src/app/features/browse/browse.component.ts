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
import { PaginatorModule } from 'primeng/paginator';
import { CatalogService, SortKey } from '../../core/services/catalog.service';
import { DramaCardComponent } from '../../shared/components/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

interface Option {
  label: string;
  value: string | number;
}

@Component({
  imports: [FormsModule, SelectModule, PaginatorModule, DramaCardComponent, EmptyStateComponent],
  templateUrl: './browse.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowseComponent implements OnInit {
  protected readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

  protected readonly genreOptions: Option[] = this.catalog.genres.map((g) => ({
    label: g.name,
    value: g.name,
  }));
  protected readonly platformOptions: Option[] = this.catalog.platforms.map((p) => ({
    label: p.name,
    value: p.name,
  }));
  protected readonly yearOptions: Option[] = this.catalog
    .availableYears()
    .map((y) => ({ label: String(y), value: y }));
  protected readonly subtitleOptions: Option[] = this.catalog
    .availableSubtitleLanguages()
    .map((s) => ({
      label: `Subtitle ${s}`,
      value: s,
    }));

  protected readonly sortOptions: Option[] = [
    { label: 'Most popular', value: 'popular' },
    { label: 'Newest', value: 'new' },
    { label: 'Highest rated', value: 'rating' },
    { label: 'Title A\u2013Z', value: 'az' },
    { label: 'Most episodes', value: 'full' },
  ];

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
    if (sortParam && this.sortOptions.some((o) => o.value === sortParam))
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
