import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogService } from '../../core/services/catalog.service';
import { CmsService } from '../../core/services/cms.service';
import { I18nService } from '../../core/services/i18n.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { buildScheduleItems, SCHEDULE_SLOTS } from '../../data/schedule';
import type { ReleaseScheduleItem } from '../../core/models/schedule';

const DAY_NAME_TO_NUM: Record<string, number> = {
  Minggu: 0,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
};

@Component({
  imports: [RouterLink, TranslocoPipe, EmptyStateComponent],
  templateUrl: './schedule.component.html',
})
export class ScheduleComponent {
  protected readonly catalog = inject(CatalogService);
  private readonly cms = inject(CmsService);
  private readonly i18n = inject(I18nService);

  protected readonly selectedIso = signal(this.todayIso());

  protected readonly days = computed(() => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'short' });
    const today = this.i18n.t('schedule.today');
    const result: { iso: string; label: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const label = i === 0 ? today : `${fmt.format(d)} ${d.getDate()}`;
      result.push({ iso, label });
    }
    return result;
  });

  protected readonly items = computed<ReleaseScheduleItem[]>(() => {
    const cmsSlots = this.cms.scheduleSlots();
    if (cmsSlots.length) {
      const now = new Date();
      const todayNum = now.getDay();
      const built: ReleaseScheduleItem[] = [];
      for (const slot of cmsSlots) {
        if (slot.status === 'Ditunda') continue;
        const targetDay = DAY_NAME_TO_NUM[slot.day] ?? 1;
        const delta = (targetDay - todayNum + 7) % 7;
        for (const offsetDays of delta === 0 ? [0, 7] : [delta]) {
          const date = new Date(now);
          date.setDate(now.getDate() + offsetDays);
          const iso = date.toISOString().slice(0, 10);
          const drama =
            this.catalog.dramas.find((d) => d.id === slot.dramaId || d.slug === slot.dramaSlug) ??
            this.catalog.getBySlug(slot.dramaSlug ?? slot.dramaId);
          built.push({
            id: `${slot.id}-${iso}`,
            dramaSlug: drama?.slug ?? slot.dramaSlug ?? slot.dramaId,
            dramaTitle: drama?.title ?? slot.dramaId,
            platformId: drama?.platformId ?? '',
            episodeNumber: slot.ep,
            releaseDate: iso,
            releaseTime: slot.time.includes('WIB') ? slot.time : `${slot.time} WIB`,
            isDemo: true,
          });
        }
      }
      return built.sort((a, b) => (a.releaseDate + (a.releaseTime ?? '')).localeCompare(b.releaseDate + (b.releaseTime ?? '')));
    }

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
