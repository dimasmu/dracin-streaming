import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider } from '@tiraiplay/shared';
import type { AppEnv } from '../env.js';

export interface CheckoutInput {
  provider: PaymentProvider;
  merchantRef: string;
  amountIdr: number;
  planName: string;
  customerName: string;
  customerEmail: string;
  paymentMethod?: string;
}

export interface CheckoutResult {
  provider: PaymentProvider;
  merchantRef: string;
  providerRef: string;
  checkoutUrl: string;
}

export interface NormalizedWebhookEvent {
  merchantRef: string;
  providerRef: string | null;
  paid: boolean;
  failed: boolean;
}

function safeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a.toLowerCase(), 'utf8');
  const bufB = Buffer.from(b.toLowerCase(), 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Verifies webhook signatures for Tripay, Duitku, and Mayar.
 */
export function verifyPaymentWebhookSignature(
  provider: PaymentProvider,
  rawBody: string,
  headers: Record<string, string | undefined>,
  payload: Record<string, unknown>,
  env: AppEnv,
): boolean {
  if (provider === 'tripay') {
    const privateKey = env.TRIPAY_PRIVATE_KEY;
    const signature = headers['x-callback-signature'];
    if (!privateKey || !signature) return false;
    const expected = createHmac('sha256', privateKey).update(rawBody).digest('hex');
    return safeHexEqual(signature, expected);
  }

  if (provider === 'duitku') {
    const apiKey = env.DUITKU_API_KEY;
    const merchantCode = String(payload['merchantCode'] ?? env.DUITKU_MERCHANT_CODE ?? '');
    const amount = String(payload['amount'] ?? '');
    const merchantOrderId = String(payload['merchantOrderId'] ?? '');
    const signature = String(payload['signature'] ?? '');
    if (!apiKey || !merchantCode || !amount || !merchantOrderId || !signature) return false;
    const expected = createHash('md5')
      .update(`${merchantCode}${amount}${merchantOrderId}${apiKey}`)
      .digest('hex');
    return safeHexEqual(signature, expected);
  }

  // Mayar webhook HMAC-SHA256 / token verification
  const secret = env.MAYAR_WEBHOOK_SECRET;
  const sig = headers['x-callback-signature'] ?? headers['x-mayar-signature'] ?? '';
  if (!secret || !sig) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeHexEqual(sig, expected) || safeHexEqual(sig, secret);
}

export function normalizeWebhookPayload(
  provider: PaymentProvider,
  payload: Record<string, unknown>,
): NormalizedWebhookEvent | null {
  if (provider === 'tripay') {
    const merchantRef = String(payload['merchant_ref'] ?? '');
    if (!merchantRef) return null;
    const status = String(payload['status'] ?? '').toUpperCase();
    return {
      merchantRef,
      providerRef: payload['reference'] ? String(payload['reference']) : null,
      paid: status === 'PAID',
      failed: status === 'EXPIRED' || status === 'FAILED',
    };
  }

  if (provider === 'duitku') {
    const merchantRef = String(payload['merchantOrderId'] ?? '');
    if (!merchantRef) return null;
    const resultCode = String(payload['resultCode'] ?? '');
    return {
      merchantRef,
      providerRef: payload['reference'] ? String(payload['reference']) : null,
      paid: resultCode === '00',
      failed: resultCode !== '' && resultCode !== '00',
    };
  }

  // Mayar
  const data = (payload['data'] as Record<string, unknown> | undefined) ?? payload;
  const merchantRef = String(
    data['extraData'] ?? data['merchantRef'] ?? data['transactionId'] ?? '',
  );
  if (!merchantRef) return null;
  const status = String(data['status'] ?? payload['event'] ?? '').toLowerCase();
  return {
    merchantRef,
    providerRef: data['id'] ? String(data['id']) : null,
    paid: status.includes('paid') || status.includes('success') || status === 'payment.received',
    failed: status.includes('failed') || status.includes('expired'),
  };
}

export async function createGatewayCheckout(
  input: CheckoutInput,
  env: AppEnv,
): Promise<CheckoutResult> {
  if (input.provider === 'tripay' && env.TRIPAY_API_KEY && env.TRIPAY_PRIVATE_KEY && env.TRIPAY_MERCHANT_CODE) {
    const signature = createHmac('sha256', env.TRIPAY_PRIVATE_KEY)
      .update(`${env.TRIPAY_MERCHANT_CODE}${input.merchantRef}${input.amountIdr}`)
      .digest('hex');

    const res = await fetch('https://tripay.co.id/api/transaction/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TRIPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: input.paymentMethod ?? 'QRIS',
        merchant_ref: input.merchantRef,
        amount: input.amountIdr,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        order_items: [{ name: input.planName, price: input.amountIdr, quantity: 1 }],
        return_url: `${env.APP_BASE_URL}/billing/success?ref=${input.merchantRef}`,
        signature,
      }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      data?: { reference?: string; checkout_url?: string };
      message?: string;
    };
    if (!res.ok || !json.success || !json.data?.checkout_url) {
      throw new Error(json.message ?? 'Tripay checkout creation failed');
    }
    return {
      provider: 'tripay',
      merchantRef: input.merchantRef,
      providerRef: json.data.reference ?? input.merchantRef,
      checkoutUrl: json.data.checkout_url,
    };
  }

  // Fallback sandbox checkout URL when provider credentials are not yet configured locally
  return {
    provider: input.provider,
    merchantRef: input.merchantRef,
    providerRef: `sandbox-${input.merchantRef}`,
    checkoutUrl: `${env.APP_BASE_URL}/billing/sandbox-checkout?ref=${input.merchantRef}&provider=${input.provider}`,
  };
}
