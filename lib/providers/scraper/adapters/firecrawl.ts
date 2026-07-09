import { FirecrawlService } from '../../../services/firecrawl';
import type { ScraperProvider } from '../types';
import type { SearchResult } from '../../../types';

export class FirecrawlAdapter implements ScraperProvider {
  readonly id = 'firecrawl';
  readonly displayName = 'Firecrawl';
  private service: FirecrawlService;

  constructor(apiKey: string) {
    this.service = new FirecrawlService(apiKey);
  }

  search(query: string, opts?: { limit?: number; scrapeContent?: boolean }): Promise<SearchResult[]> {
    return this.service.search(query, opts);
  }

  scrapeUrl(url: string): Promise<{ data?: { markdown?: string; html?: string }; error?: string }> {
    return this.service.scrapeUrl(url);
  }

  searchWithMultipleQueries(
    queries: string[],
    opts?: { limit?: number; scrapeContent?: boolean }
  ): Promise<SearchResult[]> {
    return this.service.searchWithMultipleQueries(queries, opts);
  }
}
