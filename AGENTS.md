# AGENT.md

Canonical guide for AI agents and contributors working in this repo. Other agent files (e.g. `CLAUDE.md`) point here — keep this the single source of truth.

## Product

**Super Enrich** — provider-agnostic, AI-powered data enrichment. Upload a CSV of emails, pick the fields you want, and a phased multi-agent pipeline returns structured, source-cited company data, streamed row by row.

**Ships today:** Firecrawl (scrape/search) + OpenAI (extraction).
**Direction (designed, not yet built):** swappable scrapers + LLMs, measured cost/quality rankings, saved field bundles. See `docs/superpowers/specs/2026-06-29-pluggable-providers-design.md`. Do not document unbuilt features as current.

## Stack

- Next.js 15 (App Router), React, TypeScript
- Tailwind, Radix/shadcn UI
- Zod for schema-validated LLM output
- Node.js runtime for the enrich API; results stream via Server-Sent Events

## Commands

```bash
pnpm dev        # dev server (turbopack)
pnpm build      # production build
pnpm start      # serve build
pnpm lint       # eslint
```

## Layout

| Path | Purpose |
|------|---------|
| `app/super-enrich/` | Feature UI (CSV upload, field mapper, table, config) |
| `app/api/enrich/route.ts` | Main enrichment endpoint (SSE stream) |
| `app/api/generate-fields/route.ts` | Natural-language → field schema |
| `lib/agent-architecture/orchestrator.ts` | Phased agent pipeline |
| `lib/agent-architecture/agents/` | Per-phase agents |
| `lib/services/firecrawl.ts` | Scraping/search service |
| `lib/services/openai.ts` | LLM extraction (corroboration, validation) |
| `lib/types/index.ts` | Core types (`EnrichmentField`, `EnrichmentResult`, …) |

## How enrichment works

1. Parse email → domain/company.
2. Categorize requested fields → agents (by name/description; see `categorizeFields`).
3. Run phases sequentially (Discovery → Profile → Metrics → Funding → Tech Stack → General); each phase reuses prior context.
4. Each phase: parallel Firecrawl searches → OpenAI extraction with a Zod schema → validation (snippet contains value, hallucination/title filters, confidence threshold).
5. Stream results with confidence scores + source citations.

## Extending

- **Add a field to an agent:** extend its Zod schema in `lib/agent-architecture/agents/<agent>.ts`.
- **Custom fields:** handled by the General agent; no code change needed.
- **Field routing:** adjust `categorizeFields` in `orchestrator.ts`.

## Conventions

- Functional, declarative TypeScript; avoid classes for new units except where the existing service pattern uses them.
- Match existing file style. Keep changes surgical — every changed line should trace to the request.
- Validate LLM output with Zod; never trust raw model JSON.
- Don't claim a value without a source; preserve the confidence + source-context model.

## Config & env

- `FIRECRAWL_API_KEY`, `OPENAI_API_KEY` — required (env or browser-entered, sent via `X-*-API-Key` headers).
- `SUPER_ENRICH_UNLIMITED=true` — removes row/column/field caps (auto-on in development). See `app/super-enrich/config.ts`.

## Known cleanup

- `app/super-enrich/csv-uploader.tsx`: `SUPER_ENRICH_CONFIG` import is unused (pre-existing). Remove if touching that file for other reasons.
