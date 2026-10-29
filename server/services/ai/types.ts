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
  extractedReturnDate?: string | null; // e.g. for OOO replies: "2026-11-15"
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