import { AIProvider } from '../types';
import { isReasoningModel } from '../utils/modelClassifier';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  constructor(
    private apiKey: string = process.env.OPENAI_API_KEY || '',
    private model: string = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey || process.env.OPENAI_API_KEY);
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const key = this.apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not configured');

    let cleanModel = (this.model || 'gpt-4o-mini').trim();
    if (cleanModel.startsWith('openai/')) {
      cleanModel = cleanModel.replace('openai/', '');
    }

    const isReasoning = isReasoningModel('openai', cleanModel);

    const messages = [];
    if (system && !isReasoning) {
      messages.push({ role: 'system', content: system });
    } else if (system && isReasoning) {
      // o-series models recommend user-embedded instructions
      prompt = `${system}\n\n${prompt}`;
    }
    messages.push({ role: 'user', content: prompt });

    const requestBody: Record<string, any> = {
      model: cleanModel,
      messages,
    };

    // o1/o3 models require max_completion_tokens and reject custom temperature
    if (isReasoning) {
      requestBody.max_completion_tokens = 4000;
    } else {
      requestBody.temperature = 0.7;
      requestBody.max_tokens = 1500;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key.trim()}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(25_000),
    });

    const rawText = await response.text();
    if (!response.ok) {
      let parsedError = rawText;
      try {
        const errorJson = JSON.parse(rawText);
        parsedError = errorJson.error?.message || errorJson.message || rawText;
      } catch {}
      throw new Error(`OpenAI API error (${response.status}): ${parsedError}`);
    }

    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`OpenAI returned empty message content for model "${cleanModel}"`);
    }
    return content;
  }
}