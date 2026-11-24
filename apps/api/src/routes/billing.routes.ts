import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  desc,
  eq,
  paymentTransactions,
  subscriptionPlans,
  userSubscriptions,
} from '@tiraiplay/db';
import { CheckoutRequestSchema, PaymentProviderSchema } from '@tiraiplay/shared';
import {
  createGatewayCheckout,
  normalizeWebhookPayload,
  verifyPaymentWebhookSignature,
} from '../lib/payment.js';
import { requireAuth, type ApiDeps, type AppBindings } from '../middleware/rbac.js';

export function createBillingRoutes(deps: ApiDeps) {
  const app = new OpenAPIHono<AppBindings>();

  app.openapi(
    createRoute({
      method: 'get',
      path: '/plans',
      tags: ['Billing'],
      summary: 'Daftar paket langganan VIP aktif',
      responses: { 200: { description: 'Active plans' } },
    }),
    async (c) => {
      const plans = await deps.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true));
      return c.json(plans, 200);
    },
  );

  app.use('/subscriptions/*', requireAuth());

  app.openapi(
    createRoute({
      method: 'get',
      path: '/subscriptions/me',
      tags: ['Billing'],
      summary: 'Status langganan aktif & riwayat transaksi user',
      responses: { 200: { description: 'Subscription & billing history' } },
    }),
    async (c) => {
      const user = c.get('user')!;
      const [subs, txs] = await Promise.all([
        deps.db
          .select()
          .from(userSubscriptions)
          .where(eq(userSubscriptions.userId, user.id))
          .orderBy(desc(userSubscriptions.expiresAt)),
        deps.db
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.userId, user.id))
          .orderBy(desc(paymentTransactions.createdAt))
          .limit(20),
      ]);
      const now = new Date();
      const active = subs.find((s) => s.status === 'active' && s.expiresAt > now) ?? null;
      return c.json({ activeSubscription: active, transactions: txs }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/subscriptions/checkout',
      tags: ['Billing'],
      summary: 'Buat sesi pembayaran subscription bulanan (Mayar / Duitku / TriPay)',
      request: {
        body: { content: { 'application/json': { schema: CheckoutRequestSchema } } },
      },
      responses: {
        201: { description: 'Checkout link created' },
        404: { description: 'Plan not found' },
      },
    }),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      const [plan] = await deps.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, body.planId))
        .limit(1);
      if (!plan || !plan.isActive) {
        return c.json({ code: 'NOT_FOUND', message: 'Paket langganan tidak ditemukan.' }, 404);
      }

      const provider = body.provider ?? deps.env.PAYMENT_DEFAULT_PROVIDER;
      const merchantRef = `TP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const gatewayRes = await createGatewayCheckout(
        {
          provider,
          merchantRef,
          amountIdr: plan.priceIdr,
          planName: plan.name,
          customerName: user.name,
          customerEmail: user.email,
          paymentMethod: body.paymentMethod,
        },
        deps.env,
      );

      const [tx] = await deps.db
        .insert(paymentTransactions)
        .values({
          userId: user.id,
          planId: plan.id,
          provider,
          merchantRef,
          providerRef: gatewayRes.providerRef,
          amountIdr: plan.priceIdr,
          status: 'pending',
          checkoutUrl: gatewayRes.checkoutUrl,
        })
        .returning();

      return c.json(
        {
          transactionId: tx.id,
          merchantRef: tx.merchantRef,
          provider: tx.provider,
          amountIdr: tx.amountIdr,
          checkoutUrl: tx.checkoutUrl,
        },
        201,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/webhooks/payment/{provider}',
      tags: ['Billing'],
      summary: 'Webhook callback terverifikasi dari Mayar / Duitku / TriPay',
      request: {
        params: z.object({ provider: PaymentProviderSchema }),
      },
      responses: {
        200: { description: 'Webhook processed' },
        400: { description: 'Malformed payload' },
        401: { description: 'Invalid signature' },
      },
    }),
    async (c) => {
      const { provider } = c.req.valid('param');
      const rawBody = await c.req.text();
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return c.json({ code: 'BAD_PAYLOAD', message: 'Invalid JSON' }, 400);
      }

      const headers: Record<string, string | undefined> = {
        'x-callback-signature': c.req.header('x-callback-signature'),
        'x-mayar-signature': c.req.header('x-mayar-signature'),
      };

      if (!verifyPaymentWebhookSignature(provider, rawBody, headers, payload, deps.env)) {
        return c.json({ code: 'INVALID_SIGNATURE', message: 'Signature webhook tidak valid.' }, 401);
      }

      const event = normalizeWebhookPayload(provider, payload);
      if (!event) {
        return c.json({ code: 'INVALID_EVENT', message: 'Payload webhook tidak dikenali.' }, 400);
      }

      const [tx] = await deps.db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.merchantRef, event.merchantRef))
        .limit(1);
      if (!tx) {
        return c.json({ ok: true, ignored: true }, 200);
      }

      // Idempotent guard: jangan aktifkan ulang jika sudah paid
      if (tx.status === 'paid') {
        return c.json({ ok: true, idempotent: true }, 200);
      }

      if (event.paid) {
        const [plan] = await deps.db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, tx.planId))
          .limit(1);
        const durationDays = plan?.durationDays ?? 30;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + durationDays * 86400 * 1000);

        await deps.db.transaction(async (trx) => {
          await trx
            .update(paymentTransactions)
            .set({
              status: 'paid',
              providerRef: event.providerRef ?? tx.providerRef,
              rawWebhook: payload,
              paidAt: now,
            })
            .where(eq(paymentTransactions.id, tx.id));

          await trx.insert(userSubscriptions).values({
            userId: tx.userId,
            planId: tx.planId,
            status: 'active',
            startsAt: now,
            expiresAt,
          });
        });
      } else if (event.failed) {
        await deps.db
          .update(paymentTransactions)
          .set({ status: 'failed', rawWebhook: payload })
          .where(eq(paymentTransactions.id, tx.id));
      }

      return c.json({ ok: true }, 200);
    },
  );

  return app;
}
