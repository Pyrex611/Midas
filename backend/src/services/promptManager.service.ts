import { logger } from '../config/logger';

export type UseCase = 'initial' | 'followup' | 'reply';

export interface PromptParams {
  useCase: UseCase;
  tone: string;
  campaignContext?: string | null;
  reference?: string | null;
  companyContext?: string | null;
  variationSeed?: string | number;
  // For reply use case
  originalEmail?: string;
  originalSubject?: string;
  recipientName?: string;
  recipientCompany?: string;
  sentiment?: string;
  conversationHistory?: string;
  // For follow‑up use case
  stepNumber?: number; // 1,2,3...
}

export class PromptManager {
  /**
   * Build a state‑of‑the‑art prompt for the given use case.
   */
  buildPrompt(params: PromptParams): string {
    const { useCase, tone, campaignContext, reference, companyContext, variationSeed, stepNumber } = params;
    const hasReference = !!reference;

    let prompt = `You are an elite B2B sales development representative with a 40%+ reply rate. You write concise, human‑centric emails that spark curiosity and respect the prospect's time. Your copy is always personalised, avoids clichés, and follows proven persuasion frameworks. You never use spammy language, gimmicks, or hard sells.\n\n`;

    prompt += `## DIVERSITY REQUIREMENT\n`;
    prompt += `To ensure each email is unique, vary your subject line style and opening approach. Use seed: ${variationSeed || 'random'}. For example, alternate between curiosity, question, compliment, or insight‑driven subjects. Avoid repeating the same structure across multiple drafts.\n\n`;

    prompt += `## UNIVERSAL REQUIREMENTS\n`;
    prompt += `- **Subject line:** Under 60 characters, curiosity‑driven, and directly relevant to the prospect. Never use ALL CAPS or excessive punctuation.\n`;
    prompt += `- **Body:** 3–4 short paragraphs, under 150 words, formatted for mobile reading (short sentences, line breaks).\n`;
    prompt += `- **Tone:** Adapt to the requested tone (${tone}) – e.g., "professional" means concise and respectful; "friendly" means warm and conversational; "casual" means relaxed but still respectful.\n`;
    prompt += `- **Personalisation:** Always use the placeholders exactly as provided:\n`;
    prompt += `    - {{name}} → the prospect's name.\n`;
    prompt += `    - {{company}} → the prospect's company (never use this for any other company).\n`;
    prompt += `    - {{position}} → the prospect's job title.\n`;
    prompt += `    - {{senderName}} → the sender's name.\n`;
    prompt += `    - {{reference_company}} → **ONLY if a reference story is provided** – this represents a past client's company. Never use {{company}} for the reference client.\n`;
    prompt += `- **Reference Story Handling:**\n`;
    prompt += `    - ${hasReference ? 'A reference story is provided. You MUST use the placeholder {{reference_company}} when mentioning that client. Do NOT use {{company}} for the reference.' : 'No reference story is provided. You MUST NOT mention any client story at all – not even using {{company}} as a stand‑in. Absolutely avoid any reference to a past client.'}\n`;
    prompt += `- **Value Proposition:** The email should contain a compelling value proposition tailored to the prospect's context and the campaign objective. Do not use a placeholder for this; instead, craft a specific benefit that would appeal to the prospect.\n`;
    prompt += `- **Call‑to‑Action (CTA):** End with a single, low‑friction question that invites a reply (e.g., "Would you be open to a brief chat next week?"). Never use "click here" or links.\n`;
    prompt += `- **Persuasion Principles:** Where appropriate, subtly incorporate social proof (e.g., similar companies), reciprocity (e.g., an insight), or consistency (e.g., referencing a past action).\n`;
    prompt += `- **Avoid:** Overused phrases like "I hope this email finds you well", "game‑changer", "revolutionary". Be specific and concrete.\n\n`;

    switch (useCase) {
      case 'initial':
        prompt += this.buildInitialPrompt(tone, campaignContext, hasReference, reference);
        break;
      case 'followup':
        prompt += this.buildFollowupPrompt(tone, campaignContext, hasReference, params.originalEmail, stepNumber);
        break;
      case 'reply':
        prompt += this.buildReplyPrompt(params);
        break;
      default:
        prompt += this.buildInitialPrompt(tone, campaignContext, hasReference, reference);
    }

    prompt += this.getExampleForUseCase(useCase, tone, hasReference, stepNumber);

    prompt += `\n## OUTPUT FORMAT\n`;
    prompt += `Return ONLY a valid JSON object with two fields: "subject" and "body". Do not include any other text, markdown, or explanation.\n`;
    prompt += `Example: {"subject": "Quick question about {{company}}", "body": "Hi {{name}},\\n\\nI noticed..."}\n`;

    if (companyContext) {
      prompt += `\n## SENDER COMPANY CONTEXT\n${companyContext}\n`;
    }

    prompt += `\n## SELF‑CRITIQUE (CRITICAL – MUST FOLLOW)\n`;
    prompt += `Before finalizing, review your email against these checks:\n`;
    prompt += `1. If no reference story was provided (check above: reference story is ${hasReference ? 'PROVIDED' : 'NOT PROVIDED'}), ensure there is NO mention of any client story and that you NEVER used {{reference_company}} or implied a past client using {{company}}.\n`;
    prompt += `2. Verify all placeholders are exactly as required and that the email is personalised to the prospect.\n`;
    prompt += `3. Confirm the subject is under 60 characters and compelling.\n`;
    prompt += `4. Ensure the body is under 150 words and has a low‑friction CTA.\n`;
    prompt += `If any of these are not met, rewrite the email now – output only the final, corrected version.\n`;

    logger.debug({ prompt }, 'Built prompt');
    return prompt;
  }

  private buildInitialPrompt(
    tone: string,
    campaignContext?: string | null,
    hasReference?: boolean,
    reference?: string | null
  ): string {
    let section = `\n## INITIAL OUTREACH TASK\n`;
    section += `You are writing the very first email to a prospect. The goal is to spark curiosity and earn a reply, not to close a deal immediately. Focus on building rapport by asking a thoughtful, relevant question based on the campaign objective.\n\n`;

    if (campaignContext) {
      section += `### Campaign Objective\n${campaignContext}\n`;
      section += `- Identify a specific pain point or opportunity this campaign addresses.\n`;
      section += `- Frame your question or insight to align with that objective.\n`;
    }

    if (hasReference && reference) {
      section += `\n### Reference Story (use only if relevant)\n${reference}\n`;
      section += `- If you use this story, you MUST use {{reference_company}} to refer to that client. Do NOT use {{company}}.\n`;
      section += `- Keep it brief – one sentence woven naturally into the email.\n`;
    }

    section += `\n### Structure Guidelines for Initial Email\n`;
    section += `1. **Opening line:** Personalise by mentioning the prospect's pain point the campaign addresses (e.g., "Insurance companies like {{company}} all tell me they suffer low conversion rates and have tons of unconverted leads sitting in their CRMs...").\n`;
    section += `2. **Value hook / question:** Ask a question that highlights a common challenge or opportunity related to the campaign. For example: "How many cold leads do you have sitting in your CRM?" or "What's your biggest hurdle in achieving X?"\n`;
    section += `3. **Social proof / reference (optional):** ${hasReference ? 'If a reference story exists and fits, add one sentence about a similar client\'s success, using {{reference_company}}.' : 'Do not mention any client stories.'}\n`;
    section += `4. **Low‑friction CTA:** End with a simple, open‑ended question that invites a reply (e.g., "Would you be open to a 10‑minute chat to explore if this could be relevant?").\n`;

    return section;
  }

  private buildFollowupPrompt(
    tone: string,
    campaignContext?: string | null,
    hasReference?: boolean,
    originalEmail?: string,
    stepNumber?: number
  ): string {
    let section = `\n## FOLLOW‑UP EMAIL TASK (Step ${stepNumber || 1})\n`;
    section += `The prospect has not replied to the previous email(s). Your job is to gently re‑engage them with added value or a different angle. The goal is to continue building rapport and eventually lead to a conversation.\n\n`;

    if (originalEmail) {
      section += `### Original Email (for context)\n${originalEmail}\n`;
      section += `- Do **not** repeat the original message verbatim. Build upon it.\n`;
    }

    section += `\n### Follow‑up Strategy\n`;
    section += `- **Option A (Value‑add):** Share a relevant insight, industry trend, or a brief case study ${hasReference ? '(using {{reference_company}} if appropriate)' : ''}.\n`;
    section += `- **Option B (Alternative angle):** Highlight a different benefit of your solution that wasn't mentioned before.\n`;
    section += `- **Option C (Social proof):** Mention that others in their industry (or similar roles) have found value in a specific outcome.\n`;
    section += `- **Politely acknowledge** that they might be busy – e.g., "I know you're busy, so just circling back."\n`;
    section += `- **Keep it very short** – 2–3 sentences maximum. The goal is to remind and add a fresh reason to reply.\n`;
    section += `- **CTA:** End with a simple, open‑ended question that invites a reply (e.g., "How nice would it be for those old leads to generate some unexpected revenue for you at no additional cost?"\n`;

    if (campaignContext) {
      section += `\nCampaign Objective (re‑emphasise the core problem): ${campaignContext}\n`;
    }

    return section;
  }

  private buildReplyPrompt(params: PromptParams): string {
    const { originalEmail, originalSubject, sentiment, recipientName, recipientCompany, conversationHistory } = params;
    let section = `\n## REPLY TO LEAD RESPONSE TASK\n`;
    section += `You are replying to a lead who has responded to your previous email. Adapt to their sentiment and move the conversation forward.\n\n`;

    if (conversationHistory) {
      section += `### Conversation History (most recent first)\n${conversationHistory}\n\n`;
      section += `- Use this history to understand context, avoid repeating yourself, and answer any previously asked questions.\n`;
    }

    if (originalSubject) {
      section += `### Original Subject\n${originalSubject}\n`;
      section += `- The subject should continue the thread. Typically you would use "Re: ${originalSubject}" or a more specific variant. However, if the original subject is generic, you may improve it while keeping the thread context.\n`;
    }

    if (originalEmail) {
      section += `### Lead's Message\n${originalEmail}\n`;
    }

    if (sentiment) {
      section += `\n### Detected Sentiment\n${sentiment}\n`;
      section += `- If sentiment is **very positive/positive**: Reinforce their interest, provide the information they requested, and propose a concrete next step (e.g., calendar link).\n`;
      section += `- If sentiment is **neutral/curious**: Answer their questions directly and gently guide them toward a low‑commitment next step.\n`;
      section += `- If sentiment is **negative/very negative**: Acknowledge their concern empathetically, reframe if possible, or ask a clarifying question to understand better.\n`;
    }

    section += `\n### Reply Guidelines\n`;
    section += `- Address their comments point‑by‑point. Show that you listened.\n`;
    section += `- Keep the tone helpful, not pushy. Match the lead's level of formality.\n`;
    section += `- If they asked a question, answer it clearly and concisely.\n`;
    section += `- End with a single, clear CTA that aligns with the conversation (e.g., "Would next Wednesday at 2 PM work for a quick call?" or "I'll send over the info – what's the best email address?").\n`;
    section += `- Use placeholders appropriately, but you may also use their actual name if provided ({{recipientName}}) to personalise.\n`;

    return section;
  }

  private getExampleForUseCase(useCase: UseCase, tone: string, hasReference: boolean, stepNumber?: number): string {
    if (useCase === 'initial' && tone === 'professional') {
      if (hasReference) {
        return `
## EXAMPLE (professional tone, initial outreach with reference story)
{
  "subject": "Quick question about {{company}}'s lead conversion",
  "body": "Hi {{name}},\\n\\nI noticed that many companies in the {{industry}} space struggle with reactivating cold leads. We recently helped {{reference_company}} turn 30% of their dormant database into paying clients within 60 days.\\n\\nHow many unconverted leads do you currently have sitting in your CRM?\\n\\nBest,\\n{{senderName}}"
}
`;
      } else {
        return `
## EXAMPLE (professional tone, initial outreach without reference)
{
  "subject": "A quick question about {{company}}'s pipeline",
  "body": "Hi {{name}},\\n\\nI've been speaking to insurance companies like {{company}} and many companies in your space tell us that converting cold leads is their biggest challenge.\\n\\nWhat's your current approach to reactivating old leads?\\n\\nBest,\\n{{senderName}}"
}
`;
      }
    }
    if (useCase === 'followup' && tone === 'professional') {
      if (hasReference) {
        return `
## EXAMPLE (professional tone, follow‑up step ${stepNumber || 1} with reference story)
{
  "subject": "Following up – lead reactivation at {{company}}",
  "body": "Hi {{name}},\\n\\nJust circling back – I know you're busy. At {{reference_company}}, they were surprised by how quickly they started seeing results with our approach.\\n\\nIf you're not the right person, could you point me to who handles lead reactivation?\\n\\nBest,\\n{{senderName}}"
}
`;
      } else {
        return `
## EXAMPLE (professional tone, follow‑up step ${stepNumber || 1} without reference)
{
  "subject": "Re: A quick question about {{company}}'s pipeline",
  "body": "Hi {{name}},\\n\\nI wanted to follow up in case my first email got lost. I'd love to share a quick insight about how companies similar to {{company}} are boosting revenue from old leads.\\n\\nWould a brief call next week work for you?\\n\\nBest,\\n{{senderName}}"
}
`;
      }
    }
    return '';
  }
}

export const promptManager = new PromptManager();