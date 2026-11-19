import { Router } from 'express';
import prisma, { activeDbProvider, activeDbHost } from '../lib/prisma';
import { logger } from '../config/logger';

const router = Router();

router.get('/health/db', async (_req, res) => {
  try {
    const start = Date.now();
    const [leadCount, campaignCount, draftCount, domainCount] = await Promise.all([
      prisma.lead.count(),
      prisma.campaign.count(),
      prisma.draft.count(),
      prisma.domain.count(),
    ]);
    const duration = Date.now() - start;

    const databaseLabel =
      activeDbProvider === 'supabase'
        ? 'Supabase Postgres'
        : activeDbProvider === 'neon'
        ? 'Neon Postgres'
        : 'PostgreSQL';

    res.json({
      status: 'healthy',
      database: databaseLabel,
      provider: activeDbProvider,
      host: activeDbHost,
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
    logger.error({ error: error.message }, 'Database health check failed');
    res.status(500).json({
      status: 'unhealthy',
      provider: activeDbProvider,
      host: activeDbHost,
      error: error.message,
    });
  }
});

router.post('/test/lead', async (_req, res) => {
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