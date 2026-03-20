import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanse() {
  console.log('🚀 Starting Deep Queue Cleansing...');

  try {
    // 1. Fetch all pending emails with lead data for verification
    const allPending = await prisma.pendingEmail.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' }, // Order by oldest first so we keep the original entry
    });

    console.log(`Found ${allPending.length} total pending entries. Analyzing...`);

    const idsToDelete: string[] = [];
    const seenCombos = new Set<string>();

    for (const email of allPending) {
      // Logic A: Orphan Check (Is the lead still in this campaign?)
      // Fetch the lead directly to ensure fresh state
      const lead = await prisma.lead.findUnique({
        where: { id: email.leadId },
        select: { id: true, campaignId: true }
      });

      if (!lead || lead.campaignId !== email.campaignId) {
        console.log(`[ORPHAN] Entry ${email.id}: Lead ${email.leadId} is no longer in Campaign ${email.campaignId}`);
        idsToDelete.push(email.id);
        continue;
      }

      // Logic B: Duplicate Check (More than 1 email for this lead in this campaign?)
      const comboKey = `${email.leadId}-${email.campaignId}`;
      
      if (seenCombos.has(comboKey)) {
        console.log(`[DUPLICATE] Entry ${email.id}: Lead ${email.leadId} already has an earlier email queued for Campaign ${email.campaignId}`);
        idsToDelete.push(email.id);
      } else {
        // This is the first (and oldest) time we've seen this lead/campaign pair
        seenCombos.add(comboKey);
      }
    }

    // 2. Perform Batch Deletion
    if (idsToDelete.length > 0) {
      console.log(`\nFound ${idsToDelete.length} invalid or redundant entries.`);
      
      const result = await prisma.pendingEmail.deleteMany({
        where: {
          id: { in: idsToDelete }
        }
      });

      console.log(`✅ Successfully deleted ${result.count} entries from the queue.`);
    } else {
      console.log('✨ No duplicates or orphans found. Queue is already healthy.');
    }

  } catch (error) {
    console.error('❌ Cleansing failed:', error);
  } finally {
    await prisma.$disconnect();
    console.log('👋 Process finished.');
  }
}

cleanse();