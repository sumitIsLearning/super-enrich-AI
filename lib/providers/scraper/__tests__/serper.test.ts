import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SerperAdapter } from '../adapters/serper';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const serperResponse = {
  organic: [
    { link: 'https://acme.com', title: 'Acme Corp', snippet: 'We build things.' },
    { link: 'https://news.com/acme', title: 'Acme News', snippet: 'Acme raised $10M.' },
  ],
};

describe('SerperAdapter', () => {
  let adapter: SerperAdapter;

  beforeEach(() => {
    adapter = new SerperAdapter('serper-test-key');
    vi.resetAllMocks();
  });

  it('has id "serper"', () => {
    expect(adapter.id).toBe('serper');
  });

  it('search maps Serper organic results to SearchResult[]', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(serperResponse),
    });
    const results = await adapter.search('acme corp');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      url: 'https://acme.com',
      title: 'Acme Corp',
      description: 'We build things.',
    });
  });

  it('search returns [] on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const results = await adapter.search('query');
    expect(results).toEqual([]);
  });

  it('scrapeUrl uses fetchPageContent fallback', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('<html><body><p>Acme builds things.</p></body></html>'),
    });
    const result = await adapter.scrapeUrl('https://acme.com');
    expect(result.data?.markdown).toContain('Acme builds things');
  });
});
