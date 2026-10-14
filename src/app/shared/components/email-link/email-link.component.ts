import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18nService } from '../../../core/services/i18n.service';

/**
 * An email address that is a real `mailto:` link, plus a button that copies it.
 * "Copied" is only shown when the clipboard write actually succeeded.
 */
@Component({
  selector: 'app-email-link',
  imports: [TranslocoPipe],
  templateUrl: './email-link.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailLinkComponent {
  readonly address = input.required<string>();

  private readonly messages = inject(MessageService);
  private readonly i18n = inject(I18nService);

  protected readonly copied = signal(false);
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.resetTimer) clearTimeout(this.resetTimer);
    });
  }

  protected async copy(): Promise<void> {
    const address = this.address();
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      this.copied.set(false);
      this.messages.add({
        severity: 'warn',
        summary: this.i18n.t('legalCommon.emailCopyFailed'),
        detail: this.i18n.t('legalCommon.emailCopyFailedDetail', { address }),
        life: 5000,
      });
      return;
    }
    this.copied.set(true);
    this.messages.add({
      severity: 'success',
      summary: this.i18n.t('legalCommon.emailCopied'),
      detail: address,
      life: 2500,
    });
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.copied.set(false), 2000);
  }
}
