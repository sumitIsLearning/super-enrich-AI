ARCHITECTURE.md

Running log of what got built, why, and how pieces connect. One entry per increment, four lines max each. This is your interview-prep doc as it accumulates — don't let it go stale.


Feature: Grouped boolean search queries, 6 orchestrator phases (Profile, Metrics, Funding, Tech Stack x2, General)
Why this shape: `site:X OR "name" kw1 kw2` has no parens, so OR doesn't group as intended and the site: filter often does nothing (verified against Serper). Wrapped the source choice in parens, OR'd the keyword set, dropped duplicate over-quoted exact-phrase ANDs.
Connects to: Each feeds `this.scraper.search()` in its own phase function (`orchestrator.ts`); no other call sites touched.
Breaks if removed: Query strings revert to ungrouped OR / over-quoted forms — site: filter silently ineffective or results collapse to zero, same failure mode as the original bug this session opened with.


Feature: Serper adapter fetches page content per search result
Why this shape: Serper's own API only returns Google snippet metadata, never page text, so every orchestrator phase was feeding the LLM empty content blocks. Reused the existing SSRF-hardened `fetchPageContent()` (already used by `scrapeUrl()`) inside `search()`, fetched in parallel, dropped results under 100 chars (matches Discovery phase's existing thin-content threshold).
Connects to: `lib/providers/scraper/adapters/serper.ts:search()`; called generically via `ScraperProvider` from every `orchestrator.ts` phase. No caller changes needed.
Breaks if removed: Serper-backed enrichments silently degrade to zero usable content again, same failure mode this session started with.


Feature: TinyFish scraper adapter (4th ScraperProvider) — steps 1-2, tests pending
Why this shape: TinyFish's Fetch API renders via a real headless browser (JS/SPA-safe, unlike our regex-based `fetchPageContent`), and its Search API returns structured JSON like Serper. Implemented as a normal `ScraperProvider` — `search()` calls Search then batches content via one Fetch call (10-URL cap), `scrapeUrl()` makes 2 parallel Fetch calls (markdown + html) since the API returns one format per call.
Connects to: `lib/providers/scraper/adapters/tinyfish.ts`; wired into `registry.ts`, `client-keys.ts`, `check-env`, `enrich/route.ts`, `.env.example` — same pattern as the other 3 adapters, no picker/UI changes needed (reads the registry generically).
Breaks if removed: TinyFish disappears from the scraper picker; `/api/enrich` 400s on `scraperId: "tinyfish"`.


Feature: Configurable rate-limit tier config (`lib/config/rate-limit.ts`)
Why this shape: existing limiter had one hardcoded rule (50/day) reused everywhere; needed per-endpoint-type tiers (auth/public/authenticated) with every threshold env-configurable, not hardcoded.
Connects to: consumed by `lib/rate-limit.ts`'s tier param and backoff functions; auth wiring (`lib/auth/index.ts`) still pending.
Breaks if removed: tier functions lose their default numbers; every caller needs inline thresholds again.

Feature: Tier-based rate limiter + per-account backoff (`lib/rate-limit.ts`)
Why this shape: single hardcoded 50/day/IP limiter couldn't express "stricter on auth, looser on authenticated actions." Added a `tier` param to `getRateLimiter`/`isRateLimited`, plus `recordAuthFailure`/`checkAuthBackoff`/`clearAuthBackoff` for exponential backoff on auth instead of a hard lockout.
Connects to: `RATE_LIMIT_CONFIG`; `scrape/route.ts`'s existing 2-arg call no longer compiles until it's updated to pass a tier (deliberate — see handoff.md); backoff functions have no caller yet, pending `lib/auth/index.ts` wiring.
Breaks if removed: no tiered rate limiting exists; `scrape/route.ts` needs reverting too since it depends on the new signature.

[Next entry goes here]

Feature:
Why this shape:
Connects to:
Breaks if removed: