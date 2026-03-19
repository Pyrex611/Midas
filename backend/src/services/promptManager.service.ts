import { logger } from '../config/logger';

export type UseCase = 'initial' | 'followup' | 'reply';

export interface PromptParams {
  useCase: UseCase;
  tone: string;
  campaignContext?: string | null;
  objective?: string | null;      
  microObjective?: string | null; 
  targetTool?: string | null;      
  reference?: string | null;
  variationSeed?: string | number;
  originalEmail?: string;         
  lastEmailContent?: string;      
  sentiment?: string;
  conversationHistory?: string;
  stepNumber?: number;
}

export class PromptManager {
  buildPrompt(params: PromptParams): string {
    const { useCase, tone, objective, microObjective, targetTool, reference, variationSeed, stepNumber, campaignContext } = params;

    let prompt = `ROLE: You are an Elite B2B Sales Strategist and Copywriter. 
EXPERTISE: High-ticket outreach, psychological pattern interrupts, and conversion optimization.
MISSION: Convert a cold lead into a "${objective}" using a multi-step sequence.

## THE CAMPAIGN CONTEXT (FOR INFORMATION ONLY)
"${campaignContext}"

## ⛔ STRICT NEGATIVE CONSTRAINTS (DO NOT VIOLATE)
1. DO NOT copy any examples provided in the context verbatim. If an example is present, use it only to understand the product; write your own original copy.
2. DO NOT use corporate clichés: "I hope this finds you well", "Just checking in", "Touching base", "Revolutionary", "Game-changer".
3. DO NOT invent placeholders. You are strictly limited to: {{firstName}}, {{company}}, {{senderName}}, {{targetTool}}, and {{reference_company}}.
4. NO "Running Blind" or generic analogies unless they are logically specific to the niche.\n\n`;

    prompt += `## LOGICAL INFERENCE ENGINE
You must analyze the CAMPAIGN CONTEXT. If you need to mention a business area (e.g., 'front desk', 'intake', 'missed calls'), do NOT use a placeholder like {{area}}. You must hardcode the correct terminology based on the context provided.\n\n`;

    prompt += `## STRATEGIC ALIGNMENT
- Global Goal: ${objective}
- Tool Available: ${targetTool || 'None'}
- Variation Seed: ${variationSeed}\n\n`;

    // Task Selection
    if (useCase === 'initial') {
        prompt += this.buildInitialReachLogic();
    } else if (useCase === 'followup') {
        prompt += this.buildFollowupLogic(params);
    } else {
        prompt += this.buildReplyLogic(params);
    }

    prompt += `\n\n## FINAL FORMATTING
- Output strictly raw JSON: {"subject": "...", "body": "..."}
- Subject: Maximum 5 words. Curiosity-driven.
- Body: Mobile-optimized. Max 3 paragraphs. Short, punchy sentences.`;

    return prompt;
  }

  private buildInitialReachLogic(): string {
    return `### TASK: INITIAL OUTREACH (Pattern Interrupt)
1. The Hook: A specific, slightly provocative observation about {{company}}'s industry.
2. The Pivot: Connect the observation to the GLOBAL GOAL.
3. The Soft Ask: A low-friction question that is easy to answer with a 'Yes' or 'No'.`;
  }

  private buildFollowupLogic(p: PromptParams): string {
    const vossLogic = p.stepNumber && p.stepNumber >= 3 
      ? `Use Chris Voss 'No-Oriented' logic. Example: "Would it be a bad idea to...?" or "Have you given up on...?"` 
      : `Provide a fresh insight not mentioned in the previous email.`;

    return `### TASK: FOLLOW-UP STEP ${p.stepNumber}
Objective: ${p.microObjective}
Stitch: Refer to the previous context ("${p.lastEmailContent?.substring(0, 60)}...") without saying "I'm following up."
Psychology: ${vossLogic}`;
  }

  private buildReplyLogic(p: PromptParams): string {
    return `### TASK: ADAPTIVE REPLY
Lead Status: ${p.sentiment}. 
Content: Answer their question briefly, then pivot to the conversion tool: {{targetTool}}.
Thread History: ${p.conversationHistory}`;
  }
}

export const promptManager = new PromptManager();