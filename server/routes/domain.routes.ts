import { Router } from 'express';
import { domainService } from '../services/domain.service';

const router = Router();

router.get('/', async (req: any, res) => {
  try {
    const domains = await domainService.getDomains(req.user.id);
    res.json(domains);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: any, res) => {
  try {
    const { domainName } = req.body;
    if (!domainName) return res.status(400).json({ error: 'domainName is required' });
    const domain = await domainService.addDomain(req.user.id, domainName);
    res.status(201).json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/verify', async (req: any, res) => {
  try {
    const domain = await domainService.verifyDomain(req.user.id, req.params.id);
    res.json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req: any, res) => {
  try {
    await domainService.deleteDomain(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;