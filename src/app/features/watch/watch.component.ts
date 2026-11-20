import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslocoPipe } from '@jsverse/transloco';
import { SelectModule } from 'primeng/select';
import { CatalogService } from '../../core/services/catalog.service';
import { BookmarkService } from '../../core/services/bookmark.service';
import { I18nService } from '../../core/services/i18n.service';
import { PreferencesService, VideoLang } from '../../core/services/preferences.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { DragScrollDirective } from '../../shared/directives/drag-scroll.directive';
import { formatAired, monogram, ratingStars, videoLangLabel } from '../../core/utils/format';

interface OwnComment {
  id: string;
  body: string;
  likes: number;
}

interface EpisodeRange {
  index: number;
  start: number;
  end: number;
  label: string;
}

const EP_CHUNK_SIZE = 30;
const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;

@Component({
  imports: [
    FormsModule,
    RouterLink,
    SelectModule,
    TranslocoPipe,
    DramaCardComponent,
    EmptyStateComponent,
    DragScrollDirective,
  ],
  templateUrl: './watch.component.html',
  host: {
    '(document:fullscreenchange)': 'onFullscreenChange()',
    '(document:keydown)': 'onGlobalKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class WatchComponent {
  readonly slug = input<string>();
  readonly episode = input<string>();
  /** Video version from the ?v=id|en query param. */
  readonly v = input<string>();

  private readonly catalog = inject(CatalogService);
  private readonly bookmarks = inject(BookmarkService);
  private readonly prefs = inject(PreferencesService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly playerEl = viewChild<ElementRef<HTMLElement>>('player');

  protected readonly monogram = monogram;
  protected readonly stars = [1, 2, 3, 4, 5];

  protected readonly drama = computed(() =>
    this.slug() ? this.catalog.getBySlug(this.slug()!) : undefined,
  );

  protected readonly totalEpisodes = computed(() => Math.max(1, this.drama()?.totalEpisodes ?? 1));

  protected readonly episodeNumber = computed(() => {
    const n = Math.floor(Number(this.episode()));
    if (!isFinite(n) || n < 1) return 1;
    return Math.min(n, this.totalEpisodes());
  });

  protected readonly hasPrev = computed(() => this.episodeNumber() > 1);
  protected readonly hasNext = computed(() => this.episodeNumber() < this.totalEpisodes());

  protected readonly episodeRanges = computed<EpisodeRange[]>(() => {
    const total = this.totalEpisodes();
    const ranges: EpisodeRange[] = [];
    for (let start = 1, idx = 0; start <= total; start += EP_CHUNK_SIZE, idx++) {
      const end = Math.min(total, start + EP_CHUNK_SIZE - 1);
      ranges.push({
        index: idx,
        start,
        end,
        label: `Episode ${start} – ${end}`,
      });
    }
    return ranges;
  });

  protected readonly selectedRangeIndex = signal(0);

  protected readonly visibleEpisodeNumbers = computed(() => {
    const ranges = this.episodeRanges();
    const range = ranges[this.selectedRangeIndex()] ?? ranges[0];
    if (!range) return [1];
    return Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  });

  protected readonly allEpisodeNumbers = computed(() =>
    Array.from({ length: this.totalEpisodes() }, (_, i) => i + 1),
  );

  protected readonly related = computed(() =>
    this.drama() ? this.catalog.related(this.drama()!, 10) : [],
  );

  /** Up Next / Rekomendasi Lanjutan compact list in the right sidebar */
  protected readonly upNextList = computed(() => this.related().slice(0, 4));

  protected readonly dramaTags = computed<string[]>(() => {
    const d = this.drama();
    if (!d) return [];
    if (d.tags && d.tags.length > 0) return d.tags;
    return [
      ...d.genres.map((g) => this.i18n.t(`genre.${g}`)),
      d.platformId,
      d.status === 'completed' ? (this.i18n.lang() === 'id' ? 'Tamat' : 'Completed') : 'Ongoing',
      ...(d.releaseYear ? [String(d.releaseYear)] : []),
    ];
  });

  protected readonly bookmarked = computed(() =>
    this.drama() ? this.bookmarks.isBookmarked(this.drama()!.id) : false,
  );

  protected readonly statusLabel = computed(() => {
    const s = this.drama()?.status;
    return s && s !== 'unknown' ? this.i18n.t('status.' + s) : '';
  });
  protected readonly ratingFilled = computed(() => ratingStars(this.drama()?.rating));
  protected readonly aired = computed(() => {
    const d = this.drama();
    return d && (d.releaseDate || d.releaseYear)
      ? formatAired(d.releaseDate, d.releaseYear, this.i18n.lang(), this.i18n.t('common.tba'))
      : '';
  });

  // Demo-player state
  protected readonly playing = signal(false);
  protected readonly progress = signal(18);
  protected readonly muted = signal(false);
  protected readonly quality = signal<'1080p' | '720p'>('1080p');
  protected readonly speedIndex = signal(0);
  protected readonly speedLabel = computed(() => `${PLAYBACK_SPEEDS[this.speedIndex()]}x`);
  protected readonly aspectVertical = signal(false);
  protected readonly isFullscreen = signal(false);
  protected readonly epMenuOpen = signal(false);
  protected readonly reelTransition = signal<'up' | 'down' | ''>('');
  protected readonly showReelsHint = signal(false);
  protected readonly swipeFeedback = signal<string>('');
  protected readonly swipeOffsetY = signal(0);
  protected readonly shortcutsOpen = signal(false);
  protected readonly server = signal(1);
  protected readonly autoPlay = signal(true);
  protected readonly autoNext = signal(true);
  protected readonly lightsOut = signal(false);
  protected readonly vote = signal<'' | 'like' | 'dislike'>('');
  protected readonly userScore = signal(0);

  private swipeStartY: number | null = null;
  private swipePointerId: number | null = null;
  private lastWheelStepAt = 0;
  private swipeFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private reelTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private reelsHintTimer: ReturnType<typeof setTimeout> | null = null;

  /** Video versions this drama has, in display order. */
  protected readonly videoLangs = computed<VideoLang[]>(() => this.drama()?.videoLanguages ?? []);

  protected readonly videoLang = computed<VideoLang | ''>(() => {
    const langs = this.videoLangs();
    for (const wanted of [this.v(), this.prefs.videoLang(), this.i18n.lang()]) {
      const match = langs.find((l) => l === wanted);
      if (match) return match;
    }
    return langs[0] ?? '';
  });

  protected readonly versionParams = computed(() => (this.v() ? { v: this.videoLang() } : {}));

  protected readonly videoLangOptions = computed(() =>
    this.videoLangs().map((value) => ({ value, label: this.i18n.t('videoLang.' + value + 'Name') })),
  );

  protected readonly videoLangText = computed(() => videoLangLabel(this.videoLangs()));

  protected readonly episodesUnit = computed(() =>
    this.i18n.t(this.totalEpisodes() === 1 ? 'watch.unitOne' : 'watch.unitMany'),
  );
  protected readonly durationSeconds = computed(() => (this.drama()?.durationMinutes ?? 1) * 60);
  protected readonly duration = computed(() => this.formatTime(this.durationSeconds()));
  protected readonly elapsed = computed(() =>
    this.formatTime(Math.floor((this.progress() / 100) * this.durationSeconds())),
  );

  protected readonly commentSort = signal<'new' | 'top'>('new');
  private readonly ownComments = signal<OwnComment[]>([]);
  private readonly likedComments = signal<ReadonlySet<string>>(new Set());

  protected readonly comments = computed(() => {
    const own = this.ownComments().map((c) => ({
      id: c.id,
      author: this.i18n.t('watch.you'),
      time: this.i18n.t('watch.justNow'),
      body: c.body,
      likes: c.likes + (this.likedComments().has(c.id) ? 1 : 0),
    }));
    const presets = [
      { id: 'c1', baseLikes: 24, n: 1 },
      { id: 'c2', baseLikes: 15, n: 2 },
      { id: 'c3', baseLikes: 9, n: 3 },
    ].map((p) => ({
      id: p.id,
      author: this.i18n.t(`watch.c${p.n}Author`),
      time: this.i18n.t(`watch.c${p.n}Time`),
      body: this.i18n.t(`watch.c${p.n}Body`),
      likes: p.baseLikes + (this.likedComments().has(p.id) ? 1 : 0),
    }));
    const list = [...own, ...presets];
    if (this.commentSort() === 'top') {
      return [...list].sort((a, b) => b.likes - a.likes);
    }
    return list;
  });

  protected readonly draft = signal('');

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      this.slug();
      const ep = this.episodeNumber();
      untracked(() => {
        this.stop(true);
        this.selectedRangeIndex.set(Math.floor((ep - 1) / EP_CHUNK_SIZE));
      });
    });
    this.destroyRef.onDestroy(() => {
      this.stop(false);
      if (this.swipeFeedbackTimer) clearTimeout(this.swipeFeedbackTimer);
      if (this.reelTransitionTimer) clearTimeout(this.reelTransitionTimer);
      if (this.reelsHintTimer) clearTimeout(this.reelsHintTimer);
    });
  }

  protected onFullscreenChange(): void {
    const active = !!document.fullscreenElement;
    this.isFullscreen.set(active);
    this.epMenuOpen.set(false);
    if (this.reelsHintTimer) clearTimeout(this.reelsHintTimer);
    if (active) {
      this.showReelsHint.set(true);
      this.reelsHintTimer = setTimeout(() => this.showReelsHint.set(false), 2600);
    } else {
      this.showReelsHint.set(false);
    }
  }

  protected onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.epMenuOpen()) {
      this.epMenuOpen.set(false);
      return;
    }
    if (!this.isFullscreen()) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.stepEpisode(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.stepEpisode(-1);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.epMenuOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.watch-ep-dropdown-wrap')) {
      this.epMenuOpen.set(false);
    }
  }

  protected selectEpisode(ep: number): void {
    this.epMenuOpen.set(false);
    const d = this.drama();
    if (!d || !isFinite(ep) || ep < 1 || ep > this.totalEpisodes()) return;
    void this.router.navigate(['/watch', d.slug, ep], { queryParams: this.versionParams() });
  }

  protected stepEpisode(delta: -1 | 1): void {
    const d = this.drama();
    if (!d) return;
    const target = this.episodeNumber() + delta;
    if (target < 1 || target > this.totalEpisodes()) {
      this.showSwipeFeedback(
        delta > 0
          ? this.i18n.lang() === 'id'
            ? 'Episode terakhir'
            : 'Last episode'
          : this.i18n.lang() === 'id'
            ? 'Episode pertama'
            : 'First episode',
      );
      return;
    }
    this.reelTransition.set(delta > 0 ? 'up' : 'down');
    if (this.reelTransitionTimer) clearTimeout(this.reelTransitionTimer);
    this.reelTransitionTimer = setTimeout(() => this.reelTransition.set(''), 260);
    this.showSwipeFeedback(`${delta > 0 ? '↑' : '↓'} Episode ${target}`);
    void this.router.navigate(['/watch', d.slug, target], { queryParams: this.versionParams() });
  }

  protected onStagePointerDown(event: PointerEvent): void {
    if (!this.isFullscreen() && !this.aspectVertical()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, select, a, input, .watch-hud-bottom, .watch-ep-dropdown-wrap')) return;
    this.swipeStartY = event.clientY;
    this.swipePointerId = event.pointerId;
    this.swipeOffsetY.set(0);
  }

  protected onStagePointerMove(event: PointerEvent): void {
    if (this.swipeStartY === null || event.pointerId !== this.swipePointerId) return;
    const dy = event.clientY - this.swipeStartY;
    this.swipeOffsetY.set(Math.max(-90, Math.min(90, dy)));
  }

  protected onStagePointerUp(event: PointerEvent): void {
    if (this.swipeStartY === null || event.pointerId !== this.swipePointerId) return;
    const dy = event.clientY - this.swipeStartY;
    this.swipeStartY = null;
    this.swipePointerId = null;
    this.swipeOffsetY.set(0);
    if (Math.abs(dy) >= 56) {
      // Swipe up (dy < 0) -> next episode; swipe down (dy > 0) -> previous episode (Instagram Reels)
      this.stepEpisode(dy < 0 ? 1 : -1);
    }
  }

  protected onStageWheel(event: WheelEvent): void {
    if (!this.isFullscreen()) return;
    if (Math.abs(event.deltaY) < 28) return;
    event.preventDefault();
    const now = Date.now();
    if (now - this.lastWheelStepAt < 480) return;
    this.lastWheelStepAt = now;
    this.stepEpisode(event.deltaY > 0 ? 1 : -1);
  }

  private showSwipeFeedback(text: string): void {
    this.swipeFeedback.set(text);
    if (this.swipeFeedbackTimer) clearTimeout(this.swipeFeedbackTimer);
    this.swipeFeedbackTimer = setTimeout(() => this.swipeFeedback.set(''), 1300);
  }

  protected selectRange(event: Event): void {
    const idx = Number((event.target as HTMLSelectElement).value);
    if (isFinite(idx) && idx >= 0) {
      this.selectedRangeIndex.set(idx);
    }
  }

  protected setCommentSort(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.commentSort.set(val === 'top' ? 'top' : 'new');
  }

  protected isCommentLiked(id: string): boolean {
    return this.likedComments().has(id);
  }

  protected toggleCommentLike(id: string): void {
    const next = new Set(this.likedComments());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.likedComments.set(next);
  }

  protected rateDrama(score: number): void {
    this.userScore.set(score);
    this.messages.add({
      severity: 'success',
      summary: this.i18n.lang() === 'id' ? 'Penilaian disimpan' : 'Rating saved',
      detail: `${score} / 5 ★`,
      life: 2000,
    });
  }

  protected togglePlay(): void {
    if (this.playing()) {
      this.stop(false);
      return;
    }
    this.playing.set(true);
    this.timer = setInterval(() => {
      this.progress.update((p) => (p >= 100 ? 0 : p + 1));
    }, 600);
  }

  protected seek(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    this.progress.set(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
  }

  protected cycleSpeed(): void {
    this.speedIndex.update((i) => (i + 1) % PLAYBACK_SPEEDS.length);
  }

  protected toggleQuality(): void {
    this.quality.update((q) => (q === '1080p' ? '720p' : '1080p'));
  }

  protected toggleAspect(): void {
    this.aspectVertical.update((v) => !v);
  }

  protected toggleFullscreen(): void {
    const el = this.playerEl()?.nativeElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  protected setVideoLang(lang: VideoLang | null): void {
    if (!lang || lang === this.videoLang()) return;
    this.prefs.setVideoLang(lang);
    void this.router.navigate([], {
      queryParams: { v: lang },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected choose(value: 'like' | 'dislike'): void {
    this.vote.set(this.vote() === value ? '' : value);
  }

  protected toggleBookmark(): void {
    const d = this.drama();
    if (!d) return;
    const added = this.bookmarks.toggle(d.id);
    this.messages.add({
      severity: 'success',
      summary: this.i18n.t(added ? 'card.addedBookmark' : 'card.removedBookmark'),
      detail: d.title,
      life: 2500,
    });
  }

  protected async share(): Promise<void> {
    const d = this.drama();
    if (!d) return;
    const version = this.videoLang();
    const url = `${window.location.origin}/watch/${d.slug}/${this.episodeNumber()}${version ? `?v=${version}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      this.messages.add({
        severity: 'success',
        summary: this.i18n.t('watch.linkCopied'),
        detail: url,
        life: 2500,
      });
    } catch {
      this.messages.add({
        severity: 'warn',
        summary: this.i18n.t('watch.linkFailed'),
        detail: url,
        life: 4000,
      });
    }
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected submitComment(event?: Event): void {
    event?.preventDefault();
    const body = this.draft().trim();
    if (!body) return;
    this.ownComments.update((c) => [{ id: `own-${Date.now()}`, body, likes: 0 }, ...c]);
    this.draft.set('');
    this.messages.add({
      severity: 'success',
      summary: this.i18n.t('watch.commentPosted'),
      detail: body,
      life: 2500,
    });
  }

  private stop(reset: boolean): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing.set(false);
    if (reset) this.progress.set(0);
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
