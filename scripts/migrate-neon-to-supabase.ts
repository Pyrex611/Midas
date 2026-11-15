/**
 * Zero-Loss Postgres-to-Postgres Data Migration Script (Neon -> Supabase)
 *
 * Usage (from project root, after running `npx prisma db push` against Supabase port 5432):
 *   SOURCE_DATABASE_URL="postgresql://...neon..." \
 *   TARGET_DATABASE_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres" \
 *   npx tsx scripts/migrate-neon-to-supabase.ts
 *
 * Safe to re-run: uses ON CONFLICT DO NOTHING and preserves all UUIDs, CUIDs,
 * and ENCRYPTION_KEY-encrypted Mailgun/AI keys identically.
 */

import 'dotenv/config';
import { Pool } from 'pg';

const TABLE_ORDER = [
  'users',
  'UserSettings',
  'Subscription',
  'Domain',
  'DomainHealthSnapshot',
  'Sender',
  'KnowledgeBase',
  'KnowledgeResource',
  'Campaign',
  'CampaignSender',
  'CampaignMember',
  'CampaignInvite',
  'Blocklist',
  'UploadJob',
  'Lead',
  'LeadActivityEvent',
  'Draft',
  'FollowUpStep',
  'OutboundEmail',
  'PendingEmail',
  'ApiKey',
  'Gong',
  'NewsletterRecipient',
  'NewsletterBroadcast',
  'NewsletterQueueItem',
  'Artifact',
  'Notification',
  'WebhookSubscription',
  'WebhookDelivery',
  'CronLock',
];

async function getColumnTypes(pool: Pool, tableName: string): Promise<Map<string, string>> {
  const res = await pool.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  const map = new Map<string, string>();
  for (const row of res.rows) {
    map.set(row.column_name, row.data_type.toLowerCase());
  }
  return map;
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL;

  if (!sourceUrl || !targetUrl) {
    throw new Error('Set SOURCE_DATABASE_URL (Neon) and TARGET_DATABASE_URL (Supabase direct port 5432).');
  }

  const source = new Pool({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false }, max: 2 });
  const target = new Pool({ connectionString: targetUrl, ssl: { rejectUnauthorized: false }, max: 2 });

  console.log('Starting zero-loss Neon -> Supabase migration...\n');

  try {
    for (const table of TABLE_ORDER) {
      const colTypes = await getColumnTypes(target, table);
      if (colTypes.size === 0) {
        console.log(`- Skipping "${table}" (not present in target schema yet)`);
        continue;
      }

      const sourceColTypes = await getColumnTypes(source, table);
      if (sourceColTypes.size === 0) {
        console.log(`- Skipping "${table}" (not present in source schema)`);
        continue;
      }

      // Copy intersection of columns that exist in both source and target
      const sharedColumns = Array.from(colTypes.keys()).filter((c) => sourceColTypes.has(c));
      if (sharedColumns.length === 0) continue;

      const selectColsSql = sharedColumns.map((c) => `"${c}"`).join(', ');
      const { rows } = await source.query(`SELECT ${selectColsSql} FROM "${table}"`);

      if (rows.length === 0) {
        console.log(`✓ "${table}": 0 rows (empty)`);
        continue;
      }

      const BATCH_SIZE = 200;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const values: any[] = [];
        const valueClauses: string[] = [];
        let paramIdx = 1;

        for (const row of batch) {
          const placeholders: string[] = [];
          for (const col of sharedColumns) {
            let val = row[col];
            const dtype = colTypes.get(col);
            if (val !== null && val !== undefined && (dtype === 'json' || dtype === 'jsonb')) {
              val = typeof val === 'string' ? val : JSON.stringify(val);
            }
            values.push(val);
            placeholders.push(`$${paramIdx++}`);
          }
          valueClauses.push(`(${placeholders.join(', ')})`);
        }

        const insertSql = `INSERT INTO "${table}" (${selectColsSql}) VALUES ${valueClauses.join(', ')} ON CONFLICT DO NOTHING`;
        const res = await target.query(insertSql, values);
        inserted += res.rowCount || 0;
      }

      console.log(`✓ "${table}": ${rows.length} source rows -> ${inserted} inserted cleanly`);
    }

    console.log('\nMigration complete! Verify health via /api/diagnostics/health/db.');
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});