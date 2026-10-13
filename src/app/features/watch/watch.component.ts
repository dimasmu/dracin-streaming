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
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { CatalogService } from '../../core/services/catalog.service';
import { BookmarkService } from '../../core/services/bookmark.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { DragScrollDirective } from '../../shared/directives/drag-scroll.directive';
import { formatAired, monogram, ratingStars } from '../../core/utils/format';

interface Comment {
  author: string;
  time: string;
  body: string;
}

@Component({
  imports: [RouterLink, DramaCardComponent, EmptyStateComponent, DragScrollDirective],
  templateUrl: './watch.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchComponent {
  readonly slug = input<string>();
  readonly episode = input<string>();

  private readonly catalog = inject(CatalogService);
  private readonly bookmarks = inject(BookmarkService);
  private readonly prefs = inject(PreferencesService);
  private readonly messages = inject(MessageService);
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
    return s && s !== 'unknown' ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  });
  protected readonly ratingFilled = computed(() => ratingStars(this.drama()?.rating));
  protected readonly aired = computed(() => {
    const d = this.drama();
    return d && (d.releaseDate || d.releaseYear) ? formatAired(d.releaseDate, d.releaseYear) : '';
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

  /** Follows the language chosen in the navbar, falling back to what this drama offers. */
  protected readonly subtitle = computed(() => {
    const langs = this.drama()?.subtitleLanguages ?? [];
    const wanted = this.prefs.subtitle();
    return langs.includes(wanted) ? wanted : (langs[0] ?? '');
  });

  protected readonly durationSeconds = computed(() => (this.drama()?.durationMinutes ?? 1) * 60);
  protected readonly duration = computed(() => this.formatTime(this.durationSeconds()));
  protected readonly elapsed = computed(() =>
    this.formatTime(Math.floor((this.progress() / 100) * this.durationSeconds())),
  );

  protected readonly comments = signal<Comment[]>([
    {
      author: 'Aisyah R.',
      time: '2 hours ago',
      body: 'This episode keeps you on edge! The acting feels so natural.',
    },
    {
      author: 'Rizky P.',
      time: '5 hours ago',
      body: 'Started from episode 1 and binged all the way here. The twist in episode 38 was completely unexpected.',
    },
    {
      author: 'Fajar M.',
      time: '1 day ago',
      body: 'The chemistry between the leads gets stronger every episode.',
    },
  ]);
  protected readonly draft = signal('');

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

  protected choose(value: 'like' | 'dislike'): void {
    this.vote.set(this.vote() === value ? '' : value);
  }

  protected toggleBookmark(): void {
    const d = this.drama();
    if (!d) return;
    const added = this.bookmarks.toggle(d.id);
    this.messages.add({
      severity: 'success',
      summary: added ? 'Added to bookmarks' : 'Removed from bookmarks',
      detail: d.title,
      life: 2500,
    });
  }

  protected async share(): Promise<void> {
    const d = this.drama();
    if (!d) return;
    const url = `${window.location.origin}/watch/${d.slug}/${this.episodeNumber()}`;
    try {
      await navigator.clipboard.writeText(url);
      this.messages.add({ severity: 'success', summary: 'Link copied', detail: url, life: 2500 });
    } catch {
      this.messages.add({
        severity: 'warn',
        summary: 'Could not copy link',
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
    this.comments.update((c) => [{ author: 'You', time: 'Just now', body }, ...c]);
    this.draft.set('');
    this.messages.add({ severity: 'success', summary: 'Comment posted', detail: body, life: 2500 });
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
