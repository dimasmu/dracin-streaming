import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Drama } from '../../../core/models/drama';
import { DramaPreviewService } from '../../../core/services/drama-preview.service';
import { monogram } from '../../../core/utils/format';

@Component({
  selector: 'app-drama-card',
  imports: [RouterLink],
  templateUrl: './drama-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DramaCardComponent {
  readonly drama = input.required<Drama>();

  protected readonly preview = inject(DramaPreviewService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly monogram = computed(() => monogram(this.drama().title));
  protected readonly subtitle = computed(() => this.drama().subtitleLanguages[0] ?? 'EN');
  protected readonly genre = computed(() => this.drama().genres[0] ?? '');
  protected readonly episode = computed(
    () => this.drama().latestEpisode ?? this.drama().totalEpisodes ?? 0,
  );
  protected readonly watchEpisode = computed(() => Math.max(1, this.episode()));

  protected onPointerEnter(): void {
    // The service ignores hover-capable devices that cannot actually hover.
    if (!this.preview.supportsHover()) return;
    this.preview.open(this.drama(), this.host.nativeElement);
  }

  protected onFocusIn(): void {
    // Keyboard focus opens the preview immediately so it reads as an
    // accessible alternative to hovering.
    this.preview.openImmediate(this.drama(), this.host.nativeElement);
  }
}