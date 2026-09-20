import { Router } from 'express';
import { verificationService } from '../services/verification';

const router = Router();

// Public, non-sensitive. Drives frontend feature flags (e.g. enabling the
// "Verify emails" checkbox on upload) without needing a frontend redeploy
// when a verification provider's API key is added on the backend.
router.get('/', (_req, res) => {
  res.json({
    verification: {
      available: verificationService.isAvailable(),
      provider: verificationService.providerName,
    },
  });
});

export default router;
