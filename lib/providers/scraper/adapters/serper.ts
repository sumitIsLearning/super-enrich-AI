import type { ScraperProvider } from '../types';
import type { SearchResult } from '../../../types';

const SERPER_ENDPOINT = 'https://google.serper.dev/search';

export class SerperAdapter implements ScraperProvider {
  readonly id = 'serper';
  readonly displayName = 'Serper';

  constructor(private readonly apiKey: string) {}

  async search(
    query: string,
    opts: { limit?: number } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10 } = opts;
    try {
      const response = await fetch(SERPER_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: limit }),
      });

      if (!response.ok) {
        console.error(`Serper search failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as {
        organic?: Array<{ link: string; title?: string; snippet?: string }>;
      };

      const { fetchPageContent } = await import('../fetch-content');
      const results = await Promise.all(
        (data.organic ?? []).map(async (item) => {
          const content = await fetchPageContent(item.link);
          return {
            url: item.link,
            title: item.title ?? '',
            description: item.snippet ?? '',
            markdown: content?.markdown,
          };
        })
      );

      // Serper only returns snippet metadata, never page content, so every
      // result needs its own fetch above. Drop anything that came back
      // empty (fetch failed / blocked) or too thin to be real content
      // (e.g. a JS-only page shell) -- same threshold the Discovery phase
      // already uses for the same purpose.
      return results.filter((r) => r.markdown && r.markdown.length >= 100);
    } catch (error) {
      console.error('Serper search error:', error);
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
    opts?: { limit?: number }
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
