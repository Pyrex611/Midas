import { AIProvider } from '../types';
import { logger } from '../../../config/logger';

export class MockProvider implements AIProvider {
  readonly name = 'mock';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async complete(prompt: string, _system?: string): Promise<string> {
    logger.debug('[AI-ENGINE] MockProvider generating static fallback response');
    
    if (prompt.includes('Inbound Classification') || prompt.includes('classifyIntent')) {
      return JSON.stringify({
        intent: 'INTERESTED_INFO',
        sentiment: 'positive',
        confidence: 0.85,
        summary: 'Prospect is open to exploring details.',
        recommendedAction: 'SEND_COLLATERAL',
      });
    }

    if (prompt.includes('sentiment') || prompt.includes('Reply text')) {
      return JSON.stringify({
        sentiment: 'neutral',
        intent: 'asking for info',
        painPoints: ['Pipeline conversion friction'],
        objections: [],
        interestLevel: 6,
        buyingSignals: ['requested details'],
        suggestedApproach: 'Provide a brief one-pager and offer an asynchronous demo.',
        keyPoints: [],
      });
    }

    return JSON.stringify({
      subject: '{Quick question|Quick idea} regarding {{company}}',
      body: '{Hi|Hey|Hello} {{name}},\n\n{I noticed|Looks like} {{company}} is active in your market. We help teams automate pipeline conversion without adding overhead.\n\nWorth exploring?\n\nBest,\n{{senderName}}',
    });
  }
}