import { Directive, ElementRef, OnDestroy, inject, signal } from '@angular/core';

/**
 * Controls that must always keep their plain click behaviour and therefore
 * never start a drag. Links are deliberately excluded: drama cards are
 * wrapped in a stretched <a>, so links have to remain valid drag sources —
 * their click is suppressed separately once a real drag is detected.
 */
const NO_DRAG_SELECTOR =
  'button, input, textarea, select, [data-no-drag], [contenteditable="true"]';

const DRAG_THRESHOLD_PX = 6;

/**
 * Click-and-drag horizontal scrolling for horizontally overflowing tracks
 * (carousels, rails, the hero slider, the platform tab strip).
 *
 * Pointer Events are used so mouse, pen and touch share one code path. Only
 * mouse/pen start a drag — on touch we keep the browser's native momentum
 * scrolling, which is both faster and what users expect on a phone.
 *
 * Handled here:
 *  - a meaningful drag suppresses the follow-up click, so card links do not
 *    navigate while swiping;
 *  - drags never start from buttons/inputs/other controls;
 *  - `pointercancel`, window blur and destroy all reset the drag state;
 *  - exactly one listener set per host element, always removed on destroy;
 *  - scroll-snap is relaxed while dragging so the track never feels sticky.
 */
@Directive({
  selector: '[appDragScroll]',
  host: {
    '[class.is-dragging]': 'dragging()',
  },
})
export class DragScrollDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly dragging = signal(false);

  private pointerId: number | null = null;
  private startX = 0;
  private startScrollLeft = 0;
  private moved = false;

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest?.(NO_DRAG_SELECTOR)) return;

    const el = this.host.nativeElement;
    if (el.scrollWidth <= el.clientWidth) return;

    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startScrollLeft = el.scrollLeft;
    this.moved = false;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerId === null || event.pointerId !== this.pointerId) return;

    const dx = event.clientX - this.startX;
    if (!this.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      this.moved = true;
      this.begin();
    }

    event.preventDefault();
    this.host.nativeElement.scrollLeft = this.startScrollLeft - dx;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.pointerId === null || event.pointerId !== this.pointerId) return;
    this.end();
  };

  private readonly onPointerCancel = (): void => this.end();

  private readonly onWindowBlur = (): void => this.end();

  /**
   * Capture-phase click swallow, active only while a drag is in flight.
   * It always clears `moved` afterwards so a later plain click is unaffected.
   */
  private readonly onClickCapture = (event: MouseEvent): void => {
    if (this.moved) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.moved = false;
  };

  constructor() {
    const el = this.host.nativeElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('click', this.onClickCapture, true);
    window.addEventListener('blur', this.onWindowBlur);
  }

  private begin(): void {
    const el = this.host.nativeElement;
    this.dragging.set(true);
    el.style.userSelect = 'none';
    if (this.pointerId !== null) {
      try {
        el.setPointerCapture(this.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
    }
  }

  private end(): void {
    const el = this.host.nativeElement;
    if (this.pointerId !== null) {
      try {
        el.releasePointerCapture(this.pointerId);
      } catch {
        /* ignore */
      }
    }
    this.pointerId = null;
    if (this.dragging()) {
      this.dragging.set(false);
      el.style.userSelect = '';
    }
  }

  ngOnDestroy(): void {
    const el = this.host.nativeElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
    el.removeEventListener('click', this.onClickCapture, true);
    window.removeEventListener('blur', this.onWindowBlur);
    this.end();
  }
}