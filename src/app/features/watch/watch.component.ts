import {
  ChangeDetectionStrategy,
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

/** A comment you posted. Its author and time are translated when shown, so they follow the website language. */
interface OwnComment {
  body: string;
}

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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly playerEl = viewChild<ElementRef<HTMLElement>>('player');

  protected readonly monogram = monogram;
  protected readonly stars = [0, 1, 2, 3, 4];

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
  protected readonly episodeNumbers = computed(() =>
    Array.from({ length: this.totalEpisodes() }, (_, i) => i + 1),
  );

  protected readonly related = computed(() =>
    this.drama() ? this.catalog.related(this.drama()!, 8) : [],
  );
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

  // Demo-player state. There is no real media source behind any of this.
  protected readonly playing = signal(false);
  protected readonly progress = signal(0);
  protected readonly muted = signal(false);
  protected readonly quality = signal<'HD' | 'SD'>('HD');
  protected readonly server = signal(1);
  protected readonly autoPlay = signal(true);
  protected readonly autoNext = signal(true);
  protected readonly lightsOut = signal(false);
  protected readonly vote = signal<'' | 'like' | 'dislike'>('');

  /** Video versions this drama has, in display order. */
  protected readonly videoLangs = computed<VideoLang[]>(() => this.drama()?.videoLanguages ?? []);

  /**
   * Which video version is playing: the URL's `?v=` first, then what the
   * viewer last chose, then the website language, then the first version.
   * The website language is only a starting point; the two are independent.
   */
  protected readonly videoLang = computed<VideoLang | ''>(() => {
    const langs = this.videoLangs();
    for (const wanted of [this.v(), this.prefs.videoLang(), this.i18n.lang()]) {
      const match = langs.find((l) => l === wanted);
      if (match) return match;
    }
    return langs[0] ?? '';
  });

  /** Query params that keep the chosen version while moving between episodes. */
  protected readonly versionParams = computed(() => (this.v() ? { v: this.videoLang() } : {}));

  /** Dropdown options. Names follow the website language; values are the video versions. */
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

  private readonly ownComments = signal<OwnComment[]>([]);
  protected readonly comments = computed(() => [
    ...this.ownComments().map((c) => ({
      author: this.i18n.t('watch.you'),
      time: this.i18n.t('watch.justNow'),
      body: c.body,
    })),
    ...[1, 2, 3].map((n) => ({
      author: this.i18n.t(`watch.c${n}Author`),
      time: this.i18n.t(`watch.c${n}Time`),
      body: this.i18n.t(`watch.c${n}Body`),
    })),
  ]);  protected readonly draft = signal('');

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // A different episode or drama starts from the beginning, paused.
    effect(() => {
      this.slug();
      this.episodeNumber();
      untracked(() => this.stop(true));
    });
    this.destroyRef.onDestroy(() => this.stop(false));
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

  protected toggleQuality(): void {
    this.quality.update((q) => (q === 'HD' ? 'SD' : 'HD'));
  }

  protected toggleFullscreen(): void {
    const el = this.playerEl()?.nativeElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  /** Switch to the other video. Playback position is kept, like changing audio track in a real player. */
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
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected submitComment(): void {
    const body = this.draft().trim();
    if (!body) return;
    this.ownComments.update((c) => [{ body }, ...c]);
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
