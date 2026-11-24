import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BookmarkService } from '../../core/services/bookmark.service';
import { CatalogService } from '../../core/services/catalog.service';
import { DramaCardComponent } from '../../shared/components/drama-card/drama-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { MessageService } from 'primeng/api';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  imports: [RouterLink, TranslocoPipe, DramaCardComponent, EmptyStateComponent],
  templateUrl: './bookmarks.component.html',
})
export class BookmarksComponent {
  private readonly bookmarks = inject(BookmarkService);
  private readonly catalog = inject(CatalogService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(I18nService);

  protected readonly dramas = computed(() =>
    this.bookmarks
      .list()
      .map((b) => this.catalog.dramas.find((d) => d.id === b.dramaId || d.slug === b.dramaId))
      .filter((d): d is NonNullable<typeof d> => Boolean(d)),
  );

  protected remove(dramaId: string, title: string): void {
    this.bookmarks.remove(dramaId);
    this.messages.add({
      severity: 'success',
      summary: this.i18n.t('card.removedBookmark'),
      detail: title,
      life: 2500,
    });
  }
}
