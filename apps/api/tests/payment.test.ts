import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';
import { normalizeWebhookPayload, verifyPaymentWebhookSignature } from '../src/lib/payment.js';

describe('Payment Gateway Webhooks (Tripay, Duitku, Mayar)', () => {
  const env = loadEnv({
    TRIPAY_PRIVATE_KEY: 'tripay-secret',
    DUITKU_API_KEY: 'duitku-secret',
    DUITKU_MERCHANT_CODE: 'D1234',
    MAYAR_WEBHOOK_SECRET: 'mayar-secret',
  });

  it('verifies Tripay HMAC-SHA256 webhook signature & normalizes PAID event', () => {
    const payload = {
      merchant_ref: 'TP-1001',
      reference: 'T0001',
      status: 'PAID',
    };
    const raw = JSON.stringify(payload);
    const sig = createHmac('sha256', 'tripay-secret').update(raw).digest('hex');

    expect(
      verifyPaymentWebhookSignature('tripay', raw, { 'x-callback-signature': sig }, payload, env),
    ).toBe(true);
    expect(
      verifyPaymentWebhookSignature('tripay', raw, { 'x-callback-signature': 'bad' }, payload, env),
    ).toBe(false);

    const normalized = normalizeWebhookPayload('tripay', payload);
    expect(normalized).toEqual({
      merchantRef: 'TP-1001',
      providerRef: 'T0001',
      paid: true,
      failed: false,
    });
  });

  it('verifies Duitku MD5 webhook signature', () => {
    const sig = createHash('md5').update('D123429000TP-2002duitku-secret').digest('hex');
    const payload = {
      merchantCode: 'D1234',
      amount: '29000',
      merchantOrderId: 'TP-2002',
      resultCode: '00',
      reference: 'DK-99',
      signature: sig,
    };

    expect(
      verifyPaymentWebhookSignature('duitku', JSON.stringify(payload), {}, payload, env),
    ).toBe(true);
    expect(normalizeWebhookPayload('duitku', payload)?.paid).toBe(true);
  });

  it('verifies Mayar HMAC-SHA256 webhook signature', () => {
    const payload = {
      event: 'payment.received',
      data: { id: 'myr-1', status: 'paid', extraData: 'TP-3003' },
    };
    const raw = JSON.stringify(payload);
    const sig = createHmac('sha256', 'mayar-secret').update(raw).digest('hex');

    expect(
      verifyPaymentWebhookSignature('mayar', raw, { 'x-callback-signature': sig }, payload, env),
    ).toBe(true);
    expect(normalizeWebhookPayload('mayar', payload)).toEqual({
      merchantRef: 'TP-3003',
      providerRef: 'myr-1',
      paid: true,
      failed: false,
    });
  });
});
