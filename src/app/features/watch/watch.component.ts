import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { BookmarkService } from '../../core/services/bookmark.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { MessageService } from 'primeng/api';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { monogram } from '../../core/utils/format';

interface Comment {
  author: string;
  time: string;
  body: string;
}

@Component({
  imports: [RouterLink, DramaCardComponent, EmptyStateComponent],
  templateUrl: './watch.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchComponent implements OnInit, OnDestroy {
  readonly slug = input<string>();
  readonly episode = input<string>();

  private readonly catalog = inject(CatalogService);
  private readonly bookmarks = inject(BookmarkService);
  private readonly prefs = inject(PreferencesService);
  private readonly messages = inject(MessageService);
  protected readonly monogram = monogram;

  protected readonly drama = computed(() =>
    this.slug() ? this.catalog.getBySlug(this.slug()!) : undefined,
  );

  protected readonly episodeNumber = computed(() => {
    const total = this.drama()?.totalEpisodes ?? 1;
    const n = Number(this.episode());
    if (!isFinite(n) || n < 1) return 1;
    return Math.min(n, total);
  });

  protected readonly hasPrev = computed(() => this.episodeNumber() > 1);
  protected readonly hasNext = computed(
    () => this.episodeNumber() < (this.drama()?.totalEpisodes ?? 1),
  );
  protected readonly episodeNumbers = computed(() => {
    const total = this.drama()?.totalEpisodes ?? 0;
    return Array.from({ length: total }, (_, i) => i + 1);
  });
  protected readonly related = computed(() =>
    this.drama() ? this.catalog.related(this.drama()!, 8) : [],
  );
  protected readonly bookmarked = computed(() =>
    this.drama() ? this.bookmarks.isBookmarked(this.drama()!.id) : false,
  );

  protected readonly playing = signal(false);
  protected readonly progress = signal(34);
  protected readonly server = signal(1);
  protected readonly subtitle = signal<string>(this.prefs.subtitle());
  protected readonly vote = signal<'' | 'like' | 'dislike'>('');

  protected readonly durationLabel = computed(() => this.drama()?.durationMinutes ?? 1);
  protected readonly duration = computed(() => this.formatTime(this.durationLabel() * 120));
  protected readonly elapsed = computed(() =>
    this.formatTime(Math.floor((this.progress() / 100) * this.durationLabel() * 120)),
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

  ngOnInit(): void {
    this.subtitle.set(this.prefs.subtitle());
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  protected togglePlay(): void {
    const next = !this.playing();
    this.playing.set(next);
    if (this.timer) clearInterval(this.timer);
    if (next) {
      this.timer = setInterval(() => {
        this.progress.update((p) => (p >= 100 ? 0 : p + 1));
      }, 600);
    }
  }

  protected choose(value: 'like' | 'dislike'): void {
    this.vote.set(this.vote() === value ? '' : value);
  }

  protected toggleBookmark(): void {
    const d = this.drama();
    if (d) this.bookmarks.toggle(d.id);
  }

  protected share(): void {
    const d = this.drama();
    if (!d) return;
    this.messages.add({
      severity: 'info',
      summary: 'Share',
      detail: `Link copied for ${d.title}`,
      life: 2500,
    });
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

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
