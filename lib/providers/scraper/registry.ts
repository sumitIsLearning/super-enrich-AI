import { FirecrawlAdapter } from './adapters/firecrawl';
import { TavilyAdapter } from './adapters/tavily';
import { SerperAdapter } from './adapters/serper';
import { TinyFishAdapter } from './adapters/tinyfish';
import type { ScraperProvider, ScraperMeta } from './types';

const SCRAPER_META: ScraperMeta[] = [
  {
    id: 'firecrawl',
    displayName: 'Firecrawl',
    description: 'Full-page markdown extraction with JavaScript rendering. Highest content quality.',
    category: 'scraper',
    docsUrl: 'https://www.firecrawl.dev/app/api-keys',
  },
  {
    id: 'tavily',
    displayName: 'Tavily',
    description: 'AI-native search API. Returns search results with full page content in one call.',
    category: 'scraper',
    docsUrl: 'https://app.tavily.com',
  },
  {
    id: 'serper',
    displayName: 'Serper / SerpAPI',
    description: 'Google SERP results. Cheapest per call; page content fetched separately.',
    category: 'scraper',
    docsUrl: 'https://serper.dev',
  },
  {
    id: 'tinyfish',
    displayName: 'TinyFish',
    description: 'Search + real-browser fetch, built for agents. Handles JS-rendered pages. Free tier available.',
    category: 'scraper',
    docsUrl: 'https://docs.tinyfish.ai/',
  },
];

export function getScraper(id: string, apiKey: string): ScraperProvider {
  switch (id) {
    case 'firecrawl': return new FirecrawlAdapter(apiKey);
    case 'tavily':   return new TavilyAdapter(apiKey);
    case 'serper':   return new SerperAdapter(apiKey);
    case 'tinyfish': return new TinyFishAdapter(apiKey);
    default: throw new Error(`Unknown scraper id: ${id}`);
  }
}

export function listScrapers(): ScraperMeta[] {
  return SCRAPER_META;
}
