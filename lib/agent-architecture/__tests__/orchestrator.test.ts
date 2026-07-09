import { describe, it, expect, vi } from 'vitest';
import { AgentOrchestrator } from '../orchestrator';
import type { ScraperProvider } from '../../providers/scraper/types';
import type { LLMExtractor } from '../../providers/llm/extraction';
import type { EnrichmentField } from '../../types';

const mockScraper: ScraperProvider = {
  id: 'mock',
  displayName: 'Mock',
  search: vi.fn().mockResolvedValue([
    { url: 'https://acme.com', title: 'Acme', description: 'Builds things', markdown: '# Acme\nFounded 2010' },
  ]),
  scrapeUrl: vi.fn().mockResolvedValue({ data: { markdown: '# Acme\nWe build things.' } }),
  searchWithMultipleQueries: vi.fn().mockResolvedValue([]),
};

const mockExtractor: LLMExtractor = {
  extractStructuredDataWithCorroboration: vi.fn().mockResolvedValue({
    companyName: { field: 'companyName', value: 'Acme Corp', confidence: 0.9 },
  }),
  extractStructuredDataOriginal: vi.fn().mockResolvedValue({}),
};

describe('AgentOrchestrator (injected providers)', () => {
  it('constructs with ScraperProvider + LLMExtractor (no raw API keys)', () => {
    expect(() => new AgentOrchestrator(mockScraper, mockExtractor)).not.toThrow();
  });

  it('enrichRow calls scraper.search at least once', async () => {
    const orchestrator = new AgentOrchestrator(mockScraper, mockExtractor);
    const fields: EnrichmentField[] = [
      { name: 'companyName', displayName: 'Company Name', description: 'Company name', type: 'string', required: false },
    ];
    await orchestrator.enrichRow({ email: 'alice@acme.com' }, fields, 'email');
    expect(mockScraper.search).toHaveBeenCalled();
  });
});
