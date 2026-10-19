import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import Papa from 'papaparse';
import { verificationService } from './verification';

export class LeadQueueService {

  private isEmailBlocked(email: string, blocklist: { pattern: string }[]): boolean {
    const cleanEmail = email.trim().toLowerCase();
    const emailDomain = cleanEmail.split('@')[1] || '';

    return blocklist.some(b => {
      const cleanPattern = b.pattern.trim().toLowerCase().replace(/^\*@?/, '').replace(/^@/, '');
      if (!cleanPattern) return false;
      return cleanEmail === cleanPattern || emailDomain === cleanPattern || cleanEmail.endsWith('@' + cleanPattern) || cleanEmail.endsWith('.' + cleanPattern);
    });
  }

  private parseRow(row: any): { name: string; email: string; company: string | null; position: string | null } | null {
    const keys = Object.keys(row);
    const emailKey = keys.find(k => /email/i.test(k));
    const nameKey = keys.find(k => /^(full ?name|name|contact ?name)$/i.test(k));
    const firstNameKey = keys.find(k => /first ?name/i.test(k));
    const lastNameKey = keys.find(k => /last ?name/i.test(k));
    const companyKey = keys.find(k => /company|organization|account/i.test(k));
    const positionKey = keys.find(k => /title|position|role/i.test(k));

    const email = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
    let name = nameKey ? String(row[nameKey] || '').trim() : '';
    if (!name && firstNameKey) {
      const first = String(row[firstNameKey] || '').trim();
      const last = lastNameKey ? String(row[lastNameKey] || '').trim() : '';
      name = `${first} ${last}`.trim();
    }

    const company = companyKey ? String(row[companyKey] || '').trim() : null;
    const position = positionKey ? String(row[positionKey] || '').trim() : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    if (!name) name = email.split('@')[0];

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

      const lockedJobs = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "UploadJob"
        WHERE status IN ('PENDING', 'VERIFYING')
        ORDER BY created_at ASC
        LIMIT 5
        FOR UPDATE SKIP LOCKED
      `;

      if (lockedJobs.length === 0) return { jobsProcessed: 0 };

      for (const jobHeader of lockedJobs) {
        const job = await prisma.uploadJob.findUnique({ where: { id: jobHeader.id } });
        if (!job) continue;

        try {
          if (job.status === 'PENDING') {
            await prisma.uploadJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });

            const response = await fetch(job.blobUrl);
            const csvText = await response.text();

            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            const rawLeads: any[] = parsed.data;

            const blocklist = await prisma.blocklist.findMany({ where: { userId: job.userId } });

            const validRows: { name: string; email: string; company: string | null; position: string | null }[] = [];
            let blockedCount = 0;

            for (const row of rawLeads) {
              const parsedRow = this.parseRow(row);
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

            // ---- Fast path: verification opted out (or globally unavailable) ----
            // Import leads immediately, skipping the vendor round-trip entirely.
            // This is the default today (no verification API key is configured
            // yet) and keeps uploads fast regardless of that — leads land as
            // `UNVERIFIED` and can be (re-)verified later once a provider is on.
            if (!job.verifyEmails || !verificationService.isAvailable()) {
              await this.insertLeads(
                job.id,
                job.userId,
                validRows.map(r => ({ ...r, verificationStatus: 'UNVERIFIED' })),
                { totalRows: rawLeads.length, blockedLeads: blockedCount, catchAllLeads: 0, invalidLeads: 0 }
              );
              jobsProcessed++;
              continue;
            }

            // ---- Verified path: submit to whichever provider is configured ----
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
            const rawRows: { name: string; email: string; company: string | null; position: string | null }[] =
              JSON.parse(job.pendingRows || '[]');
            const emails = rawRows.map(r => r.email);

            const { isComplete, results } = await verificationService.getBulkJobResults(job.verificationId, emails);

            if (!isComplete) {
              logger.debug(`Job ${job.id} still verifying with ${verificationService.providerName}...`);
              continue;
            }

            let catchAllCount = 0;
            let invalidCount = 0;
            const leadsToInsert: { name: string; email: string; company: string | null; position: string | null; verificationStatus: string }[] = [];

            for (const row of rawRows) {
              const vResult = results.find(r => r.email === row.email);
              if (!vResult) continue;

              if (vResult.status === 'INVALID') invalidCount++;
              else if (vResult.status === 'CATCH_ALL') catchAllCount++;

              if (vResult.status === 'VALID' || vResult.status === 'CATCH_ALL') {
                leadsToInsert.push({ ...row, verificationStatus: vResult.status });
              }
            }

            await this.insertLeads(job.id, job.userId, leadsToInsert, {
              totalRows: job.totalRows,
              blockedLeads: job.blockedLeads,
              catchAllLeads: catchAllCount,
              invalidLeads: invalidCount,
            });
            jobsProcessed++;
          }
        } catch (jobError: any) {
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
    leads: { name: string; email: string; company: string | null; position: string | null; verificationStatus: string }[],
    counts: { totalRows: number; blockedLeads: number; catchAllLeads: number; invalidLeads: number }
  ) {
    const CHUNK_SIZE = 500;
    let insertedCount = 0;
    let duplicatesCount = 0;

    for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
      const chunk = leads.slice(i, i + CHUNK_SIZE).map(l => ({ ...l, userId }));
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
    logger.info(`Job ${jobId} completed. Inserted ${insertedCount} leads.`);
  }
}

export const leadQueueService = new LeadQueueService();
