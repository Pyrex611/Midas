import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany();
  console.log(`Syncing ${campaigns.length} campaigns to membership model...`);

  for (const campaign of campaigns) {
    await prisma.campaignMember.upsert({
      where: {
        campaignId_userId: {
          campaignId: campaign.id,
          userId: campaign.userId,
        },
      },
      update: {},
      create: {
        campaignId: campaign.id,
        userId: campaign.userId,
        role: 'OWNER',
      },
    });
  }
  console.log('Collaboration sync complete.');
}

main().finally(() => prisma.$disconnect());