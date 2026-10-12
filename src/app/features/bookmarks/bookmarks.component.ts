import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookmarkService } from '../../core/services/bookmark.service';
import { CatalogService } from '../../core/services/catalog.service';
import { DramaCardComponent } from '../../shared/components/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MessageService } from 'primeng/api';

@Component({
  imports: [RouterLink, DramaCardComponent, EmptyStateComponent],
  templateUrl: './bookmarks.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarksComponent {
  private readonly bookmarks = inject(BookmarkService);
  private readonly catalog = inject(CatalogService);
  private readonly messages = inject(MessageService);

  protected readonly dramas = computed(() =>
    this.bookmarks
      .list()
      .map((b) => this.catalog.getBySlug(b.dramaId))
      .filter((d): d is NonNullable<typeof d> => Boolean(d)),
  );

  protected remove(dramaId: string, title: string): void {
    this.bookmarks.remove(dramaId);
    this.messages.add({
      severity: 'success',
      summary: 'Removed from bookmarks',
      detail: title,
      life: 2500,
    });
  }
}
