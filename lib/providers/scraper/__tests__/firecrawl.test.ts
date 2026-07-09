import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FirecrawlService before importing adapter
vi.mock('../../../services/firecrawl', () => {
  const mockInstance = {
    search: vi.fn().mockResolvedValue([
      { url: 'https://example.com', title: 'Example', description: 'Test', markdown: '# Example' },
    ]),
    scrapeUrl: vi.fn().mockResolvedValue({
      data: { markdown: '# About', html: '<h1>About</h1>' },
    }),
    searchWithMultipleQueries: vi.fn().mockResolvedValue([
      { url: 'https://example.com', title: 'Example', description: 'Test', markdown: '# Example' },
    ]),
  };
  return {
    FirecrawlService: vi.fn().mockImplementation(function () {
      return mockInstance;
    }),
  };
});

import { FirecrawlAdapter } from '../adapters/firecrawl';

describe('FirecrawlAdapter', () => {
  let adapter: FirecrawlAdapter;

  beforeEach(() => {
    adapter = new FirecrawlAdapter('test-key');
  });

  it('has id "firecrawl"', () => {
    expect(adapter.id).toBe('firecrawl');
  });

  it('search delegates to FirecrawlService and returns SearchResult[]', async () => {
    const results = await adapter.search('acme corp', { limit: 3 });
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com');
  });

  it('scrapeUrl delegates to FirecrawlService', async () => {
    const result = await adapter.scrapeUrl('https://example.com');
    expect(result.data?.markdown).toBe('# About');
  });

  it('searchWithMultipleQueries delegates to FirecrawlService', async () => {
    const results = await adapter.searchWithMultipleQueries(['query1', 'query2']);
    expect(results).toHaveLength(1);
  });
});
