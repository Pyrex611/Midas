import { Pool } from 'pg';
import { logger } from '../config/logger';

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

export interface TableMigrationResult {
  table: string;
  sourceRows: number;
  insertedRows: number;
  status: 'MIGRATED' | 'EMPTY' | 'SKIPPED';
}

export class MigrationService {
  private async getColumnTypes(pool: Pool, tableName: string): Promise<Map<string, string>> {
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

  async migrateFromNeon(sourceDatabaseUrl: string): Promise<{
    success: boolean;
    durationMs: number;
    totalSourceRows: number;
    totalInsertedRows: number;
    tables: TableMigrationResult[];
  }> {
    const cleanSource = (sourceDatabaseUrl || '').trim();
    if (!/^postgres(ql)?:\/\//i.test(cleanSource)) {
      throw new Error('Source database URL must start with postgresql:// or postgres://');
    }

    const targetUrl =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL_POOLED ||
      process.env.DATABASE_URL;

    if (!targetUrl) {
      throw new Error('Target Supabase DATABASE_URL is not configured on this server.');
    }

    const source = new Pool({
      connectionString: cleanSource,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8_000,
      max: 2,
    });

    const target = new Pool({
      connectionString: targetUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8_000,
      max: 2,
    });

    const startedAt = Date.now();
    const results: TableMigrationResult[] = [];
    let totalSourceRows = 0;
    let totalInsertedRows = 0;

    try {
      await source.query('SELECT 1');
      await target.query('SELECT 1');

      for (const table of TABLE_ORDER) {
        const [targetColTypes, sourceColTypes] = await Promise.all([
          this.getColumnTypes(target, table),
          this.getColumnTypes(source, table),
        ]);

        if (targetColTypes.size === 0 || sourceColTypes.size === 0) {
          results.push({ table, sourceRows: 0, insertedRows: 0, status: 'SKIPPED' });
          continue;
        }

        const sharedColumns = Array.from(targetColTypes.keys()).filter((c) => sourceColTypes.has(c));
        if (sharedColumns.length === 0) {
          results.push({ table, sourceRows: 0, insertedRows: 0, status: 'SKIPPED' });
          continue;
        }

        const selectColsSql = sharedColumns.map((c) => `"${c}"`).join(', ');
        const { rows } = await source.query(`SELECT ${selectColsSql} FROM "${table}"`);

        if (rows.length === 0) {
          results.push({ table, sourceRows: 0, insertedRows: 0, status: 'EMPTY' });
          continue;
        }

        const BATCH_SIZE = 300;
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
              const dtype = targetColTypes.get(col);
              if (val !== null && val !== undefined && (dtype === 'json' || dtype === 'jsonb')) {
                val = typeof val === 'string' ? val : JSON.stringify(val);
              }
              values.push(val);
              placeholders.push(`$${paramIdx++}`);
            }
            valueClauses.push(`(${placeholders.join(', ')})`);
          }

          const insertSql = `INSERT INTO "${table}" (${selectColsSql}) VALUES ${valueClauses.join(', ')} ON CONFLICT DO NOTHING`;
          const insertRes = await target.query(insertSql, values);
          inserted += insertRes.rowCount || 0;
        }

        totalSourceRows += rows.length;
        totalInsertedRows += inserted;
        results.push({ table, sourceRows: rows.length, insertedRows: inserted, status: 'MIGRATED' });
      }

      const durationMs = Date.now() - startedAt;
      logger.info({ durationMs, totalSourceRows, totalInsertedRows }, '[MIGRATION] On-platform Neon -> Supabase transfer completed');

      return {
        success: true,
        durationMs,
        totalSourceRows,
        totalInsertedRows,
        tables: results,
      };
    } finally {
      await source.end().catch(() => {});
      await target.end().catch(() => {});
    }
  }
}

export const migrationService = new MigrationService();