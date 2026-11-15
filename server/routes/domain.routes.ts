import { Router } from 'express';
import { domainService } from '../services/domain.service';
import { senderService } from '../services/sender.service';
import { dnsService } from '../services/dns.service';
import { snapshotService } from '../services/snapshot.service';

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

router.post('/esp', async (req: any, res) => {
  try {
    const { domainName, espProvider, apiKey, smtpConfig } = req.body;
    if (!domainName) return res.status(400).json({ error: 'domainName is required' });
    if (!['resend', 'smtp'].includes(espProvider)) {
      return res.status(400).json({ error: 'espProvider must be "resend" or "smtp"' });
    }
    const domain = await domainService.connectEspDomain(req.user.id, {
      domainName,
      espProvider,
      apiKey,
      smtpConfig,
    });
    res.status(201).json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/send-test', async (req: any, res) => {
  try {
    const { testRecipientEmail } = req.body;
    const domain = await domainService.runSendTest(req.user.id, req.params.id, testRecipientEmail || req.user.email);
    res.json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/receiving-test/reset', async (req: any, res) => {
  try {
    const domain = await domainService.resetReceivingTest(req.user.id, req.params.id);
    res.json(domain);
  } catch (error: any) {
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

router.get('/:id/dns-inspect', async (req: any, res) => {
  try {
    const report = await dnsService.inspectDomainDns(
      req.user.id,
      req.params.id,
      req.query.dkimSelector as string | undefined
    );
    res.json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/tracking-domain', async (req: any, res) => {
  try {
    const { trackingDomain } = req.body;
    if (!trackingDomain) return res.status(400).json({ error: 'trackingDomain is required' });
    const result = await dnsService.configureTrackingDomain(req.user.id, req.params.id, trackingDomain);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/snapshots', async (req: any, res) => {
  try {
    const days = parseInt((req.query.days as string) || '30', 10);
    const snapshots = await snapshotService.getDomainSnapshots(req.user.id, req.params.id, days);
    res.json(snapshots);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/dmarc-bimi', async (req: any, res) => {
  try {
    const domains = await domainService.getDomains(req.user.id);
    const domain = domains.find((d: any) => d.id === req.params.id);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    const report = await domainService.checkDmarcPolicy(domain.domainName);
    res.json(report);
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

router.delete('/:id', async (req: any, res) => {
  try {
    await domainService.deleteDomain(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

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