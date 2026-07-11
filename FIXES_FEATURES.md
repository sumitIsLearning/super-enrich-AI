# Fixes & Features

Chronological record of what's been built and fixed since the fork from Fire Enrich (2026-06-29). Grouped by theme, newest first. Commit hashes point to `git log` for full detail.

## Session: 2026-07-11 — Auth rate-limit wiring, dependency audit, error-handling hardening, row cap

**Feature — better-auth rate limiter wired to Redis + sign-in backoff** (`46d29ac`)
Continues the 2026-07-10 rate-limit thread: `lib/auth/index.ts` now enables better-auth's native per-IP limiter for `/sign-in/email`, `/sign-up/email`, `/forget-password`, backed by a new `redisSecondaryStorage` adapter (`lib/rate-limit.ts`) instead of the in-memory default that resets per instance. Added per-account exponential backoff on sign-in only (`hooks.before`/`after` via `createAuthMiddleware`, self-filtered since both hooks match every path internally). Route-level tier wiring for `scrape`/`enrich`/`chat`/`generate-fields` is still pending — see `handoff.md`.

**Fix — dependency audit: 2 critical, 42 high, 45 moderate advisories** (`5b1cd17`)
`pnpm audit` found 94 advisories. Removed `@langchain/core`/`@langchain/langgraph`/`@langchain/openai` (zero source imports found anywhere — dead weight pulling in a critical `form-data` CVE and a high-severity secret-extraction advisory for nothing). Bumped `next` 15.3.2 → 15.5.20 (RCE in React flight protocol, plus SSRF/cache-poisoning/DoS advisories — stayed on the 15.x line, not the v16 major). Forced `axios` → `^1.18.1` and `form-data` → `>=4.0.4` via `pnpm.overrides`, since both were pinned deep inside `firecrawl-js`/`@tavily/core`/`openai`'s own lockfiles. Down to 0 critical/17 high/17 moderate — remainder is dev/build-time-only tooling (tailwindcss v3's `sucrase` chain, eslint's `ajv`/`js-yaml`), not touched.

**Fix — raw error messages leaking to clients** (`aa4b823`)
5 spots in `enrich`/`chat`'s SSE streams echoed `error.message` (or `details: error.message`) straight into the client-facing response — provider SDK internals, unhandled exceptions, etc. would have reached the browser as-is, 3 of them with no server-side logging at all. Each now logs full detail via `console.error` and returns a generic message.

**Feature — 1000-row cap per enrichment request** (`aa4b823`)
No server-side limit existed on rows per `/api/enrich` call (flagged in a prior session's open-findings list) — a direct API call could bypass the CSV UI entirely with unlimited rows. Added `ENRICHMENT_CONFIG.MAX_ROWS_PER_REQUEST` (1000), enforced server-side (the real boundary) and client-side in the CSV uploader for fast feedback. Also added a 10MB `maxSize` sanity ceiling to the dropzone with an `onDropRejected` handler, since oversized/wrong-type files were previously rejected silently with no error shown.

## Session: 2026-07-10 (cont.) — Configurable rate limiting, in progress

**In progress — tiered rate limiting + auth backoff, not yet committed**
Old limiter was one hardcoded rule (50 requests/day/IP) reused everywhere, with no coverage on auth or on `enrich`/`chat`/`generate-fields`. Built `lib/config/rate-limit.ts`: three env-configurable tiers — AUTH (strict, per-IP + per-account exponential backoff instead of a hard lockout), PUBLIC (moderate, unused for now since no unauthenticated route exists), AUTHENTICATED (loose, for logged-in user actions). `lib/rate-limit.ts` now takes a tier param instead of hardcoded numbers, plus `recordAuthFailure`/`checkAuthBackoff`/`clearAuthBackoff` for the backoff leg. Auth wiring (`lib/auth/index.ts`) and the route updates (`scrape`, `enrich`, `chat`, `generate-fields`) are still pending — see `handoff.md` for exact next steps and the currently-broken build state.

## Session: 2026-07-10 — Search query rewrite, Serper content-fetch fix, OpenRouter/Google fix, key-status UI

**Docs — FIXES_FEATURES.md history + keep-updated rule** (`ccad615`)
Added this file and an AGENTS.md rule to keep it updated after every fix/feature, same format, newest-first.

**Fix — Serper never fetched page content** (`493d0f2`)
Serper's own API only ever returned Google's snippet metadata (url, title, description) — never the actual page. Every orchestrator phase fed that straight into the LLM extraction prompt, so extraction ran against empty content blocks regardless of query quality. Wired the existing SSRF-hardened `fetchPageContent()` into `search()`, fetched per result in parallel, dropped anything under 100 chars (fetch failure or a JS-only page shell).

**Fix — ungrouped boolean search queries across 6 orchestrator phases** (`6537355`)
`site:X OR "name" kw1 kw2` has no parens, so `OR` doesn't group the way it reads — the `site:` filter often did nothing. Wrapped the domain/name choice in parens and OR'd the keyword set in Profile, Metrics, Funding, and Tech Stack's GitHub query. Also fixed an over-quoting bug in Tech Stack's mentions query (same class as the one below) and merged General's two queries per field group into one, halving its Serper calls.

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
- Open signup rides the operator's env keys; no allowlist on `llmModelId`/`scraperId`; no server-side row cap.
- Rate limiting only covers `/api/scrape` — tiered rate limiting (auth/public/authenticated) is in progress, see FIXES_FEATURES.md's "Configurable rate limiting" entry and `handoff.md`.
- No ownership check on job cancel; no Zod validation on enrich/generate-fields request bodies; BYOK keys sit in plaintext `localStorage` (deliberate, tracked as follow-up hardening).
- Two live `cn()` helpers (`lib/utils.ts` vs `utils/cn.ts`) — not consolidated.
- Two lockfiles committed (`pnpm-lock.yaml` + `package-lock.json`) — one should be dropped before going public.
- `ARCHITECTURE.md` backfill still not done for the rebrand or provider-picker migration.
