import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqItem } from '../../data/faq';

@Component({
  imports: [RouterLink, AccordionModule],
  templateUrl: './faq.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqComponent {
  protected readonly items = FAQ_ITEMS;
  protected readonly query = signal('');
  protected readonly activeCategory = signal<string | null>(null);
  protected readonly openPanels = signal<string[]>([]);

  protected readonly categories = computed(() =>
    FAQ_CATEGORIES.map((c) => ({ ...c, count: this.count(c.id) })),
  );

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.activeCategory();
    return FAQ_ITEMS.filter((item) => {
      if (cat && item.category !== cat) return false;
      if (q && !(item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)))
        return false;
      return true;
    });
  });

  protected count(id: string): number {
    return FAQ_ITEMS.filter((i) => i.category === id).length;
  }

  protected setCategory(id: string): void {
    this.activeCategory.set(this.activeCategory() === id ? null : id);
    this.openPanels.set([]);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected itemKey(item: FaqItem): string {
    return `${item.category}-${item.q}`;
  }
}
