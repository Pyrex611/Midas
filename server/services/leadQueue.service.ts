import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import Papa from 'papaparse';
import { verificationService } from './verification.service';

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

  async processPendingUploads() {
    try {
      await prisma.$executeRaw`
        UPDATE "UploadJob"
        SET status = 'PENDING'
        WHERE status = 'PROCESSING'
        AND updated_at < NOW() - INTERVAL '15 minutes'
      `;

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
            await prisma.uploadJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });
            
            const response = await fetch(job.blobUrl);
            const csvText = await response.text();
            
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            const rawLeads: any[] = parsed.data;

            const blocklist = await prisma.blocklist.findMany({ where: { userId: job.userId } });

            const validRows: any[] = [];
            let blockedCount = 0;
            
            for (const row of rawLeads) {
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

              if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
              if (!name) name = email.split('@')[0];

              if (this.isEmailBlocked(email, blocklist)) {
                blockedCount++;
                continue;
              }

              validRows.push({ name, email, company, position });
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

            let validCount = 0, catchAllCount = 0, invalidCount = 0;
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

            // High-Speed Chunked Batch Inserts
            const CHUNK_SIZE = 500;
            let insertedCount = 0;
            let duplicatesCount = 0;

            for (let i = 0; i < leadsToInsert.length; i += CHUNK_SIZE) {
              const chunk = leadsToInsert.slice(i, i + CHUNK_SIZE);
              const insertResult = await prisma.lead.createMany({
                data: chunk,
                skipDuplicates: true,
              });
              insertedCount += insertResult.count;
              duplicatesCount += (chunk.length - insertResult.count);
            }

            await prisma.uploadJob.update({
              where: { id: job.id },
              data: {
                status: 'COMPLETED',
                validLeads: insertedCount,
                catchAllLeads: catchAllCount,
                invalidLeads: invalidCount,
                duplicates: duplicatesCount,
                error: null 
              }
            });
            logger.info(`Job ${job.id} completed. Inserted ${insertedCount} leads.`);
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