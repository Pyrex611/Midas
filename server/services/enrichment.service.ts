import prisma from '../lib/prisma';
import { aiService } from './ai.service';
import { planGuardService } from './billing/planGuard.service';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com',
]);

export class EnrichmentService {
  private async fetchDomainSnippet(email: string): Promise<string | null> {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return null;

    try {
      const res = await fetch(`https://${domain}`, {
        headers: { 'User-Agent': 'MidasEnrichBot/1.0 (+https://midas-aem.vercel.app)' },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;
      const html = await res.text();
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);
    } catch {
      return null;
    }
  }

  /**
   * Consumes 2 AI Credits (unless user attached their own BYO AI Key)
   * and enriches a Lead with grounded corporate context + outreach hooks.
   */
  async enrichLead(userId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, userId } });
    if (!lead) throw new Error('Lead not found');

    // Tier gate: deduct 2 AI credits (bypassed if BYO AI Key is saved)
    await planGuardService.consumeAiCredits(userId, 2, true);

    const siteSnippet = await this.fetchDomainSnippet(lead.email);

    const prompt = `Synthesize B2B sales enrichment intelligence for this prospect in strict JSON:
Lead Name: ${lead.name}
Email: ${lead.email}
Company: ${lead.company || 'Infer from email domain if corporate'}
Position: ${lead.position || 'Unknown'}
${siteSnippet ? `\nWebsite Snapshot:\n${siteSnippet}\n` : ''}

Return valid JSON only:
{
  "companySummary": "1-2 sentence summary of what their company does",
  "industry": "Primary industry category",
  "likelyPainPoints": ["pain point 1", "pain point 2"],
  "recentAchievementOrFocus": "Inferred focus area or positioning angle",
  "personalizationHook": "A natural 1-sentence opening observation for cold outreach",
	"Insights": "General Overview and understanding, and any relevant points or insights regarding the company"
}`;

    const raw = await aiService.complete(prompt, 'You are an expert B2B sales researcher. Return valid JSON only.', userId);
    const jsonMatch = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').match(/\{[\s\S]*\}/);
    const enrichedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { rawSummary: raw };

    return prisma.lead.update({
      where: { id: lead.id },
      data: {
        enrichedData,
        enrichedAt: new Date(),
      },
    });
  }
}

export const enrichmentService = new EnrichmentService();