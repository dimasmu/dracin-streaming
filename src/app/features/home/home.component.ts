import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { DragScrollDirective } from '../../shared/directives/drag-scroll.directive';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import type { Drama } from '../../core/models/drama';
import { monogram } from '../../core/utils/format';

const AUTO_ROTATE_MS = 7000;

@Component({
  imports: [RouterLink, DramaCardComponent, DragScrollDirective],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  protected readonly catalog = inject(CatalogService);
  protected readonly monogram = monogram;
  private readonly heroTrack = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly featured = signal<Drama[]>([]);
  protected readonly current = signal(0);
  protected readonly activeGenre = signal('All');

  /** Platform names selected in the homepage strip. */
  protected readonly selectedPlatforms = signal<ReadonlySet<string>>(new Set());

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
    return this.catalog
      .filter({ genres: [g], sort: 'popular' })
      .slice(0, 12);
  });

  protected readonly platformCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const p of this.catalog.platforms) counts[p.id] = this.catalog.countByPlatform(p.name);
    return counts;
  });

  /** Defaults to trending; narrows to the selected platforms once any are picked. */
  protected readonly platformResults = computed(() => {
    const selected = [...this.selectedPlatforms()];
    if (selected.length === 0) return this.catalog.trending(12);
    return this.catalog.filter({ platforms: selected, sort: 'popular' }).slice(0, 12);
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
  private autoPaused = false;

  ngOnInit(): void {
    const top = [...this.catalog.dramas].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3);
    this.featured.set(top);
    this.startTimer();

    // Keep the dots in sync with the scroll position produced by dragging.
    const track = this.heroTrack.nativeElement.querySelector<HTMLElement>('.hero-track');
    if (track) {
      track.addEventListener('scroll', this.onHeroScroll, { passive: true });
      this.trackEl = track;
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.trackEl?.removeEventListener('scroll', this.onHeroScroll);
  }

  private trackEl: HTMLElement | null = null;

  private readonly onHeroScroll = (): void => {
    const track = this.trackEl;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const clamped = Math.max(0, Math.min(this.featured().length - 1, index));
    if (clamped !== this.current()) this.current.set(clamped);
  };

  protected togglePlatform(name: string): void {
    const next = new Set(this.selectedPlatforms());
    if (next.has(name)) next.delete(name);
    else next.add(name);
    this.selectedPlatforms.set(next);
  }

  protected clearPlatforms(): void {
    this.selectedPlatforms.set(new Set());
  }

  protected pauseAuto(): void {
    this.autoPaused = true;
  }

  protected resumeAuto(): void {
    this.autoPaused = false;
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      if (!this.autoPaused) this.step(1);
    }, AUTO_ROTATE_MS);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  protected step(delta: number): void {
    const len = this.featured().length;
    if (!len) return;
    const next = (this.current() + delta + len) % len;
    this.current.set(next);
    this.scrollHeroTo(next);
  }

  protected go(index: number): void {
    this.current.set(index);
    this.scrollHeroTo(index);
  }

  /** Drives the scroll-snap track; falls back silently if the DOM is absent. */
  private scrollHeroTo(index: number): void {
    afterNextRender(() => {
      const track = this.trackEl;
      if (!track) return;
      track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    });
  }
}