import prisma from '../../lib/prisma';
import { getPlanConfig, PlanQuotaConfig, PlanTier } from './plans';

export class PlanGuardService {
  /**
   * Resolves the user's subscription row, lazily provisioning SCOUT (Free)
   * if none exists and automatically rolling over monthly usage counters
   * when crossing into a new calendar month.
   */
  async getOrInitSubscription(userId: string) {
    let sub = await prisma.subscription.findUnique({ where: { userId } });

    if (!sub) {
      sub = await prisma.subscription.create({
        data: {
          userId,
          plan: 'SCOUT',
          status: 'ACTIVE',
          periodResetAt: new Date(),
        },
      });
    }

    const now = new Date();
    const lastReset = new Date(sub.periodResetAt);
    const sameMonth =
      now.getUTCFullYear() === lastReset.getUTCFullYear() &&
      now.getUTCMonth() === lastReset.getUTCMonth();

    if (!sameMonth) {
      sub = await prisma.subscription.update({
        where: { userId },
        data: {
          aiCreditsUsed: 0,
          emailsSentThisMonth: 0,
          periodResetAt: now,
        },
      });
    }

    const effectivePlan: PlanTier = sub.status === 'ACTIVE' ? (sub.plan as PlanTier) : 'SCOUT';
    const config = getPlanConfig(effectivePlan);

    return { subscription: sub, config };
  }

  async getQuotaSummary(userId: string) {
    const { subscription, config } = await this.getOrInitSubscription(userId);
    const [leadCount, subscriberCount, domainCount, senderCount, gongCount, kbCount] = await Promise.all([
      prisma.lead.count({ where: { userId } }),
      prisma.newsletterRecipient.count({ where: { userId } }),
      prisma.domain.count({ where: { userId } }),
      prisma.sender.count({ where: { userId } }),
      prisma.gong.count({ where: { userId } }),
      prisma.knowledgeBase.count({ where: { userId } }),
    ]);

    return {
      plan: config.tier,
      displayName: config.displayName,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      limits: config,
      usage: {
        emailsSentThisMonth: subscription.emailsSentThisMonth,
        aiCreditsUsed: subscription.aiCreditsUsed,
        leads: leadCount,
        subscribers: subscriberCount,
        domains: domainCount,
        senders: senderCount,
        gongs: gongCount,
        knowledgeBases: kbCount,
      },
    };
  }

  async assertKnowledgeBaseCapacity(userId: string): Promise<PlanQuotaConfig> {
    const { config } = await this.getOrInitSubscription(userId);
    const count = await prisma.knowledgeBase.count({ where: { userId } });
    if (count >= config.maxKnowledgeBases) {
      throw new Error(
        `Your ${config.displayName} plan allows up to ${config.maxKnowledgeBases} Knowledge Base(s). Upgrade to Chief ($35/mo) to create up to 5 Knowledge Bases.`
      );
    }
    return config;
  }

  async assertKnowledgeResourceCapacity(userId: string, knowledgeBaseId: string): Promise<PlanQuotaConfig> {
    const { config } = await this.getOrInitSubscription(userId);
    const count = await prisma.knowledgeResource.count({ where: { knowledgeBaseId, userId } });
    if (count >= config.maxResourcesPerKnowledgeBase) {
      throw new Error(
        `Your ${config.displayName} plan allows up to ${config.maxResourcesPerKnowledgeBase} resources per Knowledge Base. Upgrade to add more files and URLs.`
      );
    }
    return config;
  }

  async assertArtifactCapacity(
    userId: string,
    scope: { campaignId?: string | null; gongId?: string | null; broadcastId?: string | null },
    fileSizeBytes?: number
  ): Promise<PlanQuotaConfig> {
    const { config } = await this.getOrInitSubscription(userId);

    if (fileSizeBytes && fileSizeBytes > config.maxArtifactSizeMb * 1024 * 1024) {
      throw new Error(
        `Artifact file exceeds your ${config.displayName} maximum size of ${config.maxArtifactSizeMb}MB.`
      );
    }

    const where: any = { userId };
    if (scope.campaignId) where.campaignId = scope.campaignId;
    else if (scope.gongId) where.gongId = scope.gongId;
    else if (scope.broadcastId) where.broadcastId = scope.broadcastId;

    const count = await prisma.artifact.count({ where });
    if (count >= config.maxArtifactsPerEntity) {
      throw new Error(
        `Your ${config.displayName} plan allows ${config.maxArtifactsPerEntity} artifact(s) per Campaign/Gong/Broadcast. Upgrade to Chief ($35/mo) for 5 per entity.`
      );
    }

    return config;
  }

  async consumeAiCredits(userId: string, cost: number = 1, bypassWithByoKey: boolean = false): Promise<void> {
    if (bypassWithByoKey) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { aiApiKeyEncrypted: true },
      });
      if (settings?.aiApiKeyEncrypted) return;
    }

    const { subscription, config } = await this.getOrInitSubscription(userId);
    if (subscription.aiCreditsUsed + cost > config.monthlyAiCredits) {
      throw new Error(
        `Monthly AI credit allowance (${config.monthlyAiCredits}) reached on ${config.displayName}. Upgrade to Chief ($35/mo) for 500 credits/mo or attach your own AI key in Settings.`
      );
    }

    await prisma.subscription.update({
      where: { userId },
      data: { aiCreditsUsed: { increment: cost } },
    });
  }

  async recordEmailSent(userId: string, count: number = 1): Promise<void> {
    await this.getOrInitSubscription(userId);
    await prisma.subscription.update({
      where: { userId },
      data: { emailsSentThisMonth: { increment: count } },
    }).catch(() => {});
  }

  async isOverMonthlyEmailLimit(userId: string): Promise<boolean> {
    const { subscription, config } = await this.getOrInitSubscription(userId);
    return subscription.emailsSentThisMonth >= config.monthlyEmails;
  }
}

export const planGuardService = new PlanGuardService();