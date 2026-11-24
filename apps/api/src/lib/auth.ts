import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import * as schema from '@tiraiplay/db/schema';
import type { Database } from '@tiraiplay/db';
import type { AppEnv } from '../env.js';

export function createAuth(db: Database, env: AppEnv) {
  return betterAuth({
    appName: 'TiraiPlay',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
        twoFactors: schema.twoFactors,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : undefined,
    user: {
      additionalFields: {
        username: { type: 'string', required: false, defaultValue: '' },
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
        department: {
          type: 'string',
          required: false,
          defaultValue: 'Komunitas Penonton',
          input: false,
        },
        phone: { type: 'string', required: false },
        status: { type: 'string', required: false, defaultValue: 'Aktif', input: false },
        twoFactorEnabled: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    plugins: [
      twoFactor({
        issuer: 'TiraiPlay',
      }),
    ],
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
