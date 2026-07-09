# Super Enrich

AI-powered CSV enrichment: turns a list of company emails into structured business intelligence using a phased multi-agent pipeline, web scraping, and LLM extraction.

> Documents the feature as it ships today (Firecrawl + OpenAI). The provider-agnostic direction lives in `docs/superpowers/specs/2026-06-29-pluggable-providers-design.md`.

## Overview

Super Enrich takes a CSV of company email addresses and enriches each row with business data. It uses Firecrawl for web scraping/search and OpenAI GPT models for intelligent, schema-validated extraction.

## Architecture

### Phased multi-agent pipeline

Agents run **sequentially** so each phase builds on the previous one's discoveries. Fields are routed to agents automatically by name/description.

| Phase | Agent | Extracts |
|-------|-------|----------|
| 1 | Discovery | Company name, website, business type |
| 2 | Company Profile | Industry, headquarters, year founded, company type |
| 3 | Metrics | Employee count, revenue, size |
| 4 | Financial Intel | Funding stage, total raised, investors, valuation |
| 5 | Tech Stack | Languages, frameworks, infrastructure (HTML + GitHub) |
| 6 | General | Custom fields (CEO, competitors, anything else) |

Within a phase, searches run in parallel. A final synthesis step resolves conflicts and validates values. Every field carries a 0–1 confidence score and source URLs.

### Service layer

```
Frontend (React/Next) → API routes (SSE stream) → Orchestrator
                                                      │
                          ┌───────────────────────────┼───────────────┐
                  FirecrawlService            OpenAIService     specialized agents
                  (scrape/search)            (GPT extraction)
```

### Data flow

1. **Email parsing** — extract company/domain from email patterns.
2. **Query generation** — multiple targeted searches per company.
3. **Multi-source scraping** — aggregate content via Firecrawl.
4. **AI synthesis** — combine and validate with an OpenAI model.
5. **Confidence scoring** — 0–1 per field.
6. **Source attribution** — track the origin of each value.

## Setup

### Prerequisites
- Node.js 18+ and pnpm/npm
- Firecrawl API key — [firecrawl.dev](https://firecrawl.dev)
- OpenAI API key — [platform.openai.com](https://platform.openai.com)

### Install

```bash
pnpm install
# .env.local
FIRECRAWL_API_KEY=your_firecrawl_key
OPENAI_API_KEY=your_openai_key
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) (or `/super-enrich`).

Keys can also be entered in the browser (stored in `localStorage`, sent per request).

## Features

- **Smart email detection** — column detection, domain extraction, company-name inference.
- **Agent-based enrichment** — specialized agents selected by requested fields, parallel within a phase.
- **Real-time progress** — Server-Sent Events, animated cell population.
- **Flexible fields** — presets plus natural-language custom field generation.
- **Export** — CSV/JSON with confidence scores and source URLs.

## Notes

- **Performance:** concurrent rows with rate limiting; deduped queries.
- **Error handling:** graceful degradation, retries on transient errors, fallback extraction.
- **Privacy:** browser-side keys, no server-side data retention, HTTPS, full source tracking.
- **Limits:** see `config.ts` — capped in hosted mode, unlimited locally (`SUPER_ENRICH_UNLIMITED`).

## Support

- Repo: [github.com/sumitIsLearning/super-enrich-AI](https://github.com/sumitIsLearning/super-enrich-AI)
- Originally based on [mendableai/fire-enrich](https://github.com/mendableai/fire-enrich).
