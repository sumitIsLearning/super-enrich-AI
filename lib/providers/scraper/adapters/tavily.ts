import { tavily } from '@tavily/core';
import type { ScraperProvider } from '../types';
import type { SearchResult } from '../../../types';

export class TavilyAdapter implements ScraperProvider {
  readonly id = 'tavily';
  readonly displayName = 'Tavily';
  private client: ReturnType<typeof tavily>;

  constructor(apiKey: string) {
    this.client = tavily({ apiKey });
  }

  async search(
    query: string,
    opts: { limit?: number; scrapeContent?: boolean } = {}
  ): Promise<SearchResult[]> {
    const { limit = 5 } = opts;
    try {
      const response = await this.client.search(query, {
        maxResults: limit,
        includeRawContent: true,
      });
      return (response.results ?? []).map((r) => ({
        url: r.url,
        title: r.title ?? '',
        description: r.content?.substring(0, 200) ?? '',
        markdown: r.rawContent ?? r.content ?? '',
      }));
    } catch (error) {
      console.error('Tavily search error:', error);
      return [];
    }
  }

  async scrapeUrl(
    url: string
  ): Promise<{ data?: { markdown?: string; html?: string }; error?: string }> {
    const { fetchPageContent } = await import('../fetch-content');
    const content = await fetchPageContent(url);
    if (!content) return { error: `Failed to fetch ${url}` };
    return { data: content };
  }

  async searchWithMultipleQueries(
    queries: string[],
    opts?: { limit?: number; scrapeContent?: boolean }
  ): Promise<SearchResult[]> {
    const seen = new Set<string>();
    const all: SearchResult[] = [];
    for (const q of queries) {
      const results = await this.search(q, opts);
      for (const r of results) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          all.push(r);
        }
      }
    }
    return all;
  }
}
