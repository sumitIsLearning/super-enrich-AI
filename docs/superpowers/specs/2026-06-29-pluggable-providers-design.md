# Design: Pluggable Providers, Ranking & Field Bundles

**Date:** 2026-06-29
**Status:** Approved (design); pending implementation plan

## Summary

Fire Enrich currently hardwires two services: **Firecrawl** for scraping/search and
**OpenAI** for extraction. This work makes both **swappable**, adds a **scorecard**
(measured quality + published cost) to guide selection, and adds **field bundles**
(named, reusable sets of fields). Selection is **manual per run**; ranking is
**advisory** (it informs the manual choice, never auto-selects).

## Current State

- `lib/services/firecrawl.ts` — `FirecrawlService(apiKey)`: `search()`, `searchWithMultipleQueries()`, `scrapeUrl()`. Returns `SearchResult[]`.
- `lib/services/openai.ts` — `OpenAIService(apiKey)`: extraction (`extractStructuredDataWithCorroboration`, `extractStructuredDataOriginal`), plus query generation, chat/Q&A helpers. Model ids (`gpt-5`, `gpt-5-mini`) are string literals; structured output uses `zodResponseFormat`.
- `lib/agent-architecture/orchestrator.ts` — constructs both services directly from API keys; runs phased agents.
- `app/api/enrich/route.ts` — reads keys from env or `X-OpenAI-API-Key` / `X-Firecrawl-API-Key` headers; builds `AgentEnrichmentStrategy(openaiApiKey, firecrawlApiKey)`; streams SSE.
- `app/fire-enrich/field-mapper.tsx` — `PRESET_FIELDS` list + add-custom + AI-generated fields (`/api/generate-fields`).
- No database. Sessions are in-memory. Node.js runtime.

## Goals

1. Choose the **scraper** (Firecrawl, Tavily, Serper) per run.
2. Choose the **LLM** (OpenAI, Google Gemini, OpenRouter models) per run.
3. Show each option an **advisory scorecard**: measured quality + published cost.
4. **Field bundles**: pick a preset bundle or save/load a custom named bundle.

## Non-Goals

- No automatic provider selection (manual only; ranking is advisory).
- No multi-user accounts/auth. Scorecard and bundles are **global** to the instance.
- No change to the phased agent pipeline's logic or field-categorization rules.
- No hosted-DB dependency. SQLite single-file, behind an interface for later swap.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Selection | Manual pick of scraper + LLM before each run |
| Ranking role | Advisory labels on the pickers, not auto-select |
| Cost source | Static config from each provider's published per-1M input/output token price (scrapers: per-request/page) |
| Quality source | Measured from real runs (fields-found rate, mean confidence, success rate) |
| Storage | SQLite (`better-sqlite3`) behind a storage interface; global scope |
| Field model | Named field bundles (preset + user-saved) |
| LLM layer | Vercel AI SDK (`generateObject` / `generateText`) — unifies OpenAI, Gemini, OpenRouter + Zod structured output |
| LLM providers | OpenAI, Google Gemini, OpenRouter |
| Scrapers | Firecrawl, Tavily, Serper (Serper is search-only → content-fetch fallback) |

## Architecture

Three sub-projects. Build order **1 → 2**, with **3** in parallel.

```
                ┌─────────────────────────────────────────┐
   UI pickers   │  scraper ▼   llm ▼   bundle ▼   [Enrich] │
   (advisory    └─────────────────────────────────────────┘
    scorecards)            │ selection ids + keys
                           ▼
                  app/api/enrich/route.ts
                           │ resolves ids → instances via registries
                           ▼
            ┌──────────────────────────────────┐
            │        AgentOrchestrator          │
            │  uses ScraperProvider + LLMProvider│
            └──────────────────────────────────┘
                  │ search/scrape        │ extract
                  ▼                      ▼
          ScraperRegistry          LLMRegistry (AI SDK models)
          (firecrawl/tavily/serper)(openai/google/openrouter)
                  │                      │
                  └──── per-run metrics ─┘
                           ▼
                  TelemetryStore (SQLite) ──► RankingService ──► scorecards
                  BundleStore (SQLite)
```

### Sub-project 1 — Provider abstraction layer

**Scraper interface** (`lib/providers/scraper/types.ts`):

```ts
export interface ScraperProvider {
  readonly id: string;            // 'firecrawl' | 'tavily' | 'serper'
  readonly displayName: string;
  search(query: string, opts?: { limit?: number; scrapeContent?: boolean }): Promise<SearchResult[]>;
  scrapeUrl(url: string): Promise<{ data?: { markdown?: string; html?: string }; error?: string }>;
}
```

- `SearchResult` is the existing type (unchanged) — the normalized shape every provider returns.
- Firecrawl adapter wraps today's `FirecrawlService` (behavior preserved).
- Tavily adapter: search + content in one call; map to `SearchResult`.
- Serper adapter: SERP search only. `scrapeUrl` and `scrapeContent` fall back to a small **HTTP fetch + Readability** fetcher (`lib/providers/scraper/fetch-content.ts`) to produce `markdown`/`html`.
- Registry (`lib/providers/scraper/registry.ts`): `getScraper(id, apiKey)` → instance; `listScrapers()` → metadata for the UI.

**LLM provider via AI SDK** (`lib/providers/llm/types.ts`):

```ts
export interface LLMModelInfo {
  id: string;            // 'openai:gpt-5' | 'google:gemini-2.5-pro' | 'openrouter:<model>'
  providerId: 'openai' | 'google' | 'openrouter';
  displayName: string;
  pricing: { inputPer1M: number; outputPer1M: number }; // USD, from config
}

export interface LLMProvider {
  readonly model: LanguageModel;     // AI SDK model instance
  readonly info: LLMModelInfo;
}
```

- `lib/providers/llm/registry.ts`: `getLLM(modelId, apiKey)` builds the AI SDK model
  (`@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`); `listModels()`
  returns `LLMModelInfo[]` for the UI.
- `OpenAIService` extraction methods are reimplemented once against the AI SDK
  (`generateObject` with the existing Zod schemas; `generateText` for chat/query
  helpers). All providers go through this single path — no per-provider extraction code.
  The corroboration/validation logic (snippet checks, hallucination filters,
  post-processing) is **preserved as-is**; only the model-call boundary changes.
- Usage (tokens in/out) is captured from the AI SDK response for telemetry.

**Wiring**: `enrich` route accepts `scraperId`, `llmModelId` in the request body and
keys from env or headers (extended: `X-Google-API-Key`, `X-OpenRouter-API-Key`,
`X-Tavily-API-Key`, `X-Serper-API-Key`). It resolves instances from the registries and
passes them into the orchestrator. The orchestrator stops constructing services itself
and instead receives a `ScraperProvider` and an extraction client.

### Sub-project 2 — Telemetry & ranking

**Storage interface** (`lib/storage/types.ts`) with a SQLite implementation
(`lib/storage/sqlite.ts`, `better-sqlite3`, file at `data/fire-enrich.db`).

Tables:

```sql
CREATE TABLE provider_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL,         -- 'scraper' | 'llm'
  provider_id   TEXT NOT NULL,         -- e.g. 'firecrawl' | 'openai:gpt-5'
  fields_total  INTEGER,               -- llm: fields requested
  fields_found  INTEGER,               -- llm: fields with a value
  mean_conf     REAL,                  -- llm: mean confidence of found fields
  input_tokens  INTEGER,               -- llm
  output_tokens INTEGER,               -- llm
  requests      INTEGER,               -- scraper: calls made
  results_count INTEGER,               -- scraper: usable results returned
  ok            INTEGER NOT NULL,      -- 1 success, 0 error
  cost_usd      REAL,                  -- computed at write time from pricing config
  created_at    TEXT NOT NULL
);
```

**Pricing config** (`lib/providers/pricing.ts`): per-model `inputPer1M`/`outputPer1M`
and per-scraper `perRequest`, hand-entered from provider docs. Cost per run is computed
at write time so historical rows stay accurate even if prices change later.

**RankingService** (`lib/providers/ranking.ts`): aggregates `provider_runs`
(`GROUP BY provider_id`) into:
- `qualityScore` = f(fields_found/fields_total, mean_conf, success rate) — 0–100.
- `avgCostPerRun` = mean `cost_usd`.
- `sampleSize` = row count (UI shows "based on N runs"; low N flagged).

Exposed via `GET /api/providers` → `{ scrapers: [...], models: [...] }` each with
metadata + scorecard. Metrics are recorded by the enrich route after each phase/run
(non-blocking; a telemetry write failure never fails enrichment).

### Sub-project 3 — Field bundles

Table:

```sql
CREATE TABLE field_bundles (
  id          TEXT PRIMARY KEY,        -- slug
  name        TEXT NOT NULL,
  description TEXT,
  fields_json TEXT NOT NULL,           -- EnrichmentField[]
  is_preset   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
```

- Preset bundles seeded on first run from a constant (built from existing
  `PRESET_FIELDS` groupings, e.g. "Company Basics", "Funding Profile", "Tech Stack").
- API: `GET /api/bundles`, `POST /api/bundles` (save custom), `DELETE /api/bundles/:id`
  (custom only; presets are read-only).
- `field-mapper.tsx` gains a bundle dropdown: selecting one loads its fields into the
  existing selected-fields state; a "Save as bundle" action persists the current
  selection. Existing per-field add/remove/AI-generate is unchanged.

## Data Flow (one row, end to end)

1. User picks `scraperId`, `llmModelId`, and a bundle; clicks Enrich.
2. `enrich` route resolves a `ScraperProvider` and AI-SDK extraction client from the registries using the selected ids + keys.
3. Orchestrator runs phases; each phase calls the scraper (search/scrape) and the LLM (extract) through the interfaces — exactly as today, but provider-agnostic.
4. After each LLM extraction and scraper call, the route writes a `provider_runs` row (tokens, fields found, confidence, computed cost, ok).
5. Results stream back via SSE (unchanged). Scorecards update on the next page load from the aggregated telemetry.

## Error Handling

- Missing key for a selected provider → 400 with a clear message (mirrors current missing-key check).
- Scraper/LLM call failures keep today's behavior (retry/empty-result for scraper; fallback path for extraction). A failed run still records a `provider_runs` row with `ok=0`.
- Telemetry/bundle DB errors are caught and logged; they never break enrichment.
- SQLite on ephemeral/serverless filesystems is acceptable (resets per deploy); documented. Self-hosted/local persists normally.

## Testing

- **Scraper adapters:** unit tests mapping each provider's raw response → `SearchResult` (fixtures); Serper fallback fetcher tested against a sample HTML fixture.
- **LLM extraction parity:** run the existing corroboration validation over a fixed content fixture through the AI SDK path; assert the same fields/structure as before for OpenAI.
- **RankingService:** seed `provider_runs` rows, assert aggregation math (quality score, avg cost, sample size).
- **BundleStore:** save → load → delete round-trip; presets are read-only.
- **Registry resolution:** unknown id → error; known id → correct instance type.

## Build Order

1. **Sub-project 1** (foundation): interfaces, registries, adapters, AI-SDK extraction, route wiring, UI pickers (no scores yet).
2. **Sub-project 2**: storage interface + SQLite, pricing config, telemetry writes, RankingService, `/api/providers`, advisory labels in pickers.
3. **Sub-project 3** (parallel with 1–2; different files): bundle store, bundle APIs, field-mapper dropdown.

Each sub-project gets its own implementation plan via writing-plans, starting with #1.

## Open Items

None blocking. Exact preset-bundle contents and the qualityScore weighting constants will be finalized in the sub-project plans.
