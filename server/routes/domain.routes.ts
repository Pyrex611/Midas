import { Router } from 'express';
import { domainService } from '../services/domain.service';
import { senderService } from '../services/sender.service';

const router = Router();

router.get('/', async (req: any, res) => {
  try {
    const domains = await domainService.getDomains(req.user.id);
    res.json(domains);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Default connect flow: paste the Mailgun key you already send with (the
// same one that works with a plain curl call), we run one real test send
// immediately, then hand back a one-time code + address to confirm
// receiving. testRecipientEmail defaults to the caller's own account email.
router.post('/', async (req: any, res) => {
  try {
    const { domainName, mailgunApiKey, region, testRecipientEmail } = req.body;
    if (!domainName) return res.status(400).json({ error: 'domainName is required' });
    if (!mailgunApiKey) return res.status(400).json({ error: 'mailgunApiKey is required' });

    const domain = await domainService.connectWithKey(
      req.user.id,
      domainName,
      mailgunApiKey,
      region || null,
      testRecipientEmail || req.user.email
    );
    res.status(201).json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Retry the send test (e.g. after fixing a typo'd key) for an already-created domain row.
router.post('/:id/send-test', async (req: any, res) => {
  try {
    const { testRecipientEmail } = req.body;
    const domain = await domainService.runSendTest(req.user.id, req.params.id, testRecipientEmail || req.user.email);
    res.json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Regenerate the receiving-test code/address (in case the first attempt expired or was mistyped).
router.post('/:id/receiving-test/reset', async (req: any, res) => {
  try {
    const domain = await domainService.resetReceivingTest(req.user.id, req.params.id);
    res.json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Check whether the receiving test has been confirmed yet (set by the
// inbound webhook when the test email actually arrives — see webhooks.service.ts).
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
    res.status(400).json({ error: error.message });
  }
});

// --- Senders (per-mailbox sending identity + quota) ---

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
