import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { requireScopeIfApiKey } from '../middleware/dualAuth.middleware';
import { sandboxService } from '../services/sandbox.service';

const router = Router();

router.get('/status', requireScopeIfApiKey('campaigns:read'), async (req: AuthRequest, res: Response) => {
  try {
    const status = await sandboxService.getSandboxStatus(req.user!.id);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to inspect sandbox status' });
  }
});

router.post('/test-send', requireScopeIfApiKey('campaigns:write'), async (req: AuthRequest, res: Response) => {
  try {
    const { toEmail, subject, body } = req.body || {};
    const result = await sandboxService.sendSandboxTest({
      userId: req.user!.id,
      userEmail: req.user!.email,
      toEmail,
      subject,
      body,
    });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Sandbox dispatch failed' });
  }
});

export default router;