import { HttpClient } from '@angular/common/http';
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
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Hls from 'hls.js';
import { MessageService } from 'primeng/api';
import { TranslocoPipe } from '@jsverse/transloco';
import { Select, SelectModule } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import type { PlayEpisodeResponse, QuotaInfo } from '@tiraiplay/shared';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { CatalogService, type DramaDetailApiResponse } from '../../core/services/catalog.service';
import { CmsService } from '../../core/services/cms.service';
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

interface CommentReplyItem {
  id: string;
  author: string;
  time: string;
  body: string;
  likes: number;
  replyTo?: string;
  isOwn?: boolean;
}

interface CommentViewItem {
  id: string;
  author: string;
  time: string;
  body: string;
  likes: number;
  isOwn: boolean;
  replies: CommentReplyItem[];
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
    '(window:scroll)': 'onWindowScroll()',
  },
})
export class WatchComponent {
  readonly slug = input<string>();
  readonly episode = input<string>();
  /** Video version from the ?v=id|en query param. */
  readonly v = input<string>();

  private readonly http = inject(HttpClient);
  private readonly catalog = inject(CatalogService);
  protected readonly auth = inject(AuthService);
  private readonly billing = inject(BillingService);
  private readonly cms = inject(CmsService);
  private readonly bookmarks = inject(BookmarkService);
  private readonly prefs = inject(PreferencesService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly playerEl = viewChild<ElementRef<HTMLElement>>('player');
  private readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  private readonly langSelects = viewChildren(Select);

  protected onWindowScroll(): void {
    for (const sel of this.langSelects()) {
      if (sel.overlayVisible()) {
        sel.hide(false);
      }
    }
  }

  protected readonly monogram = monogram;
  protected readonly stars = [1, 2, 3, 4, 5];

  protected readonly drama = computed(
    () => this.detailData()?.drama ?? (this.slug() ? this.catalog.getBySlug(this.slug()!) : undefined),
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

  // Player state (real HLS stream when backend active, demo timer fallback offline)
  protected readonly detailData = signal<DramaDetailApiResponse | null>(null);
  protected readonly liveStreamUrl = signal<string | null>(null);
  protected readonly subtitleProxyUrl = signal<string | null>(null);
  protected readonly streamLoading = signal(false);
  private readonly loadedStreamKey = signal<string | null>(null);
  private readonly videoDurationSec = signal(0);
  private readonly videoCurrentSec = signal(0);
  private hls: Hls | null = null;
  private lastViewReportAt = 0;

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
  protected readonly currentEpisodeMeta = computed(() => {
    const d = this.drama();
    if (!d) return undefined;
    return this.cms.getEpisodesForDrama(d).find((e) => e.number === this.episodeNumber());
  });
  protected readonly episodeTitleLabel = computed(() => {
    const title = this.currentEpisodeMeta()?.title?.trim() ?? '';
    const ep = this.episodeNumber();
    return title && title !== `Episode ${ep}` ? title : '';
  });
  protected readonly subtitleLabel = computed(() => {
    const subs = this.drama()?.subtitleLanguages ?? [];
    return subs.length ? subs.map((s) => s.toUpperCase()).join(' / ') : '';
  });
  protected readonly durationSeconds = computed(() =>
    this.videoDurationSec() > 0 ? this.videoDurationSec() : (this.drama()?.durationMinutes ?? 1) * 60,
  );
  protected readonly duration = computed(() => this.formatTime(this.durationSeconds()));
  protected readonly elapsed = computed(() =>
    this.videoDurationSec() > 0
      ? this.formatTime(this.videoCurrentSec())
      : this.formatTime(Math.floor((this.progress() / 100) * this.durationSeconds())),
  );

  protected readonly commentSort = signal<'new' | 'top'>('new');
  private readonly apiComments = signal<CommentViewItem[] | null>(null);
  private readonly ownComments = signal<OwnComment[]>([]);
  private readonly ownReplies = signal<Record<string, Array<{ id: string; body: string; replyTo?: string; likes: number }>>>({});
  private readonly likedComments = signal<ReadonlySet<string>>(new Set());
  protected readonly replyingTo = signal<{ rootId: string; author: string } | null>(null);
  protected readonly replyDraft = signal('');
  private readonly collapsedReplies = signal<ReadonlySet<string>>(new Set());

  protected readonly comments = computed<CommentViewItem[]>(() => {
    const remote = this.apiComments();
    if (remote !== null) {
      return this.commentSort() === 'top'
        ? [...remote].sort((a, b) => b.likes - a.likes)
        : remote;
    }

    const isId = this.i18n.lang() === 'id';
    const liked = this.likedComments();
    const userReplies = this.ownReplies();

    const mapReplies = (
      rootId: string,
      presetReplies: Array<{ id: string; author: string; time: string; body: string; baseLikes: number; replyTo?: string }>,
    ): CommentReplyItem[] => {
      const seeded: CommentReplyItem[] = presetReplies.map((r) => ({
        id: r.id,
        author: r.author,
        time: r.time,
        body: r.body,
        replyTo: r.replyTo,
        likes: r.baseLikes + (liked.has(r.id) ? 1 : 0),
      }));
      const added: CommentReplyItem[] = (userReplies[rootId] ?? []).map((r) => ({
        id: r.id,
        author: this.i18n.t('watch.you'),
        time: this.i18n.t('watch.justNow'),
        body: r.body,
        replyTo: r.replyTo,
        isOwn: true,
        likes: r.likes + (liked.has(r.id) ? 1 : 0),
      }));
      return [...seeded, ...added];
    };

    const own: CommentViewItem[] = this.ownComments().map((c) => ({
      id: c.id,
      author: this.i18n.t('watch.you'),
      time: this.i18n.t('watch.justNow'),
      body: c.body,
      isOwn: true,
      likes: c.likes + (liked.has(c.id) ? 1 : 0),
      replies: mapReplies(c.id, []),
    }));

    const presetSeedReplies: Record<
      string,
      Array<{ id: string; author: string; time: string; body: string; baseLikes: number; replyTo?: string }>
    > = {
      c1: [
        {
          id: 'c1-r1',
          author: 'Dimas A.',
          time: isId ? '1 jam lalu' : '1 hour ago',
          body: isId
            ? 'Setuju banget, adegan konfrontasinya terasa intens dari awal sampai akhir!'
            : 'Totally agree, that confrontation scene felt intense from start to finish!',
          baseLikes: 6,
          replyTo: this.i18n.t('watch.c1Author'),
        },
      ],
    };

    const presets: CommentViewItem[] = [
      { id: 'c1', baseLikes: 24, n: 1 },
      { id: 'c2', baseLikes: 15, n: 2 },
      { id: 'c3', baseLikes: 9, n: 3 },
    ].map((p) => ({
      id: p.id,
      author: this.i18n.t(`watch.c${p.n}Author`),
      time: this.i18n.t(`watch.c${p.n}Time`),
      body: this.i18n.t(`watch.c${p.n}Body`),
      isOwn: false,
      likes: p.baseLikes + (liked.has(p.id) ? 1 : 0),
      replies: mapReplies(p.id, presetSeedReplies[p.id] ?? []),
    }));

    const list = [...own, ...presets];
    if (this.commentSort() === 'top') {
      return [...list].sort((a, b) => b.likes - a.likes);
    }
    return list;
  });

  protected readonly totalCommentCount = computed(() =>
    this.comments().reduce((sum, c) => sum + 1 + c.replies.length, 0),
  );

  protected readonly draft = signal('');

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const s = this.slug();
      untracked(() => {
        if (s && this.auth.apiReachable()) {
          void this.loadDramaDetail(s);
        } else {
          this.detailData.set(null);
        }
      });
    });

    effect(() => {
      this.slug();
      const ep = this.episodeNumber();
      const dId = this.detailData()?.drama.id;
      const sort = this.commentSort();
      untracked(() => {
        this.stop(true);
        this.selectedRangeIndex.set(Math.floor((ep - 1) / EP_CHUNK_SIZE));
        this.replyingTo.set(null);
        this.replyDraft.set('');
        if (dId && this.auth.apiReachable()) {
          void this.loadCommentsFromApi(dId, ep, sort);
        } else {
          this.apiComments.set(null);
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.stop(false);
      this.destroyHls();
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

    if (this.auth.apiReachable() && this.apiComments() !== null) {
      if (!this.auth.isAuthenticated()) {
        this.auth.openAuthModal('login');
        return;
      }
      void firstValueFrom(
        this.http.post<{ liked: boolean; likes: number }>(`/api/comments/${id}/like`, {}),
      )
        .then((res) => {
          this.apiComments.update((list) =>
            list
              ? list.map((c) =>
                  c.id === id
                    ? { ...c, likes: res.likes }
                    : {
                        ...c,
                        replies: c.replies.map((r) => (r.id === id ? { ...r, likes: res.likes } : r)),
                      },
                )
              : null,
          );
        })
        .catch(() => undefined);
    }
  }

  protected rateDrama(score: number): void {
    const d = this.drama();
    if (this.auth.apiReachable() && this.detailData() && !this.auth.isAuthenticated()) {
      this.auth.openAuthModal('login');
      return;
    }
    this.userScore.set(score);
    if (d && this.auth.apiReachable() && this.detailData()) {
      void firstValueFrom(
        this.http.put(`/api/dramas/${d.id}/vote`, { score }),
      ).catch(() => undefined);
    }
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

    const epMeta = this.detailData()?.episodes.find((e) => e.number === this.episodeNumber());
    if (epMeta && this.auth.apiReachable()) {
      void this.requestAndPlayEpisode(epMeta.id);
      return;
    }

    // Offline / local fixture fallback
    this.playing.set(true);
    this.timer = setInterval(() => {
      this.progress.update((p) => (p >= 100 ? 0 : p + 1));
    }, 600);
  }

  protected seek(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const pct = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    this.progress.set(pct);

    const video = this.videoEl()?.nativeElement;
    if (video && this.liveStreamUrl() && Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = (pct / 100) * video.duration;
    }
  }

  protected cycleSpeed(): void {
    this.speedIndex.update((i) => (i + 1) % PLAYBACK_SPEEDS.length);
    const video = this.videoEl()?.nativeElement;
    if (video) {
      video.playbackRate = PLAYBACK_SPEEDS[this.speedIndex()];
    }
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
    const wasPlaying = this.playing();
    this.loadedStreamKey.set(null);
    this.prefs.setVideoLang(lang);
    void this.router.navigate([], {
      queryParams: { v: lang },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (wasPlaying) {
      const epMeta = this.detailData()?.episodes.find((e) => e.number === this.episodeNumber());
      if (epMeta && this.auth.apiReachable()) {
        void this.requestAndPlayEpisode(epMeta.id, lang);
      }
    }
  }

  protected choose(value: 'like' | 'dislike'): void {
    if (this.auth.apiReachable() && this.detailData() && !this.auth.isAuthenticated()) {
      this.auth.openAuthModal('login');
      return;
    }
    const nextVote = this.vote() === value ? '' : value;
    this.vote.set(nextVote);
    const d = this.drama();
    if (d && this.auth.apiReachable() && this.detailData()) {
      void firstValueFrom(
        this.http.put(`/api/dramas/${d.id}/vote`, { vote: nextVote || null }),
      ).catch(() => undefined);
    }
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

  protected async submitComment(event?: Event): Promise<void> {
    event?.preventDefault();
    const body = this.draft().trim();
    if (!body) return;

    const d = this.drama();
    if (d && this.auth.apiReachable() && this.detailData()) {
      if (!this.auth.isAuthenticated()) {
        this.auth.openAuthModal('login');
        return;
      }
      try {
        await firstValueFrom(
          this.http.post(`/api/dramas/${d.id}/episodes/${this.episodeNumber()}/comments`, {
            body,
          }),
        );
        this.draft.set('');
        await this.loadCommentsFromApi(d.id, this.episodeNumber(), this.commentSort());
        this.messages.add({
          severity: 'success',
          summary: this.i18n.t('watch.commentPosted'),
          detail: body,
          life: 2500,
        });
      } catch {
        this.messages.add({
          severity: 'error',
          summary: this.i18n.lang() === 'id' ? 'Gagal mengirim komentar' : 'Failed to post comment',
          detail: body,
          life: 2500,
        });
      }
      return;
    }

    this.ownComments.update((c) => [{ id: `own-${Date.now()}`, body, likes: 0 }, ...c]);
    this.draft.set('');
    this.messages.add({
      severity: 'success',
      summary: this.i18n.t('watch.commentPosted'),
      detail: body,
      life: 2500,
    });
  }

  protected openReply(rootId: string, author: string): void {
    const active = this.replyingTo();
    if (active && active.rootId === rootId && active.author === author) {
      this.cancelReply();
      return;
    }
    this.replyingTo.set({ rootId, author });
    this.replyDraft.set('');
    if (this.collapsedReplies().has(rootId)) {
      this.toggleRepliesVisibility(rootId);
    }
  }

  protected cancelReply(): void {
    this.replyingTo.set(null);
    this.replyDraft.set('');
  }

  protected onReplyDraft(event: Event): void {
    this.replyDraft.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected async submitReply(event: Event, rootId: string): Promise<void> {
    event.preventDefault();
    const body = this.replyDraft().trim();
    const target = this.replyingTo();
    if (!body || !target || target.rootId !== rootId) return;

    const d = this.drama();
    if (d && this.auth.apiReachable() && this.detailData()) {
      if (!this.auth.isAuthenticated()) {
        this.auth.openAuthModal('login');
        return;
      }
      try {
        await firstValueFrom(
          this.http.post(`/api/dramas/${d.id}/episodes/${this.episodeNumber()}/comments`, {
            body,
            parentId: rootId,
            replyToAuthor: target.author,
          }),
        );
        this.replyingTo.set(null);
        this.replyDraft.set('');
        await this.loadCommentsFromApi(d.id, this.episodeNumber(), this.commentSort());
        this.messages.add({
          severity: 'success',
          summary: this.i18n.lang() === 'id' ? 'Balasan terkirim' : 'Reply posted',
          detail: body,
          life: 2500,
        });
      } catch {
        this.messages.add({
          severity: 'error',
          summary: this.i18n.lang() === 'id' ? 'Gagal mengirim balasan' : 'Failed to post reply',
          detail: body,
          life: 2500,
        });
      }
      return;
    }

    this.ownReplies.update((map) => ({
      ...map,
      [rootId]: [
        ...(map[rootId] ?? []),
        {
          id: `reply-${Date.now()}`,
          body,
          replyTo: target.author,
          likes: 0,
        },
      ],
    }));

    this.replyingTo.set(null);
    this.replyDraft.set('');
    this.messages.add({
      severity: 'success',
      summary: this.i18n.lang() === 'id' ? 'Balasan terkirim' : 'Reply posted',
      detail: body,
      life: 2500,
    });
  }

  protected areRepliesExpanded(rootId: string): boolean {
    return !this.collapsedReplies().has(rootId);
  }

  protected toggleRepliesVisibility(rootId: string): void {
    const next = new Set(this.collapsedReplies());
    if (next.has(rootId)) next.delete(rootId);
    else next.add(rootId);
    this.collapsedReplies.set(next);
  }

  protected onVideoMetadata(): void {
    const video = this.videoEl()?.nativeElement;
    if (video && Number.isFinite(video.duration)) {
      this.videoDurationSec.set(Math.floor(video.duration));
      video.playbackRate = PLAYBACK_SPEEDS[this.speedIndex()];
    }
  }

  protected onVideoTimeUpdate(): void {
    const video = this.videoEl()?.nativeElement;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    this.videoCurrentSec.set(Math.floor(video.currentTime));
    this.progress.set((video.currentTime / video.duration) * 100);

    const now = Date.now();
    if (now - this.lastViewReportAt >= 15000) {
      this.lastViewReportAt = now;
      this.reportViewEvent(Math.floor(video.currentTime), false);
    }
  }

  protected onVideoEnded(): void {
    this.playing.set(false);
    const video = this.videoEl()?.nativeElement;
    this.reportViewEvent(Math.floor(video?.duration ?? 0), true);
    if (this.autoNext() && this.hasNext()) {
      this.stepEpisode(1);
    }
  }

  protected onVideoError(): void {
    this.playing.set(false);
    this.messages.add({
      severity: 'warn',
      summary: this.i18n.lang() === 'id' ? 'Stream tidak dapat dimuat' : 'Stream unavailable',
      detail:
        this.i18n.lang() === 'id'
          ? 'URL video sumber (.m3u8) belum tersedia atau sedang gangguan.'
          : 'The source video (.m3u8) URL is unavailable or unreachable.',
      life: 3200,
    });
  }

  private async loadDramaDetail(slug: string): Promise<void> {
    const detail = await this.catalog.fetchDramaDetail(slug);
    if (!detail || this.slug() !== slug) return;
    this.detailData.set(detail);
    this.vote.set(detail.viewerState.vote ?? '');
    this.userScore.set(detail.viewerState.userScore ?? 0);
    await this.loadCommentsFromApi(detail.drama.id, this.episodeNumber(), this.commentSort());
  }

  private async loadCommentsFromApi(
    dramaId: string,
    epNumber: number,
    sort: 'new' | 'top',
  ): Promise<void> {
    try {
      const rows = await firstValueFrom(
        this.http.get<
          Array<{
            id: string;
            author: string;
            time: string;
            body: string;
            likes: number;
            likedByMe?: boolean;
            isOwn: boolean;
            replies: Array<{
              id: string;
              author: string;
              time: string;
              body: string;
              likes: number;
              likedByMe?: boolean;
              replyTo?: string | null;
              isOwn?: boolean;
            }>;
          }>
        >(`/api/dramas/${dramaId}/episodes/${epNumber}/comments?sort=${sort}`),
      );
      if (Array.isArray(rows)) {
        const liked = new Set<string>();
        const mapped: CommentViewItem[] = rows.map((r) => {
          if (r.likedByMe) liked.add(r.id);
          return {
            id: r.id,
            author: r.author,
            time: this.formatCommentDate(r.time),
            body: r.body,
            likes: r.likes,
            isOwn: r.isOwn,
            replies: r.replies.map((rep) => {
              if (rep.likedByMe) liked.add(rep.id);
              return {
                id: rep.id,
                author: rep.author,
                time: this.formatCommentDate(rep.time),
                body: rep.body,
                likes: rep.likes,
                replyTo: rep.replyTo ?? undefined,
                isOwn: rep.isOwn,
              };
            }),
          };
        });
        this.likedComments.set(liked);
        this.apiComments.set(mapped);
      }
    } catch {
      this.apiComments.set(null);
    }
  }

  private async requestAndPlayEpisode(
    episodeId: string,
    overrideLang?: VideoLang,
  ): Promise<void> {
    const lang = overrideLang ?? (this.videoLang() || 'id');
    const key = `${episodeId}:${lang}`;
    const video = this.videoEl()?.nativeElement;

    if (this.loadedStreamKey() === key && this.liveStreamUrl() && video) {
      await video.play().catch(() => undefined);
      return;
    }

    this.streamLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<PlayEpisodeResponse>(`/api/episodes/${episodeId}/play`, {
          videoLang: lang,
        }),
      );
      this.auth.updateQuota(res.quota);
      this.loadedStreamKey.set(key);
      this.liveStreamUrl.set(res.streamProxyUrl);
      this.subtitleProxyUrl.set(res.subtitleProxyUrl);
      this.attachHlsStream(res.streamProxyUrl);
    } catch (err) {
      const e = err as { status?: number; error?: { code?: string; message?: string; quota?: QuotaInfo } };
      if (e.status === 401 && e.error?.code === 'LOGIN_REQUIRED_FOR_QUOTA') {
        this.messages.add({
          severity: 'warn',
          summary: this.i18n.lang() === 'id' ? 'Login Gratis untuk 10 Ep/Hari' : 'Sign in for 10 Ep/Day',
          detail: e.error.message,
          life: 4000,
        });
        this.auth.openAuthModal('login');
      } else if (e.status === 403 && e.error?.code === 'QUOTA_EXCEEDED') {
        if (e.error.quota) this.auth.updateQuota(e.error.quota);
        void this.billing.openVipModal(e.error.quota ?? null);
      } else {
        this.onVideoError();
      }
    } finally {
      this.streamLoading.set(false);
    }
  }

  private attachHlsStream(streamUrl: string): void {
    const video = this.videoEl()?.nativeElement;
    if (!video) return;
    this.destroyHls();

    if (Hls.isSupported()) {
      const hls = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = true; } });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          this.onVideoError();
        }
      });
      this.hls = hls;
      return;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      void video.play().catch(() => undefined);
    }
  }

  private destroyHls(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  private reportViewEvent(watchSeconds: number, completed: boolean): void {
    const d = this.drama();
    if (!d || !this.auth.apiReachable() || !this.detailData()) return;
    void firstValueFrom(
      this.http.post('/api/events/view', {
        dramaId: d.id,
        episodeNumber: this.episodeNumber(),
        watchSeconds,
        completed,
      }),
    ).catch(() => undefined);
  }

  private formatCommentDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(this.i18n.lang() === 'id' ? 'id-ID' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private stop(reset: boolean): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const video = this.videoEl()?.nativeElement;
    if (video && !video.paused) {
      video.pause();
    }
    this.playing.set(false);
    if (reset) {
      this.progress.set(0);
      this.videoCurrentSec.set(0);
      this.videoDurationSec.set(0);
      this.liveStreamUrl.set(null);
      this.subtitleProxyUrl.set(null);
      this.loadedStreamKey.set(null);
      this.destroyHls();
    }
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
