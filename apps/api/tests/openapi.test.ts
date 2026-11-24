import { describe, expect, it } from 'vitest';
import { createApiApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { MemoryKeyValueStore } from '../src/lib/redis.js';

describe('Hono OpenAPI 3.1 Specification & Health Endpoint', () => {
  it('generates a complete OpenAPI 3.1 document covering all TiraiPlay routes', async () => {
    const env = loadEnv({});
    const kv = new MemoryKeyValueStore();
    const fakeDb = {
      select: () => ({
        from: () => Promise.resolve([]),
      }),
    } as never;
    const fakeAuth = {
      api: { getSession: async () => null },
      handler: async () => new Response('ok'),
    } as never;

    const app = createApiApp({ db: fakeDb, kv, auth: fakeAuth, env });

    const healthRes = await app.request('/health');
    expect(healthRes.status).toBe(200);
    expect(await healthRes.json()).toEqual({ ok: true, service: 'tiraiplay-api' });

    const specRes = await app.request('/api/openapi.json');
    expect(specRes.status).toBe(200);
    const spec = (await specRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.paths['/api/dramas']).toBeDefined();
    expect(spec.paths['/api/dramas/{slug}']).toBeDefined();
    expect(spec.paths['/api/episodes/{episodeId}/play']).toBeDefined();
    expect(spec.paths['/api/streams/{token}/master.m3u8']).toBeDefined();
    expect(spec.paths['/api/subscriptions/checkout']).toBeDefined();
    expect(spec.paths['/api/webhooks/payment/{provider}']).toBeDefined();
    expect(spec.paths['/api/admin/dramas']).toBeDefined();
    expect(spec.paths['/api/admin/rbac']).toBeDefined();
    expect(spec.paths['/api/admin/settings']).toBeDefined();
  });
});
