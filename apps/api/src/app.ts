import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createSessionMiddleware, type ApiDeps, type AppBindings } from './middleware/rbac.js';
import { createAdminRoutes } from './routes/admin.routes.js';
import { createBillingRoutes } from './routes/billing.routes.js';
import { createPlayerRoutes } from './routes/player.routes.js';
import { createPublicRoutes } from './routes/public.routes.js';
import { createViewerRoutes } from './routes/viewer.routes.js';

export function createApiApp(deps: ApiDeps) {
  const root = new OpenAPIHono<AppBindings>();

  root.use('*', logger());
  root.use(
    '/api/*',
    cors({
      origin: deps.env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  root.get('/health', (c) => c.json({ ok: true, service: 'tiraiplay-api' }));

  // Mount Better Auth handler at /api/auth/*
  root.on(['POST', 'GET'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw));

  // OpenAPI API sub-app mounted under /api
  const api = new OpenAPIHono<AppBindings>();
  api.use('*', createSessionMiddleware(deps));

  api.route('/', createPublicRoutes(deps));
  api.route('/', createPlayerRoutes(deps));
  api.route('/', createViewerRoutes(deps));
  api.route('/', createBillingRoutes(deps));
  api.route('/', createAdminRoutes(deps));

  root.route('/api', api);

  root.doc('/api/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'TiraiPlay Streaming & CMS API',
      version: '1.0.0',
      description:
        'Backend API untuk katalog drama pendek Tiongkok, kuota harian 10 ep/hari, subscription bulanan, dan Admin CMS.',
    },
  });

  root.get(
    '/api/docs',
    apiReference({
      url: '/api/openapi.json',
      pageTitle: 'TiraiPlay API Docs',
    }),
  );

  return root;
}
