import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Drama } from '../../../core/models/drama';
import { CatalogService } from '../../../core/services/catalog.service';
import { DramaPreviewService } from '../../../core/services/drama-preview.service';
import { I18nService } from '../../../core/services/i18n.service';
import { isPlaceholderImage, monogram } from '../../../core/utils/format';

@Component({
  selector: 'app-drama-card',
  imports: [RouterLink],
  templateUrl: './drama-card.component.html',
  host: {
    '(pointerenter)': 'onPointerEnter()',
    '(pointerleave)': 'preview.scheduleClose()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'preview.scheduleClose()',
  },
})
export class DramaCardComponent {
  readonly drama = input.required<Drama>();

  protected readonly preview = inject(DramaPreviewService);
  protected readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly catalog = inject(CatalogService);

  protected readonly monogram = computed(() => monogram(this.drama().title));

  private readonly brokenPosterUrls = signal<ReadonlySet<string>>(new Set());

  protected readonly posterSrc = computed(() => {
    const url = this.drama().posterUrl?.trim();
    return url && !this.brokenPosterUrls().has(url) ? url : null;
  });

  protected onPosterError(url: string): void {
    this.brokenPosterUrls.update((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }

  protected onPosterLoad(url: string, event: Event): void {
    if (isPlaceholderImage(event)) {
      this.onPosterError(url);
    }
  }

  protected readonly platformTone = computed(
    () => this.catalog.getPlatform(this.drama().platformId)?.tone ?? this.drama().tone,
  );

  protected readonly genresLine = computed(() => {
    this.i18n.lang();
    return this.drama()
      .genres.slice(0, 2)
      .map((g) => this.i18n.t(`genre.${g}`))
      .join(' · ');
  });

  protected readonly ratingLabel = computed(() => {
    const r = this.drama().rating;
    return typeof r === 'number' && isFinite(r) ? r.toFixed(1) : null;
  });

  protected readonly episode = computed(
    () => this.drama().latestEpisode ?? this.drama().totalEpisodes ?? 0,
  );

  protected readonly watchEpisode = computed(() => Math.max(1, this.episode()));

  protected readonly durationLabel = computed(() => {
    const mins = this.drama().durationMinutes ?? 2;
    return `${mins}m/ep`;
  });

  protected onPointerEnter(): void {
    if (!this.preview.supportsHover()) return;
    this.preview.open(this.drama(), this.host.nativeElement);
  }

  protected onFocusIn(): void {
    this.preview.openImmediate(this.drama(), this.host.nativeElement);
  }
}
