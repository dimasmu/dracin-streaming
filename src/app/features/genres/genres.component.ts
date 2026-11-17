import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginatorModule } from 'primeng/paginator';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogService } from '../../core/services/catalog.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { monogram } from '../../core/utils/format';

@Component({
  imports: [RouterLink, PaginatorModule, TranslocoPipe, DramaCardComponent, EmptyStateComponent],
  templateUrl: './genres.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenresComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly monogram = monogram;

  /** Selected genre names; empty means "all genres". */
  protected readonly selectedGenres = signal<readonly string[]>([]);
  protected readonly rows = signal(12);
  protected readonly first = signal(0);

  /** True when no genre is picked, i.e. the "All" chip is active. */
  protected readonly isAll = computed(() => this.selectedGenres().length === 0);

  protected readonly genreOptions = computed(() => this.catalog.genres.map((g) => g.name));

  protected readonly filtered = computed(() => {
    const selected = this.selectedGenres();
    if (selected.length === 0) return this.catalog.filter({ sort: 'popular' });
    return this.catalog.filter({ genres: [...selected], sort: 'popular' });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.rows())),
  );

  protected readonly paged = computed(() => {
    const start = this.first();
    return this.filtered().slice(start, start + this.rows());
  });

  protected isSelected(name: string): boolean {
    return this.selectedGenres().includes(name);
  }

  protected toggleGenre(name: string): void {
    const current = this.selectedGenres();
    this.selectedGenres.set(
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
    this.first.set(0);
  }

  protected clearGenres(): void {
    this.selectedGenres.set([]);
    this.first.set(0);
  }

  protected count(name: string): number {
    return this.catalog.countByGenre(name);
  }

  protected onPageChange(event: { first?: number; rows?: number }): void {
    this.first.set(event.first ?? 0);
    if (event.rows) this.rows.set(event.rows);
  }
}
