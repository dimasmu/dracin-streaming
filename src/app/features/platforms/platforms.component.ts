import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginatorModule } from 'primeng/paginator';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogService } from '../../core/services/catalog.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { monogram } from '../../core/utils/format';

@Component({
  imports: [RouterLink, PaginatorModule, TranslocoPipe, DramaCardComponent, EmptyStateComponent],
  templateUrl: './platforms.component.html',
})
export class PlatformsComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly monogram = monogram;

  /** Selected platform names; empty means "all platforms". */
  protected readonly selectedPlatforms = signal<readonly string[]>([]);
  protected readonly rows = signal(10);
  protected readonly first = signal(0);

  /** True when no platform is picked, i.e. the "All" chip is active. */
  protected readonly isAll = computed(() => this.selectedPlatforms().length === 0);

  protected readonly filtered = computed(() => {
    const selected = this.selectedPlatforms();
    if (selected.length === 0) return this.catalog.filter({ sort: 'popular' });
    return this.catalog.filter({ platforms: [...selected], sort: 'popular' });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.rows())),
  );

  protected readonly paged = computed(() => {
    const start = this.first();
    return this.filtered().slice(start, start + this.rows());
  });

  protected isSelected(name: string): boolean {
    return this.selectedPlatforms().includes(name);
  }

  protected togglePlatform(name: string): void {
    const current = this.selectedPlatforms();
    this.selectedPlatforms.set(
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
    this.first.set(0);
  }

  protected clearPlatforms(): void {
    this.selectedPlatforms.set([]);
    this.first.set(0);
  }

  protected count(name: string): number {
    return this.catalog.countByPlatform(name);
  }

  protected onPageChange(event: { first?: number; rows?: number }): void {
    this.first.set(event.first ?? 0);
    if (event.rows) this.rows.set(event.rows);
  }
}
