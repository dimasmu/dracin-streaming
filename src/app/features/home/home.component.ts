import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { type Drama } from '../../core/models/drama';
import { BookmarkService } from '../../core/services/bookmark.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CmsService } from '../../core/services/cms.service';
import { DragScrollDirective } from '../../shared/directives/drag-scroll.directive';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { monogram, videoLangLabel } from '../../core/utils/format';
import { I18nService } from '../../core/services/i18n.service';

const AUTO_ROTATE_MS = 7000;

@Component({
  imports: [RouterLink, TranslocoPipe, DramaCardComponent, DragScrollDirective],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  protected readonly catalog = inject(CatalogService);
  private readonly cms = inject(CmsService);
  protected readonly monogram = monogram;
  protected readonly videoLangs = (langs: readonly string[]) => videoLangLabel(langs, ' · ');
  private readonly i18n = inject(I18nService);
  private readonly bookmarks = inject(BookmarkService);
  private readonly messages = inject(MessageService);
  private readonly heroTrack = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly featured = computed(() => this.catalog.featured());
  protected readonly current = signal(0);
  protected readonly isId = computed(() => this.i18n.lang() === 'id');
  protected readonly brokenBackdrops = signal<ReadonlySet<string>>(new Set());

  protected isBackdropBroken(id: string): boolean {
    return this.brokenBackdrops().has(id);
  }

  protected markBackdropBroken(id: string): void {
    this.brokenBackdrops.update((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  protected onBackdropLoad(id: string, event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    // YouTube returns a 120x90 grey "..." placeholder image on HTTP 404 without firing (error).
    if (img.naturalWidth <= 160 && img.naturalHeight <= 120) {
      this.markBackdropBroken(id);
    }
  }

  protected isBookmarked(id: string): boolean {
    return this.bookmarks.isBookmarked(id);
  }

  protected toggleBookmark(drama: Drama): void {
    const added = this.bookmarks.toggle(drama.id);
    this.messages.add({
      severity: added ? 'success' : 'info',
      summary: added
        ? this.isId()
          ? 'Disimpan ke Bookmark'
          : 'Saved to Bookmarks'
        : this.isId()
          ? 'Dihapus dari Bookmark'
          : 'Removed from Bookmarks',
      detail: drama.title,
      life: 2600,
    });
  }

  protected hasLang(d: Drama, lang: 'id' | 'en'): boolean {
    return d.videoLanguages.includes(lang) || d.subtitleLanguages.includes(lang);
  }

  protected ratingLabel(d: Drama): string | null {
    return typeof d.rating === 'number' && isFinite(d.rating) ? d.rating.toFixed(1) : null;
  }

  protected platformTone(d: Drama): string {
    return this.catalog.getPlatform(d.platformId)?.tone ?? d.tone;
  }

  protected platformName(platformId: string): string {
    return this.catalog.getPlatform(platformId)?.name ?? platformId;
  }
  protected readonly activeGenre = signal('All');

  /** Platform names selected in the homepage strip. */
  protected readonly selectedPlatforms = signal<ReadonlySet<string>>(new Set());

  protected readonly trending = computed(() => this.catalog.trending(10));
  protected readonly recent = computed(() => this.catalog.recent(10));
  protected readonly mostViewed = computed(() => this.catalog.mostViewed(10));
  protected readonly mostLiked = computed(() => this.catalog.mostLiked(10));

  protected readonly genreOptions = computed(() => [
    'All',
    ...this.catalog.genres.map((g) => g.name),
  ]);

  protected readonly genreDramas = computed(() => {
    const g = this.activeGenre();
    if (g === 'All') return this.catalog.trending(10);
    return this.catalog
      .filter({ genres: [g], sort: 'popular' })
      .slice(0, 10);
  });

  protected readonly platformCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const p of this.catalog.platforms) counts[p.id] = this.catalog.countByPlatform(p.name);
    return counts;
  });

  /** Defaults to trending; narrows to the selected platforms once any are picked. */
  protected readonly platformResults = computed(() => {
    const selected = [...this.selectedPlatforms()];
    if (selected.length === 0) return this.catalog.trending(10);
    return this.catalog.filter({ platforms: selected, sort: 'popular' }).slice(0, 10);
  });

  protected readonly schedulePreview = computed(() => {
    const now = new Date();
    const dayFmt = new Intl.DateTimeFormat(this.i18n.lang(), { weekday: 'short' });
    const cmsSlots = this.cms.scheduleSlots().filter((s) => s.status !== 'Ditunda');
    if (cmsSlots.length) {
      const dayNumMap: Record<string, number> = {
        Minggu: 0,
        Senin: 1,
        Selasa: 2,
        Rabu: 3,
        Kamis: 4,
        Jumat: 5,
        Sabtu: 6,
      };
      const todayNum = now.getDay();
      return cmsSlots.slice(0, 6).map((slot) => {
        const delta = ((dayNumMap[slot.day] ?? 1) - todayNum + 7) % 7;
        const date = new Date(now);
        date.setDate(now.getDate() + delta);
        const drama =
          this.catalog.dramas.find((d) => d.id === slot.dramaId || d.slug === slot.dramaSlug) ??
          this.catalog.dramas[0];
        return {
          id: `slot-${slot.id}`,
          dramaSlug: drama?.slug ?? slot.dramaSlug ?? slot.dramaId,
          dramaTitle: drama?.title ?? slot.dramaId,
          episodeNumber: slot.ep,
          platformId: drama?.platformId ?? 'TiraiPlay',
          dayLabel: dayFmt.format(date),
          releaseTime: slot.time.includes('WIB') ? slot.time : `${slot.time} WIB`,
        };
      });
    }
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
        dayLabel: dayFmt.format(date),
        releaseTime: `${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')} WIB`,
      };
    });
  });

  private timer: ReturnType<typeof setInterval> | null = null;
  private programmaticTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private programmaticScroll = false;
  private autoPaused = false;
  private trackEl: HTMLElement | null = null;

  ngOnInit(): void {
    this.startTimer();

    // Keep the dots in sync with the scroll position produced by dragging.
    const track = this.heroTrack.nativeElement.querySelector<HTMLElement>('.hero-track');
    if (track) {
      track.addEventListener('scroll', this.onHeroScroll, { passive: true });
      track.addEventListener('scrollend', this.onHeroScrollEnd, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          if (track.clientWidth > 0) {
            this.programmaticScroll = true;
            track.scrollTo({ left: this.current() * track.clientWidth, behavior: 'auto' });
            this.releaseProgrammaticSoon(120);
          }
        });
        this.resizeObserver.observe(track);
      }
      this.trackEl = track;
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.programmaticTimer) {
      clearTimeout(this.programmaticTimer);
      this.programmaticTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.trackEl?.removeEventListener('scroll', this.onHeroScroll);
    this.trackEl?.removeEventListener('scrollend', this.onHeroScrollEnd);
  }

  private readonly onHeroScroll = (): void => {
    if (this.programmaticScroll) return;
    const track = this.trackEl;
    if (!track || !track.clientWidth) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const clamped = Math.max(0, Math.min(this.featured().length - 1, index));
    if (clamped !== this.current()) this.current.set(clamped);
  };

  private readonly onHeroScrollEnd = (): void => {
    this.programmaticScroll = false;
    if (this.programmaticTimer) {
      clearTimeout(this.programmaticTimer);
      this.programmaticTimer = null;
    }
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
    this.stopTimer();
    this.timer = setInterval(() => {
      if (!this.autoPaused) this.advance(1);
    }, AUTO_ROTATE_MS);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  protected step(delta: number): void {
    this.startTimer();
    this.advance(delta);
  }

  private advance(delta: number): void {
    const len = this.featured().length;
    if (!len) return;
    const next = (this.current() + delta + len) % len;
    this.current.set(next);
    this.scrollHeroTo(next);
  }

  protected go(index: number): void {
    this.startTimer();
    this.current.set(index);
    this.scrollHeroTo(index);
  }

  private releaseProgrammaticSoon(ms: number): void {
    if (this.programmaticTimer) clearTimeout(this.programmaticTimer);
    this.programmaticTimer = setTimeout(() => {
      this.programmaticScroll = false;
      this.programmaticTimer = null;
    }, ms);
  }

  /** Drives the scroll-snap track; falls back silently if the DOM is absent. */
  private scrollHeroTo(index: number): void {
    const track = this.trackEl;
    if (!track) return;
    this.programmaticScroll = true;
    this.releaseProgrammaticSoon(700);
    requestAnimationFrame(() => {
      track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    });
  }
}