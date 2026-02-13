import { PrismaClient } from '@prisma/client';
import { LeadCreateInput, LeadUpdateInput, LeadStatus } from '../types/lead.types';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

export class LeadService {
  /**
   * Bulk insert leads with duplicate handling.
   * @param leads - Array of validated lead objects
   * @param skipDuplicates - If true, skip existing emails; if false, update them
   */
  async createLeads(
    leads: LeadCreateInput[],
    skipDuplicates = true
  ): Promise<{ created: number; duplicates: number; failed: number; errors: any[] }> {
    const result = { created: 0, duplicates: 0, failed: 0, errors: [] };

    for (const lead of leads) {
      try {
        const existing = await prisma.lead.findUnique({
          where: { email: lead.email },
        });

        if (existing) {
          if (skipDuplicates) {
            result.duplicates++;
            continue;
          } else {
            // Update existing lead with new information
            await prisma.lead.update({
              where: { id: existing.id },
              data: {
                name: lead.name,
                company: lead.company ?? existing.company,
                position: lead.position ?? existing.position,
              },
            });
            result.created++;
            continue;
          }
        }

        await prisma.lead.create({ data: lead });
        result.created++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ email: lead.email, error: error.message });
        logger.error({ error, lead }, 'Failed to create lead');
      }
    }

    return result;
  }

  /**
   * Retrieve paginated leads, optionally filtered by status.
   */
  async getLeads(
    page: number,
    pageSize: number,
    status?: LeadStatus
  ) {
    const where = status ? { status } : {};

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

  /**
   * Retrieve a single lead by ID.
   */
  async getLead(id: string) {
    try {
      return await prisma.lead.findUniqueOrThrow({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Lead not found');
      }
      throw error;
    }
  }

  /**
   * Update an existing lead.
   */
  async updateLead(id: string, data: LeadUpdateInput) {
    try {
      return await prisma.lead.update({
        where: { id },
        data,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Lead not found');
      }
      throw error;
    }
  }

  /**
   * Delete a lead by ID.
   */
  async deleteLead(id: string) {
    try {
      await prisma.lead.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Lead not found');
      }
      throw error;
    }
  }
}