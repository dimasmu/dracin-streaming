import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { eq, rolePermissions, users, type Database } from '@tiraiplay/db';
import {
  DEFAULT_ROLE_PERMISSIONS,
  type CmsPermission,
  type CmsRole,
  type CmsRolePermissions,
} from '@tiraiplay/shared';
import type { AppEnv } from '../env.js';
import type { AuthInstance } from '../lib/auth.js';
import type { KeyValueStore } from '../lib/redis.js';

export interface AuthUserContext {
  id: string;
  email: string;
  name: string;
  username: string;
  role: CmsRole;
  status: string;
  department: string;
  twoFactorEnabled: boolean;
}

export interface AppVariables {
  user: AuthUserContext | null;
  guestKey: string;
  permissions: CmsRolePermissions;
}

export interface AppBindings {
  Variables: AppVariables;
}

export interface ApiDeps {
  db: Database;
  kv: KeyValueStore;
  auth: AuthInstance;
  env: AppEnv;
}

const GUEST_COOKIE_NAME = 'tp_guest';

function signGuestId(guestId: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(guestId).digest('base64url');
  return `${guestId}.${sig}`;
}

function verifyGuestCookie(raw: string | undefined, secret: string): string | null {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [guestId, sig] = parts;
  if (!guestId || !sig) return null;
  const expected = createHmac('sha256', secret).update(guestId).digest('base64url');
  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) return null;
  return guestId;
}

function getClientIp(c: Context): string {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return c.req.header('x-real-ip') ?? '127.0.0.1';
}

export async function getRolePermissionsMap(
  db: Database,
): Promise<Record<CmsRole, CmsRolePermissions>> {
  const base = structuredClone(DEFAULT_ROLE_PERMISSIONS);
  const rows = await db.select().from(rolePermissions);
  for (const row of rows) {
    const role = row.role as CmsRole;
    const perm = row.permission as CmsPermission;
    if (base[role] && perm in base[role]) {
      base[role][perm] = row.enabled;
    }
  }
  return base;
}

export function createSessionMiddleware(deps: ApiDeps): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    // Resolve or issue signed guest cookie + IP hash key
    let guestId = verifyGuestCookie(getCookie(c, GUEST_COOKIE_NAME), deps.env.STREAM_SIGNING_SECRET);
    if (!guestId) {
      guestId = randomUUID();
      setCookie(c, GUEST_COOKIE_NAME, signGuestId(guestId, deps.env.STREAM_SIGNING_SECRET), {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        secure: deps.env.NODE_ENV === 'production',
      });
    }
    const ipHash = createHash('sha256')
      .update(`${getClientIp(c)}:${deps.env.STREAM_SIGNING_SECRET}`)
      .digest('hex')
      .slice(0, 16);
    c.set('guestKey', `${guestId}:${ipHash}`);

    // Resolve Better Auth session if present
    let resolvedUser: AuthUserContext | null = null;
    try {
      const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
      if (session?.user?.id) {
        const [dbUser] = await deps.db
          .select()
          .from(users)
          .where(eq(users.id, session.user.id))
          .limit(1);
        if (dbUser && dbUser.status !== 'Ditangguhkan') {
          resolvedUser = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            username: dbUser.username,
            role: dbUser.role,
            status: dbUser.status,
            department: dbUser.department,
            twoFactorEnabled: dbUser.twoFactorEnabled,
          };
        }
      }
    } catch {
      resolvedUser = null;
    }

    c.set('user', resolvedUser);
    const matrix = await getRolePermissionsMap(deps.db);
    const role: CmsRole = resolvedUser?.role ?? 'user';
    c.set('permissions', matrix[role]);
    await next();
  };
}

export function requireAuth(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ code: 'UNAUTHORIZED', message: 'Silakan login terlebih dahulu.' }, 401);
    }
    await next();
  };
}

export function requirePermission(perm: CmsPermission): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ code: 'UNAUTHORIZED', message: 'Autentikasi diperlukan.' }, 401);
    }
    const perms = c.get('permissions');
    if (!perms?.[perm]) {
      return c.json(
        {
          code: 'FORBIDDEN',
          message: `Role "${user.role}" tidak memiliki izin "${perm}".`,
        },
        403,
      );
    }
    await next();
  };
}
