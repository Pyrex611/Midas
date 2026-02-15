import { logger } from '../config/logger';
import { env } from '../config/env';

// ===== PROVIDER INTERFACE =====
interface AIProvider {
  generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ): Promise<{ subject: string; body: string }>;
  isAvailable(): Promise<boolean>;
}

// ===== MOCK PROVIDER (always available, high‑quality templates) =====
class MockProvider implements AIProvider {
  async isAvailable() { return true; }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    logger.debug({ tone, useCase, campaignContext, reference }, 'MockProvider generating draft');
    return this.generateMockDraft(tone, useCase, campaignContext, reference);
  }

  private generateMockDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string
  ): { subject: string; body: string } {
    // Base templates
    const baseDrafts: Record<string, { subject: string; body: string }> = {
      'professional-initial': {
        subject: 'Quick question regarding {{company}}',
        body: `Hi {{name}},\n\nI've been following {{company}}'s recent work in the industry and was impressed by your team's achievements. At our company, we specialize in helping businesses like yours achieve {{valueProposition}}.\n\nWould you be open to a 10‑minute call next week? I'd love to share some insights that could be relevant.\n\nBest regards,\n[Your Name]`,
      },
      'friendly-initial': {
        subject: 'Loved your recent post on {{topic}}',
        body: `Hi {{name}},\n\nI came across your post about {{topic}} and it really resonated. At {{senderCompany}}, we're working on something that aligns perfectly with that vision.\n\nIf you're open to it, I'd love to exchange ideas – no strings attached.\n\nCheers,\n[Your Name]`,
      },
      'urgent-initial': {
        subject: 'Time‑sensitive opportunity for {{company}}',
        body: `Hi {{name}},\n\nI'm reaching out because we have a limited window to help companies like {{company}} achieve {{valueProposition}}. Based on your role, I believe you could benefit from a quick conversation.\n\nWould you have 10 minutes this week?\n\nBest,\n[Your Name]`,
      },
      'data-driven-initial': {
        subject: 'Data‑backed insights for {{company}}',
        body: `Hi {{name}},\n\nI analyzed {{company}}'s recent performance and noticed an opportunity to improve {{valueProposition}}. Our data shows that companies in your sector typically see a 30% uplift after implementing our approach.\n\nWould you be open to reviewing the findings together?\n\nCheers,\n[Your Name]`,
      },
      'storytelling-initial': {
        subject: 'The $10k Deal Story You Need',
        body: `Hi {{name}},\n\nI remember a few years back, {{reference_company}} was struggling to close those big-ticket deals. Their sales team was great, but the final hurdle felt insurmountable. Then, we implemented a new approach – not just selling, but truly understanding and solving their core pain points.\n\nIt wasn't about pushing features; it was about uncovering the hidden 'why' behind their purchase. This led to a remarkable shift, with one client landing a $10k deal on the first call.\n\nMy expertise lies in that precise moment – transforming hesitation into commitment, and turning prospects into paying clients, exponentially raising revenue. {{valueProposition}} is designed to do just that.\n\nWould you be open to a brief chat to explore this?`,
      },
    };

    const key = `${tone}-${useCase}`;
    const draft = baseDrafts[key] || baseDrafts['professional-initial'];
    
    // Inject campaign context and reference if provided
    let finalBody = draft.body;
    if (campaignContext) {
      finalBody = `[Goal: ${campaignContext}]\n\n${finalBody}`;
    }
    if (reference) {
      // Reference is already in the storytelling template, but we ensure placeholder exists
      if (!finalBody.includes('{{reference_company}}')) {
        finalBody = `[Reference: ${reference}]\n\n${finalBody}`;
      }
    } else {
      // Remove any lines that contain {{reference_company}} if reference not provided
      finalBody = finalBody
        .split('\n')
        .filter(line => !line.includes('{{reference_company}}'))
        .join('\n');
    }
    
    return {
      subject: draft.subject,
      body: finalBody,
    };
  }
}

// ===== OPENAI PROVIDER =====
class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4-turbo-preview') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable() {
    if (!this.apiKey) return false;
    try {
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const prompt = this.buildPrompt(tone, useCase, campaignContext, reference, companyContext);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert B2B cold email copywriter. Output only valid JSON with "subject" and "body".',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return this.parseResponse(content);
  }

  private buildPrompt(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ): string {
    let prompt = `You are an expert in B2B cold outreach with a 40%+ reply rate.
Generate a ${tone} cold email for ${useCase} outreach.

CAMPAIGN OBJECTIVE: ${campaignContext || 'General outreach'}

`;

    if (reference) {
      prompt += `REFERENCE STORY: ${reference}
Use this story as a case study, mentioning the company name as {{reference_company}}. If the story includes a specific company name, you may incorporate it naturally.\n\n`;
    } else {
      prompt += `No reference story provided. Do not include any specific client story; instead focus on the value proposition.\n\n`;
    }

    prompt += `IMPORTANT REQUIREMENTS:
- Subject line: compelling, under 60 characters, no placeholders.
- Body: 3-4 short paragraphs, under 150 words, mobile‑friendly.
- Use placeholders EXACTLY as: {{name}}, {{company}}, {{position}}, {{valueProposition}}.
- ${reference ? 'If you used the reference story, ensure {{reference_company}} appears where the client company would be mentioned.' : 'Do NOT use {{reference_company}}.'}
- No links, no attachments, no "click here".
- End with a clear, low‑friction call‑to‑action (e.g., "Would you be open to a brief chat?").
- Output ONLY valid JSON: {"subject": "...", "body": "..."}
${companyContext ? `Context about the sender's company: ${companyContext}` : ''}`;

    return prompt;
  }

  private parseResponse(raw: string): { subject: string; body: string } {
    try {
      return JSON.parse(raw);
    } catch {
      // Fallback: extract using regex
      const subjectMatch = raw.match(/"subject"\s*:\s*"([^"]+)"/);
      const bodyMatch = raw.match(/"body"\s*:\s*"([^"]+)"/);
      return {
        subject: subjectMatch?.[1] || 'New opportunity',
        body: bodyMatch?.[1]?.replace(/\\n/g, '\n') || 'Hi {{name}}...',
      };
    }
  }
}

// ===== GOOGLE GEMINI PROVIDER =====
class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-pro') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const prompt = this.buildPrompt(tone, useCase, campaignContext, reference, companyContext);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return this.parseResponse(text);
  }

  private buildPrompt = OpenAIProvider.prototype.buildPrompt;
  private parseResponse = OpenAIProvider.prototype.parseResponse;
}

// ===== OLLAMA PROVIDER =====
class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private fastModel: string;
  private powerfulModel: string;

  constructor(baseUrl = 'http://localhost:11434', fastModel = 'llama3.2:1b', powerfulModel = 'llama3.1:8b') {
    this.baseUrl = baseUrl;
    this.fastModel = fastModel;
    this.powerfulModel = powerfulModel;
  }

  async isAvailable() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/tags`);
      return resp.ok;
    } catch {
      return false;
    }
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const model = useCase === 'initial' ? this.powerfulModel : this.fastModel;
    const prompt = this.buildPrompt(tone, useCase, campaignContext, reference, companyContext);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 },
      }),
    });

    if (!response.ok) throw new Error('Ollama generation failed');
    const data = await response.json();
    return this.parseResponse(data.response);
  }

  private buildPrompt = OpenAIProvider.prototype.buildPrompt;
  private parseResponse = OpenAIProvider.prototype.parseResponse;
}

// ===== FACTORY =====
export class AIService {
  private provider: AIProvider;

  constructor() {
    const providerType = env.AI_PROVIDER?.toLowerCase() || 'mock';
    logger.info({ provider: providerType }, 'Initializing AI service');

    switch (providerType) {
      case 'openai':
        this.provider = new OpenAIProvider(env.OPENAI_API_KEY || '', env.OPENAI_MODEL);
        break;
      case 'gemini':
        this.provider = new GeminiProvider(env.GEMINI_API_KEY || '', env.GEMINI_MODEL);
        break;
      case 'ollama':
        this.provider = new OllamaProvider(env.OLLAMA_URL, env.OLLAMA_FAST_MODEL, env.OLLAMA_POWERFUL_MODEL);
        break;
      case 'mock':
      default:
        this.provider = new MockProvider();
        break;
    }
  }

  async generateDraft(
    tone: string = 'professional',
    useCase: string = 'initial',
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ): Promise<{ subject: string; body: string }> {
    try {
      return await this.provider.generateDraft(tone, useCase, campaignContext, reference, companyContext);
    } catch (error) {
      logger.error({ error, provider: env.AI_PROVIDER }, 'AI provider failed, falling back to mock');
      const mock = new MockProvider();
      return mock.generateDraft(tone, useCase, campaignContext, reference, companyContext);
    }
  }
}

export const aiService = new AIService();