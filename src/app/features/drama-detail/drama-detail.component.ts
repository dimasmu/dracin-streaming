import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { BookmarkService } from '../../core/services/bookmark.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { monogram, ratingStars } from '../../core/utils/format';

@Component({
  imports: [RouterLink, DramaCardComponent, EmptyStateComponent],
  templateUrl: './drama-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DramaDetailComponent {
  readonly slug = input<string>();

  private readonly catalog = inject(CatalogService);
  private readonly bookmarks = inject(BookmarkService);
  protected readonly monogram = monogram;

  protected readonly drama = computed(() =>
    this.slug() ? this.catalog.getBySlug(this.slug()!) : undefined,
  );
  protected readonly bookmarked = computed(() =>
    this.drama() ? this.bookmarks.isBookmarked(this.drama()!.id) : false,
  );
  protected readonly stars = [0, 1, 2, 3, 4];
  protected readonly ratingFilled = computed(() => ratingStars(this.drama()?.rating));
  protected readonly statusLabel = computed(() => {
    const s = this.drama()?.status ?? 'unknown';
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  protected readonly episodeNumbers = computed(() => {
    const total = this.drama()?.totalEpisodes ?? 0;
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  protected readonly related = computed(() =>
    this.drama() ? this.catalog.related(this.drama()!, 8) : [],
  );

  protected toggleBookmark(): void {
    const d = this.drama();
    if (d) this.bookmarks.toggle(d.id);
  }
}
