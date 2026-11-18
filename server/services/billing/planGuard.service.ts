import prisma from '../../lib/prisma';
import { getPlanConfig, PLAN_TIERS, PlanQuotaConfig, PlanTier } from './plans';

const ADMIN_UNLIMITED_CONFIG: PlanQuotaConfig = {
  ...PLAN_TIERS.SYNDICATE,
  displayName: 'Platform Superadmin (Unlimited)',
  monthlyEmails: 9_999_999,
  maxLeads: 9_999_999,
  maxSubscribers: 9_999_999,
  maxDomains: 9_999,
  maxSenders: 9_999,
  maxGongs: 9_999,
  maxKnowledgeBases: 9_999,
  maxResourcesPerKnowledgeBase: 9_999,
  maxArtifactsPerEntity: 9_999,
  maxArtifactSizeMb: 50,
  monthlyAiCredits: 999_999,
  allowAutoReplyAgent: true,
  allowTeamInvites: true,
  allowCustomTrackingDomain: true,
};

export class PlanGuardService {
  private async isSuperAdmin(userId: string): Promise<boolean> {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    return Boolean(u?.isAdmin);
  }

  async getOrInitSubscription(userId: string) {
    const isAdmin = await this.isSuperAdmin(userId);
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

    if (isAdmin) {
      return { subscription: sub, config: ADMIN_UNLIMITED_CONFIG, isAdmin: true };
    }

    const effectivePlan: PlanTier = sub.status === 'ACTIVE' ? (sub.plan as PlanTier) : 'SCOUT';
    const config = getPlanConfig(effectivePlan);

    return { subscription: sub, config, isAdmin: false };
  }

  async getQuotaSummary(userId: string) {
    const { subscription, config, isAdmin } = await this.getOrInitSubscription(userId);
    const [leadCount, subscriberCount, domainCount, senderCount, gongCount, kbCount] = await Promise.all([
      prisma.lead.count({ where: { userId } }),
      prisma.newsletterRecipient.count({ where: { userId } }),
      prisma.domain.count({ where: { userId } }),
      prisma.sender.count({ where: { userId } }),
      prisma.gong.count({ where: { userId } }),
      prisma.knowledgeBase.count({ where: { userId } }),
    ]);

    return {
      isAdmin,
      plan: isAdmin ? 'ADMIN' : config.tier,
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

  async assertDomainCapacity(userId: string): Promise<PlanQuotaConfig> {
    const { config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return config;

    const count = await prisma.domain.count({ where: { userId } });
    if (count >= config.maxDomains) {
      throw new Error(
        `Your ${config.displayName} plan allows up to ${config.maxDomains} sending domain(s). Upgrade to Chief ($35/mo) to connect up to 10 domains.`
      );
    }
    return config;
  }

  async assertSenderCapacity(userId: string): Promise<PlanQuotaConfig> {
    const { config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return config;

    const count = await prisma.sender.count({ where: { userId } });
    if (count >= config.maxSenders) {
      throw new Error(
        `Your ${config.displayName} plan allows up to ${config.maxSenders} sending mailbox(es). Upgrade to Chief ($35/mo) to create up to 25 senders.`
      );
    }
    return config;
  }

  async assertGongCapacity(userId: string): Promise<PlanQuotaConfig> {
    const { config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return config;

    const count = await prisma.gong.count({ where: { userId } });
    if (count >= config.maxGongs) {
      throw new Error(
        `Your ${config.displayName} plan allows up to ${config.maxGongs} Gong newsletter channel(s). Upgrade to Chief ($35/mo) for up to 25 Gongs.`
      );
    }
    return config;
  }

  async assertLeadCapacity(userId: string, incomingNewCount: number = 1): Promise<PlanQuotaConfig> {
    const { config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return config;

    const count = await prisma.lead.count({ where: { userId } });
    if (count + incomingNewCount > config.maxLeads) {
      throw new Error(
        `Lead limit exceeded: your ${config.displayName} plan supports up to ${config.maxLeads.toLocaleString()} leads (currently ${count.toLocaleString()}). Upgrade to Chief ($35/mo) for 10,000 leads.`
      );
    }
    return config;
  }

  async assertSubscriberCapacity(userId: string, incomingNewCount: number = 1): Promise<PlanQuotaConfig> {
    const { config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return config;

    const count = await prisma.newsletterRecipient.count({ where: { userId } });
    if (count + incomingNewCount > config.maxSubscribers) {
      throw new Error(
        `Subscriber limit exceeded: your ${config.displayName} plan supports up to ${config.maxSubscribers.toLocaleString()} subscribers (currently ${count.toLocaleString()}). Upgrade to Chief ($35/mo) for 10,000 subscribers.`
      );
    }
    return config;
  }

  async assertFeatureAccess(
    userId: string,
    feature: 'allowAutoReplyAgent' | 'allowTeamInvites' | 'allowCustomTrackingDomain'
  ): Promise<PlanQuotaConfig> {
    const { config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return config;

    if (!config[feature]) {
      const labels: Record<typeof feature, string> = {
        allowAutoReplyAgent: 'Autonomous AI Auto-Reply Agent',
        allowTeamInvites: 'Team Collaboration Invites',
        allowCustomTrackingDomain: 'Custom Branded Tracking CNAMEs',
      };
      throw new Error(
        `${labels[feature]} requires the Chief ($35/mo) or Syndicate ($99/mo) plan. Upgrade in Plan Settings.`
      );
    }
    return config;
  }

  async assertKnowledgeBaseCapacity(userId: string): Promise<PlanQuotaConfig> {
    const { config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return config;

    const count = await prisma.knowledgeBase.count({ where: { userId } });
    if (count >= config.maxKnowledgeBases) {
      throw new Error(
        `Your ${config.displayName} plan allows up to ${config.maxKnowledgeBases} Knowledge Base(s). Upgrade to Chief ($35/mo) to create up to 5 Knowledge Bases.`
      );
    }
    return config;
  }

  async assertKnowledgeResourceCapacity(userId: string, knowledgeBaseId: string): Promise<PlanQuotaConfig> {
    const { config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return config;

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
    const { config, isAdmin } = await this.getOrInitSubscription(userId);

    if (fileSizeBytes && fileSizeBytes > config.maxArtifactSizeMb * 1024 * 1024) {
      throw new Error(
        `Artifact file exceeds your ${config.displayName} maximum size of ${config.maxArtifactSizeMb}MB.`
      );
    }

    if (isAdmin) return config;

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

    const { subscription, config, isAdmin } = await this.getOrInitSubscription(userId);
    if (!isAdmin && subscription.aiCreditsUsed + cost > config.monthlyAiCredits) {
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
    const { subscription, config, isAdmin } = await this.getOrInitSubscription(userId);
    if (isAdmin) return false;
    return subscription.emailsSentThisMonth >= config.monthlyEmails;
  }
}

export const planGuardService = new PlanGuardService();