import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export interface DispatchWebhookOptions {
  userId: string;
  event: 'lead.replied' | 'gong.subscribed' | 'deliverability.circuit_tripped' | 'deal.booked' | string;
  payload: Record<string, any>;
}

export class WebhookDispatchService {
  /**
   * Generates a secure HMAC-SHA256 signature matching standard webhook provider protocols (Stripe / Svix / Resend).
   * Format: t=<timestamp>,v1=<signature>
   */
  private generateSignature(secret: string, timestamp: number, payloadString: string): string {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payloadString}`)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Dispatches events asynchronously across all active subscriptions for a tenant.
   * Completely decoupled from the primary HTTP transaction to preserve sub-second response times.
   */
  async dispatch(options: DispatchWebhookOptions): Promise<void> {
    const { userId, event, payload } = options;

    try {
      const subscriptions = await prisma.webhookSubscription.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      if (subscriptions.length === 0) return;

      const matched = subscriptions.filter((sub) => {
        const evs = sub.events || [];
        return evs.includes('*') || evs.includes(event) || evs.includes(`${event.split('.')[0]}.*`);
      });

      if (matched.length === 0) return;

      const timestamp = Math.floor(Date.now() / 1000);
      const envelope = {
        id: `evt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
        event,
        timestamp,
        data: payload,
      };
      const serializedPayload = JSON.stringify(envelope);

      for (const sub of matched) {
        this.sendToEndpoint(sub, event, envelope, serializedPayload, timestamp).catch((err) => {
          logger.warn({ err: err?.message, subscriptionId: sub.id, event }, 'Webhook dispatch delivery error');
        });
      }
    } catch (err: any) {
      logger.error({ err: err?.message, userId, event }, 'Failed to process webhook event dispatch');
    }
  }

  private async sendToEndpoint(
    subscription: any,
    event: string,
    envelope: any,
    serializedPayload: string,
    timestamp: number
  ) {
    const signatureHeader = this.generateSignature(subscription.secret, timestamp, serializedPayload);
    const start = Date.now();
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let status = 'DELIVERED';
    let errorMessage: string | null = null;

    try {
      const res = await fetch(subscription.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Midas-Webhook-Engine/2.2',
          'X-Midas-Signature': signatureHeader,
          'X-Midas-Event': event,
          'X-Midas-Delivery': envelope.id,
        },
        body: serializedPayload,
        signal: AbortSignal.timeout(5000), // Strict 5-second timeout constraint
      });

      statusCode = res.status;
      const text = await res.text();
      responseBody = text.slice(0, 1000); // Bounded snippet

      if (!res.ok) {
        status = 'FAILED';
        errorMessage = `Endpoint returned HTTP ${res.status}`;
      }
    } catch (fetchErr: any) {
      status = 'FAILED';
      errorMessage = fetchErr.message || 'Connection timed out or network error';
    }

    const durationMs = Date.now() - start;

    await prisma.webhookDelivery.create({
      data: {
        subscriptionId: subscription.id,
        event,
        payload: envelope as any,
        statusCode,
        responseBody,
        error: errorMessage,
        status,
        durationMs,
      },
    });

    logger.info(
      { subscriptionId: subscription.id, event, statusCode, durationMs, status },
      '[WEBHOOK] Outbound event delivered'
    );
  }

  /**
   * Fires an immediate test ping payload to verify downstream receiver connectivity.
   */
  async testPing(subscriptionId: string, userId: string) {
    const sub = await prisma.webhookSubscription.findFirst({
      where: { id: subscriptionId, userId },
    });
    if (!sub) throw new Error('Webhook subscription not found');

    const testPayload = {
      test: true,
      message: 'Midas Webhook Delivery Engine live test ping.',
      pingedAt: new Date().toISOString(),
    };

    const timestamp = Math.floor(Date.now() / 1000);
    const envelope = {
      id: `evt_test_${Date.now()}`,
      event: 'ping',
      timestamp,
      data: testPayload,
    };
    const serialized = JSON.stringify(envelope);

    await this.sendToEndpoint(sub, 'ping', envelope, serialized, timestamp);

    return prisma.webhookDelivery.findFirst({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const webhookDispatchService = new WebhookDispatchService();