import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { LEGAL_CONTACT } from '../../../core/legal';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, TranslocoPipe, NgOptimizedImage],
  templateUrl: './app-footer.component.html',
})
export class AppFooterComponent {
  private readonly messages = inject(MessageService);
  protected readonly i18n = inject(I18nService);

  protected readonly generalEmail = LEGAL_CONTACT.general;
  protected readonly dmcaEmail = LEGAL_CONTACT.dmca;

  protected copyEmail(address: string): void {
    try {
      void navigator.clipboard?.writeText(address);
    } catch {
      /* clipboard may be unavailable in restricted contexts */
    }
    this.messages.add({
      severity: 'info',
      summary: this.i18n.lang() === 'id' ? 'Alamat disalin' : 'Email copied',
      detail: address,
      life: 2400,
    });
  }
}
