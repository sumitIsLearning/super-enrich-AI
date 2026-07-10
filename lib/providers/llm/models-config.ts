import type { LLMModelInfo } from './types';

export const MODELS_CONFIG: LLMModelInfo[] = [
  // OpenAI
  {
    id: 'openai:gpt-4o',
    providerId: 'openai',
    displayName: 'GPT-4o',
    description: 'OpenAI flagship multimodal. Best quality for structured extraction.',
    pricing: { inputPer1M: 2.5, outputPer1M: 10 },
    contextWindow: 128_000,
  },
  {
    id: 'openai:gpt-4o-mini',
    providerId: 'openai',
    displayName: 'GPT-4o mini',
    description: 'Lightweight OpenAI model. Fast and cost-effective.',
    pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
    contextWindow: 128_000,
  },
  // Google Gemini
  {
    id: 'google:gemini-2.5-pro',
    providerId: 'google',
    displayName: 'Gemini 2.5 Pro',
    description: 'Google Gemini flagship with 1M context. Strong at multi-source synthesis.',
    pricing: { inputPer1M: 1.25, outputPer1M: 10 },
    contextWindow: 1_000_000,
  },
  {
    id: 'google:gemini-2.5-flash',
    providerId: 'google',
    displayName: 'Gemini 2.5 Flash',
    description: 'Fast Gemini model. Good balance of quality and cost.',
    pricing: { inputPer1M: 0.075, outputPer1M: 0.3 },
    contextWindow: 1_000_000,
  },
  // OpenRouter — every entry verified tool-capable against
  // https://openrouter.ai/api/v1/models (supported_parameters includes "tools").
  // generateObject relies on tool calls for structured output, so non-tool
  // models (e.g. Llama) fail with "the tool was not called". Frontier models
  // are the reliable tool-callers. Re-verify slugs + pricing before shipping.
  {
    id: 'openrouter:deepseek/deepseek-v4-flash',
    providerId: 'openrouter',
    displayName: 'DeepSeek V4 Flash (via OpenRouter)',
    description: 'Ultra-cheap, fast. Good default for high-volume extraction.',
    pricing: { inputPer1M: 0.09, outputPer1M: 0.18 },
    contextWindow: 1_048_576,
  },
  {
    id: 'openrouter:deepseek/deepseek-v4-pro',
    providerId: 'openrouter',
    displayName: 'DeepSeek V4 Pro (via OpenRouter)',
    description: 'Stronger DeepSeek, still low cost.',
    pricing: { inputPer1M: 0.43, outputPer1M: 0.87 },
    contextWindow: 1_048_576,
  },
  {
    id: 'openrouter:google/gemini-3.1-flash-lite',
    providerId: 'openrouter',
    displayName: 'Gemini 3.1 Flash Lite (via OpenRouter)',
    description: 'Cheap, fast Google model with large context.',
    pricing: { inputPer1M: 0.25, outputPer1M: 1.5 },
    contextWindow: 1_048_576,
  },
  {
    id: 'openrouter:openai/gpt-5.4-mini',
    providerId: 'openrouter',
    displayName: 'GPT-5.4 mini (via OpenRouter)',
    description: 'OpenAI mid-tier. Reliable tool calling.',
    pricing: { inputPer1M: 0.75, outputPer1M: 4.5 },
    contextWindow: 400_000,
  },
  {
    id: 'openrouter:x-ai/grok-4.3',
    providerId: 'openrouter',
    displayName: 'Grok 4.3 (via OpenRouter)',
    description: 'xAI Grok. Strong reasoning, good value.',
    pricing: { inputPer1M: 1.25, outputPer1M: 2.5 },
    contextWindow: 1_000_000,
  },
  {
    id: 'openrouter:anthropic/claude-sonnet-4.6',
    providerId: 'openrouter',
    displayName: 'Claude Sonnet 4.6 (via OpenRouter)',
    description: 'Anthropic flagship. Best-in-class structured extraction.',
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    contextWindow: 1_000_000,
  },
];
