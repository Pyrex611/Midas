import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function masterCleanse() {
  console.log('🚀 Starting MASTER Queue Cleansing...');

  try {
    const allPending = await prisma.pendingEmail.findMany({
      where: { status: 'PENDING' },
      include: { lead: true },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Analyzing ${allPending.length} entries...`);

    const idsToDelete: string[] = [];
    const seenEmailsInCampaign = new Set<string>();

    for (const entry of allPending) {
      // 1. ORPHAN CHECK
      if (!entry.lead || entry.lead.campaignId !== entry.campaignId) {
        console.log(`[ORPHAN] Deleting entry ${entry.id}: Lead unlinked or deleted.`);
        idsToDelete.push(entry.id);
        continue;
      }

      const emailKey = `${entry.lead.email.toLowerCase()}_${entry.campaignId}`;

      // 2. DUPLICATE CHECK (Same email in same campaign)
      if (seenEmailsInCampaign.has(emailKey)) {
        console.log(`[DUPLICATE] Deleting entry ${entry.id} for ${entry.lead.email} (Email already queued).`);
        idsToDelete.push(entry.id);
        continue;
      }

      // 3. SENT HISTORY CHECK
      const alreadySent = await prisma.outboundEmail.findFirst({
        where: {
          campaignId: entry.campaignId,
          lead: { email: entry.lead.email },
          status: 'SENT'
        }
      });

      if (alreadySent) {
        console.log(`[HISTORY] Deleting entry ${entry.id} for ${entry.lead.email} (Already sent).`);
        idsToDelete.push(entry.id);
        continue;
      }

      // If we reach here, this is the valid first entry for this email
      seenEmailsInCampaign.add(emailKey);
    }

    if (idsToDelete.length > 0) {
      await prisma.pendingEmail.deleteMany({ where: { id: { in: idsToDelete } } });
      console.log(`✅ MASTER CLEANSE: Deleted ${idsToDelete.length} redundant entries.`);
    } else {
      console.log('✨ Queue is 100% healthy.');
    }
  } catch (e) {
    console.error('❌ Cleanse failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

masterCleanse();