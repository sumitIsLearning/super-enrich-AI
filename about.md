# About Super Enrich

## What it is

Super Enrich takes a CSV of email addresses and turns it into a real dataset about the companies behind them: industry, headcount, funding, tech stack, leadership, whatever fields you ask for. You upload the file, pick your fields (or just describe them in a sentence), and the table fills in row by row, live, with every value backed by a source link and a confidence score.

It's built for the unglamorous but constant job sales, recruiting, and research teams all have: you're staring at a list of emails and you need to know who these companies actually are, without hand-Googling each one.

## Where it started

This didn't start from zero. It began as [Fire Enrich](https://github.com/mendableai/fire-enrich), an open-source demo Firecrawl (Mendable AI) built to show off their scraping API. I kept the original LICENSE file exactly as it was, MIT, copyright Mendable AI, because that's the right thing to do when you build on someone else's open-source work.

From that starting point I rebuilt most of the core and extended the rest. The original only worked with Firecrawl for scraping and OpenAI for extraction, full stop. Super Enrich swapped that for a pluggable registry on both sides: Firecrawl, Tavily, or Serper for search and scraping, OpenAI, Gemini, or OpenRouter for extraction, pick whichever per run. It also had no concept of a user. I added real multi-user auth with Better Auth, backed by a Postgres database (Neon, via Drizzle), and put a login in front of every page and every API route. And because a demo doesn't need to survive contact with the public internet the way an open-source repo does, I added rate limiting and a shared session check across the API layer, with a security pass done ahead of open-sourcing it.

## How it actually works

You upload a CSV. Any column can hold the email; the app works out which one.

You pick fields, either from a preset (company size, funding, tech stack) or by typing a sentence and letting an LLM turn it into a structured field list.

From there the pipeline runs per row, in phases, each one building on what the last phase learned:

1. Discovery: company name, website, what they actually do.
2. Profile: industry, headquarters, founding year.
3. Metrics: headcount, revenue.
4. Funding: stage, amount raised, investors.
5. Tech stack: what they're built on, pulled from their site and GitHub presence.
6. General: anything custom you asked for, using everything learned in the earlier phases.

Each phase searches the web in parallel, then hands the results to an LLM that has to fill in a strict schema (Zod) or return nothing at all. Every value that comes back ships with the source it was pulled from and a confidence score, so you can tell a well-supported answer from a shaky guess. Results stream to your browser as each row finishes, so you're not staring at a blank screen waiting for the whole file to process.

## What it's built with

Next.js 15 (App Router) and React 19 on the front end, TypeScript throughout, Tailwind and Radix/shadcn for UI. The enrichment pipeline itself isn't a framework, it's a custom multi-agent orchestrator where each "agent" is really a focused prompt paired with a Zod schema, run through the Vercel AI SDK against whichever LLM provider is selected. Scraping goes through Firecrawl, Tavily, or Serper depending on what's picked. Auth is Better Auth (email and password, plus optional Google OAuth) sitting on Postgres through Drizzle ORM. Zod validates everything a model returns before the app trusts it.

## What's done, what's not

The enrichment engine, provider switching, and the auth and database foundation are built and working today. Saveable field bundles, a review step before export, and turning a row into a shareable page (Markdown plus schema.org) are designed but not built yet. `docs/FEATURE_TRACKER.md` tracks the exact state of each piece and gets updated as things ship, so it's a better source of truth than this page for "is X done yet."

## Why it's open source

Two reasons, honestly. It was built on open-source work, so putting it back out into the open feels like the right close to that loop. And the part I find genuinely interesting, an agent pipeline that stays accurate by having each phase build on verified context from the last one instead of asking a single model to guess everything at once, seemed more useful shared than sitting in a private repo.
