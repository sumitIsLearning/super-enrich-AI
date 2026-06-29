# SP1: Pluggable Providers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hard-wired Firecrawl + OpenAI with a registry-driven provider system so any run can use Firecrawl, Tavily, or Serper for scraping and OpenAI, Google Gemini, or OpenRouter for LLM extraction, selected via UI pickers before each run.

**Architecture:** New `lib/providers/` module with two registries (scraper + LLM). The orchestrator stops constructing services itself and instead receives a `ScraperProvider` and an `LLMExtractor`. The enrich route resolves provider instances from registries using `scraperId`/`llmModelId` from the request body. A `ProviderPicker` UI component lets the user choose before enriching.

**Tech Stack:** Vercel AI SDK v4 (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`), `@tavily/core`, Node `fetch` for Serper, `zod`, shadcn `Select` component, Next.js 15 App Router (Node runtime).

## Global Constraints

- No automatic provider selection — manual pick only; ranking is advisory (no scores yet in SP1).
- Env vars / `X-*-API-Key` request headers remain as fallback key sources (integration hub replaces this in SP4).
- New scraper providers must return the existing `SearchResult` type from `lib/types/index.ts` unchanged.
- Orchestrator behavior (phased agents, corroboration, confidence scoring, post-processing) preserved as-is — only the model/scraper call boundary changes.
- All new server code: Node runtime (`export const runtime = 'nodejs'`).
- TypeScript strict mode; no `any`.
- No `Co-Authored-By` in commit messages.

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `lib/providers/scraper/types.ts` | `ScraperProvider` interface |
| `lib/providers/scraper/adapters/firecrawl.ts` | Wraps existing `FirecrawlService` |
| `lib/providers/scraper/adapters/tavily.ts` | Tavily search adapter |
| `lib/providers/scraper/adapters/serper.ts` | Serper SERP adapter + content-fetch fallback |
| `lib/providers/scraper/fetch-content.ts` | HTTP fetch → plain text (used by Serper `scrapeUrl`) |
| `lib/providers/scraper/registry.ts` | `getScraper(id, apiKey)`, `listScrapers()` |
| `lib/providers/llm/types.ts` | `LLMModelInfo`, `LLMExtractor` interfaces |
| `lib/providers/llm/models-config.ts` | Static model catalog + pricing |
| `lib/providers/llm/registry.ts` | `getLLM(modelId, apiKey)`, `listModels()` |
| `lib/providers/llm/extraction.ts` | AI-SDK `generateObject`-based extraction (replaces OpenAI-specific calls in orchestrator) |
| `app/api/providers/route.ts` | `GET /api/providers` → scraper + model metadata |
| `app/super-enrich/provider-picker.tsx` | UI: scraper dropdown + LLM dropdown |

### Modified files
| Path | Change |
|------|--------|
| `lib/agent-architecture/orchestrator.ts` | Constructor accepts `ScraperProvider` + `LLMExtractor`; replace `this.firecrawl.*` and `this.openai.*` calls |
| `lib/strategies/agent-enrichment-strategy.ts` | Accept + forward `ScraperProvider` and `LLMExtractor` |
| `lib/types/index.ts` | Add `scraperId?: string`, `llmModelId?: string` to `EnrichmentRequest` |
| `app/api/enrich/route.ts` | Parse `scraperId`/`llmModelId`; resolve from registries; pass to strategy |
| `app/super-enrich/page.tsx` | Integrate `ProviderPicker`; thread state through to enrichment call |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json` (via pnpm)

**Interfaces:**
- Produces: `@ai-sdk/google`, `@openrouter/ai-sdk-provider`, `@tavily/core` available to import

- [ ] **Step 1: Install packages**

```bash
pnpm add @ai-sdk/google @openrouter/ai-sdk-provider @tavily/core
```

- [ ] **Step 2: Verify install succeeded**

```bash
pnpm list @ai-sdk/google @openrouter/ai-sdk-provider @tavily/core
```

Expected: three lines showing installed versions with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @ai-sdk/google, @openrouter/ai-sdk-provider, @tavily/core"
```

---

### Task 2: Scraper provider interface + Firecrawl adapter

**Files:**
- Create: `lib/providers/scraper/types.ts`
- Create: `lib/providers/scraper/adapters/firecrawl.ts`
- Test: `lib/providers/scraper/__tests__/firecrawl.test.ts`

**Interfaces:**
- Consumes: `SearchResult` from `lib/types/index.ts`, `FirecrawlService` from `lib/services/firecrawl.ts`
- Produces:
  ```ts
  interface ScraperProvider {
    readonly id: string;
    readonly displayName: string;
    search(query: string, opts?: { limit?: number; scrapeContent?: boolean }): Promise<SearchResult[]>;
    scrapeUrl(url: string): Promise<{ data?: { markdown?: string; html?: string }; error?: string }>;
    searchWithMultipleQueries(queries: string[], opts?: { limit?: number; scrapeContent?: boolean }): Promise<SearchResult[]>;
  }
  function getScraperMeta(id: string): { id: string; displayName: string; category: 'scraper' }
  ```

- [ ] **Step 1: Write the failing test**

Create `lib/providers/scraper/__tests__/firecrawl.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FirecrawlService before importing adapter
vi.mock('../../services/firecrawl', () => ({
  FirecrawlService: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue([
      { url: 'https://example.com', title: 'Example', description: 'Test', markdown: '# Example' },
    ]),
    scrapeUrl: vi.fn().mockResolvedValue({
      data: { markdown: '# About', html: '<h1>About</h1>' },
    }),
    searchWithMultipleQueries: vi.fn().mockResolvedValue([
      { url: 'https://example.com', title: 'Example', description: 'Test', markdown: '# Example' },
    ]),
  })),
}));

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/providers/scraper/__tests__/firecrawl.test.ts
```

Expected: FAIL — `FirecrawlAdapter` not found.

- [ ] **Step 3: Create `lib/providers/scraper/types.ts`**

```ts
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
```

- [ ] **Step 4: Create `lib/providers/scraper/adapters/firecrawl.ts`**

```ts
import { FirecrawlService } from '../../services/firecrawl';
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm vitest run lib/providers/scraper/__tests__/firecrawl.test.ts
```

Expected: PASS — 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/providers/scraper/types.ts lib/providers/scraper/adapters/firecrawl.ts lib/providers/scraper/__tests__/firecrawl.test.ts
git commit -m "feat: ScraperProvider interface and Firecrawl adapter"
```

---

### Task 3: Content fetcher (Serper scrapeUrl fallback)

Serper is search-only (no page content). `scrapeUrl()` falls back to a plain HTTP fetch + HTML-to-text strip.

**Files:**
- Create: `lib/providers/scraper/fetch-content.ts`
- Test: `lib/providers/scraper/__tests__/fetch-content.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function fetchPageContent(url: string): Promise<{ markdown?: string; html?: string } | null>
  ```

- [ ] **Step 1: Write the failing test**

Create `lib/providers/scraper/__tests__/fetch-content.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPageContent } from '../fetch-content';

describe('fetchPageContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns markdown text extracted from HTML', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<html><head><title>Acme Corp</title></head>
           <body><h1>About Acme</h1><p>We build great things.</p></body></html>`
        ),
    } as unknown as Response);

    const result = await fetchPageContent('https://acme.com/about');
    expect(result).not.toBeNull();
    expect(result?.markdown).toContain('About Acme');
    expect(result?.markdown).toContain('We build great things');
  });

  it('returns null when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await fetchPageContent('https://bad-url.com');
    expect(result).toBeNull();
  });

  it('returns null on non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
    } as unknown as Response);
    const result = await fetchPageContent('https://example.com/missing');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/providers/scraper/__tests__/fetch-content.test.ts
```

Expected: FAIL — `fetchPageContent` not found.

- [ ] **Step 3: Create `lib/providers/scraper/fetch-content.ts`**

```ts
const FETCH_TIMEOUT_MS = 10_000;

// Strip HTML tags, collapse whitespace → plain text usable as "markdown"
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50_000);
}

export async function fetchPageContent(
  url: string
): Promise<{ markdown?: string; html?: string } | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SuperEnrich/1.0)' },
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    const html = await response.text();
    const markdown = htmlToText(html);
    return { markdown, html: html.substring(0, 100_000) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/providers/scraper/__tests__/fetch-content.test.ts
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/providers/scraper/fetch-content.ts lib/providers/scraper/__tests__/fetch-content.test.ts
git commit -m "feat: fetchPageContent utility for Serper scrapeUrl fallback"
```

---

### Task 4: Tavily adapter

**Files:**
- Create: `lib/providers/scraper/adapters/tavily.ts`
- Test: `lib/providers/scraper/__tests__/tavily.test.ts`

**Interfaces:**
- Consumes: `ScraperProvider` from `lib/providers/scraper/types.ts`, `SearchResult` from `lib/types/index.ts`, `@tavily/core`
- Produces: `TavilyAdapter implements ScraperProvider`

- [ ] **Step 1: Write the failing test**

Create `lib/providers/scraper/__tests__/tavily.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/providers/scraper/__tests__/tavily.test.ts
```

Expected: FAIL — `TavilyAdapter` not found.

- [ ] **Step 3: Create `lib/providers/scraper/adapters/tavily.ts`**

```ts
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
    // Tavily doesn't expose a dedicated scrape endpoint; use fetch-content fallback
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/providers/scraper/__tests__/tavily.test.ts
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/providers/scraper/adapters/tavily.ts lib/providers/scraper/__tests__/tavily.test.ts
git commit -m "feat: Tavily scraper adapter"
```

---

### Task 5: Serper adapter

**Files:**
- Create: `lib/providers/scraper/adapters/serper.ts`
- Test: `lib/providers/scraper/__tests__/serper.test.ts`

**Interfaces:**
- Consumes: `ScraperProvider`, `SearchResult`, `fetchPageContent` from `lib/providers/scraper/fetch-content.ts`
- Produces: `SerperAdapter implements ScraperProvider`

Serper API: `POST https://google.serper.dev/search` with header `X-API-KEY`.

- [ ] **Step 1: Write the failing test**

Create `lib/providers/scraper/__tests__/serper.test.ts`:

```ts
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
    // First call is for the scrape (fetchPageContent uses fetch internally)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('<html><body><p>Acme builds things.</p></body></html>'),
    });
    const result = await adapter.scrapeUrl('https://acme.com');
    expect(result.data?.markdown).toContain('Acme builds things');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/providers/scraper/__tests__/serper.test.ts
```

Expected: FAIL — `SerperAdapter` not found.

- [ ] **Step 3: Create `lib/providers/scraper/adapters/serper.ts`**

```ts
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

      return (data.organic ?? []).map((item) => ({
        url: item.link,
        title: item.title ?? '',
        description: item.snippet ?? '',
        // Serper returns snippets only — no full page content
      }));
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/providers/scraper/__tests__/serper.test.ts
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/providers/scraper/adapters/serper.ts lib/providers/scraper/__tests__/serper.test.ts
git commit -m "feat: Serper scraper adapter with fetch-content fallback"
```

---

### Task 6: Scraper registry

**Files:**
- Create: `lib/providers/scraper/registry.ts`
- Test: `lib/providers/scraper/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: All three adapters
- Produces:
  ```ts
  function getScraper(id: string, apiKey: string): ScraperProvider
  function listScrapers(): ScraperMeta[]
  ```

- [ ] **Step 1: Write the failing test**

Create `lib/providers/scraper/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getScraper, listScrapers } from '../registry';
import { FirecrawlAdapter } from '../adapters/firecrawl';
import { TavilyAdapter } from '../adapters/tavily';
import { SerperAdapter } from '../adapters/serper';

vi.mock('../adapters/firecrawl', () => ({
  FirecrawlAdapter: vi.fn().mockImplementation((key: string) => ({ id: 'firecrawl', _key: key })),
}));
vi.mock('../adapters/tavily', () => ({
  TavilyAdapter: vi.fn().mockImplementation((key: string) => ({ id: 'tavily', _key: key })),
}));
vi.mock('../adapters/serper', () => ({
  SerperAdapter: vi.fn().mockImplementation((key: string) => ({ id: 'serper', _key: key })),
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/providers/scraper/__tests__/registry.test.ts
```

Expected: FAIL — `registry` module not found.

- [ ] **Step 3: Create `lib/providers/scraper/registry.ts`**

```ts
import { FirecrawlAdapter } from './adapters/firecrawl';
import { TavilyAdapter } from './adapters/tavily';
import { SerperAdapter } from './adapters/serper';
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
];

export function getScraper(id: string, apiKey: string): ScraperProvider {
  switch (id) {
    case 'firecrawl': return new FirecrawlAdapter(apiKey);
    case 'tavily':   return new TavilyAdapter(apiKey);
    case 'serper':   return new SerperAdapter(apiKey);
    default: throw new Error(`Unknown scraper id: ${id}`);
  }
}

export function listScrapers(): ScraperMeta[] {
  return SCRAPER_META;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/providers/scraper/__tests__/registry.test.ts
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/providers/scraper/registry.ts lib/providers/scraper/__tests__/registry.test.ts
git commit -m "feat: scraper registry with Firecrawl, Tavily, Serper"
```

---

### Task 7: LLM types, model config, and registry

**Files:**
- Create: `lib/providers/llm/types.ts`
- Create: `lib/providers/llm/models-config.ts`
- Create: `lib/providers/llm/registry.ts`
- Test: `lib/providers/llm/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: `@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`
- Produces:
  ```ts
  interface LLMModelInfo {
    id: string;           // 'openai:gpt-4o' | 'google:gemini-2.5-pro' | 'openrouter:...'
    providerId: 'openai' | 'google' | 'openrouter';
    displayName: string;
    pricing: { inputPer1M: number; outputPer1M: number };
  }
  function getLLM(modelId: string, apiKey: string): LanguageModel
  function listModels(): LLMModelInfo[]
  ```

- [ ] **Step 1: Write the failing test**

Create `lib/providers/llm/__tests__/registry.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ provider: 'openai-mock' })),
}));
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ provider: 'google-mock' })),
}));
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ provider: 'openrouter-mock' })),
}));

import { getLLM, listModels } from '../registry';

describe('LLM registry', () => {
  it('getLLM("openai:gpt-4o") returns an AI SDK model', () => {
    const model = getLLM('openai:gpt-4o', 'sk-test');
    expect(model).toBeDefined();
  });

  it('getLLM("google:gemini-2.5-pro") returns an AI SDK model', () => {
    const model = getLLM('google:gemini-2.5-pro', 'google-key');
    expect(model).toBeDefined();
  });

  it('getLLM("openrouter:anthropic/claude-3-5-sonnet") returns an AI SDK model', () => {
    const model = getLLM('openrouter:anthropic/claude-3-5-sonnet', 'or-key');
    expect(model).toBeDefined();
  });

  it('getLLM with unknown id throws', () => {
    expect(() => getLLM('unknown:model', 'key')).toThrow('Unknown LLM model id: unknown:model');
  });

  it('listModels returns models with required fields', () => {
    const models = listModels();
    expect(models.length).toBeGreaterThan(0);
    models.forEach((m) => {
      expect(m.id).toMatch(/^(openai|google|openrouter):/);
      expect(m.displayName).toBeTruthy();
      expect(m.pricing.inputPer1M).toBeGreaterThanOrEqual(0);
      expect(m.pricing.outputPer1M).toBeGreaterThanOrEqual(0);
    });
  });

  it('listModels includes openai, google, and openrouter providers', () => {
    const models = listModels();
    const providerIds = new Set(models.map((m) => m.providerId));
    expect(providerIds).toContain('openai');
    expect(providerIds).toContain('google');
    expect(providerIds).toContain('openrouter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/providers/llm/__tests__/registry.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `lib/providers/llm/types.ts`**

```ts
import type { LanguageModel } from 'ai';

export interface LLMModelInfo {
  id: string;
  providerId: 'openai' | 'google' | 'openrouter';
  displayName: string;
  description: string;
  pricing: { inputPer1M: number; outputPer1M: number };
  contextWindow: number;
}

export type { LanguageModel };
```

- [ ] **Step 4: Create `lib/providers/llm/models-config.ts`**

Prices from provider docs as of 2026-06 (USD per 1M tokens).

```ts
import type { LLMModelInfo } from './types';

export const MODELS_CONFIG: LLMModelInfo[] = [
  // OpenAI
  {
    id: 'openai:gpt-4o',
    providerId: 'openai',
    displayName: 'GPT-4o',
    description: 'OpenAI flagship multimodal. Best quality for structured extraction.',
    pricing: { inputPer1M: 2.5, outputPer1M: 10 },
    contextWindow: 128_000,
  },
  {
    id: 'openai:gpt-4o-mini',
    providerId: 'openai',
    displayName: 'GPT-4o mini',
    description: 'Lightweight OpenAI model. Fast and cost-effective.',
    pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
    contextWindow: 128_000,
  },
  // Google Gemini
  {
    id: 'google:gemini-2.5-pro',
    providerId: 'google',
    displayName: 'Gemini 2.5 Pro',
    description: 'Google Gemini flagship with 1M context. Strong at multi-source synthesis.',
    pricing: { inputPer1M: 1.25, outputPer1M: 10 },
    contextWindow: 1_000_000,
  },
  {
    id: 'google:gemini-2.5-flash',
    providerId: 'google',
    displayName: 'Gemini 2.5 Flash',
    description: 'Fast Gemini model. Good balance of quality and cost.',
    pricing: { inputPer1M: 0.075, outputPer1M: 0.3 },
    contextWindow: 1_000_000,
  },
  // OpenRouter (examples — user supplies model slug)
  {
    id: 'openrouter:anthropic/claude-sonnet-4-5',
    providerId: 'openrouter',
    displayName: 'Claude Sonnet 4.5 (via OpenRouter)',
    description: 'Anthropic Claude via OpenRouter. Strong reasoning and long-context understanding.',
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    contextWindow: 200_000,
  },
  {
    id: 'openrouter:meta-llama/llama-3.3-70b-instruct',
    providerId: 'openrouter',
    displayName: 'Llama 3.3 70B (via OpenRouter)',
    description: 'Open-weight Llama via OpenRouter. Very low cost.',
    pricing: { inputPer1M: 0.12, outputPer1M: 0.3 },
    contextWindow: 128_000,
  },
];
```

- [ ] **Step 5: Create `lib/providers/llm/registry.ts`**

```ts
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel, LLMModelInfo } from './types';
import { MODELS_CONFIG } from './models-config';

export function getLLM(modelId: string, apiKey: string): LanguageModel {
  const [providerId, ...rest] = modelId.split(':');
  const modelSlug = rest.join(':');

  switch (providerId) {
    case 'openai': {
      const provider = createOpenAI({ apiKey });
      return provider(modelSlug);
    }
    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider(modelSlug);
    }
    case 'openrouter': {
      const provider = createOpenRouter({ apiKey });
      return provider(modelSlug);
    }
    default:
      throw new Error(`Unknown LLM model id: ${modelId}`);
  }
}

export function listModels(): LLMModelInfo[] {
  return MODELS_CONFIG;
}

export function getModelInfo(modelId: string): LLMModelInfo | undefined {
  return MODELS_CONFIG.find((m) => m.id === modelId);
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pnpm vitest run lib/providers/llm/__tests__/registry.test.ts
```

Expected: PASS — 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/providers/llm/types.ts lib/providers/llm/models-config.ts lib/providers/llm/registry.ts lib/providers/llm/__tests__/registry.test.ts
git commit -m "feat: LLM registry with OpenAI, Gemini, OpenRouter via AI SDK"
```

---

### Task 8: LLM extraction client

Replace the OpenAI-specific `zodResponseFormat` + `client.chat.completions.create()` calls with AI-SDK `generateObject`. This is the single extraction code path all providers use.

**Files:**
- Create: `lib/providers/llm/extraction.ts`
- Test: `lib/providers/llm/__tests__/extraction.test.ts`

**Interfaces:**
- Consumes: `generateObject` from `ai`, `LanguageModel`, `EnrichmentField`, `EnrichmentResult` from `lib/types`
- The existing `createCorroboratedEnrichmentSchema` and `createEnrichmentSchema` from `lib/services/openai.ts` are **copied** here (not imported, to avoid coupling to the OpenAI service class).
- Produces:
  ```ts
  interface LLMExtractor {
    extractStructuredDataWithCorroboration(
      content: string,
      fields: EnrichmentField[],
      context: Record<string, string>,
      onMessage?: (msg: string, type: 'info' | 'success' | 'warning' | 'agent') => void
    ): Promise<Record<string, EnrichmentResult>>;
    
    extractStructuredDataOriginal(
      content: string,
      fields: EnrichmentField[],
      context: Record<string, string>
    ): Promise<Record<string, EnrichmentResult>>;
  }
  function createLLMExtractor(model: LanguageModel): LLMExtractor
  ```

- [ ] **Step 1: Write the failing test**

Create `lib/providers/llm/__tests__/extraction.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { EnrichmentField } from '../../../types';

// Mock 'ai' generateObject
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      companyName: {
        evidence: [
          {
            value: 'Acme Corp',
            source_url: 'https://acme.com',
            exact_text: 'Acme Corp was founded in 2015.',
            confidence: 0.95,
          },
        ],
        consensus_value: 'Acme Corp',
        consensus_confidence: 0.95,
        sources_agree: true,
      },
    },
    usage: { promptTokens: 100, completionTokens: 50 },
  }),
}));

import { createLLMExtractor } from '../extraction';

const mockModel = {} as import('ai').LanguageModel;

const fields: EnrichmentField[] = [
  {
    name: 'companyName',
    displayName: 'Company Name',
    description: 'The name of the company',
    type: 'string',
    required: false,
  },
];

describe('createLLMExtractor', () => {
  it('extractStructuredDataWithCorroboration returns EnrichmentResult map', async () => {
    const extractor = createLLMExtractor(mockModel);
    const results = await extractor.extractStructuredDataWithCorroboration(
      'URL: https://acme.com\nAcme Corp was founded in 2015.',
      fields,
      { companyName: 'Acme Corp' }
    );
    expect(results).toHaveProperty('companyName');
    expect(results.companyName.value).toBe('Acme Corp');
    expect(results.companyName.confidence).toBeGreaterThan(0.3);
  });

  it('filters out low-confidence results (< 0.3)', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        companyName: {
          evidence: [],
          consensus_value: null,
          consensus_confidence: 0.1,
          sources_agree: false,
        },
      },
      usage: { promptTokens: 50, completionTokens: 20 },
    } as never);

    const extractor = createLLMExtractor(mockModel);
    const results = await extractor.extractStructuredDataWithCorroboration(
      'No data here',
      fields,
      {}
    );
    expect(results).not.toHaveProperty('companyName');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/providers/llm/__tests__/extraction.test.ts
```

Expected: FAIL — `createLLMExtractor` not found.

- [ ] **Step 3: Create `lib/providers/llm/extraction.ts`**

This file ports the logic from `lib/services/openai.ts` (`extractStructuredDataWithCorroboration`, `extractStructuredDataOriginal`) to use `generateObject` from the AI SDK instead of the OpenAI-specific API. The system prompts and post-processing logic are preserved exactly.

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import type { EnrichmentField, EnrichmentResult } from '../../types';

// ── Schema builders (same logic as OpenAIService, decoupled from that class) ──

function buildEnrichmentSchema(fields: EnrichmentField[]) {
  const schemaProps: Record<string, z.ZodTypeAny> = {};
  const confidenceProps: Record<string, z.ZodTypeAny> = {};
  const sourceProps: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let base: z.ZodTypeAny;
    switch (field.type) {
      case 'number':  base = z.number(); break;
      case 'boolean': base = z.boolean(); break;
      case 'array':   base = z.array(z.string()); break;
      default:        base = z.string();
    }
    schemaProps[field.name] = field.required ? base : base.nullable();
    confidenceProps[`${field.name}_confidence`] = z.number().min(0).max(1);
    sourceProps[`${field.name}_sources`] = z
      .array(z.object({ url: z.string(), quote: z.string() }))
      .nullable();
  });

  return z.object({ ...schemaProps, ...confidenceProps, ...sourceProps });
}

function buildCorroboratedSchema(fields: EnrichmentField[]) {
  const schemaProps: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let valueSchema: z.ZodTypeAny;
    switch (field.type) {
      case 'number':  valueSchema = z.number().nullable(); break;
      case 'boolean': valueSchema = z.boolean().nullable(); break;
      case 'array':   valueSchema = z.array(z.string()).nullable(); break;
      default:        valueSchema = z.string().nullable();
    }
    schemaProps[field.name] = z.object({
      evidence: z.array(
        z.object({
          value: valueSchema,
          source_url: z.string(),
          exact_text: z.string(),
          confidence: z.number().min(0).max(1),
        })
      ),
      consensus_value: valueSchema,
      consensus_confidence: z.number().min(0).max(1),
      sources_agree: z.boolean(),
    });
  });

  return z.object(schemaProps);
}

// ── Context helpers ──

function formatContext(context: Record<string, string>): string {
  return Object.entries(context)
    .map(([key, value]) => {
      if (key === 'targetDomain' && value)
        return `Company Domain: ${value} (content from this domain is likely the target company)`;
      if (key === 'name' || key === '_parsed_name') return `Person Name: ${value}`;
      return `${key}: ${value}`;
    })
    .filter((line) => !line.includes('undefined'))
    .join('\n');
}

const MAX_CONTENT_CHARS = 400_000;

function trimContent(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) return content;
  return content.substring(0, MAX_CONTENT_CHARS) + '\n\n[Content truncated due to length...]';
}

// ── Post-processing helpers (same logic as OpenAIService) ──

function normalizeValue(value: unknown, field: EnrichmentField): unknown {
  if (value === '/' || value === '-' || value === 'N/A' || value === 'n/a') return null;

  if (value !== null && value !== undefined) {
    const name = field.name;
    if ((name === 'employeeCount' || field.displayName === 'Employee Count') && typeof value === 'number') {
      if (value > 1_000_000) return null;
    }
    if ((name === 'yearFounded' || field.displayName === 'Year Founded') && typeof value === 'number') {
      if (value < 1800 || value > new Date().getFullYear()) return null;
    }
    if ((name === 'fundingStage' || field.displayName === 'Funding Stage') && typeof value === 'string') {
      const lc = value.toLowerCase();
      if (lc.includes('seed') && !lc.includes('pre')) return 'Seed';
      if (lc.includes('pre-seed') || lc.includes('preseed')) return 'Pre-seed';
      const series = lc.match(/series\s*([a-e])/i)?.[1]?.toUpperCase();
      if (series) return `Series ${series}`;
    }
  }
  return value;
}

// ── Public interface ──

export interface LLMExtractor {
  extractStructuredDataWithCorroboration(
    content: string,
    fields: EnrichmentField[],
    context: Record<string, string>,
    onMessage?: (msg: string, type: 'info' | 'success' | 'warning' | 'agent') => void
  ): Promise<Record<string, EnrichmentResult>>;

  extractStructuredDataOriginal(
    content: string,
    fields: EnrichmentField[],
    context: Record<string, string>
  ): Promise<Record<string, EnrichmentResult>>;
}

export function createLLMExtractor(model: LanguageModel): LLMExtractor {
  return {
    async extractStructuredDataWithCorroboration(content, fields, context, onMessage) {
      const schema = buildCorroboratedSchema(fields);
      const fieldDescriptions = fields.map((f) => `- ${f.name}: ${f.description}`).join('\n');
      const contextInfo = formatContext(context);
      const customInstructions = context.instruction
        ? `\n\n**SPECIFIC INSTRUCTIONS FOR THIS EXTRACTION**:\n${context.instruction}`
        : '';

      const systemPrompt = `You are an expert data extractor. Extract information with evidence from each source.

**CRITICAL INSTRUCTIONS**:
1. For EACH field, find ALL mentions across ALL sources
2. Return an array of evidence for each field
3. Each evidence entry must include value, source_url (ONLY from "URL:" lines in the content), exact_text (verbatim sentence containing the value), and confidence
4. ONLY include evidence that is EXPLICITLY STATED in the content
5. DO NOT make up or infer values. If not found, consensus_value = null
6. NEVER use placeholder values like "/", "-", "N/A" — use null
7. ALWAYS capitalize fields properly (company names, industry names, job titles)
8. exact_text must be a complete sentence from the content that contains the value (20-200 chars)
9. DO NOT use page titles or headers as exact_text${customInstructions}

Context about the entity:
${contextInfo}

Fields to extract:
${fieldDescriptions}`;

      const { object } = await generateObject({
        model,
        schema,
        system: systemPrompt,
        prompt: trimContent(content),
        temperature: 0.1,
      });

      const results: Record<string, EnrichmentResult> = {};

      for (const field of fields) {
        const fieldData = (object as Record<string, {
          evidence: Array<{ value: unknown; source_url: string; exact_text: string; confidence: number }>;
          consensus_value: unknown;
          consensus_confidence: number;
          sources_agree: boolean;
        }>)[field.name];

        if (!fieldData) continue;

        const rawValue = normalizeValue(fieldData.consensus_value, field);
        if (rawValue === null || rawValue === undefined) continue;
        if (fieldData.consensus_confidence < 0.3) continue;

        const validEvidence = fieldData.evidence.filter(
          (e) => e.value !== null && e.confidence >= 0.2 && e.exact_text?.trim().length > 0
        );

        const sourceContext = validEvidence
          .filter((e) => e.source_url && e.source_url.startsWith('http'))
          .map((e) => ({ url: e.source_url, snippet: e.exact_text }));

        results[field.name] = {
          field: field.name,
          value: rawValue as string | number | boolean | string[],
          confidence: fieldData.consensus_confidence,
          source: validEvidence
            .filter((e) => e.source_url?.startsWith('http'))
            .map((e) => e.source_url)
            .slice(0, 2)
            .join(', '),
          sourceContext: sourceContext.length > 0 ? sourceContext : undefined,
          corroboration: {
            evidence: validEvidence.map((e) => ({
              value: e.value as string | number | boolean | string[],
              source_url: e.source_url,
              exact_text: e.exact_text,
              confidence: e.confidence,
            })),
            sources_agree: fieldData.sources_agree,
          },
        };

        onMessage?.(`Extracted ${field.name}: ${String(rawValue).substring(0, 60)}`, 'success');
      }

      return results;
    },

    async extractStructuredDataOriginal(content, fields, context) {
      const schema = buildEnrichmentSchema(fields);
      const fieldDescriptions = fields.map((f) => `- ${f.name}: ${f.description}`).join('\n');
      const contextInfo = formatContext(context);

      const systemPrompt = `You are an expert data extractor. Extract the requested information from the provided content with high accuracy.

**CRITICAL RULE**: ONLY extract information that is EXPLICITLY STATED in the content. DO NOT make up, guess, or infer values. If not found, return null.

For each field provide: the extracted value (or null), a confidence score (0-1), and a sources array with url and quote.

Confidence: 1.0 = explicitly stated; 0.8-0.9 = clearly present; 0.5-0.7 = some inference; 0.3-0.4 = unclear; 0.0 = not found.

TARGET ENTITY:
${contextInfo}

Fields to extract:
${fieldDescriptions}`;

      const { object } = await generateObject({
        model,
        schema,
        system: systemPrompt,
        prompt: trimContent(content),
      });

      const parsed = object as Record<string, unknown>;
      const results: Record<string, EnrichmentResult> = {};

      for (const field of fields) {
        let value = normalizeValue(parsed[field.name], field);
        const confidence = parsed[`${field.name}_confidence`] as number;
        const sources = parsed[`${field.name}_sources`] as Array<{ url: string; quote: string }> | null;

        value = normalizeValue(value, field);
        if (value === null || value === undefined || confidence <= 0.3) continue;

        results[field.name] = {
          field: field.name,
          value: value as string | number | boolean | string[],
          confidence,
          source: sources ? sources.map((s) => s.url).join(', ') : 'structured_extraction',
          sourceContext: sources
            ? sources.map((s) => ({ url: s.url, snippet: s.quote }))
            : undefined,
        };
      }

      return results;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/providers/llm/__tests__/extraction.test.ts
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/providers/llm/extraction.ts lib/providers/llm/__tests__/extraction.test.ts
git commit -m "feat: AI SDK generateObject extraction client (provider-agnostic LLM extraction)"
```

---

### Task 9: Refactor orchestrator to accept providers

The orchestrator currently constructs `FirecrawlService` and `OpenAIService` itself. Change it to accept a `ScraperProvider` and `LLMExtractor` via the constructor. All `this.firecrawl.*` and `this.openai.*` calls become `this.scraper.*` and `this.llm.*`.

**Files:**
- Modify: `lib/agent-architecture/orchestrator.ts`

**Interfaces:**
- Consumes: `ScraperProvider` from `lib/providers/scraper/types.ts`, `LLMExtractor` from `lib/providers/llm/extraction.ts`
- Produces: same public `enrichRow()` method signature — no external callers need to change other than `AgentEnrichmentStrategy`

- [ ] **Step 1: Write the failing test**

The test verifies the constructor no longer needs raw API keys, and that `enrichRow` calls the injected providers.

Add to `lib/agent-architecture/__tests__/orchestrator.test.ts` (create file):

```ts
import { describe, it, expect, vi } from 'vitest';
import { AgentOrchestrator } from '../orchestrator';
import type { ScraperProvider } from '../../providers/scraper/types';
import type { LLMExtractor } from '../../providers/llm/extraction';
import type { EnrichmentField } from '../../types';

const mockScraper: ScraperProvider = {
  id: 'mock',
  displayName: 'Mock',
  search: vi.fn().mockResolvedValue([
    { url: 'https://acme.com', title: 'Acme', description: 'Builds things', markdown: '# Acme\nFounded 2010' },
  ]),
  scrapeUrl: vi.fn().mockResolvedValue({ data: { markdown: '# Acme\nWe build things.' } }),
  searchWithMultipleQueries: vi.fn().mockResolvedValue([]),
};

const mockExtractor: LLMExtractor = {
  extractStructuredDataWithCorroboration: vi.fn().mockResolvedValue({
    companyName: { field: 'companyName', value: 'Acme Corp', confidence: 0.9 },
  }),
  extractStructuredDataOriginal: vi.fn().mockResolvedValue({}),
};

describe('AgentOrchestrator (injected providers)', () => {
  it('constructs with ScraperProvider + LLMExtractor (no raw API keys)', () => {
    expect(() => new AgentOrchestrator(mockScraper, mockExtractor)).not.toThrow();
  });

  it('enrichRow calls scraper.search at least once', async () => {
    const orchestrator = new AgentOrchestrator(mockScraper, mockExtractor);
    const fields: EnrichmentField[] = [
      { name: 'companyName', displayName: 'Company Name', description: 'Company name', type: 'string', required: false },
    ];
    await orchestrator.enrichRow({ email: 'alice@acme.com' }, fields, 'email');
    expect(mockScraper.search).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/agent-architecture/__tests__/orchestrator.test.ts
```

Expected: FAIL — constructor signature mismatch.

- [ ] **Step 3: Update orchestrator constructor and field types**

At the top of `lib/agent-architecture/orchestrator.ts`, replace the import/constructor block:

**Remove:**
```ts
import { FirecrawlService } from '../services/firecrawl';
import { OpenAIService } from '../services/openai';
```

**Add:**
```ts
import type { ScraperProvider } from '../providers/scraper/types';
import type { LLMExtractor } from '../providers/llm/extraction';
```

**Replace the class definition start:**

Old:
```ts
export class AgentOrchestrator {
  private firecrawl: FirecrawlService;
  private openai: OpenAIService;
  
  constructor(
    private firecrawlApiKey: string,
    private openaiApiKey: string
  ) {
    this.firecrawl = new FirecrawlService(firecrawlApiKey);
    this.openai = new OpenAIService(openaiApiKey);
  }
```

New:
```ts
export class AgentOrchestrator {
  private scraper: ScraperProvider;
  private llm: LLMExtractor;

  constructor(scraper: ScraperProvider, llm: LLMExtractor) {
    this.scraper = scraper;
    this.llm = llm;
  }
```

- [ ] **Step 4: Replace all `this.firecrawl` references with `this.scraper`**

In the orchestrator, every `this.firecrawl.search(` → `this.scraper.search(` and every `this.firecrawl.scrapeUrl(` → `this.scraper.scrapeUrl(`.

There are 11 calls total (8× search, 3× scrapeUrl). Use find-replace in the file:

```bash
# Verify counts before replacing
grep -c "this\.firecrawl\." lib/agent-architecture/orchestrator.ts
```

Expected: 11

Replace all occurrences (the file is 2194 lines; use Edit tool for each unique context, or do a global replace):

```
this.firecrawl.search(  →  this.scraper.search(
this.firecrawl.scrapeUrl(  →  this.scraper.scrapeUrl(
```

- [ ] **Step 5: Replace all `this.openai` references with `this.llm`**

There are 6 call sites using the pattern:
```ts
typeof this.openai.extractStructuredDataWithCorroboration === 'function'
  ? await this.openai.extractStructuredDataWithCorroboration(...)
  : await this.openai.extractStructuredDataOriginal(...)
```

`LLMExtractor` always has both methods (no `typeof` guard needed). Replace each block with:
```ts
await this.llm.extractStructuredDataWithCorroboration(
  combinedContent,
  fields,
  enrichmentContext,
  onAgentProgress
)
```

The one call using `extractStructuredDataOriginal` directly (line ~2035) becomes:
```ts
await this.llm.extractStructuredDataOriginal(
  combinedContent,
  fields,
  enrichmentContext
)
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pnpm vitest run lib/agent-architecture/__tests__/orchestrator.test.ts
```

Expected: PASS — 2 tests pass.

- [ ] **Step 7: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors related to orchestrator.

- [ ] **Step 8: Commit**

```bash
git add lib/agent-architecture/orchestrator.ts lib/agent-architecture/__tests__/orchestrator.test.ts
git commit -m "refactor: orchestrator accepts ScraperProvider + LLMExtractor (provider-agnostic)"
```

---

### Task 10: Refactor strategy + extend EnrichmentRequest

**Files:**
- Modify: `lib/strategies/agent-enrichment-strategy.ts`
- Modify: `lib/types/index.ts`

**Interfaces:**
- Consumes: `ScraperProvider`, `LLMExtractor`, `getLLM`, `getScraper` registries
- `AgentEnrichmentStrategy` now receives pre-built `ScraperProvider` and `LLMExtractor` (callers resolve from registry)

- [ ] **Step 1: Add `scraperId` and `llmModelId` to `EnrichmentRequest` in `lib/types/index.ts`**

Open `lib/types/index.ts` and extend `EnrichmentRequest`:

```ts
export interface EnrichmentRequest {
  rows: CSVRow[];
  fields: EnrichmentField[];
  emailColumn: string;
  nameColumn?: string;
  useAgents?: boolean;
  useV2Architecture?: boolean;
  scraperId?: string;    // e.g. 'firecrawl' | 'tavily' | 'serper'
  llmModelId?: string;  // e.g. 'openai:gpt-4o' | 'google:gemini-2.5-pro'
}
```

- [ ] **Step 2: Update `AgentEnrichmentStrategy` to accept providers**

Replace `lib/strategies/agent-enrichment-strategy.ts`:

```ts
import { AgentOrchestrator } from '../agent-architecture';
import type { CSVRow, EnrichmentField, RowEnrichmentResult, EnrichmentResult } from '../types';
import { shouldSkipEmail, loadSkipList, getSkipReason } from '../utils/skip-list';
import type { ScraperProvider } from '../providers/scraper/types';
import type { LLMExtractor } from '../providers/llm/extraction';

export class AgentEnrichmentStrategy {
  private orchestrator: AgentOrchestrator;

  constructor(scraper: ScraperProvider, llm: LLMExtractor) {
    this.orchestrator = new AgentOrchestrator(scraper, llm);
  }

  async enrichRow(
    row: CSVRow,
    fields: EnrichmentField[],
    emailColumn: string,
    onProgress?: (field: string, value: unknown) => void,
    onAgentProgress?: (message: string, type: 'info' | 'success' | 'warning' | 'agent') => void
  ): Promise<RowEnrichmentResult> {
    const email = row[emailColumn];
    console.log(`[AgentEnrichmentStrategy] Starting enrichment for email: ${email}`);

    if (!email) {
      return {
        rowIndex: 0,
        originalData: row,
        enrichments: {},
        status: 'error',
        error: 'No email found in specified column',
      };
    }

    const skipList = await loadSkipList();
    if (shouldSkipEmail(email, skipList)) {
      const skipReason = getSkipReason(email, skipList);
      return {
        rowIndex: 0,
        originalData: row,
        enrichments: {},
        status: 'skipped',
        error: skipReason,
      };
    }

    try {
      const result = await this.orchestrator.enrichRow(
        row,
        fields,
        emailColumn,
        onProgress,
        onAgentProgress
      );

      const filteredEnrichments: Record<string, EnrichmentResult> = {};
      for (const [key, enrichment] of Object.entries(result.enrichments)) {
        if (enrichment.value !== null) {
          filteredEnrichments[key] = enrichment as EnrichmentResult;
        }
      }

      return { ...result, enrichments: filteredEnrichments };
    } catch (error) {
      console.error('[AgentEnrichmentStrategy] Enrichment error:', error);
      return {
        rowIndex: 0,
        originalData: row,
        enrichments: {},
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no type errors in `agent-enrichment-strategy.ts` or `orchestrator.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/strategies/agent-enrichment-strategy.ts lib/types/index.ts
git commit -m "refactor: AgentEnrichmentStrategy accepts providers; add scraperId/llmModelId to EnrichmentRequest"
```

---

### Task 11: Update enrich route + add providers API route

**Files:**
- Modify: `app/api/enrich/route.ts`
- Create: `app/api/providers/route.ts`

**Interfaces:**
- Consumes: `getScraper`, `getLLM`, `listScrapers`, `listModels` from registries; `AgentEnrichmentStrategy`; `EnrichmentRequest` (updated type)
- Produces:
  - `POST /api/enrich` — now resolves providers from `scraperId`/`llmModelId` in body
  - `GET /api/providers` — returns `{ scrapers: ScraperMeta[], models: LLMModelInfo[] }`

- [ ] **Step 1: Update `app/api/enrich/route.ts`**

Replace the API-key and strategy resolution section. The existing key fallback logic (env vars → request headers) stays, but now we also accept `scraperId` and `llmModelId` from the request body and resolve providers from the registries.

Find the block starting at line 53 (`const openaiApiKey = ...`) and replace through the `const enrichmentStrategy = ...` construction:

Old block (lines 53–75):
```ts
const openaiApiKey = process.env.OPENAI_API_KEY || request.headers.get('X-OpenAI-API-Key');
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || request.headers.get('X-Firecrawl-API-Key');

if (!openaiApiKey || !firecrawlApiKey) {
  console.error('Missing API keys:', { hasOpenAI: !!openaiApiKey, hasFirecrawl: !!firecrawlApiKey });
  return NextResponse.json(
    { error: 'Server configuration error: Missing API keys' },
    { status: 500 }
  );
}

const strategyName = 'AgentEnrichmentStrategy';

console.log(`[STRATEGY] Using ${strategyName} - Advanced multi-agent architecture with specialized agents`);
const enrichmentStrategy = new AgentEnrichmentStrategy(
  openaiApiKey,
  firecrawlApiKey
);
```

New block:
```ts
const scraperId = body.scraperId ?? 'firecrawl';
const llmModelId = body.llmModelId ?? 'openai:gpt-4o';
const [llmProvider] = llmModelId.split(':');

// Resolve API keys: request body → env vars → request headers (SP4 hub will supersede this)
const scraperKeyMap: Record<string, string> = {
  firecrawl: process.env.FIRECRAWL_API_KEY || request.headers.get('X-Firecrawl-API-Key') || '',
  tavily:    process.env.TAVILY_API_KEY    || request.headers.get('X-Tavily-API-Key')    || '',
  serper:    process.env.SERPER_API_KEY    || request.headers.get('X-Serper-API-Key')    || '',
};
const llmKeyMap: Record<string, string> = {
  openai:    process.env.OPENAI_API_KEY    || request.headers.get('X-OpenAI-API-Key')    || '',
  google:    process.env.GOOGLE_API_KEY    || request.headers.get('X-Google-API-Key')    || '',
  openrouter:process.env.OPENROUTER_API_KEY|| request.headers.get('X-OpenRouter-API-Key')|| '',
};

const scraperApiKey = scraperKeyMap[scraperId];
const llmApiKey = llmKeyMap[llmProvider];

if (!scraperApiKey) {
  return NextResponse.json(
    { error: `Missing API key for scraper "${scraperId}". Set ${scraperId.toUpperCase().replace('-','_')}_API_KEY or pass X-${scraperId}-API-Key header.` },
    { status: 400 }
  );
}
if (!llmApiKey) {
  return NextResponse.json(
    { error: `Missing API key for LLM provider "${llmProvider}". Set ${llmProvider.toUpperCase()}_API_KEY or pass X-${llmProvider}-API-Key header.` },
    { status: 400 }
  );
}

import { getScraper } from '@/lib/providers/scraper/registry';
import { getLLM } from '@/lib/providers/llm/registry';
import { createLLMExtractor } from '@/lib/providers/llm/extraction';

const scraperInstance = getScraper(scraperId, scraperApiKey);
const llmModel = getLLM(llmModelId, llmApiKey);
const llmExtractor = createLLMExtractor(llmModel);

const enrichmentStrategy = new AgentEnrichmentStrategy(scraperInstance, llmExtractor);

console.log(`[STRATEGY] scraper=${scraperId}, llm=${llmModelId}`);
```

> **Note:** Move the three `import` statements to the top of the file with the other imports.

- [ ] **Step 2: Create `app/api/providers/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { listScrapers } from '@/lib/providers/scraper/registry';
import { listModels } from '@/lib/providers/llm/registry';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    scrapers: listScrapers(),
    models: listModels(),
  });
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and verify providers endpoint**

```bash
pnpm dev
```

In another terminal:
```bash
curl http://localhost:3000/api/providers
```

Expected: JSON with `scrapers` array (length 3) and `models` array (length ≥ 5).

- [ ] **Step 5: Stop dev server and commit**

```bash
git add app/api/enrich/route.ts app/api/providers/route.ts
git commit -m "feat: enrich route resolves providers from registry; add /api/providers endpoint"
```

---

### Task 12: Provider picker UI component

A compact shadcn Select-based component rendered in the "setup" step. Shows scraper and LLM dropdowns. Loads options from `/api/providers`. No scores yet (SP2 adds them).

**Files:**
- Create: `app/super-enrich/provider-picker.tsx`

**Interfaces:**
- Consumes: `GET /api/providers`, `Select` from `@/components/ui/select`
- Produces:
  ```ts
  interface ProviderPickerProps {
    scraperId: string;
    llmModelId: string;
    onScraperChange: (id: string) => void;
    onLlmChange: (id: string) => void;
  }
  export function ProviderPicker(props: ProviderPickerProps): JSX.Element
  ```

- [ ] **Step 1: Create `app/super-enrich/provider-picker.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ScraperMeta {
  id: string;
  displayName: string;
  description: string;
}

interface LLMModelInfo {
  id: string;
  displayName: string;
  description: string;
  pricing: { inputPer1M: number; outputPer1M: number };
}

interface ProviderPickerProps {
  scraperId: string;
  llmModelId: string;
  onScraperChange: (id: string) => void;
  onLlmChange: (id: string) => void;
}

export function ProviderPicker({
  scraperId,
  llmModelId,
  onScraperChange,
  onLlmChange,
}: ProviderPickerProps) {
  const [scrapers, setScrapers] = useState<ScraperMeta[]>([]);
  const [models, setModels] = useState<LLMModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data: { scrapers: ScraperMeta[]; models: LLMModelInfo[] }) => {
        setScrapers(data.scrapers ?? []);
        setModels(data.models ?? []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading providers…</div>;
  }

  const selectedScraper = scrapers.find((s) => s.id === scraperId);
  const selectedModel = models.find((m) => m.id === llmModelId);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Scraper picker */}
      <div className="space-y-1.5">
        <Label htmlFor="scraper-select" className="text-sm font-medium">
          Scraper
        </Label>
        <Select value={scraperId} onValueChange={onScraperChange}>
          <SelectTrigger id="scraper-select" className="w-full">
            <SelectValue placeholder="Choose scraper" />
          </SelectTrigger>
          <SelectContent>
            {scrapers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedScraper && (
          <p className="text-xs text-muted-foreground">{selectedScraper.description}</p>
        )}
      </div>

      {/* LLM model picker */}
      <div className="space-y-1.5">
        <Label htmlFor="llm-select" className="text-sm font-medium">
          LLM Model
        </Label>
        <Select value={llmModelId} onValueChange={onLlmChange}>
          <SelectTrigger id="llm-select" className="w-full">
            <SelectValue placeholder="Choose model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span>{m.displayName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ${m.pricing.inputPer1M}/${ m.pricing.outputPer1M} per 1M
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel && (
          <p className="text-xs text-muted-foreground">{selectedModel.description}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors in `provider-picker.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/super-enrich/provider-picker.tsx
git commit -m "feat: ProviderPicker UI component (scraper + LLM dropdowns)"
```

---

### Task 13: Integrate provider picker into page.tsx

Thread `scraperId` / `llmModelId` state through `page.tsx` → `UnifiedEnrichmentView` → enrich `fetch()` call.

**Files:**
- Modify: `app/super-enrich/page.tsx`
- Modify: `app/super-enrich/unified-enrichment-view.tsx`

- [ ] **Step 1: Add provider state and picker to `page.tsx`**

In `page.tsx`, add two state variables after the existing `useState` declarations:

```tsx
const [scraperId, setScraperId] = useState('firecrawl');
const [llmModelId, setLlmModelId] = useState('openai:gpt-4o');
```

Import `ProviderPicker`:
```tsx
import { ProviderPicker } from './provider-picker';
```

In the `"setup"` step JSX (where `<UnifiedEnrichmentView>` renders), add the picker above it:

```tsx
{step === "setup" && csvData && (
  <div className="space-y-6">
    <ProviderPicker
      scraperId={scraperId}
      llmModelId={llmModelId}
      onScraperChange={setScraperId}
      onLlmChange={setLlmModelId}
    />
    <UnifiedEnrichmentView
      rows={csvData.rows}
      columns={csvData.columns}
      onStartEnrichment={handleStartEnrichment}
    />
  </div>
)}
```

- [ ] **Step 2: Pass provider selection into the enrichment fetch call**

Locate the `fetch('/api/enrich', ...)` call in `page.tsx` (or in `unified-enrichment-view.tsx` if that's where it lives). The body must include `scraperId` and `llmModelId`.

Find where `enrichmentStrategy.enrichRow` / the SSE fetch is called and add the fields:

If the fetch is in `page.tsx`:
```tsx
body: JSON.stringify({
  rows,
  fields,
  emailColumn,
  scraperId,      // add
  llmModelId,     // add
}),
```

If the fetch is in `unified-enrichment-view.tsx`, pass `scraperId` and `llmModelId` as props:

Add to `UnifiedEnrichmentViewProps`:
```ts
interface UnifiedEnrichmentViewProps {
  rows: CSVRow[];
  columns: string[];
  onStartEnrichment: (emailColumn: string, fields: EnrichmentField[]) => void;
  scraperId: string;      // add
  llmModelId: string;     // add
}
```

Then pass from `page.tsx`:
```tsx
<UnifiedEnrichmentView
  rows={csvData.rows}
  columns={csvData.columns}
  onStartEnrichment={handleStartEnrichment}
  scraperId={scraperId}
  llmModelId={llmModelId}
/>
```

And in `unified-enrichment-view.tsx`, include them in the fetch body.

- [ ] **Step 3: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
pnpm dev
```

1. Open `http://localhost:3000/super-enrich`.
2. Upload a CSV with an email column.
3. On the setup step, confirm the `ProviderPicker` renders two dropdowns ("Scraper" and "LLM Model").
4. Change the LLM model to "GPT-4o mini" (or any other).
5. Start enrichment and confirm the server logs show `[STRATEGY] scraper=firecrawl, llm=openai:gpt-4o-mini`.

- [ ] **Step 5: Commit**

```bash
git add app/super-enrich/page.tsx app/super-enrich/unified-enrichment-view.tsx
git commit -m "feat: integrate ProviderPicker into setup step; thread scraperId/llmModelId to enrich route"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Choose scraper (Firecrawl, Tavily, Serper) per run | Tasks 2–6, 11, 12, 13 |
| Choose LLM (OpenAI, Gemini, OpenRouter) per run | Tasks 7–8, 11, 12, 13 |
| Advisory scorecard (no scores yet — SP2 adds them) | `/api/providers` metadata only, Task 11 |
| Single extraction code path via AI SDK `generateObject` | Task 8 |
| Existing Zod schemas preserved | Task 8 — `buildCorroboratedSchema` is same logic |
| Corroboration + confidence post-processing preserved | Task 8 — identical logic ported |
| Serper fallback scraper for `scrapeUrl` | Tasks 3, 5 |
| Token usage captured (SP2 telemetry prep) | `generateObject` returns `usage` — wired in SP2 |
| `SearchResult` type unchanged | Tasks 2, 4, 5 — adapters return same type |
| Env vars / headers as key source (fallback) | Task 11 — route logic |
| UI pickers | Tasks 12, 13 |

**Placeholder scan:** None found.

**Type consistency:** `ScraperProvider.scrapeUrl()` return `{ data?: { markdown?: string; html?: string }; error?: string }` matches the original `FirecrawlService.scrapeUrl()` shape the orchestrator already handles — no orchestrator data-path changes needed beyond the rename.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-06-29-sp1-pluggable-providers.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
