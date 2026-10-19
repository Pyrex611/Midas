import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export class LeadService {
  async createLeads(userId: string, leads: { name: string; email: string; company?: string | null; position?: string | null }[], skipDuplicates = true) {
    const result: {
      created: number;
      duplicates: number;
      failed: number;
      errors: { email: string; error: string }[];
      createdLeads: any[];
    } = { created: 0, duplicates: 0, failed: 0, errors: [], createdLeads: [] };

    for (const lead of leads) {
      try {
        const existing = await prisma.lead.findFirst({
          where: { userId, email: lead.email },
        });
        if (existing) {
          if (skipDuplicates) {
            result.duplicates++;
            continue;
          } else {
            const updated = await prisma.lead.update({
              where: { id: existing.id },
              data: { name: lead.name, company: lead.company ?? existing.company, position: lead.position ?? existing.position },
            });
            result.created++;
            result.createdLeads.push(updated);
            continue;
          }
        }
        const created = await prisma.lead.create({ data: { ...lead, userId } });
        result.created++;
        result.createdLeads.push(created);
      } catch (error: any) {
        result.failed++;
        result.errors.push({ email: lead.email, error: error.message || 'Unknown error' });
        logger.error({ error: error.message, lead }, 'Lead creation failed');
      }
    }
    return result;
  }

  async getLeads(userId: string, page: number, pageSize: number, status?: string, campaignId?: string) {
    const where: any = { userId };
    if (status && status !== 'all') where.status = status;
    if (campaignId && campaignId !== 'all') where.campaignId = campaignId;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    return { data: leads, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async deleteLead(userId: string, id: string) {
    await prisma.lead.delete({ where: { id, userId } });
    return { success: true };
  }
}

export const leadService = new LeadService();