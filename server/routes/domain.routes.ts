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

// Creates a brand-new domain via Mailgun's `POST /domains` API. Requires a
// Mailgun plan/tier that allows programmatic domain creation.
router.post('/', async (req: any, res) => {
  try {
    const { domainName, senderLocalPart } = req.body;
    if (!domainName) return res.status(400).json({ error: 'domainName is required' });
    const domain = await domainService.addDomain(req.user.id, domainName, senderLocalPart);
    res.status(201).json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Adopts a domain the user already created directly in Mailgun's dashboard —
// works even on Mailgun tiers that block/limit the domain-creation API call,
// since this only ever performs a read-only GET against Mailgun.
router.post('/connect', async (req: any, res) => {
  try {
    const { domainName, senderLocalPart } = req.body;
    if (!domainName) return res.status(400).json({ error: 'domainName is required' });
    const domain = await domainService.connectExistingDomain(req.user.id, domainName, senderLocalPart);
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
