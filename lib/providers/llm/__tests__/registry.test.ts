import { describe, it, expect, vi } from 'vitest';

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ provider: 'openai-mock' })),
}));
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ provider: 'google-mock' })),
}));
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ provider: 'openrouter-mock' })),
}));

import { getLLM, listModels } from '../registry';

describe('LLM registry', () => {
  it('getLLM("openai:gpt-4o") returns an AI SDK model', () => {
    const model = getLLM('openai:gpt-4o', 'sk-test');
    expect(model).toBeDefined();
  });

  it('getLLM("google:gemini-2.5-pro") returns an AI SDK model', () => {
    const model = getLLM('google:gemini-2.5-pro', 'google-key');
    expect(model).toBeDefined();
  });

  it('getLLM("openrouter:anthropic/claude-3-5-sonnet") returns an AI SDK model', () => {
    const model = getLLM('openrouter:anthropic/claude-3-5-sonnet', 'or-key');
    expect(model).toBeDefined();
  });

  it('getLLM with unknown id throws', () => {
    expect(() => getLLM('unknown:model', 'key')).toThrow('Unknown LLM model id: unknown:model');
  });

  it('listModels returns models with required fields', () => {
    const models = listModels();
    expect(models.length).toBeGreaterThan(0);
    models.forEach((m) => {
      expect(m.id).toMatch(/^(openai|google|openrouter):/);
      expect(m.displayName).toBeTruthy();
      expect(m.pricing.inputPer1M).toBeGreaterThanOrEqual(0);
      expect(m.pricing.outputPer1M).toBeGreaterThanOrEqual(0);
    });
  });

  it('listModels includes openai, google, and openrouter providers', () => {
    const models = listModels();
    const providerIds = new Set(models.map((m) => m.providerId));
    expect(providerIds).toContain('openai');
    expect(providerIds).toContain('google');
    expect(providerIds).toContain('openrouter');
  });
});
