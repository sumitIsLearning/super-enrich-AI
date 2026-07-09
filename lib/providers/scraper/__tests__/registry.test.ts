import { describe, it, expect, vi } from 'vitest';
import { getScraper, listScrapers } from '../registry';
import { FirecrawlAdapter } from '../adapters/firecrawl';
import { TavilyAdapter } from '../adapters/tavily';
import { SerperAdapter } from '../adapters/serper';

vi.mock('../adapters/firecrawl', () => ({
  FirecrawlAdapter: vi.fn().mockImplementation(function (key: string) { return { id: 'firecrawl', _key: key }; }),
}));
vi.mock('../adapters/tavily', () => ({
  TavilyAdapter: vi.fn().mockImplementation(function (key: string) { return { id: 'tavily', _key: key }; }),
}));
vi.mock('../adapters/serper', () => ({
  SerperAdapter: vi.fn().mockImplementation(function (key: string) { return { id: 'serper', _key: key }; }),
}));

describe('scraper registry', () => {
  it('getScraper("firecrawl") returns FirecrawlAdapter', () => {
    const adapter = getScraper('firecrawl', 'key-abc');
    expect(adapter.id).toBe('firecrawl');
    expect(FirecrawlAdapter).toHaveBeenCalledWith('key-abc');
  });

  it('getScraper("tavily") returns TavilyAdapter', () => {
    const adapter = getScraper('tavily', 'tvly-key');
    expect(adapter.id).toBe('tavily');
  });

  it('getScraper("serper") returns SerperAdapter', () => {
    const adapter = getScraper('serper', 'serper-key');
    expect(adapter.id).toBe('serper');
  });

  it('getScraper with unknown id throws', () => {
    expect(() => getScraper('unknown', 'key')).toThrow('Unknown scraper id: unknown');
  });

  it('listScrapers returns all three with required fields', () => {
    const scrapers = listScrapers();
    expect(scrapers).toHaveLength(3);
    const ids = scrapers.map((s) => s.id);
    expect(ids).toContain('firecrawl');
    expect(ids).toContain('tavily');
    expect(ids).toContain('serper');
    scrapers.forEach((s) => {
      expect(s).toHaveProperty('displayName');
      expect(s).toHaveProperty('description');
      expect(s.category).toBe('scraper');
    });
  });
});
