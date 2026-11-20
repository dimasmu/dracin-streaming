import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18nService } from '../../../core/services/i18n.service';

export type EditorialTabKey = 'faq' | 'contact' | 'terms' | 'privacy' | 'dmca';

@Component({
  selector: 'app-editorial-tabs',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <div class="editorial-nav-head">
      <nav class="legal-breadcrumb" [attr.aria-label]="'legalCommon.breadcrumb' | transloco">
        <a routerLink="/">TiraiPlay</a>
        <span aria-hidden="true">/</span>
        <span>{{ sectionLabel() }}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ currentLabel() }}</span>
      </nav>

      <nav class="editorial-tabs-bar" [attr.aria-label]="sectionLabel()">
        @for (t of tabs(); track t.key) {
          <a
            [routerLink]="t.path"
            class="editorial-tab"
            [class.is-active]="active() === t.key"
            [attr.aria-current]="active() === t.key ? 'page' : null"
          >
            {{ t.label }}
          </a>
        }
      </nav>
    </div>
  `,
})
export class EditorialTabsComponent {
  readonly active = input.required<EditorialTabKey>();
  readonly currentLabel = input.required<string>();

  protected readonly i18n = inject(I18nService);

  protected readonly sectionLabel = computed(() =>
    this.i18n.lang() === 'id' ? 'Bantuan & Legal' : 'Help & Legal',
  );

  protected readonly tabs = computed(() => {
    const isId = this.i18n.lang() === 'id';
    return [
      { key: 'faq' as EditorialTabKey, path: '/faq', label: 'FAQ' },
      { key: 'contact' as EditorialTabKey, path: '/contact', label: isId ? 'Kontak' : 'Contact' },
      {
        key: 'terms' as EditorialTabKey,
        path: '/terms',
        label: isId ? 'Ketentuan Layanan' : 'Terms of Service',
      },
      {
        key: 'privacy' as EditorialTabKey,
        path: '/privacy',
        label: isId ? 'Privasi' : 'Privacy',
      },
      { key: 'dmca' as EditorialTabKey, path: '/dmca', label: 'DMCA' },
    ];
  });
}
