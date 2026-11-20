import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AccordionModule } from 'primeng/accordion';
import { FAQ_CATEGORIES } from '../../data/faq';
import { I18nService } from '../../core/services/i18n.service';
import { EditorialTabsComponent } from '../../shared/components/editorial-tabs/editorial-tabs.component';

interface FaqEntry {
  category: string;
  q: string;
  a: string;
}

@Component({
  imports: [RouterLink, AccordionModule, TranslocoPipe, EditorialTabsComponent],
  templateUrl: './faq.component.html',
})
export class FaqComponent {
  protected readonly i18n = inject(I18nService);
  private readonly transloco = inject(TranslocoService);

  protected readonly query = signal('');
  protected readonly activeCategory = signal<string | null>(null);
  protected readonly openPanels = signal<string[]>([]);

  /** All questions in the website language. Re-evaluates when the language changes. */
  protected readonly items = computed<FaqEntry[]>(() => {
    this.i18n.lang();
    return FAQ_CATEGORIES.flatMap((c) => {
      const list = this.transloco.translate<{ q: string; a: string }[]>(`faq.items.${c.id}`);
      return (Array.isArray(list) ? list : []).map((item) => ({ category: c.id, ...item }));
    });
  });

  protected readonly categories = computed(() =>
    FAQ_CATEGORIES.map((c) => ({
      ...c,
      name: this.i18n.t(`faq.cat.${c.id}`),
      count: this.items().filter((i) => i.category === c.id).length,
    })),
  );

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.activeCategory();
    return this.items().filter((item) => {
      if (cat && item.category !== cat) return false;
      if (q && !(item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)))
        return false;
      return true;
    });
  });

  protected setCategory(id: string): void {
    this.activeCategory.set(this.activeCategory() === id ? null : id);
    this.openPanels.set([]);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Stable across languages: category + position, not the (translated) question text. */
  protected itemKey(item: FaqEntry): string {
    return `${item.category}-${this.items().indexOf(item)}`;
  }
}
