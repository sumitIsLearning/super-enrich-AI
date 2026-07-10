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


[Next entry goes here]

Feature:
Why this shape:
Connects to:
Breaks if removed: