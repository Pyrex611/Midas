import crypto from 'crypto';
import prisma from '../lib/prisma';
import { assertSafePublicUrl } from '../lib/ssrfGuard';
import { logger } from '../config/logger';

export interface DispatchWebhookInput {
  userId: string;
  event: string;
  payload: Record<string, any>;
}

export class WebhookDispatchService {
  private buildSignatureHeader(rawBody: string, secret: string, timestampSec: number): string {
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${timestampSec}.${rawBody}`)
      .digest('hex');
    return `t=${timestampSec},v1=${sig}`;
  }

  async deliverToSubscription(
    subscription: { id: string; targetUrl: string; secret: string },
    event: string,
    data: Record<string, any>
  ) {
    const timestamp = Math.floor(Date.now() / 1000);
    const envelope = {
      id: `evt_${timestamp}_${crypto.randomBytes(4).toString('hex')}`,
      event,
      timestamp,
      data,
    };

    const rawBody = JSON.stringify(envelope);
    const signatureHeader = this.buildSignatureHeader(rawBody, subscription.secret, timestamp);
    const startedAt = Date.now();

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;
    let status: 'DELIVERED' | 'FAILED' = 'FAILED';

    try {
      await assertSafePublicUrl(subscription.targetUrl);

      const res = await fetch(subscription.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Midas-Webhook-Dispatcher/1.0',
          'X-Midas-Event': event,
          'X-Midas-Signature': signatureHeader,
        },
        body: rawBody,
        signal: AbortSignal.timeout(8_000),
      });

      statusCode = res.status;
      responseBody = (await res.text()).slice(0, 1000);
      if (res.ok) {
        status = 'DELIVERED';
      } else {
        error = `Endpoint responded with HTTP ${res.status}`;
      }
    } catch (err: any) {
      error = err?.message || 'Webhook HTTP delivery failed';
    }

    const durationMs = Date.now() - startedAt;

    return prisma.webhookDelivery.create({
      data: {
        subscriptionId: subscription.id,
        event,
        payload: envelope,
        statusCode,
        responseBody,
        error,
        status,
        durationMs,
      },
    });
  }

  async dispatch(input: DispatchWebhookInput): Promise<void> {
    try {
      const subscriptions = await prisma.webhookSubscription.findMany({
        where: {
          userId: input.userId,
          isActive: true,
        },
      });

      const matching = subscriptions.filter(
        (sub) => sub.events.includes('*') || sub.events.includes(input.event)
      );

      if (matching.length === 0) return;

      await Promise.allSettled(
        matching.map((sub) => this.deliverToSubscription(sub, input.event, input.payload))
      );
    } catch (err: any) {
      logger.error({ err: err?.message, event: input.event }, '[WEBHOOK-DISPATCH] Failed to dispatch event');
    }
  }
}

export const webhookDispatchService = new WebhookDispatchService();