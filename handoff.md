# Handoff

## 1. Goal

Get this repo ready to open source. Three threads have touched `feat/tinyfish-provider` this session — one fully landed, two still mid-flight:

1. **TinyFish scraper provider** — committed (`6db3e2a`), tests still not written. See §3.
2. **Configurable rate limiting** — auth wiring landed (`46d29ac`), route-level tier application still pending, **repo still does not type-check** because of an unrelated pre-existing gap. See §4 — start here.
3. **Security hardening pass** (new this session) — dependency audit, error-message leaks, CSV row cap all landed and pushed. See §5.

Already landed and pushed to `origin/feat/tinyfish-provider` as of this session: `46d29ac`, `5b1cd17`, `aa4b823`, `9bf57b1` (see §5 for what's in each). Prior session's work (OpenRouter/Google fix, search-query rewrite, Serper content-fetch fix, TinyFish adapter, rate-limit config scaffolding) is unchanged from the last handoff — see §2/§3 for that history, not repeated here.

## 2. Committed work (landed on `feat/provider-picker`, pushed — unchanged from prior handoff)

Branch `feat/provider-picker` has these commits beyond the handoff-before-last's `f875744`/`04eb157`:

- `c84ba1b` — per-provider key status UI (server/local/missing, edit-mode modal path).
- `d2b1519` — first search-query fix: stopped over-quoting helper phrases in Profile/Metrics/Funding (0 results → 5-10).
- `ca4b6c7` — **OpenRouter/Google fix.** LanguageModel spec mismatch: `ai@4` speaks spec v1, `@ai-sdk/google`/`@openrouter/ai-sdk-provider` were on versions speaking newer specs that never populate the field `ai@4` reads from. Fixed by bumping `ai` 4→7 and all three LLM provider packages to spec-v4-compatible versions. Removed the `as unknown as LanguageModel` casts in `lib/providers/llm/registry.ts`.
- `6537355` — second search-query fix: wrapped the domain/name OR-choice in parens across Profile, Metrics, Funding, Tech Stack's GitHub query. Fixed a remaining over-quoting bug in Tech Stack's mentions query, merged General's 2-queries-per-field into 1.
- `493d0f2` — **Serper never fetched page content.** Wired the existing SSRF-hardened `fetchPageContent()` into `search()`, per-result parallel fetch, thin-content guard (<100 chars dropped).
- `ccad615` — added `FIXES_FEATURES.md` (full project history) and an AGENTS.md rule to keep it updated.

Known, accepted tradeoff from the Serper fix: `fetchPageContent` uses plain `fetch()`, no JS execution — pure client-rendered (SPA-only) pages return thin/empty content. Accepted because target pages are usually SSR'd or static, and Firecrawl/TinyFish (real headless browser) remain available as the escape hatch.

## 3. In progress, not committed — TinyFish scraper provider

Adapter + wiring committed at `6db3e2a` on `feat/tinyfish-provider` (branched off `feat/provider-picker` at `ccad615`). Integrates TinyFish as a 4th `ScraperProvider` — real headless browser rendering, closes the JS-rendering gap accepted as a Serper tradeoff above.

API: Search (`GET api.search.tinyfish.ai`) → `{results:[{position,site_name,snippet,title,url}], total_results}`, no result-count param, sliced client-side. Fetch (`POST api.fetch.tinyfish.ai`) → `{urls:[...max 10], format:'markdown'|'html'|'json'}` → `{results:[{url,text,...}], errors:[...]}`, one format per call. Auth: `X-API-Key` header both endpoints. Free tier: 30 search/min, 150 fetch-URLs/min.

**Done (committed):** `lib/providers/scraper/adapters/tinyfish.ts`, wired into `lib/providers/scraper/registry.ts`, `lib/providers/client-keys.ts`, `app/api/check-env/route.ts`, `app/api/enrich/route.ts`, `.env.example`. No changes needed to `provider-picker.tsx` or `/api/providers` (both read the registry generically). `tsc --noEmit` was clean for this thread in isolation before the rate-limit work landed on top.

**Not done yet:**
- Tests. `registry.test.ts`'s `listScrapers returns all three with required fields` test still fails (`expected length 3, got 4`). New `lib/providers/scraper/__tests__/tinyfish.test.ts` needed, mirroring `serper.test.ts`.
- No real TinyFish API key used yet — response shape and real-browser-rendering unverified against live traffic.
- `AGENTS.md`'s "Ships today" line still says "Firecrawl/Tavily/Serper".
- Plan: finish tests, verify, done — this thread is otherwise ready.

## 4. In progress, not committed — configurable rate limiting (route-level tier wiring, start here)

**User's ask:** tiered rate limiting — strict on auth routes, moderate on public endpoints, loose on authenticated user actions. Auth routes need per-IP *and* per-account limits, with exponential backoff instead of a hard lockout. Every threshold configurable via env.

**Process note:** this repo's AGENTS.md "Working Rules" (plan before code, explain existing code before touching it, one function/unit per step, explicit pause-and-approve after each increment) were followed strictly for the auth-wiring portion. Continue that cadence for the remaining steps.

### Current broken state (read this first)

`lib/rate-limit.ts`'s `getRateLimiter`/`isRateLimited` take a **required** `tier: {max, window}` param, no default. The one existing caller, `app/api/scrape/route.ts`, still calls `isRateLimited(request, 'scrape')` with 2 args — **this does not compile.** `tsc --noEmit` output right now:
```
app/api/scrape/route.ts(26,27): error TS2554: Expected 3 arguments, but got 2.
```
Not a bug to "fix" by adding a default back — user explicitly chose "make it required now, fix the one caller later" over a backwards-compatible default. This is step 1 below.

### Done and committed this session (`46d29ac`)

- `lib/rate-limit.ts` — added `redisSecondaryStorage`: implements better-auth's `SecondaryStorage` shape (`get`/`set`/`delete`/`increment`), backed by Upstash Redis via the same dev-bypass rule (`getBackoffRedis()`) as the existing backoff functions. `increment` does INCR-then-EXPIRE-only-on-first-write (non-atomic, same pattern as `recordAuthFailure`). Self-guarding — always returns a defined object, no conditional needed at the call site.
- `lib/auth/index.ts` — `secondaryStorage: redisSecondaryStorage` + `rateLimit: { enabled: true, storage: "secondary-storage", customRules: {...} }` for `/sign-in/email`, `/sign-up/email`, `/forget-password`, sized from `RATE_LIMIT_CONFIG.AUTH.IP_MAX`/`IP_WINDOW_SECONDS` (one shared `authIpRule` const). `hooks.before`/`after` (both `createAuthMiddleware`, self-filtered to `/sign-in/email` only, since both hooks match every path internally — confirmed via source) wiring `checkAuthBackoff`/`recordAuthFailure`/`clearAuthBackoff`. `ctx.body` is untyped at this generic level — email read via a local cast, not a Zod schema.

**Design decisions re-confirmed this session** (were previously "proposed, not separately confirmed" — now locked):
- Backoff scoped to `/sign-in/email` only, not sign-up or forget-password — re-confirmed.
- Storage backend: **Redis via `secondaryStorage`, not better-auth's in-memory default** — user explicitly chose this over the memory-default option when asked, reversing the prior session's tentative recommendation. This is now built and committed, not just proposed.

Verified via `tsc --noEmit` after each unit (clean except the pre-existing `scrape/route.ts` gap) and `next build` (compiles).

### Better-auth mechanics — verified via source, not memory (don't re-derive, don't guess)

Checked directly against `better-auth@1.6.23`, `node_modules/.pnpm/better-auth@1.6.23_.../dist/api/` and `node_modules/.pnpm/@better-auth+core@1.6.23_.../src/`:

- Built-in rate limiter off by default. `rateLimit: { enabled: true, customRules: {...} }` on `betterAuth({...})`.
- `customRules` keys are normalized paths without the `/api/auth` prefix. Value `{window: <seconds>, max: <number>}`.
- `SecondaryStorage` interface (`@better-auth/core/src/db/type.ts:307`): `get(key)`, `getAndDelete?(key)` (optional), `increment?(key, ttl)` (optional, atomic counter, TTL only applied on creation), `set(key, value, ttl?)`, `delete(key)`.
- `rateLimit.storage: "secondary-storage"` routes the limiter through `options.secondaryStorage` (verified in `dist/api/rate-limiter/index.mjs`'s `getRateLimitStorage`), using `increment` when present, falling back to get/set otherwise.
- `hooks: { before, after }` both always match every path internally (`matcher: () => true`) — must self-filter with `if (ctx.path !== "/sign-in/email") return;`.
- `ctx.body?.email` readable in both `before`/`after` for the sign-in-email endpoint, but typed `unknown` at the generic hook level — needs a local cast.
- IP resolution: `getIp(ctx.request, ctx.context.options)`, returns `string | null` (confirmed from source, `disableIpTracking` returns null).
- Block via `throw new APIError("TOO_MANY_REQUESTS", { message }, { "Retry-After": String(seconds) })`.
- Detect success/failure in `after`: `isAPIError(ctx.context.returned)`.
- `@better-auth/core` is a transitive dependency, not declared directly in `package.json` — avoided importing its types directly (structural typing used instead) to not rely on an undeclared package.

### Remaining steps (in order)

1. **`app/api/scrape/route.ts`** — fix the broken call: pass `RATE_LIMIT_CONFIG.AUTHENTICATED` as the third arg to `isRateLimited`. This is the only thing currently blocking a clean `tsc`/`build`.
2. **`app/api/enrich/route.ts`** — add `isRateLimited(request, 'enrich', RATE_LIMIT_CONFIG.AUTHENTICATED)` after `requireApiSession`, in both `POST` and `DELETE`.
3. **`app/api/chat/route.ts`** — same, `POST` + `DELETE`.
4. **`app/api/generate-fields/route.ts`** — same, `POST` only.
5. **`app/api/providers/route.ts`, `app/api/check-env/route.ts`** — no change (user decision: GET, cheap reads, no external API cost, stay unrated).
6. **`.env.example`** — document: `RATE_LIMIT_AUTH_IP_MAX`, `RATE_LIMIT_AUTH_IP_WINDOW_SECONDS`, `RATE_LIMIT_AUTH_BACKOFF_BASE_SECONDS`, `RATE_LIMIT_AUTH_BACKOFF_MULTIPLIER`, `RATE_LIMIT_AUTH_BACKOFF_MAX_SECONDS`, `RATE_LIMIT_PUBLIC_MAX`, `RATE_LIMIT_PUBLIC_WINDOW`, `RATE_LIMIT_AUTHENTICATED_MAX`, `RATE_LIMIT_AUTHENTICATED_WINDOW`.

### Decisions locked (don't relitigate without new info)

- DELETE `/api/enrich` and DELETE `/api/chat` get the same authenticated-tier limit as their POST counterparts.
- GET `/api/providers` and GET `/api/check-env` stay unrated.
- Per-account auth protection is exponential backoff only, no separate fixed per-account counter.
- `getRateLimiter`/`isRateLimited`'s `tier` param is hard-required, no default.
- Backoff scoped to `/sign-in/email` only.
- Rate-limit storage: Redis via `secondaryStorage`, not memory-default (built, see above).
- Better-auth's rate-limit storage question (cross-instance correctness) is now resolved by the Redis wiring — the "left as memory default" caveat from the prior handoff no longer applies.

## 5. Security hardening pass (new this session — landed and pushed)

User requested, in sequence: (a) secrets scan, (b) dependency audit, (c) error-handling review, (d) file-upload review. All done in one sitting, committed, pushed to `origin/feat/tinyfish-provider`.

**Secrets scan — clean, no code changes.** Regex-scanned tracked files for key-shaped literals (`sk-`, `AIza`, `ghp_`, `xox[baprs]-`, `AKIA`, etc.), checked `NEXT_PUBLIC_*` usage (zero exist in the repo), checked `next.config.ts` for `env:` exposure, checked full git history for ever-committed `.env`/`.env.local` (only `.env.example` ever touched), checked `.gitignore` coverage, checked `check-env`'s route for value leakage (booleans only, gated behind session). Zero real findings. **Outstanding, not code:** a Serper API key was pasted in plaintext into an earlier chat session for debugging (carried over from a prior handoff) — confirm it's rotated in the Serper dashboard if not already done.

**Dependency audit — `5b1cd17`.** `pnpm audit` found 94 advisories (2 critical, 42 high, 45 moderate, 5 low). Triaged by reachability (checked actual imports and `pnpm why` chains, not just advisory metadata):
- Removed `@langchain/core`, `@langchain/langgraph`, `@langchain/openai` — zero source imports anywhere, confirmed via import-statement grep, not just string matches. Killed the critical `form-data` chain and a high `@langchain/core` secret-extraction advisory for free.
- Bumped `next` 15.3.2 → 15.5.20 (latest patched 15.x, the `backport` npm dist-tag — deliberately not the v16 major, which is current `latest`). Cleared the critical RCE in React flight protocol plus every other `next` advisory (SSRF, cache poisoning, DoS). Bumped `eslint-config-next` to match.
- `axios` and `form-data` were still critical/high after the above — both pinned deep inside `firecrawl-js`/`@tavily/core`/`openai`'s own lockfiles, not top-level deps. Forced via `pnpm.overrides`: `axios: "^1.18.1"`, `form-data: ">=4.0.4"`.
- Result: 0 critical, down from 42 high/45 moderate to 17/17.
- Verified via `tsc --noEmit` after every step and one full `next build` (compiles clean; only pre-existing `jose`/Edge-Runtime warnings from better-auth, unrelated).

**Remaining from the audit, not done — pick up here if continuing this thread:**
- An in-range `pnpm update` pass was scoped but not run — should clear `mdast-util-to-hast` (13.2.0 → needs 13.2.1, one patch behind), a stray duplicate `prismjs@1.27.0` copy nested via `react-syntax-highlighter > refractor` (separate from the already-fine 1.30.0 copy), plus `lodash`/`lodash-es`/`uuid`/`postcss`/`follow-redirects`/`yaml`.
- `@xmldom/xmldom` (5 high XML-injection/DoS advisories, via `pixi.js`, confirmed live in `components/app/(home)/sections/hero/`) — reachability confirmed, fix not yet decided. Check what version `pixi.js` itself allows before deciding override vs. accept.
- Dev/build-only toolchain vulns (`esbuild`, `glob`, `minimatch`, `picomatch`, `brace-expansion` via `tailwindcss@3`'s `sucrase` chain; `ajv`/`js-yaml`/`flatted`/`@eslint/plugin-kit` via eslint's `eslintrc` compat layer) — proposed as accepted risk (never shipped, not reachable from a request), not explicitly re-confirmed by the user as a final decision.
- Two lockfiles still committed (`pnpm-lock.yaml`, updated by this work; `package-lock.json`, untouched, now more stale than before) — still needs a pick-one decision before going public.

**Error-handling review — `aa4b823`.** Scanned all 7 `app/api/**/route.ts` handlers. 5 spots in `enrich`/`chat`'s SSE streams echoed `error.message` (or `details: error.message`) straight into the client response, 3 of them with no server-side logging at all. Each now `console.error`'s the full error and returns a generic message. `scrape/route.ts`, `generate-fields/route.ts`, `providers/route.ts`, `check-env/route.ts` were already doing this correctly (not touched). `auth/[...all]/route.ts` fully delegates to better-auth's own handler — not customized, out of scope.

**File-upload review — no vulnerability found, one hygiene fix landed (part of `aa4b823`).** Only upload surface in the app: `components/super-enrich/csv-uploader.tsx` (CSV via `react-dropzone` + `papaparse`). Key fact: the raw file **never reaches the server** — `Papa.parse` runs entirely client-side via `FileReader`; only parsed JSON (rows/fields) crosses the network to `/api/enrich`, already capped server-side at 5MB via content-length check. No `multer`/`formidable`/disk writes/blob storage anywhere in the repo (confirmed via repo-wide grep) — "stored outside web root" and "never executed as code" are moot, there's no file-storage surface to secure. Confirmed no `eval`/`new Function`/`dangerouslySetInnerHTML` touches parsed CSV values anywhere in `components/super-enrich/`. The one real (low-severity, client-only) gap: `useDropzone`'s `accept` option is a picker-dialog hint only, easily bypassed, and no `maxSize` existed. Fixed: added `maxSize: 10MB` + an `onDropRejected` handler (dropzone doesn't route rejections through `onDrop` — was silently dropping files with zero feedback before this).

**Row cap — `aa4b823`, same commit as the error-handling fix.** User asked to cap rows per enrichment at 1000 (not 200 as first floated) as a hard, always-on ceiling — separate from `SUPER_ENRICH_CONFIG.CSV_LIMITS.MAX_ROWS` (15/`Infinity`, the pre-existing demo-tier gate that's bypassed in unlimited/self-hosted mode). New `ENRICHMENT_CONFIG.MAX_ROWS_PER_REQUEST` (`lib/config/enrichment.ts`), enforced server-side in `/api/enrich` (the real boundary — closes the "no server-side row cap" gap flagged in §6 below) and client-side in the CSV uploader for fast feedback.

`FIXES_FEATURES.md` updated with all of the above (`9bf57b1`).

## 6. Dead code found (flagged, not touched)

Unchanged from the prior handoff — confirmed still unreachable, nothing imports them:
- `lib/agent-architecture/agents/*.ts` (discovery-agent, company-profile-agent, metrics-agent, funding-agent, tech-stack-agent, general-agent)
- `lib/services/specialized-agents.ts`
- `lib/agent-architecture/tools/smart-search-tool.ts`

Confirmed via `lib/agent-architecture/index.ts`, which only exports `orchestrator.ts`'s `AgentOrchestrator` — the only orchestrator class `AgentEnrichmentStrategy` (used by `app/api/enrich/route.ts`) ever instantiates. Pre-provider-abstraction leftovers, contain an even worse version of the over-quoting bug fixed in `6537355`. Not touched — unreachable, no user-facing effect.

Side effect: `AGENTS.md`'s Layout table entry (`lib/agent-architecture/agents/` → "Per-phase agents") is stale — describes dead code as if it were live.

## 7. Other open items (carried over, not yet done)

- **Per-phase error isolation** (`lib/agent-architecture/orchestrator.ts`, `enrichRow`'s top-level catch): one phase throwing still discards all other phases' results for that row.
- **Extraction resilience** (`lib/providers/llm/extraction.ts`): `generateObject` call sites still have no empty-content guard / try-catch for a model that returns plain text instead of calling the tool.
- Remaining security findings, unfixed: open signup rides the operator's env keys; `llmModelId`/`scraperId` not checked against an allowlist; no ownership check on job cancel (any authenticated user can cancel any run by sessionId — `activeSessions`/`activeQueries` are global maps); no Zod on enrich/generate-fields bodies; BYOK keys in plaintext `localStorage` (deliberately deferred, see §8).
- Two live `cn()` helpers (`lib/utils.ts` vs `utils/cn.ts`) — not consolidated.
- Two lockfiles committed (see §5 — now further out of sync, `pnpm-lock.yaml` updated by the dependency audit, `package-lock.json` untouched).
- `ARCHITECTURE.md` now has real entries going forward, but the rebrand and provider-picker migration from earlier sessions were never backfilled into it.
- `about.md` documents the project's origin (forked from Firecrawl's Fire Enrich demo; LICENSE still carries the Mendable AI copyright). Point new readers there.

## 8. Decisions locked (don't relitigate without new info)

- BYOK key storage stays in `localStorage`, not moved to session/server storage. Known XSS-exposure tradeoff, accepted deliberately — flagged again during this session's secrets scan, not changed.
- No live pre-test of a submitted key — rely on `/api/enrich`'s existing "missing/invalid key" error.
- `/api/chat` stays hardcoded to Firecrawl + OpenAI, gated behind `chatEnabled` computed at Start time — not made provider-aware.
- Serper's JS-rendering gap (plain `fetch()`, no headless browser) is an accepted tradeoff, not a bug to fix.
- Enrichment row cap: 1000, hard ceiling, always-on regardless of unlimited/self-hosted mode (§5).

## 9. Commit status

`feat/provider-picker`: everything through `ccad615` committed and pushed to `origin/feat/provider-picker`.

`feat/tinyfish-provider`: branched from `feat/provider-picker` at `ccad615`. Working tree is **clean** — everything through this session is committed and pushed to `origin/feat/tinyfish-provider`:

```
9bf57b1 docs: log auth/deps/error-handling/row-cap session in FIXES_FEATURES.md
aa4b823 fix(enrich): stop leaking raw errors to clients, cap rows at 1000
5b1cd17 fix(deps): drop unused langchain, patch next/axios/form-data CVEs
46d29ac feat(auth): back better-auth rate limiter with Redis, add sign-in backoff
9a267c4 wip(rate-limit): tier-based limiter config + auth backoff functions
6db3e2a feat(providers): add TinyFish scraper provider (wip, no tests yet)
```

`tsc --noEmit` currently reports exactly one error, pre-existing from `9a267c4`, not introduced this session:
```
app/api/scrape/route.ts(26,27): error TS2554: Expected 3 arguments, but got 2.
```
This is §4 step 1. Fixing it is the fastest path to a fully green build.

Three independent things remain before this branch is ready to merge/open-source, none blocking each other:
1. Rate-limit route wiring (§4, steps 1-6) — fixes the build.
2. TinyFish tests (§3).
3. Dependency audit remainder (§5: in-range `pnpm update`, `@xmldom/xmldom` decision, dev-tooling accept-risk confirmation).

Recommend finishing §4 step 1 first (one-line fix, unblocks the build), then picking whichever of the other two threads matters more.
