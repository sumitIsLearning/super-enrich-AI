import type { SearchResult } from '../../types';

export interface ScraperProvider {
  readonly id: string;
  readonly displayName: string;
  search(
    query: string,
    opts?: { limit?: number; scrapeContent?: boolean }
  ): Promise<SearchResult[]>;
  scrapeUrl(url: string): Promise<{
    data?: { markdown?: string; html?: string };
    error?: string;
  }>;
  searchWithMultipleQueries(
    queries: string[],
    opts?: { limit?: number; scrapeContent?: boolean }
  ): Promise<SearchResult[]>;
}

export interface ScraperMeta {
  id: string;
  displayName: string;
  description: string;
  category: 'scraper';
  docsUrl: string;
}
