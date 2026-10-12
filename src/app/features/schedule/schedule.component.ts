import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { buildScheduleItems, SCHEDULE_SLOTS } from '../../data/schedule';
import type { ReleaseScheduleItem } from '../../core/models/schedule';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  imports: [RouterLink, EmptyStateComponent],
  templateUrl: './schedule.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleComponent {
  protected readonly catalog = inject(CatalogService);

  protected readonly selectedIso = signal(this.todayIso());

  protected readonly days = computed(() => {
    const now = new Date();
    const result: { iso: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const label = i === 0 ? 'Today' : `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
      result.push({ iso, label });
    }
    return result;
  });

  protected readonly items = computed<ReleaseScheduleItem[]>(() => {
    const base = buildScheduleItems(SCHEDULE_SLOTS, new Date());
    return base.map((item) => {
      const drama = this.catalog.getBySlug(item.dramaSlug);
      return {
        ...item,
        dramaTitle: drama?.title ?? item.dramaSlug,
        platformId: drama?.platformId ?? '',
      };
    });
  });

  protected readonly selectedItems = computed(() =>
    this.items().filter((i) => i.releaseDate === this.selectedIso()),
  );

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  protected dayMark(item: ReleaseScheduleItem): string {
    const d = new Date(item.releaseDate + 'T00:00:00');
    return String(d.getDate()).padStart(2, '0');
  }
}
