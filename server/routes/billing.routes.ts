import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { planGuardService } from '../services/billing/planGuard.service';
import { PLAN_TIERS } from '../services/billing/plans';
import { dodoService } from '../services/billing/dodo.service';

const router = Router();

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await planGuardService.getQuotaSummary(req.user!.id);
    res.json({
      ...summary,
      tiers: Object.values(PLAN_TIERS),
      dodoConfigured: dodoService.isConfigured(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load billing summary' });
  }
});

router.post('/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const { plan, billingCycle = 'monthly' } = req.body;
    if (!['CHIEF', 'SYNDICATE'].includes(plan)) {
      return res.status(400).json({ error: 'plan must be CHIEF or SYNDICATE' });
    }
    const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
    const session = await dodoService.createCheckoutSession({
      userId: req.user!.id,
      email: req.user!.email,
      plan,
      billingCycle: cycle,
    });
    res.json(session);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not initialize Dodo checkout' });
  }
});

router.post('/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const sub = await dodoService.cancelSubscription(req.user!.id);
    res.json({ success: true, subscription: sub });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not cancel subscription' });
  }
});

export default router;