 # Super Enrich AI — Feature Development Tracker

    Tracks features in development. Format: Solves → How I approached it → What I built → Impact.

    ---

    ## 1. Provider Abstraction Layer
    **Status:** Planned

    **Solves:**
    The tool is locked to one scraper (Firecrawl) and one LLM (OpenAI) — no choice, no flexibility, no cost control.

    **How I approached it:**
    Traced the hardcoded wiring (`openai.ts`, `firecrawl.ts`, orchestrator, enrich route) and chose the Vercel AI SDK to unify structured extraction across providers.

    **What I built:**
    - `ScraperProvider` interface (search + scrape → normalized `SearchResult[]`) with Firecrawl, Tavily, Serper adapters (Serper search-only + content-fetch fallback).                                        - LLM layer on Vercel AI SDK `generateObject`/`generateText` spanning OpenAI, Google Gemini, OpenRouter via one Zod-schema path.
    - Provider registry + manual per-run picker (UI dropdowns); keys via env / `X-*-API-Key` headers.

    **Impact:**
    Users pick the best scraper + model per run; new providers drop in via the registry without touching agent logic.

    ---

    ## 2. Telemetry + Ranking
    **Status:** Planned (depends on #1)

    **Solves:**
    With many providers available, users have no way to know which is most accurate or cheapest for enrichment.

    **How I approached it:**
      Decided cost comes from each provider's published per-million-token (or per-page) pricing, while quality is measured from real runs.

      **What I built:**
      - SQLite store (behind a storage interface) recording per-run metrics: fields found, confidence, success rate, spend per provider/model.
    - Static pricing config (input/output per-million tokens; scrapers per-page) sourced from provider docs.
    - Advisory quality + cost labels surfaced next to each option in the manual picker.

    **Impact:**
    Provider choice becomes data-driven — proven quality and real cost shown at the point of selection.                                                                                                    
    ---

    ## 3. Field Bundles ("Custom Data Models")
    **Status:** Planned (independent of #1/#2)

    **Solves:**
    Re-selecting the same fields one-by-one every run is repetitive; there's no reusable enrichment schema.

    **How I approached it:**
    Confirmed fields are already per-field customizable, so the gap is a named, reusable *bundle* layer on top.

    **What I built:**
    - Named field bundles (e.g. "SaaS Lead", "Investor Profile") — preset bundles plus user-defined save/load.
    - SQLite-backed `field_bundles` store behind the shared storage interface.
      - Field-mapper UI to pick a bundle (loads all fields at once) or save the current selection as a new model.