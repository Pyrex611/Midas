import { Router } from 'express';
import { domainService } from '../services/domain.service';
import { senderService } from '../services/sender.service';
import { logger } from '../config/logger';

const router = Router();

router.get('/', async (req: any, res) => {
  try {
    const domains = await domainService.getDomains(req.user.id);
    res.json(domains);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch domains');
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: any, res) => {
  try {
    const { domainName, mailgunApiKey, region, testRecipientEmail } = req.body;
    if (!domainName) return res.status(400).json({ error: 'domainName is required' });
    if (!mailgunApiKey) return res.status(400).json({ error: 'mailgunApiKey is required' });

    const recipient = testRecipientEmail || req.user?.email;
    if (!recipient) {
      return res.status(400).json({ error: 'A valid test recipient email address is required' });
    }

    const domain = await domainService.connectWithKey(
      req.user.id,
      domainName,
      mailgunApiKey,
      region || null,
      recipient
    );
    res.status(201).json(domain);
  } catch (error: any) {
    logger.error({ error: error.message, domainName: req.body?.domainName }, 'Domain connection failed');
    res.status(400).json({ error: error.message });
  }
});

// DMARC & BIMI Verification Inspector (Sprint B.1)
router.get('/:id/dmarc-bimi', async (req: any, res) => {
  try {
    const domain = await domainService.getDomainRaw(req.params.id);
    if (!domain || domain.userId !== req.user.id) return res.status(404).json({ error: 'Domain not found' });

    const policy = await domainService.checkDmarcPolicy(domain.domainName);
    res.json(policy);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/bimi', async (req: any, res) => {
  try {
    const { bimiEnabled, bimiSvgUrl, bimiVmcUrl } = req.body;
    const updated = await domainService.updateBimiSettings(req.user.id, req.params.id, {
      bimiEnabled: Boolean(bimiEnabled),
      bimiSvgUrl,
      bimiVmcUrl,
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/send-test', async (req: any, res) => {
  try {
    const { testRecipientEmail } = req.body;
    const recipient = testRecipientEmail || req.user?.email;
    if (!recipient) {
      return res.status(400).json({ error: 'A valid test recipient email address is required' });
    }

    const domain = await domainService.runSendTest(req.user.id, req.params.id, recipient);
    res.json(domain);
  } catch (error: any) {
    logger.error({ error: error.message, domainId: req.params.id }, 'Domain retry send-test failed');
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/receiving-test/reset', async (req: any, res) => {
  try {
    const domain = await domainService.resetReceivingTest(req.user.id, req.params.id);
    res.json(domain);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to reset receiving test');
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/receiving-test', async (req: any, res) => {
  try {
    const result = await domainService.checkReceivingTest(req.user.id, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req: any, res) => {
  try {
    await domainService.deleteDomain(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to delete domain');
    res.status(400).json({ error: error.message });
  }
});

// Senders
router.get('/senders/all', async (req: any, res) => {
  try {
    const senders = await senderService.listAllSendersForUser(req.user.id);
    res.json(senders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/senders', async (req: any, res) => {
  try {
    const senders = await senderService.listSendersForDomain(req.user.id, req.params.id);
    res.json(senders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/senders', async (req: any, res) => {
  try {
    const { localPart, displayName, dailyLimit } = req.body;
    if (!localPart) return res.status(400).json({ error: 'localPart is required' });
    const sender = await senderService.createSender(req.user.id, req.params.id, localPart, displayName, dailyLimit);
    res.status(201).json(sender);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/senders/:senderId', async (req: any, res) => {
  try {
    const { displayName, dailyLimit, status } = req.body;
    const sender = await senderService.updateSender(req.user.id, req.params.senderId, { displayName, dailyLimit, status });
    res.json(sender);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/senders/:senderId', async (req: any, res) => {
  try {
    await senderService.deleteSender(req.user.id, req.params.senderId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;