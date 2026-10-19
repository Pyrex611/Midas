import { logger } from '../config/logger';

export type UseCase = 'initial' | 'followup' | 'reply';

export interface PromptParams {
  useCase: UseCase;
  tone: string;
  campaignContext?: string | null;
  reference?: string | null;
  companyContext?: string | null;
  variationSeed?: string | number;
  originalEmail?: string;
  originalSubject?: string;
  recipientName?: string;
  recipientCompany?: string;
  sentiment?: string;
  conversationHistory?: string;
  stepNumber?: number;
}

export class PromptManager {
  buildPrompt(params: PromptParams): string {
    const { useCase, campaignContext, reference, stepNumber } = params;
    const hasReference = !!reference;

    let prompt = `You are an elite, top-tier B2B SDR with a 45%+ reply rate. Your objective is to write hyper-concise, industrial-grade cold emails. \n\n`;

    prompt += `## ABSOLUTE B2B MANDATES (DO NOT VIOLATE)\n`;
    prompt += `1. NO FLUFF. Never use phrases like "I hope this finds you well", "Game-changer", "Revolutionary", or "Synergy".\n`;
    prompt += `2. EXTREMELY SHORT. Keep the total body under 80 words. Time is money. \n`;
    prompt += `3. DIRECT VALUE. Get straight to the pain point and the mechanism to solve it.\n`;
    prompt += `4. SOFT CTA. End with a low-friction question based on interest, not time (e.g., "Open to seeing how?", "Worth exploring?"). Do NOT ask for "15 minutes on Tuesday".\n`;
    
    prompt += `\n## SPINTAX FORMATTING REQUIRED\n`;
    prompt += `To prevent spam fingerprinting, you MUST use Spintax formatting for greetings, transitions, and closings.\n`;
    prompt += `Format: {Option A|Option B|Option C}. \n`;
    prompt += `Example: {Hi|Hey|Hello} {{name}}, {I noticed|Looks like} you handle operations at {{company}}.\n\n`;

    prompt += `## PLACEHOLDERS\n`;
    prompt += `- {{name}} → Prospect's name.\n`;
    prompt += `- {{company}} → Prospect's company.\n`;
    prompt += `- {{senderName}} → Your name.\n`;
    if (hasReference) prompt += `- {{reference_company}} → MUST use this to refer to the past client story provided below.\n`;

    switch (useCase) {
      case 'initial':
        prompt += this.buildInitialPrompt(campaignContext, hasReference, reference);
        break;
      case 'followup':
        prompt += this.buildFollowupPrompt(params.originalEmail, stepNumber);
        break;
      case 'reply':
        prompt += this.buildReplyPrompt(params);
        break;
    }

    prompt += `\n## OUTPUT FORMAT\n`;
    prompt += `Return ONLY a valid JSON object: {"subject": "...", "body": "..."}\n`;

    return prompt;
  }

  private buildInitialPrompt(campaignContext?: string | null, hasReference?: boolean, reference?: string | null): string {
    let section = `\n## INITIAL OUTREACH TASK\n`;
    if (campaignContext) section += `Campaign Goal: ${campaignContext}\n`;
    if (hasReference && reference) section += `Reference Story: ${reference}\n`;

    section += `Structure:\n`;
    section += `1. Observation/Pain Point (Spintaxed).\n`;
    section += `2. The Mechanism (How we solve it concisely).\n`;
    section += `3. ${hasReference ? 'Name drop {{reference_company}} and their result.' : 'Brief credibility statement.'}\n`;
    section += `4. Soft CTA.\n`;
    return section;
  }

  private buildFollowupPrompt(originalEmail?: string, stepNumber?: number): string {
    let section = `\n## FOLLOW-UP TASK (Step ${stepNumber || 1})\n`;
    section += `The prospect did not reply. Provide a fresh angle, ONE sentence of value, and a new soft CTA. Maximum 3 sentences total.\n`;
    if (originalEmail) section += `Original Email sent to them:\n${originalEmail}\n`;
    return section;
  }

  private buildReplyPrompt(params: PromptParams): string {
    let section = `\n## REPLY TASK\n`;
    section += `Prospect replied with sentiment: ${params.sentiment}. \n`;
    section += `Their Message: ${params.originalEmail}\n`;
    section += `Address their specific question or objection. If positive, offer a specific next step or resource. Match their tone.\n`;
    return section;
  }
}

export const promptManager = new PromptManager();