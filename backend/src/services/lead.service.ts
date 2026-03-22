import { Prisma, Lead } from '@prisma/client';
import prisma from '../lib/prisma';
import { LeadCreateInput, LeadUpdateInput, LeadStatus } from '../types/lead.types';
import { logger } from '../config/logger';

export class LeadService {
  /**
   * Bulk insert leads with duplicate handling. Returns created leads.
   */
  async createLeads(userId: string, leads: LeadCreateInput[], skipDuplicates = true) {
    const result = { created: 0, duplicates: 0, failed: 0, errors: [], createdLeads: [] as any[] };
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
        result.errors.push({ email: lead.email, error: error.message });
        logger.error({ error, lead }, 'Lead creation failed');
        throw new Error(`Lead creation failed for ${lead.email}: ${error.message}`);
      }
    }
    return result;
  }

  /**
   * Retrieve paginated leads, optionally filtered by status and campaign.
   */
  async getLeads(userId: string, page: number, pageSize: number, status?: LeadStatus, campaignId?: string) {
    const where: any = { userId };
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;
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


  async getLead(userId: string, id: string) {
    return prisma.lead.findFirstOrThrow({ where: { id, userId } });
  }

  async updateLead(userId: string, id: string, data: LeadUpdateInput) {
    return prisma.lead.update({ where: { id, userId }, data });
  }

  async deleteLead(userId: string, id: string) {
    await prisma.lead.delete({ where: { id, userId } });
    return { success: true };
  }
}