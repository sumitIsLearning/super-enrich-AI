import { describe, it, expect, vi } from 'vitest';
import type { EnrichmentField } from '../../../types';

// Mock 'ai' generateObject
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      companyName: {
        evidence: [
          {
            value: 'Acme Corp',
            source_url: 'https://acme.com',
            exact_text: 'Acme Corp was founded in 2015.',
            confidence: 0.95,
          },
        ],
        consensus_value: 'Acme Corp',
        consensus_confidence: 0.95,
        sources_agree: true,
      },
    },
    usage: { promptTokens: 100, completionTokens: 50 },
  }),
}));

import { createLLMExtractor } from '../extraction';

const mockModel = {} as import('ai').LanguageModel;

const fields: EnrichmentField[] = [
  {
    name: 'companyName',
    displayName: 'Company Name',
    description: 'The name of the company',
    type: 'string',
    required: false,
  },
];

describe('createLLMExtractor', () => {
  it('extractStructuredDataWithCorroboration returns EnrichmentResult map', async () => {
    const extractor = createLLMExtractor(mockModel);
    const results = await extractor.extractStructuredDataWithCorroboration(
      'URL: https://acme.com\nAcme Corp was founded in 2015.',
      fields,
      { companyName: 'Acme Corp' }
    );
    expect(results).toHaveProperty('companyName');
    expect(results.companyName.value).toBe('Acme Corp');
    expect(results.companyName.confidence).toBeGreaterThan(0.3);
  });

  it('filters out low-confidence results (< 0.3)', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        companyName: {
          evidence: [],
          consensus_value: null,
          consensus_confidence: 0.1,
          sources_agree: false,
        },
      },
      usage: { promptTokens: 50, completionTokens: 20 },
    } as never);

    const extractor = createLLMExtractor(mockModel);
    const results = await extractor.extractStructuredDataWithCorroboration(
      'No data here',
      fields,
      {}
    );
    expect(results).not.toHaveProperty('companyName');
  });
});
