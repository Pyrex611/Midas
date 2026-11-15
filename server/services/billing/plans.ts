export type PlanTier = 'SCOUT' | 'CHIEF' | 'SYNDICATE';

export interface PlanQuotaConfig {
  tier: PlanTier;
  displayName: string;
  priceUsdMonthly: number;
  priceUsdAnnual: number;
  monthlyEmails: number;
  maxLeads: number;
  maxSubscribers: number;
  maxDomains: number;
  maxSenders: number;
  maxGongs: number;
  maxKnowledgeBases: number;
  maxResourcesPerKnowledgeBase: number;
  maxArtifactsPerEntity: number;
  maxArtifactSizeMb: number;
  monthlyAiCredits: number;
  allowAutoReplyAgent: boolean;
  allowTeamInvites: boolean;
  allowCustomTrackingDomain: boolean;
}

export const PLAN_TIERS: Record<PlanTier, PlanQuotaConfig> = {
  SCOUT: {
    tier: 'SCOUT',
    displayName: 'Scout (Free Forever)',
    priceUsdMonthly: 0,
    priceUsdAnnual: 0,
    monthlyEmails: 2_000,
    maxLeads: 500,
    maxSubscribers: 1_000,
    maxDomains: 1,
    maxSenders: 2,
    maxGongs: 2,
    maxKnowledgeBases: 1,
    maxResourcesPerKnowledgeBase: 3,
    maxArtifactsPerEntity: 1,
    maxArtifactSizeMb: 5,
    monthlyAiCredits: 25,
    allowAutoReplyAgent: false,
    allowTeamInvites: false,
    allowCustomTrackingDomain: false,
  },
  CHIEF: {
    tier: 'CHIEF',
    displayName: 'Chief (Pro)',
    priceUsdMonthly: 35,
    priceUsdAnnual: 348,
    monthlyEmails: 15_000,
    maxLeads: 10_000,
    maxSubscribers: 10_000,
    maxDomains: 10,
    maxSenders: 25,
    maxGongs: 25,
    maxKnowledgeBases: 5,
    maxResourcesPerKnowledgeBase: 15,
    maxArtifactsPerEntity: 5,
    maxArtifactSizeMb: 15,
    monthlyAiCredits: 500,
    allowAutoReplyAgent: true,
    allowTeamInvites: true,
    allowCustomTrackingDomain: true,
  },
  SYNDICATE: {
    tier: 'SYNDICATE',
    displayName: 'Syndicate (Agency)',
    priceUsdMonthly: 99,
    priceUsdAnnual: 948,
    monthlyEmails: 100_000,
    maxLeads: 50_000,
    maxSubscribers: 50_000,
    maxDomains: 100,
    maxSenders: 250,
    maxGongs: 100,
    maxKnowledgeBases: 50,
    maxResourcesPerKnowledgeBase: 50,
    maxArtifactsPerEntity: 25,
    maxArtifactSizeMb: 50,
    monthlyAiCredits: 2_500,
    allowAutoReplyAgent: true,
    allowTeamInvites: true,
    allowCustomTrackingDomain: true,
  },
};

export function getPlanConfig(plan?: string | null): PlanQuotaConfig {
  const key = (plan || 'SCOUT').toUpperCase() as PlanTier;
  return PLAN_TIERS[key] || PLAN_TIERS.SCOUT;
}