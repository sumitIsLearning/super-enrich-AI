import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tavily/core', () => ({
  tavily: vi.fn().mockReturnValue({
    search: vi.fn().mockResolvedValue({
      results: [
        {
          url: 'https://acme.com',
          title: 'Acme Corp',
          content: 'We make things.',
        },
      ],
    }),
  }),
}));

import { TavilyAdapter } from '../adapters/tavily';

describe('TavilyAdapter', () => {
  let adapter: TavilyAdapter;

  beforeEach(() => {
    adapter = new TavilyAdapter('tvly-test-key');
  });

  it('has id "tavily"', () => {
    expect(adapter.id).toBe('tavily');
  });

  it('search maps Tavily results to SearchResult[]', async () => {
    const results = await adapter.search('acme corp');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      url: 'https://acme.com',
      title: 'Acme Corp',
      markdown: 'We make things.',
    });
  });

  it('searchWithMultipleQueries deduplicates by URL', async () => {
    const results = await adapter.searchWithMultipleQueries(['q1', 'q2']);
    // Same URL returned twice by mock → deduped to 1
    expect(results).toHaveLength(1);
  });
});
