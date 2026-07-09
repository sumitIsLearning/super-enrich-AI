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
  // OpenRouter
  {
    id: 'openrouter:anthropic/claude-sonnet-4-5',
    providerId: 'openrouter',
    displayName: 'Claude Sonnet 4.5 (via OpenRouter)',
    description: 'Anthropic Claude via OpenRouter. Strong reasoning and long-context understanding.',
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    contextWindow: 200_000,
  },
  {
    id: 'openrouter:meta-llama/llama-3.3-70b-instruct',
    providerId: 'openrouter',
    displayName: 'Llama 3.3 70B (via OpenRouter)',
    description: 'Open-weight Llama via OpenRouter. Very low cost.',
    pricing: { inputPer1M: 0.12, outputPer1M: 0.3 },
    contextWindow: 128_000,
  },
  // NOTE: OpenRouter slugs + pricing drift. Verify each against
  // https://openrouter.ai/models before relying on the displayed cost.
  {
    id: 'openrouter:deepseek/deepseek-chat',
    providerId: 'openrouter',
    displayName: 'DeepSeek V3 (via OpenRouter)',
    description: 'Strong general-purpose model at very low cost.',
    pricing: { inputPer1M: 0.27, outputPer1M: 1.1 },
    contextWindow: 64_000,
  },
  {
    id: 'openrouter:qwen/qwen-2.5-72b-instruct',
    providerId: 'openrouter',
    displayName: 'Qwen 2.5 72B (via OpenRouter)',
    description: 'Open-weight Qwen. Good quality, low cost.',
    pricing: { inputPer1M: 0.35, outputPer1M: 0.4 },
    contextWindow: 128_000,
  },
  {
    id: 'openrouter:mistralai/mistral-large',
    providerId: 'openrouter',
    displayName: 'Mistral Large (via OpenRouter)',
    description: 'Mistral flagship. Solid reasoning, mid-tier cost.',
    pricing: { inputPer1M: 2, outputPer1M: 6 },
    contextWindow: 128_000,
  },
  {
    id: 'openrouter:anthropic/claude-3.5-haiku',
    providerId: 'openrouter',
    displayName: 'Claude 3.5 Haiku (via OpenRouter)',
    description: 'Fast, cheaper Claude for quick extraction.',
    pricing: { inputPer1M: 0.8, outputPer1M: 4 },
    contextWindow: 200_000,
  },
];
