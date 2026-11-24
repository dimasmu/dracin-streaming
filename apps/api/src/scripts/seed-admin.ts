import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb, eq, users } from '@tiraiplay/db';
import { loadEnv } from '../env.js';
import { createAuth } from '../lib/auth.js';

for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const email = process.env['ADMIN_EMAIL'] ?? 'admin@tiraiplay.example';
const password = process.env['ADMIN_PASSWORD'] ?? 'Admin12345!';
const name = process.env['ADMIN_NAME'] ?? 'Rama Pratama';

async function seedAdmin() {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  const auth = createAuth(db, env);

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length === 0) {
    await auth.api.signUpEmail({
      body: { name, email, password },
    });
  }

  await db
    .update(users)
    .set({
      role: 'admin',
      username: email.split('@')[0],
      department: 'Operasional & Kurasi',
      emailVerified: true,
      status: 'Aktif',
    })
    .where(eq(users.email, email));

  console.log(`Admin ready -> Email: ${email} | Password: ${password}`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Failed to seed admin:', err);
  process.exit(1);
});
