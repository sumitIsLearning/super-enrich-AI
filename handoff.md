# Handoff

## 1. Goal

Get this repo ready to open source. Two threads are mid-flight on `feat/tinyfish-provider`, both uncommitted:

1. **TinyFish scraper provider** — adapter + wiring done, tests not written. See §3.
2. **Configurable rate limiting** — new this session, mid-flight, **repo currently does not type-check** because of it. See §4 — start here.

Already landed (previous session, see §2): OpenRouter/Google spec-mismatch fix, search-query rewrite, Serper content-fetch fix.

## 2. Committed work (landed on `feat/provider-picker`, pushed)

Branch `feat/provider-picker` has these commits beyond the prior handoff's `f875744`/`04eb157`:

- `c84ba1b` — per-provider key status UI (server/local/missing, edit-mode modal path).
- `d2b1519` — first search-query fix: stopped over-quoting helper phrases in Profile/Metrics/Funding (0 results → 5-10).
- `ca4b6c7` — **OpenRouter/Google fix.** Root cause was a LanguageModel spec mismatch: `ai@4` speaks spec v1, `@ai-sdk/google`/`@openrouter/ai-sdk-provider` were on versions speaking newer specs that never populate the field `ai@4` reads from, so every OpenRouter/Google extraction call threw `AI_NoObjectGeneratedError`. Fixed by bumping `ai` 4→7 and all three LLM provider packages to versions that compile to the same spec (v4). Removed the `as unknown as LanguageModel` casts in `lib/providers/llm/registry.ts`. Verified live end-to-end by the user against real OpenRouter and Google models.
- `6537355` — second search-query fix, broader: `site:X OR "name" kw1 kw2` has no parens, so `OR` doesn't group the way it reads and the `site:` filter often did nothing. Wrapped the domain/name choice in parens and OR'd the keyword set across Profile, Metrics, Funding, and Tech Stack's GitHub query. Also fixed a still-present over-quoting bug in Tech Stack's mentions query, and merged General's 2-queries-per-field into 1.
- `493d0f2` — **Serper never fetched page content.** Serper's search API only returns Google snippet metadata (url/title/description), never page text, so every orchestrator phase fed empty content blocks into extraction regardless of query quality. Fixed by wiring the existing SSRF-hardened `fetchPageContent()` into `search()`, fetched per result in parallel, with a thin-content guard (<100 chars dropped).
- `ccad615` — added `FIXES_FEATURES.md` (full project history) and an AGENTS.md rule to keep it updated.

Known, accepted tradeoff from the Serper fix: `fetchPageContent` uses plain `fetch()`, no JS execution — pure client-rendered (SPA-only) pages return thin/empty content. Accepted because target pages (company about/product pages) are usually SSR'd or static, and Firecrawl/TinyFish (real headless browser) remain available as the escape hatch.

## 3. In progress, not committed — TinyFish scraper provider

New branch `feat/tinyfish-provider`, created off `feat/provider-picker` at `ccad615`. Integrates TinyFish as a 4th `ScraperProvider` — its Fetch API renders via a real headless browser (JS/SPA-safe), closing the JS-rendering gap accepted as a tradeoff for Serper above.

API researched from their OpenAPI specs (`docs.tinyfish.ai/openapi/{search,fetch}.json`):
- Search: `GET api.search.tinyfish.ai?query=...` → `{results:[{position,site_name,snippet,title,url}], total_results}`. No result-count param — must slice client-side.
- Fetch: `POST api.fetch.tinyfish.ai` → body `{urls:[...max 10], format:'markdown'|'html'|'json'}` → `{results:[{url,text,...}], errors:[...]}`. One format per call.
- Auth: `X-API-Key` header, both endpoints. Free tier: 30 search/min, 150 fetch-URLs/min.

**Done (uncommitted, working tree):**
- `lib/providers/scraper/adapters/tinyfish.ts` (new) — full `ScraperProvider` impl. `search()`: Search API → batch-fetch content in one Fetch call → same thin-content guard as Serper. `scrapeUrl()`: 2 parallel Fetch calls (markdown + html). `searchWithMultipleQueries()`: same dedup-loop pattern as the other 3 adapters.
- Wired end-to-end: `lib/providers/scraper/registry.ts`, `lib/providers/client-keys.ts`, `app/api/check-env/route.ts`, `app/api/enrich/route.ts`, `.env.example`.
- No changes needed to `provider-picker.tsx` or `/api/providers` — both read the scraper registry generically.
- Verified so far: `tsc --noEmit` clean after both the adapter and the wiring steps (**before** this session's rate-limit changes — see §4 for the now-broken state).

**Not done yet:**
- Tests. `registry.test.ts`'s `listScrapers returns all three with required fields` test now fails (`expected length 3, got 4`). New `lib/providers/scraper/__tests__/tinyfish.test.ts` needed, mirroring `serper.test.ts`.
- No real TinyFish API key used yet — response shape and "real browser rendering" unverified against live traffic.
- `AGENTS.md`'s "Ships today" line still says "Firecrawl/Tavily/Serper".
- Plan: finish tests, verify, then commit + push `feat/tinyfish-provider` (this predates the rate-limit work below and is still the plan for this thread specifically).

## 4. In progress, not committed — configurable rate limiting (this session, start here)

**User's ask:** tiered rate limiting — strict on auth routes, moderate on public endpoints, loose on authenticated user actions. Auth routes need per-IP *and* per-account limits, with exponential backoff instead of a hard lockout. Every threshold configurable via env, not hardcoded.

**Process note:** this repo's AGENTS.md "Working Rules" were followed strictly this session — plan before code, explain existing code before touching it, one function/unit per step, explicit pause-and-approve after each increment. Continue that cadence; don't batch-implement the remaining steps below in one shot unless the user says otherwise.

### Current broken state (read this first)

`lib/rate-limit.ts`'s `getRateLimiter`/`isRateLimited` now take a **required** `tier: {max, window}` param instead of the old hardcoded 50/day. The user explicitly chose "make it required now, fix the one caller later" over a backwards-compatible default. The one existing caller, `app/api/scrape/route.ts`, still calls `isRateLimited(request, 'scrape')` with 2 args — **this does not compile right now.** Not a bug to "fix" by adding a default back; it's step 2 below.

### Done this session

- `lib/config/rate-limit.ts` (new) — `RATE_LIMIT_CONFIG` with three tiers, every field env-var-backed with a default:
  - `AUTH`: `IP_MAX`/`IP_WINDOW_SECONDS` (20 per 900s default — feeds better-auth's native limiter, seconds not a Duration string), `BACKOFF_BASE_SECONDS`/`BACKOFF_MULTIPLIER`/`BACKOFF_MAX_SECONDS` (30/2/3600 default).
  - `PUBLIC`: `MAX`/`WINDOW` (100 per "1 h" — unused today, no unauthenticated route exists).
  - `AUTHENTICATED`: `MAX`/`WINDOW` (50 per "1 d" — matches the old hardcoded default so nothing silently changes for `scrape` once it's updated).
- `lib/rate-limit.ts` — `getRateLimiter(key, tier)` / `isRateLimited(request, key, tier)` generalized off the hardcoded 50/day. Added `recordAuthFailure(ip, accountKey)` / `checkAuthBackoff(ip, accountKey)` / `clearAuthBackoff(ip, accountKey)` — Redis-backed (`authfail:count:*`, `authfail:blocked:*` keys), same dev-bypass rule as the existing limiter (no-op outside production without `UPSTASH_REDIS_REST_URL`).
- Built then **removed** in the same session: `isAccountRateLimited` (fixed-window per-account counter via Upstash). Removed because the user's "per-account limits with exponential backoff" reads as backoff *being* the per-account mechanism — nothing else needs a separate fixed per-account cap. If you're reading old context and see this function referenced, it's gone on purpose.

### Better-auth mechanics — verified via source, not memory (don't re-derive, don't guess)

Checked directly against the installed version (`better-auth@1.6.23`, `node_modules/.pnpm/better-auth@1.6.23_.../dist/api/`):

- **Built-in rate limiter exists already**, off by default. Turn on with `rateLimit: { enabled: true, customRules: {...} }` on the `betterAuth({...})` options object in `lib/auth/index.ts`.
- `customRules` keys are **normalized paths without the `/api/auth` prefix** — e.g. `"/sign-in/email"`, `"/sign-up/email"`, `"/forget-password"`. Value is `{window: <seconds>, max: <number>}` (plain seconds, **not** an Upstash `Duration` string — this is why `AUTH.IP_WINDOW_SECONDS` is a number, unlike the Duration-typed fields elsewhere in the config).
- Better-auth already ships hardcoded defaults if you just enable it with no `customRules` (3 attempts/10s on sign-in/sign-up/change-password/change-email; 3/60s on password-reset/verification paths) — but these aren't configurable via our env vars, which is why we override them via `customRules` sourced from `RATE_LIMIT_CONFIG.AUTH`.
- `hooks: { before: createAuthMiddleware(async (ctx) => {...}), after: createAuthMiddleware(async (ctx) => {...}) }` — both imported from `"better-auth/api"`. **Both always match every path** (internally `matcher: () => true`) — must self-filter with `if (ctx.path !== "/sign-in/email") return;` inside the handler.
- `ctx.body?.email` is readable in both `before` and `after` for the sign-in-email endpoint.
- IP resolution: `getIp(ctx.request, ctx.context.options)`, imported from `"better-auth/api"` — same helper the built-in limiter uses internally, respects `advanced.ipAddress.trustedProxies`/`ipAddressHeaders` if configured.
- To block in `hooks.before`: `throw new APIError("TOO_MANY_REQUESTS", { message: "..." }, { "Retry-After": String(seconds) })`. `APIError` constructor is `(statusKeyOrCode, body, headers)` — all three (`APIError`, `createAuthMiddleware`, `getIp`, `isAPIError`) confirmed exported from `"better-auth/api"`.
- To detect success vs. failure in `hooks.after`: `isAPIError(ctx.context.returned)`. `ctx.context.returned` holds the endpoint's result on success **or** the caught `APIError` on failure — `after` hooks run in both cases, confirmed by reading `dispatchAuthEndpoint` in `dist/api/dispatch.mjs` (the endpoint call is try/caught, `APIError` gets turned into `result.response` before `runAfterHooks` runs).

### Remaining steps (in order)

1. **`lib/auth/index.ts`** — add `rateLimit.customRules` for `/sign-in/email`, `/sign-up/email`, `/forget-password` (all using `RATE_LIMIT_CONFIG.AUTH.IP_MAX`/`IP_WINDOW_SECONDS`), plus `hooks.before`/`hooks.after` wiring `checkAuthBackoff`/`recordAuthFailure`/`clearAuthBackoff`. Not started — session ended mid-explanation before this was written.
2. **`app/api/scrape/route.ts`** — fix the now-broken call: pass `RATE_LIMIT_CONFIG.AUTHENTICATED` as the third arg.
3. **`app/api/enrich/route.ts`** — add `isRateLimited(request, 'enrich', RATE_LIMIT_CONFIG.AUTHENTICATED)` after `requireApiSession`, in both `POST` and `DELETE`.
4. **`app/api/chat/route.ts`** — same as enrich, `POST` + `DELETE`.
5. **`app/api/generate-fields/route.ts`** — same, `POST` only.
6. **`app/api/providers/route.ts`, `app/api/check-env/route.ts`** — no change (user decision, see below).
7. **`.env.example`** — document the new vars: `RATE_LIMIT_AUTH_IP_MAX`, `RATE_LIMIT_AUTH_IP_WINDOW_SECONDS`, `RATE_LIMIT_AUTH_BACKOFF_BASE_SECONDS`, `RATE_LIMIT_AUTH_BACKOFF_MULTIPLIER`, `RATE_LIMIT_AUTH_BACKOFF_MAX_SECONDS`, `RATE_LIMIT_PUBLIC_MAX`, `RATE_LIMIT_PUBLIC_WINDOW`, `RATE_LIMIT_AUTHENTICATED_MAX`, `RATE_LIMIT_AUTHENTICATED_WINDOW`.

### Decisions explicitly confirmed by the user this session

- DELETE `/api/enrich` and DELETE `/api/chat` get the same authenticated-tier limit as their POST counterparts.
- GET `/api/providers` and GET `/api/check-env` stay unrated — cheap reads, no external API cost.
- Per-account auth protection is exponential backoff only, no separate fixed per-account counter (`isAccountRateLimited` removed after being built — see above).
- `getRateLimiter`/`isRateLimited`'s `tier` param is hard-required, no default — user chose the temporary compile break over silently preserving old behavior.

### Design proposed, not separately re-confirmed (stated as a recommendation, no objection raised, session ended before double-checking)

- Backoff (`hooks.before`/`after`) scoped to `/sign-in/email` only, not sign-up or forget-password: sign-up has no existing account to protect, and account-keyed backoff on password-reset risks leaking whether an email has an account. Per-IP `customRules` still apply to all three paths.
- Better-auth's rate-limit storage left as default `"memory"` — resets per instance/cold start, so the effective cap multiplies across instances on a multi-instance/serverless deployment. Not built out further since nothing asked for cross-instance correctness yet. If it becomes a real problem: `storage: "database"` (needs a new `rateLimit` table + drizzle migration) or a custom `secondaryStorage` adapter wrapping the same Upstash Redis already used elsewhere (no migration, more code).

If picking this up fresh: re-confirm both of the above with the user before writing `lib/auth/index.ts`, since they weren't put through the same explicit question-and-answer the other decisions got.

## 5. Dead code found (flagged, not touched)

While tracing the live enrichment code path to scope the TinyFish/Serper work, confirmed these files are **unreachable** — nothing imports them:
- `lib/agent-architecture/agents/*.ts` (discovery-agent, company-profile-agent, metrics-agent, funding-agent, tech-stack-agent, general-agent)
- `lib/services/specialized-agents.ts`
- `lib/agent-architecture/tools/smart-search-tool.ts`

Confirmed via `lib/agent-architecture/index.ts`, which only exports `orchestrator.ts`'s `AgentOrchestrator` — the only orchestrator class `AgentEnrichmentStrategy` (used by `app/api/enrich/route.ts`) ever instantiates. Pre-provider-abstraction leftovers, contain an even worse version of the over-quoting bug fixed in `6537355`. Not touched — unreachable, no user-facing effect.

Side effect: `AGENTS.md`'s Layout table entry (`lib/agent-architecture/agents/` → "Per-phase agents") is stale — describes dead code as if it were live.

## 6. Other open items (carried over, not yet done)

- **Per-phase error isolation** (`lib/agent-architecture/orchestrator.ts`, `enrichRow`'s top-level catch): one phase throwing still discards all other phases' results for that row.
- **Extraction resilience** (`lib/providers/llm/extraction.ts`): `generateObject` call sites still have no empty-content guard / try-catch for a model that returns plain text instead of calling the tool.
- Remaining security findings, unfixed: open signup rides the operator's env keys; `llmModelId`/`scraperId` not checked against an allowlist; no server-side row cap. No ownership check on job cancel; no Zod on enrich/generate-fields bodies; BYOK keys in plaintext `localStorage` (deliberately deferred).
- Two live `cn()` helpers (`lib/utils.ts` vs `utils/cn.ts`) — not consolidated.
- Two lockfiles committed (`pnpm-lock.yaml` + `package-lock.json`) — pick one before going public.
- `ARCHITECTURE.md` now has real entries going forward, but the rebrand and provider-picker migration from earlier sessions were never backfilled into it.
- `about.md` documents the project's origin (forked from Firecrawl's Fire Enrich demo; LICENSE still carries the Mendable AI copyright). Point new readers there.
- A Serper API key was pasted in plaintext into a chat session in an earlier session, for debugging — confirm it's been rotated in the Serper dashboard if that hasn't happened yet.

## 7. Decisions locked (don't relitigate without new info)

- BYOK key storage stays in `localStorage`, not moved to session/server storage.
- No live pre-test of a submitted key — rely on `/api/enrich`'s existing "missing/invalid key" error.
- `/api/chat` stays hardcoded to Firecrawl + OpenAI, gated behind `chatEnabled` computed at Start time — not made provider-aware.
- Serper's JS-rendering gap (plain `fetch()`, no headless browser) is an accepted tradeoff, not a bug to fix.

## 8. Commit status

`feat/provider-picker`: everything through `ccad615` is committed and pushed to `origin/feat/provider-picker`.

`feat/tinyfish-provider`: branched from `feat/provider-picker` at `ccad615`. **Nothing on this branch is committed.** Working tree currently carries two unrelated pieces of work:
- TinyFish adapter + wiring (§3) — needs tests, then commit.
- Rate-limiting work (§4) — mid-flight, **repo does not currently type-check** (`scrape/route.ts` vs. the new `isRateLimited` signature). Needs steps 1-7 in §4 before it's committable.

Modified/untracked as of session end: `.env.example`, `ARCHITECTURE.md`, `FIXES_FEATURES.md`, `app/api/check-env/route.ts`, `app/api/enrich/route.ts`, `handoff.md`, `lib/providers/client-keys.ts`, `lib/providers/scraper/registry.ts`, `lib/rate-limit.ts` (modified); `lib/config/rate-limit.ts`, `lib/providers/scraper/adapters/tinyfish.ts` (new, untracked).

Recommend finishing and committing one thread before starting the other — they're unrelated and currently tangled in the same working tree.
