import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import Papa from 'papaparse';
import { verificationService } from './verification.service';

export class LeadQueueService {

  private isEmailBlocked(email: string, blocklist: { pattern: string }[]): boolean {
    return blocklist.some(b => {
      if (b.pattern.startsWith('*@')) {
        return email.endsWith(b.pattern.replace('*@', '@'));
      }
      return email === b.pattern;
    });
  }

  async processPendingUploads() {
    try {
      // 1. Stale Job Recovery
      await prisma.$executeRaw`
        UPDATE "UploadJob"
        SET status = 'PENDING'
        WHERE status = 'PROCESSING'
        AND updated_at < NOW() - INTERVAL '15 minutes'
      `;

      // 2. Lock pending jobs
      const lockedJobs = await prisma.$queryRaw<{id: string}[]>`
        SELECT id FROM "UploadJob"
        WHERE status IN ('PENDING', 'VERIFYING')
        ORDER BY created_at ASC
        LIMIT 2
        FOR UPDATE SKIP LOCKED
      `;

      if (lockedJobs.length === 0) return;

      for (const jobHeader of lockedJobs) {
        const job = await prisma.uploadJob.findUnique({ where: { id: jobHeader.id }});
        if (!job) continue;

        try {
          if (job.status === 'PENDING') {
            // Prisma automatically updates 'updatedAt' due to @updatedAt in schema
            await prisma.uploadJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } }); // <-- Removed manual updatedAt
            
            const response = await fetch(job.blobUrl);
            const csvText = await response.text();
            
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            const rawLeads: any[] = parsed.data;

            const blocklist = await prisma.blocklist.findMany({ where: { userId: job.userId } });

            const validRows = [];
            let blockedCount = 0;
            
            for (const row of rawLeads) {
              const email = (row.email || row.Email || '').trim().toLowerCase();
              const name = (row.name || row.Name || '').trim();
              if (!email || !name) continue;

              if (this.isEmailBlocked(email, blocklist)) {
                blockedCount++;
                continue;
              }
              validRows.push({ name, email, company: row.company || null, position: row.position || null });
            }

            if (validRows.length === 0) {
              await prisma.uploadJob.update({ 
                where: { id: job.id }, 
                data: { status: 'COMPLETED', totalRows: rawLeads.length, blockedLeads: blockedCount } 
              });
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
                error: JSON.stringify(validRows) 
              }
            });
            logger.info(`Job ${job.id} sent to verification.`);
          } 
          
          else if (job.status === 'VERIFYING' && job.verificationId) {
            const rawRows = JSON.parse(job.error || '[]');
            const emails = rawRows.map((r: any) => r.email);
            
            const { isComplete, results } = await verificationService.getBulkJobResults(job.verificationId, emails);
            
            if (!isComplete) {
              logger.debug(`Job ${job.id} still verifying...`);
              continue;
            }

            let validCount = 0, catchAllCount = 0, invalidCount = 0, duplicatesCount = 0;
            const leadsToInsert = [];

            for (const row of rawRows) {
              const vResult = results.find(r => r.email === row.email);
              if (!vResult) continue;

              if (vResult.status === 'INVALID') invalidCount++;
              else if (vResult.status === 'CATCH_ALL') catchAllCount++;
              else if (vResult.status === 'VALID') validCount++;

              if (vResult.status === 'VALID' || vResult.status === 'CATCH_ALL') {
                leadsToInsert.push({
                  userId: job.userId,
                  name: row.name,
                  email: row.email,
                  company: row.company,
                  position: row.position,
                  verificationStatus: vResult.status
                });
              }
            }

            // CSV Chunking: Insert in batches of 500 to prevent Prisma limits
            const CHUNK_SIZE = 500;
            for (let i = 0; i < leadsToInsert.length; i += CHUNK_SIZE) {
              const chunk = leadsToInsert.slice(i, i + CHUNK_SIZE);
              
              for (const lead of chunk) {
                try {
                  await prisma.lead.create({ data: lead });
                } catch (e: any) {
                  if (e.code === 'P2002') duplicatesCount++;
                }
              }
            }

            await prisma.uploadJob.update({
              where: { id: job.id },
              data: {
                status: 'COMPLETED',
                validLeads: validCount,
                catchAllLeads: catchAllCount,
                invalidLeads: invalidCount,
                duplicates: duplicatesCount,
                error: null 
              }
            });
            logger.info(`Job ${job.id} completed. Inserted valid leads.`);
          }
        } catch (jobError: any) {
          await prisma.uploadJob.update({
            where: { id: job.id },
            data: { status: 'FAILED', error: jobError.message }
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Lead Queue processing error');
    }
  }
}

export const leadQueueService = new LeadQueueService();