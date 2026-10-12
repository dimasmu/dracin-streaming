import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import type { Drama } from '../../core/models/drama';
import { monogram } from '../../core/utils/format';

@Component({
  imports: [RouterLink, DramaCardComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  protected readonly catalog = inject(CatalogService);
  protected readonly monogram = monogram;

  protected readonly featured = signal<Drama[]>([]);
  protected readonly current = signal(0);
  protected readonly activeGenre = signal('All');

  protected readonly trending = computed(() => this.catalog.trending(12));
  protected readonly recent = computed(() => this.catalog.recent(12));
  protected readonly mostViewed = computed(() => this.catalog.mostViewed(10));
  protected readonly mostLiked = computed(() => this.catalog.mostLiked(10));

  protected readonly genreOptions = computed(() => [
    'All',
    ...this.catalog.genres.map((g) => g.name),
  ]);

  protected readonly genreDramas = computed(() => {
    const g = this.activeGenre();
    if (g === 'All') return this.catalog.trending(12);
    return this.catalog.filter({ genres: [g], sort: 'popular' }).slice(0, 12);
  });

  protected readonly schedulePreview = computed(() => {
    const now = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return this.catalog.trending(6).map((d, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() + ((i % 6) + 1));
      const hours = 19 + (i % 3);
      const minutes = i % 2 ? 30 : 0;
      return {
        id: `${d.id}-preview`,
        dramaSlug: d.slug,
        dramaTitle: d.title,
        episodeNumber: (d.latestEpisode ?? 0) + 1,
        platformId: d.platformId,
        subtitleStatus: d.subtitleLanguages[0],
        dayLabel: weekdays[date.getDay()],
        releaseTime: `${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')} WIB`,
      };
    });
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const top = [...this.catalog.dramas]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 3);
    this.featured.set(top);
    this.startTimer();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private startTimer(): void {
    this.timer = setInterval(() => this.step(1), 7000);
  }

  protected step(delta: number): void {
    const len = this.featured().length;
    if (!len) return;
    this.current.set((this.current() + delta + len) % len);
  }

  protected go(index: number): void {
    this.current.set(index);
  }
}
