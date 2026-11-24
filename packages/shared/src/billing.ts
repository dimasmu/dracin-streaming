import { z } from 'zod';

export const PaymentProviderSchema = z.enum(['mayar', 'duitku', 'tripay']);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

export const CheckoutRequestSchema = z.object({
  planId: z.string().trim().min(1).default('vip-monthly'),
  provider: PaymentProviderSchema.optional(),
  paymentMethod: z.string().trim().optional(),
});

export const DramaVoteSchema = z.object({
  vote: z.enum(['like', 'dislike']).nullable().optional(),
  score: z.number().int().min(1).max(5).nullable().optional(),
});
