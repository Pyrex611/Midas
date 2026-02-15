import { Router } from 'express';
import prisma from '../lib/prisma'; // ✅ SINGLETON – guaranteed to have models
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/diagnostics/health/db
 * Check database connectivity and return counts of all entities.
 */
router.get('/health/db', async (req, res) => {
  try {
    // 🔥 Defensive: ensure prisma and models exist
    if (!prisma) {
      throw new Error('Prisma client not initialized');
    }

    // Check each model with fallback to 0 if model doesn't exist
    let leadCount = 0, campaignCount = 0, draftCount = 0;

    if (prisma.lead) {
      leadCount = await prisma.lead.count();
    }
    if (prisma.campaign) {
      campaignCount = await prisma.campaign.count();
    }
    if (prisma.draft) {
      draftCount = await prisma.draft.count();
    }

    res.json({
      status: 'healthy',
      database: process.env.DATABASE_URL?.startsWith('file:') ? 'SQLite' : 'PostgreSQL',
      counts: {
        leads: leadCount,
        campaigns: campaignCount,
        drafts: draftCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error({ error }, '❌ Database health check failed');
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      hint: 'Run `npx prisma migrate dev` and ensure DATABASE_URL is correct.',
    });
  }
});

/**
 * POST /api/diagnostics/test/lead
 * Create a single test lead to verify write capability.
 */
router.post('/test/lead', async (req, res) => {
  try {
    if (!prisma || !prisma.lead) {
      throw new Error('Lead model not available – run migrations');
    }

    const lead = await prisma.lead.create({
      data: {
        name: 'Test Lead',
        email: `test-${Date.now()}@example.com`,
        company: 'Diagnostic Corp',
        position: 'Tester',
      },
    });

    res.json({ success: true, lead });
  } catch (error: any) {
    logger.error({ error }, '❌ Test lead creation failed');
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;