// scripts/baseline-migrations.js
//
// Safely transitions db-push-provisioned databases (e.g. Supabase / Neon)
// onto `prisma migrate deploy` without triggering P3005 ("database schema is
// not empty").
//
// Modes:
//   node scripts/baseline-migrations.js --auto
//     1. Connects to the direct Postgres URL.
//     2. If `public.users` is missing (brand-new empty DB), runs `prisma db push`
//        to bootstrap tables (bypassing legacy broken "User" vs "users" DDL).
//     3. If `_prisma_migrations` is missing or empty, marks historical migrations
//        up through `20260926000000_add_domain_route_id` as applied, leaving
//        `20261117000000_enterprise_schema_sync` for `prisma migrate deploy`.
//     4. If `_prisma_migrations` already has rows, exits immediately in <150ms.

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const PENDING_IDEMPOTENT_SYNC = '20261117000000_enterprise_schema_sync';
const CONNECTIVITY_ERROR_CODES = ['P1001', 'P1002', 'P1017'];

function resolveDirectUrl() {
  let directUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL_POOLED ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!directUrl) return null;

  try {
    const parsed = new URL(directUrl);
    if (
      (parsed.hostname.includes('pooler.supabase.com') || parsed.hostname.includes('pooler.supabase.co')) &&
      parsed.port === '6543'
    ) {
      parsed.port = '5432';
      directUrl = parsed.toString();
    }
  } catch {}

  return directUrl;
}

function baselineFolders(skipSet) {
  const folders = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const toBaseline = folders.filter((name) => !skipSet.has(name));
  console.log(`Baselining ${toBaseline.length} historical migration(s)...`);

  for (const name of toBaseline) {
    try {
      execSync(`npx prisma migrate resolve --applied ${name}`, {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      console.log(`  ✓ marked applied: ${name}`);
    } catch (err) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}`;
      if (CONNECTIVITY_ERROR_CODES.some((code) => combined.includes(code))) {
        console.error(combined);
        process.exit(1);
      }
      console.log(`  • already resolved: ${name}`);
    }
  }
}

async function run() {
  const isAuto = process.argv.includes('--auto');
  const directUrl = resolveDirectUrl();

  if (!isAuto) {
    baselineFolders(new Set([PENDING_IDEMPOTENT_SYNC]));
    console.log('\nDone. Now run: npx prisma migrate deploy');
    return;
  }

  if (!directUrl) {
    console.warn('[baseline-migrations] No DATABASE_URL found — skipping pre-migrate check.');
    return;
  }

  const pool = new Pool({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8_000,
    max: 1,
  });

  try {
    const probe = await pool.query(`
      SELECT
        to_regclass('public.users') IS NOT NULL AS has_users,
        to_regclass('public._prisma_migrations') IS NOT NULL AS has_migrations
    `);

    const { has_users, has_migrations } = probe.rows[0];

    if (has_migrations) {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "_prisma_migrations"`);
      if (countRes.rows[0].cnt > 0) {
        console.log('[baseline-migrations] _prisma_migrations already initialized — proceeding to migrate deploy.');
        return;
      }
    }

    if (!has_users) {
      console.log('[baseline-migrations] Empty database detected — initializing schema before baselining...');
      execSync('npx prisma db push', { stdio: 'inherit' });
    }

    baselineFolders(new Set([PENDING_IDEMPOTENT_SYNC]));
  } finally {
    await pool.end().catch(() => {});
  }
}

run().catch((err) => {
  console.error('[baseline-migrations] Failed:', err?.message || err);
  process.exit(1);
});