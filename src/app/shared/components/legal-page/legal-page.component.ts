import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LEGAL_DOCS, type LegalDocKey, type LegalSection } from '../../../core/legal';
import { I18nService } from '../../../core/services/i18n.service';
import { EditorialTabsComponent } from '../editorial-tabs/editorial-tabs.component';

/**
 * Frame shared by the three legal pages: breadcrumb, header, meta, section
 * navigation and "other documents". It renders NO legal text. Each page
 * projects its own content, so Terms, Privacy and DMCA stay independent.
 */
@Component({
  selector: 'app-legal-page',
  imports: [TranslocoPipe, EditorialTabsComponent],
  templateUrl: './legal-page.component.html',
})
export class LegalPageComponent {
  /** Which document this is. Drives meta data and the "other documents" list. */
  readonly doc = input.required<LegalDocKey>();
  /** Sections for the table of contents, in page order. */
  readonly sections = input.required<readonly LegalSection[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly meta = computed(() => LEGAL_DOCS.find((d) => d.key === this.doc())!);

  /**
   * Sections with their number: "01", "02", and "02.1" for nested entries.
   * The headings in each page carry the same numbers as literal text, so the
   * table of contents and the page agree as long as `sections` follows page order.
   */
  protected readonly numbered = computed(() => {
    let top = 0;
    let sub = 0;
    return this.sections().map((s) => {
      if (s.level === 2) {
        sub += 1;
        return { ...s, number: `${String(top).padStart(2, '0')}.${sub}` };
      }
      top += 1;
      sub = 0;
      return { ...s, number: String(top).padStart(2, '0') };
    });
  });

  /** Section currently being read. */
  protected readonly activeId = signal<string | null>(null);
  /** Collapsible navigator on narrow screens. */
  protected readonly tocOpen = signal(false);

  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => this.trackActiveSection());
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  /** ISO date -> "1 January 2026" in the website language. */
  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat(this.i18n.lang(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(iso + 'T00:00:00Z'));
  }

  /**
   * Plain `href="#x"` resolves against `<base href="/">` and sends the user to
   * the home page, so section links go through the router instead. It then
   * moves keyboard focus to the heading so screen-reader and keyboard users land
   * on the section, not just see it scroll past.
   */
  protected async goTo(event: Event, id: string): Promise<void> {
    event.preventDefault();
    this.tocOpen.set(false);
    await this.router.navigate([], { fragment: id, queryParamsHandling: 'preserve' });
    // The router scrolls to the fragment, honouring the sticky-header offset. This only moves focus.
    const target = this.document.getElementById(id);
    if (!target) return;
    const heading = target.matches('h2,h3') ? target : target.querySelector<HTMLElement>('h2,h3');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    this.activeId.set(id);
  }

  /** Marks the section that is nearest the top of the viewport, below the sticky header. */
  private trackActiveSection(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const ids = this.sections().map((s) => s.id);
    const els = ids
      .map((id) => this.document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;

    const visible = new Set<string>();
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // First visible section in page order wins; when none is visible keep the last one.
        const first = ids.find((id) => visible.has(id));
        if (first) this.activeId.set(first);
      },
      // Top margin = sticky header + a little air; bottom margin ignores the lower 60% of the screen.
      { rootMargin: '-90px 0px -60% 0px', threshold: 0 },
    );
    els.forEach((el) => this.observer!.observe(el));
    if (!this.activeId()) this.activeId.set(ids[0]);
  }
}
