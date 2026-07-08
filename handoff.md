# Handoff

## 1. Goal

Get this repo ready to open source. That meant three things: find real security problems before strangers start poking at a public repo, answer a set of questions about the stack and how to present the project (market positioning, recruiter framing), and write a plain-language about page for people who land on the repo without any prior context.

## 2. Current state

Branch `feat/auth-postgres-foundation` already has the auth and database foundation built: Better Auth with email/password and optional Google OAuth, sitting on Postgres through Drizzle, with every page and API route gated by a session check. That part was done before this session started.

A prior session added a security review on top of that foundation and found four real issues, one of them high severity, but applied no fixes (audit and documentation only). This session fixed the highest-severity one: SSRF in the scraper's direct-fetch path.

## 3. Active files

- `lib/providers/scraper/fetch-content.ts`, edited, SSRF guard added (see §4).
- `lib/providers/scraper/__tests__/fetch-content.test.ts`, edited, three new tests covering the guard.
- `about.md`, new (prior session), a plain-language walkthrough of the product for people outside the project.
- `AGENTS.md`, edited (prior session), added an "Agent skills" section listing when to use `mem-search`, `smart-explore`, `make-plan`, `do`, `timeline-report`, and `task-observer`.
- `handoff.md`, this file.
- `.agents/skills/`, six skill directories from a prior session: `do`, `make-plan`, `mem-search`, `smart-explore`, `task-observer`, `timeline-report`.
- Remaining security findings still need fixes: `lib/auth/index.ts`, `app/api/enrich/route.ts`, `lib/rate-limit.ts`.

## 4. Changes made

- Fixed the SSRF finding in `lib/providers/scraper/fetch-content.ts`. Before this fix the function fetched any URL handed to it (via Tavily/Serper's `scrapeUrl` fallback) with no check against private or internal IP ranges — a domain resolving to `127.0.0.1`, `169.254.169.254` (cloud metadata), or an RFC1918 range would be fetched same as any public site. Fix:
  - `assertPublicHost` resolves the hostname (`dns/promises.lookup`, all records) or parses an IP literal directly, and rejects if any resolved address falls in loopback, link-local, RFC1918, CGNAT, or IPv6 loopback/unique-local/link-local ranges.
  - The fetch now uses `redirect: 'manual'` and follows redirects itself (capped at 5 hops), re-running `assertPublicHost` on every hop — closes the bypass where a public first hop 302s to an internal address.
  - Non-http(s) protocols are rejected outright.
  - Added 3 tests: rejects IP-literal SSRF targets without ever calling `fetch`, rejects a redirect that points at `127.0.0.1`, and confirmed the 3 pre-existing tests still pass. Full scraper suite (21 tests) and `tsc --noEmit` both clean.
- Fixed a missing `origin/HEAD` git ref (`git remote set-head origin -a`) that was blocking the security-review skill's diff detection.
- Ran a full security review of the auth branch diff plus a separate audit of the codebase for API key handling and rate limiting. Found and confirmed:
  - SSRF in the new Tavily/Serper scraper path — **fixed this session**, see above.
  - Open self-service signup with no email verification or invite gate, combined with an API-key fallback to the operator's own environment variables, lets any anonymous signup ride on the operator's paid Firecrawl/OpenAI quota (`lib/auth/index.ts`, `app/api/enrich/route.ts`).
  - `llmModelId` from the request body is not checked against the app's model allowlist, and there is no server-side row cap, so a signed-up user can run expensive models across an unbounded batch on a shared key (`app/api/enrich/route.ts`).
  - Rate limiting exists (Upstash) but is wired to only one endpoint, `/api/scrape`. The bulk `/api/enrich` endpoint and `/api/chat` have none.
  - Lower-severity notes: job cancellation has no ownership check tying a session ID to its owner (low real-world risk, IDs aren't exposed to other users), no Zod validation on enrich/generate-fields request bodies, and provider API keys typed into the browser sit in plaintext `localStorage`.
- Confirmed the project's actual auth stack and dependency list by reading the source directly rather than trusting docs (Next.js 15, React 19, Better Auth 1.6.23, Drizzle + `pg` against Neon Postgres, Vercel AI SDK against OpenAI/Gemini/OpenRouter, Firecrawl/Tavily/Serper for scraping).
- Traced the project's origin back to Firecrawl's open-source Fire Enrich demo (the LICENSE file still carries the original Mendable AI copyright, unchanged) and wrote that lineage into `about.md` rather than leaving it undocumented.
- Installed the `task-observer` and `claude-mem` skill sets at project scope and added usage guidance for them to `AGENTS.md`.

## 5. Failed attempts

- First run of the security-review skill failed outright: its diff-detection hook shelled out to `git log origin/HEAD...` and there was no local `origin/HEAD` ref, so it errored before doing anything. Fixed with `git remote set-head origin -a`, then it ran clean.
- Installing the `claude-mem` skill by package name (`npx skills add thedotmack/claude-mem`) pulled in all 17 skills from that repo, including a dozen unrelated to memory, things like `wowerpoint`, `weekly-digests`, and `babysit`. Had to remove twelve of them afterward to keep project scope to just the memory-relevant five.
- The first attempt to remove those extra skills passed a comma-separated list to `--skill` and matched nothing (`No matching skills found`). The CLI wants space-separated values after a single `-s` flag, not a comma-joined string. Second attempt with that syntax worked.

## 6. Next steps

- ~~Fix the SSRF~~ — done this session (`lib/providers/scraper/fetch-content.ts`).
- Decide how to gate signup: email verification, an invite code, or just remove the environment-variable fallback so every request needs its own header-supplied key. Any of the three closes the cost-abuse path.
- Add rate limiting to `/api/enrich` and `/api/chat`, not just `/api/scrape`, since enrich is the endpoint that actually fans out into per-row LLM and scraper calls.
- Validate `llmModelId` against `MODELS_CONFIG` server-side, and consider a server-side row cap on `/api/enrich` to match the one already enforced client-side.
- Pick one lockfile. Both `pnpm-lock.yaml` and `package-lock.json` are committed right now, which looks like an unclean repo to anyone browsing it after it goes public.
- Once the fixes above land, the open-source questions from this session (tech stack, market positioning, recruiter framing) are already answered and don't need to be redone, just point people at `about.md`.
