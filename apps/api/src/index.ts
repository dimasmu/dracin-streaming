import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { createDb } from '@tiraiplay/db';
import { createApiApp } from './app.js';
import { loadEnv } from './env.js';
import { createAuth } from './lib/auth.js';
import { createKeyValueStore } from './lib/redis.js';

for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const kv = createKeyValueStore(env.REDIS_URL);
const auth = createAuth(db, env);

const app = createApiApp({ db, kv, auth, env });

console.log(`TiraiPlay API listening on http://0.0.0.0:${env.PORT}`);
console.log(`OpenAPI docs: http://localhost:${env.PORT}/api/docs`);

serve({
  fetch: app.fetch,
  port: env.PORT,
});
