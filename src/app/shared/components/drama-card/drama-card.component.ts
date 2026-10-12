import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Drama } from '../../../core/models/drama';
import { BookmarkService } from '../../../core/services/bookmark.service';
import { MessageService } from 'primeng/api';
import {
  formatAired,
  formatDuration,
  monogram,
  ratingStars,
} from '../../../core/utils/format';

@Component({
  selector: 'app-drama-card',
  imports: [RouterLink],
  templateUrl: './drama-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DramaCardComponent {
  readonly drama = input.required<Drama>();

  private readonly bookmarks = inject(BookmarkService);
  private readonly messages = inject(MessageService);

  protected readonly monogram = computed(() => monogram(this.drama().title));
  protected readonly subtitle = computed(() => this.drama().subtitleLanguages[0] ?? 'EN');
  protected readonly genre = computed(() => this.drama().genres[0] ?? '');
  protected readonly episode = computed(
    () => this.drama().latestEpisode ?? this.drama().totalEpisodes ?? 0,
  );
  protected readonly aired = computed(() =>
    formatAired(this.drama().releaseDate, this.drama().releaseYear),
  );
  protected readonly duration = computed(() =>
    formatDuration(this.drama().totalEpisodes, this.drama().durationMinutes),
  );
  protected readonly stars = computed(() => [0, 1, 2, 3, 4]);
  protected readonly filled = computed(() => ratingStars(this.drama().rating));
  protected readonly bookmarked = computed(() => this.bookmarks.isBookmarked(this.drama().id));

  protected toggleBookmark(): void {
    const added = this.bookmarks.toggle(this.drama().id);
    this.messages.add({
      severity: 'success',
      summary: added ? 'Added to bookmarks' : 'Removed from bookmarks',
      detail: this.drama().title,
      life: 2500,
    });
  }
}
