export type InboundIntentCategory =
  | 'INTERESTED_DEMO'
  | 'INTERESTED_INFO'
  | 'OBJECTION_PRICING'
  | 'OBJECTION_TIMING'
  | 'OBJECTION_COMPETITOR'
  | 'NOT_DECISION_MAKER'
  | 'OUT_OF_OFFICE'
  | 'UNSUBSCRIBE_REQUEST'
  | 'NEUTRAL_QUESTION';

export interface InboundClassification {
  intent: InboundIntentCategory;
  sentiment: 'very positive' | 'positive' | 'neutral' | 'negative' | 'very negative';
  confidence: number;
  extractedReturnDate?: string | null;
  summary: string;
  recommendedAction: 'CONVERT_CALL' | 'SEND_COLLATERAL' | 'HANDLE_OBJECTION' | 'FREEZE_OOO' | 'UNSUBSCRIBE' | 'MANUAL_REVIEW';
}

export interface ReplyAnalysis {
  sentiment: 'very positive' | 'positive' | 'neutral' | 'negative' | 'very negative';
  intent: string;
  painPoints?: string[];
  objections?: string[];
  interestLevel?: number;
  buyingSignals?: string[];
  suggestedApproach?: string;
  keyPoints?: string[];
}

export interface AIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  complete(prompt: string, system?: string): Promise<string>;
}

export interface ConfirmedProviderIntegration {
  id: string; // provider identifier, e.g. "aigateway", "gemini", "openrouter"
  provider: string;
  displayName: string;
  gatewayUrl?: string | null;
  hasApiKey: boolean;
  apiKeyEncrypted?: string | null;
  models: string[];
  activeModel: string;
  lastTestedAt: string;
  status: 'HEALTHY' | 'ERROR';
  latencyMs?: number;
}