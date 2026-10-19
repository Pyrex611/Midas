import { Router } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

const router = Router();

router.get('/health/db', async (req, res) => {
  console.log('[DEBUG DIAGNOSTICS] /health/db triggered. Testing database query latency...');
  try {
    const start = Date.now();
    const [leadCount, campaignCount, draftCount, domainCount] = await Promise.all([
      prisma.lead.count(),
      prisma.campaign.count(),
      prisma.draft.count(),
      prisma.domain.count(),
    ]);
    const duration = Date.now() - start;
    console.log(`[DEBUG DIAGNOSTICS] Prisma queries completed in ${duration}ms`);

    res.json({
      status: 'healthy',
      database: 'Vercel Postgres (Neon)',
      responseTimeMs: duration,
      counts: {
        leads: leadCount,
        campaigns: campaignCount,
        drafts: draftCount,
        domains: domainCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[DEBUG DIAGNOSTICS ERROR]', error);
    logger.error({ error: error.message }, 'Database health check failed');
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

router.post('/test/lead', async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return res.status(400).json({ error: 'No user exists for diagnostic test' });

    const lead = await prisma.lead.create({
      data: {
        userId: user.id,
        name: 'Diagnostic Test Lead',
        email: `test-${Date.now()}@example.com`,
        company: 'Diagnostic Corp',
        position: 'Tester',
      },
    });

    res.json({ success: true, lead });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Test lead creation failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;