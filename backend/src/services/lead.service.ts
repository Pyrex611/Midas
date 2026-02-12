import { PrismaClient, LeadStatus } from '@prisma/client';
import { LeadCreateInput, LeadUpdateInput } from '../types/lead.types';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

export class LeadService {
  async createLeads(
    leads: LeadCreateInput[],
    skipDuplicates = true
  ): Promise<{ created: number; duplicates: number; failed: number; errors: any[] }> {
    const result = { created: 0, duplicates: 0, failed: 0, errors: [] };

    for (const lead of leads) {
      try {
        // Check existing email
        const existing = await prisma.lead.findUnique({
          where: { email: lead.email },
        });

        if (existing) {
          if (skipDuplicates) {
            result.duplicates++;
            continue;
          } else {
            // Update existing lead with new data (optional strategy)
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
      } catch (error) {
        result.failed++;
        result.errors.push({ email: lead.email, error: error.message });
        logger.error({ error, lead }, 'Failed to create lead');
      }
    }

    return result;
  }

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

  async getLead(id: string) {
    return prisma.lead.findUniqueOrThrow({ where: { id } });
  }

  async updateLead(id: string, data: LeadUpdateInput) {
    return prisma.lead.update({ where: { id }, data });
  }

  async deleteLead(id: string) {
    await prisma.lead.delete({ where: { id } });
    return { success: true };
  }
}