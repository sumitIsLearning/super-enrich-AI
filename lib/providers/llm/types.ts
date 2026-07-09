import type { LanguageModel } from 'ai';

export interface LLMModelInfo {
  id: string;
  providerId: 'openai' | 'google' | 'openrouter';
  displayName: string;
  description: string;
  pricing: { inputPer1M: number; outputPer1M: number };
  contextWindow: number;
}

export type { LanguageModel };
