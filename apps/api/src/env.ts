import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .default('postgres://tiraiplay:tiraiplay@localhost:5432/tiraiplay'),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:4600,http://localhost:4200'),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16)
    .default('dev-better-auth-secret-change-in-production-32ch'),
  BETTER_AUTH_URL: z.string().default('http://localhost:3000'),
  STREAM_SIGNING_SECRET: z
    .string()
    .min(16)
    .default('dev-stream-signing-secret-change-in-prod'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default('tiraiplay-media'),
  R2_PUBLIC_BASE_URL: z.string().default('https://media.tiraiplay.example'),
  PAYMENT_DEFAULT_PROVIDER: z.enum(['mayar', 'duitku', 'tripay']).default('tripay'),
  MAYAR_API_KEY: z.string().optional(),
  MAYAR_WEBHOOK_SECRET: z.string().optional(),
  DUITKU_MERCHANT_CODE: z.string().optional(),
  DUITKU_API_KEY: z.string().optional(),
  TRIPAY_API_KEY: z.string().optional(),
  TRIPAY_PRIVATE_KEY: z.string().optional(),
  TRIPAY_MERCHANT_CODE: z.string().optional(),
  APP_BASE_URL: z.string().default('http://localhost:4600'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  return EnvSchema.parse(source);
}
