import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { migrationService } from '../services/migration.service';

const router = Router();

router.post('/neon-to-supabase', async (req: AuthRequest, res: Response) => {
  try {
    const { sourceDatabaseUrl } = req.body || {};
    if (!sourceDatabaseUrl || typeof sourceDatabaseUrl !== 'string') {
      return res.status(400).json({ error: 'sourceDatabaseUrl is required' });
    }

    const report = await migrationService.migrateFromNeon(sourceDatabaseUrl);
    res.json(report);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Database migration failed' });
  }
});

export default router;