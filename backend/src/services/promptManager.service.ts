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

    let prompt = `ROLE: Elite B2B SDR. 
STYLE: Concise, human-centric. No corporate fluff.
CAMPAIGN CONTEXT: "${campaignContext}"
GOAL: "${objective}"\n\n`;

    prompt += `## PLACEHOLDER RESTRICTIONS (CRITICAL)
You are ONLY allowed to use these exact placeholders. Do NOT invent your own:
1. {{firstName}} - The prospect's first name.
2. {{company}} - The prospect's company name.
3. {{senderName}} - Your name.
4. {{targetTool}} - The phone number or link provided for the close.
5. {{reference_company}} - ONLY if a reference story is provided.

## LOGICAL INFERENCE RULE
If you want to mention a specific department, pain point, or area of the business (e.g., "front desk", "missed calls", "intake process"), do NOT use a placeholder. Instead, look at the CAMPAIGN CONTEXT and hardcode the most logical term into the sentence. \n\n`;

    if (useCase === 'followup') {
      prompt += `\n## FOLLOW-UP STRATEGY (STEP ${stepNumber})
OBJ: ${microObjective}
- Logic: Do not repeat previous points. 
- The Stitch: Subtly reference the previous thread context: "${params.lastEmailContent?.substring(0, 100)}..."\n`;
    }

    // Task Logic
    if (useCase === 'initial') {
        prompt += `\n### TASK: INITIAL REACH
Write a pattern-interrupt email. Use a hook related to {{company}} and the problem defined in the context.`;
    } else if (useCase === 'followup') {
        prompt += `\n### TASK: FOLLOW-UP ${stepNumber}
Acknowledge they are busy. Pivot to the specific goal of this step.`;
    } else {
        prompt += `\n### TASK: ADAPTIVE REPLY
Sentiment: ${params.sentiment}. Lead said: "${params.originalEmail}". Pivot to the goal using {{targetTool}}.`;
    }

    prompt += `\n\n## OUTPUT: Valid JSON {"subject": "...", "body": "..."} | Seed: ${variationSeed}`;

    return prompt;
  }
}

export const promptManager = new PromptManager();