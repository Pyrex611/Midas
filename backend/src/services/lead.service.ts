import { Prisma, Lead } from '@prisma/client';
import prisma from '../lib/prisma';
import { LeadCreateInput, LeadUpdateInput, LeadStatus } from '../types/lead.types';
import { logger } from '../config/logger';

export class LeadService {
  /**
   * Bulk insert leads with duplicate handling. Returns created leads.
   */
  async createLeads(
    leads: LeadCreateInput[],
    skipDuplicates = true
  ): Promise<{
    created: number;
    duplicates: number;
    failed: number;
    errors: any[];
    createdLeads: Lead[];
  }> {
    const result = {
      created: 0,
      duplicates: 0,
      failed: 0,
      errors: [] as any[],
      createdLeads: [] as Lead[],
    };

    for (const lead of leads) {
      try {
        // Defensive: ensure lead has required fields
        if (!lead.email || !lead.name) {
          throw new Error('Lead missing email or name');
        }

        const existing = await prisma.lead.findUnique({
          where: { email: lead.email },
        });

        if (existing) {
          if (skipDuplicates) {
            result.duplicates++;
            continue;
          } else {
            // Update existing lead
            const updated = await prisma.lead.update({
              where: { id: existing.id },
              data: {
                name: lead.name,
                company: lead.company ?? existing.company,
                position: lead.position ?? existing.position,
              },
            });
            result.created++;
            result.createdLeads.push(updated);
            continue;
          }
        }

        const created = await prisma.lead.create({ data: lead });
        result.created++;
        result.createdLeads.push(created);
      } catch (error: any) {
        result.failed++;
        result.errors.push({ email: lead.email, error: error.message });
        logger.error({ error, lead }, '❌ Lead creation failed');
        // Rethrow to controller for 500 response
        throw new Error(`Lead creation failed for ${lead.email}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Retrieve paginated leads, optionally filtered by status and campaign.
   */
  async getLeads(
    page: number,
    pageSize: number,
    status?: LeadStatus,
    campaignId?: string
  ) {
    const where: any = {};
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

    return {
      data: leads,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getLead(id: string) {
    try {
      return await prisma.lead.findUniqueOrThrow({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2025') throw new Error('Lead not found');
      throw error;
    }
  }

  async updateLead(id: string, data: LeadUpdateInput) {
    try {
      return await prisma.lead.update({ where: { id }, data });
    } catch (error: any) {
      if (error.code === 'P2025') throw new Error('Lead not found');
      throw error;
    }
  }

  async deleteLead(id: string) {
    try {
      await prisma.lead.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      if (error.code === 'P2025') throw new Error('Lead not found');
      throw error;
    }
  }
}