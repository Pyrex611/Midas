import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { verificationService } from './verification';
import { reconcileCampaignQueue } from '../controllers/campaign.controller';

interface ParsedLeadRow {
  name: string;
  email: string;
  company: string | null;
  position: string | null;
}

interface ColumnMappingConfig {
  email: string;
  nameMode?: 'single' | 'split';
  nameCol?: string;
  firstNameCol?: string;
  lastNameCol?: string;
  companyCol?: string;
  positionCol?: string;
}

export class LeadQueueService {

  private isEmailBlocked(email: string, blocklist: { pattern: string }[]): boolean {
    const cleanEmail = email.trim().toLowerCase();
    const emailDomain = cleanEmail.split('@')[1] || '';

    return blocklist.some(b => {
      const cleanPattern = b.pattern.trim().toLowerCase().replace(/^\*@?/, '').replace(/^@/, '');
      if (!cleanPattern) return false;
      return (
        cleanEmail === cleanPattern ||
        emailDomain === cleanPattern ||
        cleanEmail.endsWith('@' + cleanPattern) ||
        cleanEmail.endsWith('.' + cleanPattern)
      );
    });
  }

  private parseRowWithMapping(row: any, mapping?: ColumnMappingConfig | null): ParsedLeadRow | null {
    if (!row || typeof row !== 'object') return null;

    const normalizedRow: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = k.replace(/^\uFEFF/, '').trim();
      normalizedRow[cleanKey] = v !== null && v !== undefined ? String(v).trim() : '';
    }

    let email = '';
    let name = '';
    let company: string | null = null;
    let position: string | null = null;

    if (mapping?.email && normalizedRow[mapping.email]) {
      email = normalizedRow[mapping.email].toLowerCase();
    } else {
      const emailKey = Object.keys(normalizedRow).find(k =>
        /^(work_?email|corporate_?email|business_?email|primary_?email|contact_?email|email_?address|email)$/i.test(k) ||
        (/email/i.test(k) && !/domain|status|valid/i.test(k))
      );
      if (emailKey) email = normalizedRow[emailKey].toLowerCase();
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return null;
    }

    if (mapping?.nameMode === 'split' && (mapping.firstNameCol || mapping.lastNameCol)) {
      const first = mapping.firstNameCol ? normalizedRow[mapping.firstNameCol] || '' : '';
      const last = mapping.lastNameCol ? normalizedRow[mapping.lastNameCol] || '' : '';
      name = `${first} ${last}`.trim();
    } else if (mapping?.nameCol && normalizedRow[mapping.nameCol]) {
      name = normalizedRow[mapping.nameCol];
    } else {
      const fullNameKey = Object.keys(normalizedRow).find(k =>
        /^(full_?name|contact_?name|lead_?name|prospect_?name|name)$/i.test(k) && !/company|domain/i.test(k)
      );
      if (fullNameKey && normalizedRow[fullNameKey]) {
        name = normalizedRow[fullNameKey];
      } else {
        const firstKey = Object.keys(normalizedRow).find(k => /^(first_?name|first|fname|given_?name)$/i.test(k));
        const lastKey = Object.keys(normalizedRow).find(k => /^(last_?name|last|lname|surname|family_?name)$/i.test(k));
        const first = firstKey ? normalizedRow[firstKey] || '' : '';
        const last = lastKey ? normalizedRow[lastKey] || '' : '';
        name = `${first} ${last}`.trim();
      }
    }

    if (!name) name = email.split('@')[0];

    if (mapping?.companyCol && normalizedRow[mapping.companyCol]) {
      company = normalizedRow[mapping.companyCol];
    } else {
      const companyKey = Object.keys(normalizedRow).find(k =>
        /^(company_?name|company|organization|account_?name|account|employer|firm)$/i.test(k)
      );
      if (companyKey) company = normalizedRow[companyKey] || null;
    }

    if (mapping?.positionCol && normalizedRow[mapping.positionCol]) {
      position = normalizedRow[mapping.positionCol];
    } else {
      const positionKey = Object.keys(normalizedRow).find(k =>
        /^(job_?title|title|position|role|designation|headline)$/i.test(k)
      );
      if (positionKey) position = normalizedRow[positionKey] || null;
    }

    if (company && /^(n\/a|none|null|undefined|-)$/i.test(company)) company = null;
    if (position && /^(n\/a|none|null|undefined|-)$/i.test(position)) position = null;

    return { name, email, company, position };
  }

  async processPendingUploads(): Promise<{ jobsProcessed: number }> {
    let jobsProcessed = 0;
    try {
      await prisma.$executeRaw`
        UPDATE "UploadJob"
        SET status = 'PENDING'
        WHERE status = 'PROCESSING'
        AND updated_at < NOW() - INTERVAL '15 minutes'
      `;

      let jobIds: string[] = [];
      try {
        jobIds = await prisma.$transaction(async (tx) => {
          const lockedJobs = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "UploadJob"
            WHERE status IN ('PENDING', 'VERIFYING')
            ORDER BY created_at ASC
            LIMIT 5
            FOR UPDATE SKIP LOCKED
          `;

          if (lockedJobs.length === 0) return [];
          const ids = lockedJobs.map(j => j.id);

          await tx.uploadJob.updateMany({
            where: { id: { in: ids }, status: 'PENDING' },
            data: { status: 'PROCESSING' }
          });

          return ids;
        }, { maxWait: 5000, timeout: 8000 });
      } catch (txErr: any) {
        logger.warn({ err: txErr?.message }, 'Upload job claim transaction timed out');
        return { jobsProcessed: 0 };
      }

      if (jobIds.length === 0) return { jobsProcessed: 0 };

      for (const jobId of jobIds) {
        const job = await prisma.uploadJob.findUnique({ where: { id: jobId } });
        if (!job) continue;

        try {
          if (job.status === 'PROCESSING') {
            const response = await fetch(job.blobUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            let rawLeads: any[] = [];
            const isExcel = job.filename.endsWith('.xlsx') || job.filename.endsWith('.xls');

            if (isExcel) {
              const workbook = XLSX.read(buffer, { type: 'buffer' });
              const sheetName = workbook.SheetNames[0];
              rawLeads = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            } else {
              const csvText = buffer.toString('utf8');
              const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
              rawLeads = parsed.data as any[];
            }

            let mappingConfig: ColumnMappingConfig | null = null;
            if (job.columnMapping) {
              try { mappingConfig = JSON.parse(job.columnMapping); } catch { mappingConfig = null; }
            }

            const blocklist = await prisma.blocklist.findMany({ where: { userId: job.userId } });

            const validRows: ParsedLeadRow[] = [];
            let blockedCount = 0;

            for (const row of rawLeads) {
              const parsedRow = this.parseRowWithMapping(row, mappingConfig);
              if (!parsedRow) continue;

              if (this.isEmailBlocked(parsedRow.email, blocklist)) {
                blockedCount++;
                continue;
              }
              validRows.push(parsedRow);
            }

            if (validRows.length === 0) {
              await prisma.uploadJob.update({
                where: { id: job.id },
                data: { status: 'COMPLETED', totalRows: rawLeads.length, blockedLeads: blockedCount },
              });
              jobsProcessed++;
              continue;
            }

            if (!job.verifyEmails || !verificationService.isAvailable()) {
              await this.insertLeads(
                job.id,
                job.userId,
                validRows.map(r => ({ ...r, verificationStatus: 'UNVERIFIED' })),
                { totalRows: rawLeads.length, blockedLeads: blockedCount, catchAllLeads: 0, invalidLeads: 0 },
                job.campaignId
              );
              jobsProcessed++;
              continue;
            }

            const emailsToVerify = validRows.map(r => r.email);
            const verificationId = await verificationService.submitBulkJob(emailsToVerify);

            await prisma.uploadJob.update({
              where: { id: job.id },
              data: {
                status: 'VERIFYING',
                verificationId,
                totalRows: rawLeads.length,
                blockedLeads: blockedCount,
                pendingRows: JSON.stringify(validRows),
              },
            });
            jobsProcessed++;
            logger.info(`Job ${job.id} sent to ${verificationService.providerName} for verification.`);
          }
          else if (job.status === 'VERIFYING' && job.verificationId) {
            const rawRows: ParsedLeadRow[] = JSON.parse(job.pendingRows || '[]');
            const emails = rawRows.map(r => r.email);

            const { isComplete, results } = await verificationService.getBulkJobResults(job.verificationId, emails);

            if (!isComplete) {
              logger.debug(`Job ${job.id} still verifying...`);
              continue;
            }

            let catchAllCount = 0;
            let invalidCount = 0;
            const leadsToInsert: (ParsedLeadRow & { verificationStatus: string })[] = [];

            for (const row of rawRows) {
              const vResult = results.find(r => r.email === row.email);
              if (!vResult) continue;

              if (vResult.status === 'INVALID') invalidCount++;
              else if (vResult.status === 'CATCH_ALL') catchAllCount++;

              if (vResult.status === 'VALID' || vResult.status === 'CATCH_ALL') {
                leadsToInsert.push({ ...row, verificationStatus: vResult.status });
              }
            }

            await this.insertLeads(
              job.id,
              job.userId,
              leadsToInsert,
              {
                totalRows: job.totalRows,
                blockedLeads: job.blockedLeads,
                catchAllLeads: catchAllCount,
                invalidLeads: invalidCount,
              },
              job.campaignId
            );
            jobsProcessed++;
          }
        } catch (jobError: any) {
          logger.error({ err: jobError.message, jobId: job.id }, 'Upload job processing failure');
          await prisma.uploadJob.update({
            where: { id: job.id },
            data: { status: 'FAILED', error: jobError.message },
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Lead Queue processing error');
    }
    return { jobsProcessed };
  }

  private async insertLeads(
    jobId: string,
    userId: string,
    leads: (ParsedLeadRow & { verificationStatus: string })[],
    counts: { totalRows: number; blockedLeads: number; catchAllLeads: number; invalidLeads: number },
    campaignId?: string | null
  ) {
    const CHUNK_SIZE = 500;
    let insertedCount = 0;
    let duplicatesCount = 0;

    for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
      const chunk = leads.slice(i, i + CHUNK_SIZE).map(l => ({
        ...l,
        userId,
        campaignId: campaignId || null,
        outreachStatus: campaignId ? 'PENDING' : null,
      }));
      const insertResult = await prisma.lead.createMany({ data: chunk, skipDuplicates: true });
      insertedCount += insertResult.count;
      duplicatesCount += (chunk.length - insertResult.count);
    }

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        totalRows: counts.totalRows,
        blockedLeads: counts.blockedLeads,
        validLeads: insertedCount,
        catchAllLeads: counts.catchAllLeads,
        invalidLeads: counts.invalidLeads,
        duplicates: duplicatesCount,
        pendingRows: null,
        error: null,
      },
    });

    // If assigned to a campaign, run queue reconciliation immediately
    if (campaignId) {
      reconcileCampaignQueue(campaignId, userId).catch(err => {
        logger.error({ err, campaignId }, 'Failed to reconcile queue after lead ingestion');
      });
    }

    logger.info(`Job ${jobId} completed. Inserted ${insertedCount} leads.`);
  }
}

export const leadQueueService = new LeadQueueService();