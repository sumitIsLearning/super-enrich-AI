# Super Enrich — Provider-Agnostic AI Data Enrichment

Turn a plain list of emails into a rich dataset — company profiles, funding data, tech stacks, leadership, and more. Super Enrich runs a multi-agent AI pipeline over live web data and streams structured, fully-sourced results back to you row by row.

> **Direction:** Super Enrich is evolving toward a fully **provider-agnostic** tool — pick your scraper and your LLM, compare them on measured quality and cost, and save reusable field bundles. That work is tracked in [`docs/superpowers/specs/2026-06-29-pluggable-providers-design.md`](docs/superpowers/specs/2026-06-29-pluggable-providers-design.md). **This README documents what ships today.**

## What ships today

- **Scraping/search:** [Firecrawl](https://www.firecrawl.dev/)
- **Extraction/synthesis:** OpenAI GPT models
- **Framework:** Next.js 15 (App Router), streaming via Server-Sent Events

## How it works

You upload a CSV of emails and choose which data points you want. For each row, Super Enrich extracts the company domain, then runs a sequence of specialized agents — each building on the previous one's findings — that search the web with Firecrawl and extract structured answers with an OpenAI model. Every value comes back with a confidence score and source citations, and your table fills in live.

### The agent pipeline

Agents run in sequence so each phase has more context than the last:

1. **Discovery** — company name, website, business type (the foundation for everything after).
2. **Company Profile** — industry, headquarters, year founded, company type.
3. **Metrics** — employee count, revenue, size.
4. **Financial Intel** — funding stage, total raised, investors, valuation.
5. **Tech Stack** — languages, frameworks, infrastructure (HTML + GitHub analysis).
6. **General** — any custom field (CEO, competitors, etc.) using all prior context.

Within each phase, multiple searches run in parallel. A final synthesis step resolves conflicts across sources and validates the extracted data.

### Extensibility

Each agent uses a [Zod](https://zod.dev/) schema for type-safe, validated output. Fields are routed to agents automatically by name/description (e.g. anything with "fund" or "invest" → Financial Intel; "tech stack" → Tech Stack; everything else → General). To add a data point, extend an agent's schema or add a custom field in the UI.

## Setup

### Required API keys

| Service | Purpose | Get key |
|---------|---------|---------|
| Firecrawl | Web scraping & search | [firecrawl.dev/app/api-keys](https://www.firecrawl.dev/app/api-keys) |
| OpenAI | Data extraction | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

### Quick start

1. Clone this repository.
2. Create `.env.local` with your keys (see `.env.example`):
   ```
   FIRECRAWL_API_KEY=your_firecrawl_key
   OPENAI_API_KEY=your_openai_key
   ```
3. Install dependencies: `pnpm install` (or `npm install`).
4. Run the dev server: `pnpm dev`.
5. Open [http://localhost:3000](http://localhost:3000).

You can also enter API keys directly in the browser instead of using env vars — they're kept in `localStorage` and sent per request.

## Example enrichment

**Before:**
```json
{ "email": "erez@wiz.io" }
```

**After:**
```json
{
  "email": "erez@wiz.io",
  "companyName": "Wiz",
  "industry": "Cybersecurity",
  "employeeCount": "1001-5000",
  "yearFounded": 2020,
  "headquarters": "New York, NY",
  "fundingStage": "Series D",
  "totalRaised": "$900M",
  "website": "https://www.wiz.io",
  "sources": ["https://www.wiz.io/about", "https://techcrunch.com/..."]
}
```

## Key features

- **Phased multi-agent extraction** — sequential agents build context for higher accuracy.
- **Drag & drop CSV** — get started in seconds.
- **Customizable fields** — pick presets or describe your own in natural language.
- **Real-time streaming** — watch rows enrich live via Server-Sent Events.
- **Full source citations** — every value links back to where it was found.
- **Skips personal email providers** — avoids wasting calls on Gmail/Yahoo/etc.

## Configuration & Unlimited Mode

Running locally enables **Unlimited Mode** (no row/column/field caps). Configure in [`app/super-enrich/config.ts`](app/super-enrich/config.ts):

```typescript
const isUnlimitedMode =
  process.env.SUPER_ENRICH_UNLIMITED === 'true' ||
  process.env.NODE_ENV === 'development';

export const SUPER_ENRICH_CONFIG = {
  CSV_LIMITS: {
    MAX_ROWS: isUnlimitedMode ? Infinity : 15,
    MAX_COLUMNS: isUnlimitedMode ? Infinity : 5,
  },
  REQUEST_LIMITS: {
    MAX_FIELDS_PER_ENRICHMENT: isUnlimitedMode ? 50 : 10,
  },
} as const;
```

## Contributing

Issues and pull requests welcome. For agent/architecture conventions, see [`AGENT.md`](AGENT.md).

## License

MIT — see [LICENSE](LICENSE).
