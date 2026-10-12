import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginatorModule } from 'primeng/paginator';
import { CatalogService } from '../../core/services/catalog.service';
import { DramaCardComponent } from '../../shared/components/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { monogram } from '../../core/utils/format';

@Component({
  imports: [RouterLink, PaginatorModule, DramaCardComponent, EmptyStateComponent],
  templateUrl: './platforms.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformsComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly monogram = monogram;

  protected readonly activePlatform = signal('All');
  protected readonly rows = signal(12);
  protected readonly first = signal(0);

  protected readonly filtered = computed(() => {
    const p = this.activePlatform();
    if (p === 'All') return this.catalog.filter({ sort: 'popular' });
    return this.catalog.filter({ platforms: [p], sort: 'popular' });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.rows())),
  );

  protected readonly paged = computed(() => {
    const start = this.first();
    return this.filtered().slice(start, start + this.rows());
  });

  protected selectPlatform(name: string): void {
    this.activePlatform.set(name);
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
