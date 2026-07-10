# Fixes & Features

Chronological record of what's been built and fixed since the fork from Fire Enrich (2026-06-29). Grouped by theme, newest first. Commit hashes point to `git log` for full detail.

## Session: 2026-07-10 — OpenRouter/Google fix, search fix, key-status UI

**Fix — OpenRouter/Google spec-version mismatch** (`ca4b6c7`)
Every OpenRouter and Google extraction call threw `AI_NoObjectGeneratedError`. Root cause: `ai@4` reads tool-call results via LanguageModel spec v1; `@ai-sdk/google` and `@openrouter/ai-sdk-provider` were on versions speaking newer specs that never populate the field `ai@4` reads. Fixed by bumping `ai` 4→7 and all three provider packages to versions that compile to the same spec (v4), removing the type casts that had been papering over the mismatch.

**Fix — over-quoted Serper search queries** (`d2b1519`)
Profile/metrics/funding lookups returned 0 results. Queries AND-quoted multiple helper phrases (e.g. `"founded in" "year founded"`), which Serper/Google treats as required exact matches — stacking them collapsed results to zero. Company name stays quoted; surrounding keywords no longer are.

**Feature — per-provider key status UI** (`c84ba1b`)
Once a BYOK key was saved to `localStorage` there was no way to see or change it without devtools. Added a status line under each provider dropdown (server-managed / saved locally / missing) and an edit-mode path into the key modal scoped to one provider.

## 2026-07-09 — Rebrand + provider-picker migration

**Feature — provider picker on main page** (`04eb157`)
Moved scraper/LLM selection from a duplicate `/super-enrich` route onto the main page; users pick provider + supply their own key inline. Duplicate route removed.

**Rebrand — Firecrawl → Super Enrich identity** (`f875744`)
Replaced Firecrawl brand assets (logos, colors, copy) with Super Enrich's own.

## 2026-07-08 — Security

**Fix — SSRF via private IP + redirect** (`00e64d8`)
Scraper accepted a public-looking first-hop URL that redirected to a private/loopback/link-local/CGNAT address, bypassing SSRF checks. Added DNS resolution + private-IP checks before fetch, and re-validates on every redirect hop, not just the initial URL.

## 2026-07-01 — Auth + Postgres foundation

**Feature — full auth stack** (`7cfcd2b`, `1b74751`, `36e5276`, `15c7aa8`, `b525458`, `a48ba8f`, `66add98`, `439167a`, `f5233cc`)
Better Auth + Drizzle/Neon Postgres foundation: schema + migrations, server/client auth setup, login/signup page (restyled shadcn `login-04` block), session helpers with route middleware, sign-out.

**Fix — route gating gaps** (`439167a`, `e9a0b2b`, `1dbf32a`)
App pages and API routes (`scrape`, `chat`, `check-env`, `enrich` DELETE/cancel) were reachable without a session. Added a shared `requireApiSession` helper and gated each route individually.

## 2026-06-29 – 2026-06-30 — Pluggable provider architecture

**Feature — scraper provider abstraction** (`63df414`, `e584607`, `226aaa5`, `d39f77e`, `c432d70`)
Introduced a `ScraperProvider` interface with adapters for Firecrawl, Tavily, and Serper (the latter with a fetch-content fallback), plus a registry to select between them.

**Feature — LLM provider abstraction** (`26ea250`, `6fb1e18`)
LLM registry supporting OpenAI, Gemini, and OpenRouter via the AI SDK; provider-agnostic extraction client built on `generateObject`.

**Refactor — orchestrator made provider-agnostic** (`a5743ca`, `634938c`, `99cc3f7`)
Orchestrator and `AgentEnrichmentStrategy` accept injected `ScraperProvider`/`LLMExtractor` instead of hardcoded services; `EnrichmentRequest` carries `scraperId`/`llmModelId`; added `/api/providers` endpoint.

**Feature — provider picker UI (first version)** (`3c26a67`, `8a6d8c0`)
Scraper + LLM dropdown component, wired into the setup step and threaded through to the enrich route.

## 2026-06-29 — Origin

**`63b8de5`** — Initial fork from Fire Enrich (Mendable AI's Firecrawl demo).
**`f61ebc9`** — Rebrand pass 1: `fire-enrich` → `super-enrich`, docs rewrite, added `AGENTS.md`/`CLAUDE.md`.

---

## Known open items (not yet fixed)

Carried from `handoff.md` — see that file for full detail and file:line references:
- Per-phase error isolation in `orchestrator.ts` — one phase throwing wipes all other phases' results for that row.
- No empty-content guard around `generateObject` calls in `extraction.ts`.
- Open signup rides the operator's env keys; no allowlist on `llmModelId`/`scraperId`; no server-side row cap; rate limiting only covers `/api/scrape`.
- No ownership check on job cancel; no Zod validation on enrich/generate-fields request bodies; BYOK keys sit in plaintext `localStorage` (deliberate, tracked as follow-up hardening).
- Two live `cn()` helpers (`lib/utils.ts` vs `utils/cn.ts`) — not consolidated.
- Two lockfiles committed (`pnpm-lock.yaml` + `package-lock.json`) — one should be dropped before going public.
- `ARCHITECTURE.md` backfill still not done for the rebrand or provider-picker migration.
