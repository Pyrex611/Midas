import crypto from 'crypto';
import prisma from '../lib/prisma';
import { assertSafePublicUrl } from '../lib/ssrfGuard';
import { logger } from '../config/logger';

export interface DispatchWebhookInput {
  userId: string;
  event: string;
  payload: Record<string, any>;
}

const MAX_ATTEMPTS = 3;

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
    let attempts = 0;

    // SSRF guard before attempting any outbound socket connection
    try {
      await assertSafePublicUrl(subscription.targetUrl);
    } catch (ssrfErr: any) {
      return prisma.webhookDelivery.create({
        data: {
          subscriptionId: subscription.id,
          event,
          payload: envelope,
          statusCode: null,
          responseBody: null,
          error: ssrfErr?.message || 'Blocked unsafe webhook target URL',
          attempts: 1,
          status: 'FAILED',
          durationMs: Date.now() - startedAt,
        },
      });
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attempts = attempt;
      try {
        const res = await fetch(subscription.targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Midas-Webhook-Dispatcher/1.0',
            'X-Midas-Event': event,
            'X-Midas-Attempt': String(attempt),
            'X-Midas-Signature': signatureHeader,
          },
          body: rawBody,
          signal: AbortSignal.timeout(8_000),
        });

        statusCode = res.status;
        responseBody = (await res.text()).slice(0, 1000);

        if (res.ok) {
          status = 'DELIVERED';
          error = null;
          break;
        }

        error = `Endpoint responded with HTTP ${res.status}`;
        // Do not retry deterministic 4xx client rejections (except 408 / 429)
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          break;
        }
      } catch (err: any) {
        error = err?.message || 'Webhook HTTP delivery failed';
      }

      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = attempt === 1 ? 500 : 1500;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
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
        attempts,
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