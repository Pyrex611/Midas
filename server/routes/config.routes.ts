import { Router } from 'express';
import { verificationService } from '../services/verification';
import { dodoService } from '../services/billing/dodo.service';
import { env } from '../config/env';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    verification: {
      available: verificationService.isAvailable(),
      provider: verificationService.providerName,
    },
    auth: {
      provider: env.AUTH_PROVIDER,
      supabaseUrl: env.SUPABASE_URL || null,
      supabaseAnonKey: env.SUPABASE_ANON_KEY || null,
    },
    billing: {
      provider: 'dodo',
      configured: dodoService.isConfigured(),
    },
  });
});

export default router;