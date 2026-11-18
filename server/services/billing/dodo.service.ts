import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { PlanTier } from './plans';

export class DodoService {
  private baseUrl(): string {
    return env.DODO_PAYMENTS_MODE === 'live_mode'
      ? 'https://live.dodopayments.com'
      : 'https://test.dodopayments.com';
  }

  public isConfigured(): boolean {
    return Boolean(env.DODO_PAYMENTS_API_KEY);
  }

  public isMonthlyConfigured(): boolean {
    return Boolean(env.DODO_PRODUCT_CHIEF_MONTHLY && env.DODO_PRODUCT_SYNDICATE_MONTHLY);
  }

  public isAnnualConfigured(): boolean {
    return Boolean(env.DODO_PRODUCT_CHIEF_ANNUAL && env.DODO_PRODUCT_SYNDICATE_ANNUAL);
  }

  private resolveProductId(plan: 'CHIEF' | 'SYNDICATE', cycle: 'monthly' | 'annual'): string {
    if (plan === 'CHIEF') {
      const id = cycle === 'annual' ? env.DODO_PRODUCT_CHIEF_ANNUAL : env.DODO_PRODUCT_CHIEF_MONTHLY;
      if (!id) throw new Error(`Dodo product ID not configured for CHIEF (${cycle})`);
      return id.trim();
    }
    const id = cycle === 'annual' ? env.DODO_PRODUCT_SYNDICATE_ANNUAL : env.DODO_PRODUCT_SYNDICATE_MONTHLY;
    if (!id) throw new Error(`Dodo product ID not configured for SYNDICATE (${cycle})`);
    return id.trim();
  }

  private inferPlanFromProduct(productId?: string | null): PlanTier | null {
    if (!productId) return null;
    const clean = productId.trim();
    if (clean === env.DODO_PRODUCT_CHIEF_MONTHLY || clean === env.DODO_PRODUCT_CHIEF_ANNUAL) return 'CHIEF';
    if (clean === env.DODO_PRODUCT_SYNDICATE_MONTHLY || clean === env.DODO_PRODUCT_SYNDICATE_ANNUAL) return 'SYNDICATE';
    return null;
  }

  async createCheckoutSession(options: {
    userId: string;
    email: string;
    name?: string | null;
    plan: 'CHIEF' | 'SYNDICATE';
    billingCycle: 'monthly' | 'annual';
  }): Promise<{ checkoutUrl: string; sessionId: string }> {
    if (!env.DODO_PAYMENTS_API_KEY) {
      throw new Error('DODO_PAYMENTS_API_KEY is not configured on this server');
    }

    const productId = this.resolveProductId(options.plan, options.billingCycle);
    const appUrl = (env.APP_URL || 'https://midas-aem.vercel.app').replace(/\/$/, '');

    const res = await fetch(`${this.baseUrl()}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          email: options.email,
          name: options.name || options.email.split('@')[0],
        },
        metadata: {
          userId: options.userId,
          plan: options.plan,
          billingCycle: options.billingCycle,
        },
        return_url: `${appUrl}/profile?tab=billing&checkout=success`,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const rawText = await res.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = { message: rawText }; }

    if (!res.ok || !data.checkout_url) {
      throw new Error(data.message || `Dodo checkout session failed (HTTP ${res.status})`);
    }

    return {
      checkoutUrl: data.checkout_url,
      sessionId: data.session_id,
    };
  }

  async cancelSubscription(userId: string) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub || sub.plan === 'SCOUT') {
      throw new Error('No active paid subscription to cancel');
    }

    if (sub.dodoSubscriptionId && env.DODO_PAYMENTS_API_KEY) {
      const res = await fetch(`${this.baseUrl()}/subscriptions/${sub.dodoSubscriptionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancel_at_next_billing_date: true }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to schedule cancellation in Dodo Payments: ${text}`);
      }
    }

    return prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  verifyWebhookSignature(
    rawBody: Buffer | string,
    headers: { webhookId?: string; webhookTimestamp?: string; webhookSignature?: string }
  ): boolean {
    const secret = env.DODO_PAYMENTS_WEBHOOK_SECRET;
    if (!secret) return false;

    const { webhookId, webhookTimestamp, webhookSignature } = headers;
    if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

    const tsNum = Number(webhookTimestamp);
    if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) {
      return false;
    }

    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const keyBytes = Buffer.from(cleanSecret, 'base64');
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const signedPayload = `${webhookId}.${webhookTimestamp}.${bodyStr}`;

    const expectedB64 = crypto
      .createHmac('sha256', keyBytes)
      .update(signedPayload)
      .digest('base64');

    const signatures = webhookSignature.split(' ');
    for (const entry of signatures) {
      const [version, sigB64] = entry.split(',');
      if (version !== 'v1' || !sigB64) continue;
      const a = Buffer.from(sigB64, 'utf8');
      const b = Buffer.from(expectedB64, 'utf8');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true;
      }
    }

    return false;
  }

  async processWebhook(payload: any) {
    const eventType: string = payload?.type || '';
    const data = payload?.data || {};
    const metadata = data?.metadata || {};

    let userId: string | null = metadata.userId || null;

    if (!userId && data.customer?.email) {
      const user = await prisma.user.findUnique({
        where: { email: String(data.customer.email).toLowerCase().trim() },
        select: { id: true },
      });
      userId = user?.id || null;
    }

    if (!userId && data.subscription_id) {
      const existingSub = await prisma.subscription.findUnique({
        where: { dodoSubscriptionId: data.subscription_id },
        select: { userId: true },
      });
      userId = existingSub?.userId || null;
    }

    if (!userId) {
      logger.warn({ eventType, subId: data.subscription_id }, '[DODO] Webhook received without resolvable userId');
      return;
    }

    const resolvedPlan: PlanTier =
      (metadata.plan as PlanTier) ||
      this.inferPlanFromProduct(data.product_id) ||
      'CHIEF';

    const billingCycle = metadata.billingCycle === 'annual' ? 'annual' : 'monthly';
    const dodoCustomerId = data.customer?.customer_id || data.customer_id || undefined;
    const dodoSubscriptionId = data.subscription_id || undefined;
    const nextBillingDate = data.next_billing_date ? new Date(data.next_billing_date) : undefined;

    if (
      eventType === 'subscription.active' ||
      eventType === 'subscription.renewed' ||
      eventType === 'payment.succeeded'
    ) {
      await prisma.subscription.upsert({
        where: { userId },
        update: {
          plan: resolvedPlan,
          status: 'ACTIVE',
          billingCycle,
          cancelAtPeriodEnd: Boolean(data.cancel_at_next_billing_date),
          ...(dodoCustomerId ? { dodoCustomerId } : {}),
          ...(dodoSubscriptionId ? { dodoSubscriptionId } : {}),
          ...(nextBillingDate ? { currentPeriodEnd: nextBillingDate } : {}),
          ...(eventType === 'subscription.renewed' ? { aiCreditsUsed: 0, emailsSentThisMonth: 0, periodResetAt: new Date() } : {}),
        },
        create: {
          userId,
          plan: resolvedPlan,
          status: 'ACTIVE',
          billingCycle,
          dodoCustomerId,
          dodoSubscriptionId,
          currentPeriodEnd: nextBillingDate,
        },
      });
      logger.info({ userId, plan: resolvedPlan, eventType }, '[DODO] Subscription activated/renewed');
    } else if (eventType === 'subscription.on_hold' || eventType === 'payment.failed') {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { status: 'PAST_DUE' },
      });
    } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.expired') {
      await prisma.subscription.updateMany({
        where: { userId },
        data: {
          plan: 'SCOUT',
          status: 'CANCELLED',
          cancelAtPeriodEnd: false,
        },
      });
    }
  }
}

export const dodoService = new DodoService();