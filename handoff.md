# Handoff

## 1. Goal

Get this repo ready to open source. Three threads have moved since the last handoff:

1. **Re-branding** — done, committed (`f875744`).
2. **Provider-picker migration** — done, committed (`04eb157`). Users can now pick scraper + LLM on the main page and supply their own key; the duplicate `/super-enrich` route is gone.
3. **OpenRouter enrichment is broken** — root-caused this session, **not yet fixed**. This is where the next session starts. See §4.

## 2. Current state

Branch `feat/provider-picker`. Auth + DB foundation, the SSRF fix, and the security pass from earlier sessions are unchanged.

Committed:
- `f875744` — rebrand (Firecrawl assets → Super Enrich).
- `04eb157` — provider-picker migration (restructure `app/super-enrich/` → `components/super-enrich/`, `lib/providers/client-keys.ts`, `check-env` reports all 6 provider keys, start-time key gate, picker restyled to `DESIGN.md`).

Uncommitted (working tree):
- `app/page.tsx`, `components/super-enrich/provider-picker.tsx` — inline per-provider key status ("Key set (server)" / "Key set · Change" / "Key needed · Add") so users can see and update a saved key without devtools. See §3.
- `lib/agent-architecture/orchestrator.ts` — un-quoted 3 over-constrained search queries (profile/metrics/funding) that were returning 0 Serper results. Verified empirically (0 → 10 results for a test domain). See §3.
- `lib/providers/llm/models-config.ts` — replaced 2 stale/broken OpenRouter model slugs with 6 verified-against-live-API entries. Now working end-to-end — see §4.

## 3. What changed this session (uncommitted, working, ready to commit)

### Key-status UI (Option 1 from "how does a user change their key")

Problem: once a key was saved to localStorage, there was no visual way to see or change it short of devtools.

- `app/page.tsx`: added `envStatus` state (fetched from `/api/check-env` on mount), `keysVersion` counter (bumped on save to force recompute since localStorage isn't reactive), a `keyStatus` memo (per provider: `server` / `local` / `none`), and `openKeyEditor(id)` which opens the existing key modal pre-scoped to one provider with no pending enrichment (pure edit mode). Modal title/description now branch on `pendingEnrichment` (gate vs edit).
- `provider-picker.tsx`: accepts new `keyStatus` / `onManageKey` props, renders a status line under each dropdown (plain text if server-managed, a clickable "Key set · Change" / "Key needed · Add" link otherwise).
- Verified: `npx tsc --noEmit` clean, `next lint` clean.

### Search query fix (unrelated bug found while testing)

Enrichment was returning 0 fields for every profile/metrics/funding lookup. Traced to Serper queries that AND-quoted multiple helper phrases (e.g. `"founded in" "year founded" "based in"`), which Google/Serper treats as required exact-match strings — stacking them collapses results to zero. Verified with a live curl comparison: over-quoted query → 0 results, same query with quotes stripped from the helper phrases → 10 results.

Fixed in `orchestrator.ts`: kept `"${companyName}"` quoted (exact match wanted), dropped quotes from the surrounding keywords in the profile (line ~638), metrics (~793), and funding (~941) query builders.

**This fix is real and still valid** — confirmed profile search went from `Found 0 search results` to `Found 5 search results` in a live run. It surfaced the next bug (below).

## 4. OpenRouter/Google models — fixed this session

**Resolved.** Root cause was a LanguageModel spec-version mismatch between the AI SDK core and two of the three provider packages (see original investigation below, still accurate as history).

Fix applied: bumped `ai` 4.3.16 → 7.0.19, `@ai-sdk/openai` 1.3.22 → 4.0.11, `@ai-sdk/google` 4.0.2 → 4.0.11, `@openrouter/ai-sdk-provider` 2.10.0 → 3.0.0, `zod` 3.25.3 → 3.25.76 (floor bump only, stayed on zod 3.x). Confirmed by inspecting the actual installed package internals that all three providers now compile to spec `v4`, matching `ai@7`'s supported `V2 | V3 | V4` union — not just trusting semver ranges.

Removed the `as unknown as LanguageModel` casts in `lib/providers/llm/registry.ts` (were papering over the mismatch at the type level) — compiles clean without them, confirming the types now align natively rather than by force.

No changes needed in `extraction.ts`: `generateObject`'s `model`/`schema`/`system`/`prompt`/`temperature` params and `.object` return shape are unchanged in `ai@7` (`system` is deprecated in favor of `instructions` but still functional — left as-is, cosmetic only).

Verified: `tsc --noEmit` clean, `next lint` clean (2 pre-existing warnings, unrelated files), `vitest run` 35/35 passing (including the `vi.mock('ai', ...)`-based extraction tests, confirming the mock still resolves correctly under `ai@7`'s ESM-only requirement). Live end-to-end enrichment confirmed working by the user against real OpenRouter/Google models.

Not done as part of this fix (optional, flagged not required): renaming `system` → `instructions` in `extraction.ts`; adding `"engines": {"node": ">=22"}` to `package.json`.

### Original investigation (kept for history)

### Symptom

Any OpenRouter model (tried Llama 3.3, then DeepSeek V4 Flash after a model swap) throws on every extraction call:

```
Error [AI_NoObjectGeneratedError]: No object generated: the tool was not called.
    at async Object.extractStructuredDataWithCorroboration (lib\providers\llm\extraction.ts:143:25)
```

This happens even with real search results present (5 results, post query-fix) — so it is **not** a search or model-capability problem. Row returns 0 enriched fields; the whole row silently degrades because the top-level catch in `enrichRow` swallows the error and returns `enrichments: {}` (see §5, pre-existing issue, still open).

### Root cause (confirmed via static analysis of installed packages, high confidence, not yet empirically re-verified after a fix)

Version/spec mismatch between the AI SDK core and the OpenRouter provider package, not a model or query problem:

- `ai@4.3.16` (installed) speaks LanguageModel spec **v1**. Its `generateObject` tool path (`node_modules/ai/dist/index.mjs:2886-2911`) calls `model.doGenerate({ mode: { type: "object-tool", tool: {...} } })` and reads the answer from `result.toolCalls[0].args`.
- `@openrouter/ai-sdk-provider@2.10.0` (installed) is spec **v3** — its own `package.json` declares `peerDependencies: { "ai": "^6.0.0" }`. It returns tool calls as `content: [{ type: "tool-call", ... }]` (`node_modules/@openrouter/ai-sdk-provider/dist/index.js:3731`), never populating `result.toolCalls`.
- So `ai@4` always reads `result.toolCalls` as `undefined` for any OpenRouter model → throws "the tool was not called," regardless of which model is selected or whether it supports tool-calling upstream.

Cross-check: `@ai-sdk/openai@1.3.22` (the one provider that works) is spec **v1** — matches `ai@4` exactly. `@ai-sdk/google@4.0.2` is spec **v4** — same mismatch pattern as OpenRouter, so **Gemini models are predicted to fail the same way** (not yet empirically confirmed — do this first in the next session, it's a 2-minute test that corroborates or kills the root-cause theory).

### Fix directions discussed, not yet decided or built

1. **(leaning this one)** Route OpenRouter through the already-working v1-spec `@ai-sdk/openai` provider via its OpenAI-compatible `baseURL`: `createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })` in `lib/providers/llm/registry.ts`. Smallest change, would also fix Google the same way if routed similarly. Model ids for OpenRouter already use `vendor/model` slugs (e.g. `deepseek/deepseek-v4-flash`), which is exactly what OpenRouter's OpenAI-compatible endpoint expects as its `model` field — should work unmodified.
2. Downgrade `@openrouter/ai-sdk-provider` to a version whose peerDep is `ai@^4` (v1 spec). Keeps the dedicated provider, less future-proof.
3. Upgrade the whole stack to `ai@6` + matching v6 provider versions for openai/google/openrouter. Correct long-term, but touches every `generateObject`/`streamText` call site — bigger, riskier change for this session's scope.

### Next session starting point

1. Confirm the Gemini prediction (pick a `google:*` model, run one enrichment, expect the same `NoObjectGeneratedError` shape).
2. Decide between fix options above with the user (leaning #1).
3. Implement, then re-run full end-to-end verification: default Firecrawl+OpenAI path, alt-provider gate modal, partial gate, skip-list, chat guard — plus specifically an OpenRouter and a Google model enrichment to confirm the fix.
4. Consider whether to also fix the two items this blocker exposed (see §5) while in this file: per-phase result isolation, and empty-content extraction guard.

## 5. Other open items (carried over, not yet done)

- **Per-phase error isolation** (`lib/agent-architecture/orchestrator.ts`, `enrichRow`'s top-level catch ~line 263): one phase throwing currently discards all other phases' results for that row (e.g. a working Discovery phase gets wiped by a failing Profile phase). Should wrap each phase call in its own try/catch and accumulate partial results instead.
- **Extraction resilience** (`lib/providers/llm/extraction.ts`): `extractStructuredDataWithCorroboration` / `extractStructuredDataOriginal` have no empty-content guard and no try/catch around `generateObject` — a model returning plain text (e.g. genuinely "no data found") throws instead of degrading to `{}`. Six call sites in `orchestrator.ts` (profile, metrics, funding, techStack, general, plus the `Original` variant) feed this; only the last has any guard today.
- Remaining security findings, unfixed: open signup rides the operator's env keys (`lib/auth/index.ts`, `app/api/enrich/route.ts`); `llmModelId`/`scraperId` not checked against an allowlist and no server-side row cap (`app/api/enrich/route.ts`); rate limiting only on `/api/scrape`, not `/api/enrich` or `/api/chat` (`lib/rate-limit.ts`). Lower severity: no ownership check on job cancel, no Zod on enrich/generate-fields bodies, browser keys sit in plaintext `localStorage` (deliberately deferred, see decision log below).
- Two live `cn()` helpers (`lib/utils.ts` vs `utils/cn.ts`), both intentional. Decide whether to consolidate.
- Two lockfiles committed (`pnpm-lock.yaml` + `package-lock.json`). Pick one before going public.
- `about.md` documents the project's origin (forked from Firecrawl's Fire Enrich demo; LICENSE still carries the Mendable AI copyright). Point new readers there.
- `ARCHITECTURE.md` backfill (AGENTS.md rule 7) still not done for the rebrand or the provider-picker migration. Still the empty scaffold.
- **A Serper API key was pasted in plaintext into a chat session this session for debugging.** Rotate it in the Serper dashboard if that hasn't happened yet.

## 6. Decisions locked this session (don't relitigate without new info)

- **BYOK key storage stays in `localStorage`**, not moved to session/server storage. User's own keys, matches existing pattern, hardening tracked as a separate follow-up (see §5).
- **No live pre-test of a submitted key** (the old modal test-scraped example.com with a fresh Firecrawl key). Rely on `/api/enrich`'s existing "missing/invalid key" error instead. Simpler, uniform across 6 providers.
- **`/api/chat` stays hardcoded to Firecrawl + OpenAI**, not made provider-aware — its route uses provider-specific service methods (`answerFromTableData`, `selectBestSource`, etc.) that don't exist on the generic registry interface; making it provider-aware is a services-layer rewrite, out of scope. Instead, `chatEnabled` is computed at Start time and the chat panel is hidden unless both Firecrawl and OpenAI keys are available, so it can't silently 500.

## 7. Commit status

`f875744` (rebrand) and `04eb157` (provider-picker migration) landed in an earlier session, pushed to `origin/feat/provider-picker`. This session added the key-status UI, the search query fix, and the OpenRouter/Google spec-mismatch fix (§4) — all being committed and pushed now.
