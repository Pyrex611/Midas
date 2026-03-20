import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanseCampaignLeads() {
  console.log('🧹 Cleaning Duplicate Leads from Campaigns...');

  const campaigns = await prisma.campaign.findMany({
    include: { leads: { orderBy: { createdAt: 'asc' } } }
  });

  let totalUnlinked = 0;

  for (const campaign of campaigns) {
    const seenEmails = new Set<string>();
    const redundantLeadIds: string[] = [];

    for (const lead of campaign.leads) {
      const email = lead.email.toLowerCase();
      if (seenEmails.has(email)) {
        redundantLeadIds.push(lead.id);
      } else {
        seenEmails.add(email);
      }
    }

    if (redundantLeadIds.length > 0) {
      console.log(`Campaign "${campaign.name}": Removing ${redundantLeadIds.length} duplicate leads.`);
      await prisma.lead.updateMany({
        where: { id: { in: redundantLeadIds } },
        data: { campaignId: null, outreachStatus: null }
      });
      totalUnlinked += redundantLeadIds.length;
    }
  }

  console.log(`✅ Success: Unlinked ${totalUnlinked} duplicate lead records from their campaigns.`);
}

cleanseCampaignLeads().finally(() => prisma.$disconnect());