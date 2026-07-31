import { Router } from 'express';
import multer from 'multer';
import { webhooksService } from '../services/webhooks.service';
import { logger } from '../config/logger';

const router = Router();
const upload = multer();

router.post('/mailgun', async (req, res) => {
  try {
    const { signature } = req.body;
    if (!signature) return res.status(401).send('Missing signature');

    const isValid = webhooksService.verifyMailgunSignature(
      signature.timestamp,
      signature.token,
      signature.signature
    );

    if (!isValid) return res.status(403).send('Invalid Signature');

    webhooksService.processDeliverabilityEvent(req.body).catch(err => {
      logger.error({ err }, 'Deliverability processing failed in background');
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error({ error }, 'Mailgun webhook error');
    res.status(500).send('Internal Server Error');
  }
});

// Phase 5: Inbound Route (Mailgun sends this as multipart/form-data)
router.post('/mailgun/inbound', upload.none(), async (req, res) => {
  try {
    const { timestamp, token, signature } = req.body;
    if (!signature) return res.status(401).send('Missing signature');

    const isValid = webhooksService.verifyMailgunSignature(timestamp, token, signature);
    if (!isValid) return res.status(403).send('Invalid Signature');

    // Process asynchronously to release Mailgun instantly
    webhooksService.processInboundEmail(req.body).catch(err => {
      logger.error({ err }, 'Inbound email processing failed in background');
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error({ error }, 'Mailgun inbound webhook error');
    res.status(500).send('Internal Server Error');
  }
});

export default router;