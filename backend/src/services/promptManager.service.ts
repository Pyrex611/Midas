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
}

export class PromptManager {
  /**
   * Build a state‑of‑the‑art prompt for the given use case.
   */
  buildPrompt(params: PromptParams): string {
    const { useCase, tone, campaignContext, reference, companyContext, variationSeed } = params;
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
    prompt += `    - {{valueProposition}} → a generic value phrase (e.g., "improving team productivity").\n`;
    prompt += `    - {{senderName}} → the sender's name.\n`;
    prompt += `    - {{reference_company}} → **ONLY if a reference story is provided** – this represents a past client's company. Never use {{company}} for the reference client.\n`;
    prompt += `- **Reference Story Handling:**\n`;
    prompt += `    - ${hasReference ? 'A reference story is provided. You MUST use the placeholder {{reference_company}} when mentioning that client. Do NOT use {{company}} for the reference.' : 'No reference story is provided. You MUST NOT mention any client story at all – not even using {{company}} as a stand‑in. Absolutely avoid any reference to a past client.'}\n`;
    prompt += `- **Value Proposition:** Implicitly tie your offering to a specific business outcome the prospect likely cares about (based on the campaign objective).\n`;
    prompt += `- **Call‑to‑Action (CTA):** End with a single, low‑friction question that invites a reply (e.g., "Would you be open to a brief chat next week?"). Never use "click here" or links.\n`;
    prompt += `- **Persuasion Principles:** Where appropriate, subtly incorporate social proof (e.g., similar companies), reciprocity (e.g., an insight), or consistency (e.g., referencing a past action).\n`;
    prompt += `- **Avoid:** Overused phrases like "I hope this email finds you well", "game‑changer", "revolutionary". Be specific and concrete.\n\n`;

    switch (useCase) {
      case 'initial':
        prompt += this.buildInitialPrompt(tone, campaignContext, hasReference, reference);
        break;
      case 'followup':
        prompt += this.buildFollowupPrompt(tone, campaignContext, hasReference, params.originalEmail);
        break;
      case 'reply':
        prompt += this.buildReplyPrompt(params);
        break;
      default:
        prompt += this.buildInitialPrompt(tone, campaignContext, hasReference, reference);
    }

    prompt += this.getExampleForUseCase(useCase, tone, hasReference);

    prompt += `\n## OUTPUT FORMAT\n`;
    prompt += `Return ONLY a valid JSON object with two fields: "subject" and "body". Do not include any other text, markdown, or explanation.\n`;
    prompt += `Example: {"subject": "Quick question about {{company}}", "body": "Hi {{name}},\\n\\nI noticed..."}\n`;

    if (companyContext) {
      prompt += `\n## SENDER COMPANY CONTEXT\n${companyContext}\n`;
    }

    // ===== STRENGTHENED SELF‑CRITIQUE =====
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
    section += `You are writing the very first email to a prospect. The goal is to spark curiosity and earn a reply.\n\n`;

    if (campaignContext) {
      section += `### Campaign Objective\n${campaignContext}\n`;
      section += `- Identify the primary pain point or opportunity this campaign addresses.\n`;
      section += `- Frame your value proposition as a means to achieve that objective.\n`;
    }

    if (hasReference && reference) {
      section += `\n### Reference Story (use only if relevant)\n${reference}\n`;
      section += `- If you use this story, you MUST use {{reference_company}} to refer to that client. Do NOT use {{company}}.\n`;
      section += `- Keep it brief – one sentence woven naturally into the email.\n`;
    }

    section += `\n### Structure Guidelines for Initial Email\n`;
    section += `1. **Opening line:** Personalise by mentioning something specific about the prospect's company or role (e.g., "I saw that {{company}} recently expanded into..." or "Following your recent post on...").\n`;
    section += `2. **Value hook:** Briefly state how you help companies like theirs achieve a specific result. Use numbers or concrete outcomes if possible.\n`;
    section += `3. **Social proof / reference (optional):** ${hasReference ? 'If a reference story exists and fits, add one sentence about a similar client\'s success, using {{reference_company}}.' : 'Do not mention any client stories.'}\n`;
    section += `4. **Low‑friction CTA:** Ask a simple, open‑ended question that invites a reply (e.g., "Would you be open to a 10‑minute call to explore if this could be relevant?").\n`;

    return section;
  }

  private buildFollowupPrompt(
    tone: string,
    campaignContext?: string | null,
    hasReference?: boolean,
    originalEmail?: string
  ): string {
    let section = `\n## FOLLOW‑UP EMAIL TASK\n`;
    section += `The prospect has not replied to the initial email. Your job is to gently re‑engage them with added value or a different angle.\n\n`;

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
    section += `- **CTA:** Suggest a specific, easy next step, e.g., "Would a 5‑minute call next Tuesday work for you?"\n`;

    if (campaignContext) {
      section += `\nCampaign Objective (re‑emphasise the core problem): ${campaignContext}\n`;
    }

    return section;
  }

  private buildReplyPrompt(params: PromptParams): string {
    const { originalEmail, originalSubject, sentiment, recipientName, recipientCompany } = params;
    let section = `\n## REPLY TO LEAD RESPONSE TASK\n`;
    section += `You are replying to a lead who has responded to your previous email. Adapt to their sentiment and move the conversation forward.\n\n`;

    if (originalSubject) {
      section += `### Original Subject\n${originalSubject}\n`;
      section += `- The subject should continue the thread. Typically you would use "Re: ${originalSubject}" or a more specific variant. However, if the original subject is generic, you may improve it while keeping the thread context.\n`;
    }

    if (originalEmail) {
      section += `### Lead's Message\n${originalEmail}\n`;
    }

    if (sentiment) {
      section += `\n### Detected Sentiment\n${sentiment}\n`;
      section += `- If sentiment is **positive**: Reinforce their interest, provide the information they requested, and propose a concrete next step (e.g., calendar link).\n`;
      section += `- If sentiment is **neutral/curious**: Answer their questions directly and gently guide them toward a low‑commitment next step.\n`;
      section += `- If sentiment is **negative/objection**: Acknowledge their concern empathetically, reframe if possible, or ask a clarifying question to understand better.\n`;
    }

    section += `\n### Reply Guidelines\n`;
    section += `- Address their comments point‑by‑point. Show that you listened.\n`;
    section += `- Keep the tone helpful, not pushy. Match the lead's level of formality.\n`;
    section += `- If they asked a question, answer it clearly and concisely.\n`;
    section += `- End with a single, clear CTA that aligns with the conversation (e.g., "Would next Wednesday at 2 PM work for a quick call?" or "I'll send over the info – what's the best email address?").\n`;
    section += `- Use placeholders appropriately, but you may also use their actual name if provided ({{recipientName}}) to personalise.\n`;

    return section;
  }

  private getExampleForUseCase(useCase: UseCase, tone: string, hasReference: boolean): string {
    if (useCase === 'initial' && tone === 'professional') {
      if (hasReference) {
        return `
## EXAMPLE (professional tone, initial outreach with reference story)
{
  "subject": "Quick question about {{company}}'s 2024 goals",
  "body": "Hi {{name}},\\n\\nI noticed that {{company}} recently expanded into the EU market – congratulations! Many companies in your space struggle with local compliance while scaling. We recently helped {{reference_company}} reduce compliance overhead by 30% in their first year abroad.\\n\\nWould you be open to a 15‑minute chat about the common pitfalls we see and how to avoid them?\\n\\nBest,\\n{{senderName}}"
}
`;
      } else {
        return `
## EXAMPLE (professional tone, initial outreach without reference)
{
  "subject": "Quick question about {{company}}'s 2024 goals",
  "body": "Hi {{name}},\\n\\nI noticed that {{company}} recently expanded into the EU market – congratulations! Many companies in your space struggle with local compliance while scaling. We help businesses like yours reduce compliance overhead by 30% with a streamlined approach.\\n\\nWould you be open to a 15‑minute chat about the common pitfalls we see and how to avoid them?\\n\\nBest,\\n{{senderName}}"
}
`;
      }
    }
    if (useCase === 'initial' && tone === 'friendly') {
      if (hasReference) {
        return `
## EXAMPLE (friendly tone, initial outreach with reference story)
{
  "subject": "Loved your recent post on scaling",
  "body": "Hi {{name}},\\n\\nI really enjoyed your recent post about scaling challenges. At {{reference_company}}, we faced similar hurdles and managed to cut onboarding time by 40% with a few simple process tweaks.\\n\\nI'd love to share what we learned – would a quick call next week work for you?\\n\\nCheers,\\n{{senderName}}"
}
`;
      } else {
        return `
## EXAMPLE (friendly tone, initial outreach without reference)
{
  "subject": "Loved your recent post on scaling",
  "body": "Hi {{name}},\\n\\nI really enjoyed your recent post about scaling challenges. Many companies in your space struggle with this, and we've developed a simple framework that cuts onboarding time by 40%.\\n\\nWould a quick call next week work for you to exchange ideas?\\n\\nCheers,\\n{{senderName}}"
}
`;
      }
    }
    return '';
  }
}

export const promptManager = new PromptManager();