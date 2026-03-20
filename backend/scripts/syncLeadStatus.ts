import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function syncStatus() {
  console.log('🔄 Syncing Lead Statuses with Email History...');
  
  const leads = await prisma.lead.findMany({
    where: { 
      NOT: { outreachStatus: 'SENT' },
      campaignId: { not: null }
    }
  });

  let synced = 0;
  for (const lead of leads) {
    const hasHistory = await prisma.outboundEmail.findFirst({
      where: {
        campaignId: lead.campaignId!,
        lead: { email: lead.email },
        status: 'SENT'
      }
    });

    if (hasHistory) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { outreachStatus: 'SENT', status: 'CONTACTED' }
      });
      synced++;
    }
  }

  console.log(`✅ Synchronized ${synced} leads to 'SENT' status.`);
}

syncStatus().finally(() => prisma.$disconnect());