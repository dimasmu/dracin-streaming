import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PaymentProvider, QuotaInfo } from '@tiraiplay/shared';

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  priceIdr: number;
  durationDays: number;
  features: string[];
}

export interface CheckoutResponse {
  transactionId: string;
  merchantRef: string;
  provider: PaymentProvider;
  amountIdr: number;
  checkoutUrl: string;
}

const DEFAULT_PLANS: SubscriptionPlanDto[] = [
  {
    id: 'vip-monthly',
    name: 'VIP Bulanan',
    priceIdr: 29000,
    durationDays: 30,
    features: [
      'Nonton semua episode tanpa batas kuota 10 ep/hari',
      'Kualitas Full HD 1080p & multi-bahasa ID/EN',
      'Bebas batas tunggu reset harian',
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);

  readonly vipModalOpen = signal(false);
  readonly quotaContext = signal<QuotaInfo | null>(null);
  readonly plans = signal<SubscriptionPlanDto[]>(DEFAULT_PLANS);
  readonly selectedProvider = signal<PaymentProvider>('tripay');
  readonly checkingOut = signal(false);
  readonly checkoutError = signal<string | null>(null);

  async openVipModal(quota: QuotaInfo | null = null): Promise<void> {
    this.quotaContext.set(quota);
    this.checkoutError.set(null);
    this.vipModalOpen.set(true);
    try {
      const list = await firstValueFrom(this.http.get<SubscriptionPlanDto[]>('/api/plans'));
      if (Array.isArray(list) && list.length > 0) {
        this.plans.set(list);
      }
    } catch {
      /* keep default fallback plan */
    }
  }

  closeVipModal(): void {
    this.vipModalOpen.set(false);
    this.checkoutError.set(null);
  }

  async startCheckout(planId: string): Promise<CheckoutResponse | null> {
    this.checkingOut.set(true);
    this.checkoutError.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<CheckoutResponse>('/api/subscriptions/checkout', {
          planId,
          provider: this.selectedProvider(),
        }),
      );
      if (res?.checkoutUrl) {
        window.open(res.checkoutUrl, '_blank', 'noopener');
      }
      return res;
    } catch (err) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        'Gagal membuat transaksi pembayaran.';
      this.checkoutError.set(msg);
      return null;
    } finally {
      this.checkingOut.set(false);
    }
  }
}
