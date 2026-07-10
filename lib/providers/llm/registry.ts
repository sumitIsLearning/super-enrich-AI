import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel, LLMModelInfo } from './types';
import { MODELS_CONFIG } from './models-config';

export function getLLM(modelId: string, apiKey: string): LanguageModel {
  const [providerId, ...rest] = modelId.split(':');
  const modelSlug = rest.join(':');

  switch (providerId) {
    case 'openai': {
      const provider = createOpenAI({ apiKey });
      return provider(modelSlug);
    }
    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider(modelSlug);
    }
    case 'openrouter': {
      const provider = createOpenRouter({ apiKey });
      return provider(modelSlug);
    }
    default:
      throw new Error(`Unknown LLM model id: ${modelId}`);
  }
}

export function listModels(): LLMModelInfo[] {
  return MODELS_CONFIG;
}

export function getModelInfo(modelId: string): LLMModelInfo | undefined {
  return MODELS_CONFIG.find((m) => m.id === modelId);
}
