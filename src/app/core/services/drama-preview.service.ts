import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type { Drama } from '../models/drama';

export interface PreviewState {
  drama: Drama;
  /** The hovered/focused card element, used as the overlay origin. */
  origin: HTMLElement;
}

/** Delay before a preview opens, so passing the cursor does not trigger one. */
const OPEN_DELAY_MS = 380;
/** Grace period while closing so small pointer moves do not dismiss it. */
const CLOSE_DELAY_MS = 180;
/** How long the skeleton stays up before real (locally available) data shows. */
const SKELETON_MS = 220;

/**
 * Single source of truth for the drama hover/focus preview.
 *
 * Only one preview can ever be visible: `state` holds a single entry, and every
 * open() replaces it. The actual CDK overlay is owned by
 * `DramaPreviewComponent`, which is mounted once in the app root — this service
 * only manages *what* should be shown and the open/close timing.
 */
@Injectable({ providedIn: 'root' })
export class DramaPreviewService {
  readonly state = signal<PreviewState | null>(null);
  readonly loading = signal(false);

  private readonly destroyRef = inject(DestroyRef);

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private skeletonTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // The preview is anchored to a card element; navigating away destroys that
    // element but would otherwise leave the overlay stranded on screen.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.close());

    // Leaving the window or switching tabs does not fire pointerleave, so the
    // preview would otherwise stay open until the next hover.
    if (typeof window !== 'undefined') {
      const onHide = () => this.close();
      window.addEventListener('blur', onHide);
      window.document.addEventListener('visibilitychange', () => {
        if (window.document.hidden) onHide();
      });
      this.destroyRef.onDestroy(() => window.removeEventListener('blur', onHide));
    }
  }

  /** True only for devices that can actually hover (mouse/trackpad). */
  private get hoverCapable(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch {
      return false;
    }
  }

  open(drama: Drama, origin: HTMLElement): void {
    // A keyboard focus (or any caller) always gets the preview.
    this.cancelClose();

    const current = this.state();
    if (current && current.drama.id === drama.id && current.origin === origin) return;

    this.cancelOpen();
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      this.state.set({ drama, origin });
      this.loading.set(true);
      this.clearSkeleton();
      this.skeletonTimer = setTimeout(() => {
        this.skeletonTimer = null;
        this.loading.set(false);
      }, SKELETON_MS);
    }, OPEN_DELAY_MS);
  }

  /** Immediate open, used for keyboard focus so tabbing feels responsive. */
  openImmediate(drama: Drama, origin: HTMLElement): void {
    this.cancelOpen();
    this.cancelClose();
    const current = this.state();
    if (current && current.drama.id === drama.id && current.origin === origin) return;
    this.state.set({ drama, origin });
    this.loading.set(true);
    this.clearSkeleton();
    this.skeletonTimer = setTimeout(() => {
      this.skeletonTimer = null;
      this.loading.set(false);
    }, SKELETON_MS);
  }

  /**
   * Hover left the card, but the pointer may still be travelling to the
   * preview itself — so the close is deferred.
   *
   * Critically this also cancels a *pending open*. Without that, sweeping the
   * cursor across a card would fire `open()` (380 ms timer) and then
   * `scheduleClose()` on leave; the open timer survived and popped the preview
   * open after the pointer had already gone, with no further pointerleave to
   * ever close it.
   */
  scheduleClose(): void {
    this.cancelOpen();
    this.cancelClose();

    // Nothing is on screen yet, so there is nothing to fade out.
    if (!this.state()) return;

    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.state.set(null);
      this.loading.set(false);
    }, CLOSE_DELAY_MS);
  }

  /** Pointer entered the preview itself — cancel any pending close. */
  keepOpen(): void {
    this.cancelClose();
  }

  close(): void {
    this.cancelOpen();
    this.cancelClose();
    this.clearSkeleton();
    this.state.set(null);
    this.loading.set(false);
  }

  /** Convenience guard used by the card's pointer handlers. */
  supportsHover(): boolean {
    return this.hoverCapable;
  }

  private cancelOpen(): void {
    if (this.openTimer !== null) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private cancelClose(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private clearSkeleton(): void {
    if (this.skeletonTimer !== null) {
      clearTimeout(this.skeletonTimer);
      this.skeletonTimer = null;
    }
  }
}