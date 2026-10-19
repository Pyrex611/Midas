import prisma from '../server/lib/prisma';

// Previously instantiated its own bare `new PrismaClient()` — under Prisma
// 7 that throws immediately (`requires either "adapter" or "accelerateUrl"`,
// see server/lib/prisma.ts for the full incident writeup). Reuses the same
// adapter-backed singleton as the running app instead of a second,
// divergent client-construction pattern.

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
