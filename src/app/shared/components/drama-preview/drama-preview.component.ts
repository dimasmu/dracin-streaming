import { ChangeDetectionStrategy, Component, ElementRef, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverlayModule, ScrollStrategyOptions } from '@angular/cdk/overlay';
import { SkeletonModule } from 'primeng/skeleton';
import { DramaPreviewService } from '../../../core/services/drama-preview.service';
import { formatAired, monogram, ratingStars } from '../../../core/utils/format';

/**
 * The single, app-root-mounted drama preview.
 *
 * It renders through a CDK connected overlay, which appends the panel to
 * `.cdk-overlay-container` on `<body>`. That placement is what makes the
 * preview immune to `overflow: hidden` on carousels, grids and rails.
 *
 * Placement is delegated to CDK's flexible-connected strategy: right side,
 * then left side, then below, each clamped to the viewport margin. The
 * reposition scroll strategy keeps it aligned while the page scrolls.
 */
@Component({
  selector: 'app-drama-preview',
  imports: [RouterLink, OverlayModule, SkeletonModule],
  templateUrl: './drama-preview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DramaPreviewComponent {
  protected readonly preview = inject(DramaPreviewService);
  private readonly scrollStrategies = inject(ScrollStrategyOptions);

  protected readonly monogram = monogram;
  protected readonly stars = [0, 1, 2, 3, 4];

  protected readonly origin = computed<ElementRef | null>(() => {
    const el = this.preview.state()?.origin;
    return el ? new ElementRef(el) : null;
  });

  protected readonly positions = [
    {
      originX: 'end' as const,
      originY: 'top' as const,
      overlayX: 'start' as const,
      overlayY: 'top' as const,
      offsetX: 14,
      offsetY: -4,
    },
    {
      originX: 'start' as const,
      originY: 'top' as const,
      overlayX: 'end' as const,
      overlayY: 'top' as const,
      offsetX: -14,
      offsetY: -4,
    },
    {
      originX: 'center' as const,
      originY: 'bottom' as const,
      overlayX: 'center' as const,
      overlayY: 'top' as const,
      offsetY: 12,
    },
  ];

  protected readonly scrollStrategy = this.scrollStrategies.reposition();
  protected readonly viewportMargin = 12;

  protected readonly ratingFilled = computed(() => ratingStars(this.preview.state()?.drama.rating));
  protected readonly aired = computed(() =>
    formatAired(this.preview.state()?.drama.releaseDate, this.preview.state()?.drama.releaseYear),
  );

  /** Hide the preview once the hovered card scrolls out of the viewport. */
  protected readonly panelClasses = 'drama-preview-panel';

  protected onEnter(): void {
    this.preview.keepOpen();
  }

  protected onLeave(): void {
    this.preview.scheduleClose();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.preview.close();
    }
  }
}