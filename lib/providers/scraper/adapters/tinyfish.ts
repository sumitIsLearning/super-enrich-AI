import type { ScraperProvider } from '../types';
import type { SearchResult } from '../../../types';

const SEARCH_ENDPOINT = 'https://api.search.tinyfish.ai/';
const FETCH_ENDPOINT = 'https://api.fetch.tinyfish.ai/';
const MIN_CONTENT_CHARS = 100;
const MAX_FETCH_URLS_PER_CALL = 10; // TinyFish Fetch API hard cap per call

interface TinyFishSearchResultItem {
  url: string;
  title?: string;
  snippet?: string;
}

interface TinyFishFetchResultItem {
  url: string;
  text?: string | null;
}

export class TinyFishAdapter implements ScraperProvider {
  readonly id = 'tinyfish';
  readonly displayName = 'TinyFish';

  constructor(private readonly apiKey: string) {}

  private async fetchContent(
    urls: string[],
    format: 'markdown' | 'html' = 'markdown'
  ): Promise<Map<string, string>> {
    const contentByUrl = new Map<string, string>();
    if (urls.length === 0) return contentByUrl;
    try {
      const response = await fetch(FETCH_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls: urls.slice(0, MAX_FETCH_URLS_PER_CALL), format }),
      });

      if (!response.ok) return contentByUrl;

      const data = (await response.json()) as { results?: TinyFishFetchResultItem[] };
      for (const item of data.results ?? []) {
        if (typeof item.text === 'string' && item.text.length > 0) {
          contentByUrl.set(item.url, item.text);
        }
      }
    } catch (error) {
      console.error('TinyFish fetch error:', error);
    }
    return contentByUrl;
  }

  async search(
    query: string,
    opts: { limit?: number } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10 } = opts;
    try {
      const url = new URL(SEARCH_ENDPOINT);
      url.searchParams.set('query', query);

      const response = await fetch(url, {
        headers: { 'X-API-Key': this.apiKey },
      });

      if (!response.ok) {
        console.error(`TinyFish search failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as { results?: TinyFishSearchResultItem[] };
      // Search API has no result-count param -- slice to the requested limit ourselves.
      const items = (data.results ?? []).slice(0, limit);
      if (items.length === 0) return [];

      const contentByUrl = await this.fetchContent(items.map((item) => item.url));

      // Same guard as the Serper adapter: drop anything whose fetched page
      // came back missing or too thin (blocked / bot-walled / render failure).
      return items
        .map((item) => ({
          url: item.url,
          title: item.title ?? '',
          description: item.snippet ?? '',
          markdown: contentByUrl.get(item.url),
        }))
        .filter((r) => r.markdown && r.markdown.length >= MIN_CONTENT_CHARS);
    } catch (error) {
      console.error('TinyFish search error:', error);
      return [];
    }
  }

  async scrapeUrl(
    url: string
  ): Promise<{ data?: { markdown?: string; html?: string }; error?: string }> {
    // TinyFish returns one format per call, so fetch markdown + html in
    // parallel to match what the other adapters return from a single scrape.
    const [markdownMap, htmlMap] = await Promise.all([
      this.fetchContent([url], 'markdown'),
      this.fetchContent([url], 'html'),
    ]);
    const markdown = markdownMap.get(url);
    const html = htmlMap.get(url);
    if (!markdown && !html) return { error: `Failed to fetch ${url}` };
    return { data: { markdown, html } };
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
