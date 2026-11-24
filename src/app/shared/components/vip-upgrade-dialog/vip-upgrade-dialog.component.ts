import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import type { PaymentProvider } from '@tiraiplay/shared';
import { AuthService } from '../../../core/services/auth.service';
import { BillingService } from '../../../core/services/billing.service';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-vip-upgrade-dialog',
  imports: [DialogModule, ButtonModule, TranslocoPipe],
  templateUrl: './vip-upgrade-dialog.component.html',
})
export class VipUpgradeDialogComponent {
  protected readonly billing = inject(BillingService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  protected readonly providers: ReadonlyArray<{ id: PaymentProvider; label: string; desc: string }> = [
    { id: 'tripay', label: 'TriPay', desc: 'QRIS · GoPay · Dana · VA' },
    { id: 'duitku', label: 'Duitku', desc: 'QRIS · OVO · ShopeePay · VA' },
    { id: 'mayar', label: 'Mayar', desc: 'QRIS · E-Wallet · Instant' },
  ];

  protected readonly activePlan = computed(() => this.billing.plans()[0]);

  protected formatIdr(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }

  protected async checkout(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.billing.closeVipModal();
      this.auth.openAuthModal('login');
      return;
    }
    const plan = this.activePlan();
    if (!plan) return;
    const res = await this.billing.startCheckout(plan.id);
    if (res) {
      this.messages.add({
        severity: 'info',
        summary: this.i18n.t('vip.checkoutCreated'),
        detail: `${res.merchantRef} · ${this.formatIdr(res.amountIdr)}`,
        life: 4000,
      });
    }
  }
}
