# Product

## Register

product

## Users

Growth / sales / RevOps people enriching lead lists. They upload a CSV of emails, pick which fields they want (company profile, metrics, funding, tech stack), configure which scraper/LLM provider to use, and review AI-enriched, source-cited results streamed row by row. Primary task per screen: upload → configure fields & providers → review results.

## Product Purpose

Super Enrich turns a CSV of emails into structured, source-cited company data using a phased multi-agent pipeline. It exists to be provider-agnostic — users bring their own scraper (Firecrawl/Tavily/Serper) and LLM (OpenAI/Gemini/OpenRouter) keys instead of being locked into one vendor. Success is a user trusting the enriched output enough to act on it, because every value traces to a source and a confidence score.

## Brand Personality

Technical and precise. Confident, engineer-facing, no-nonsense — matches the data-table/config-form feel already in the enrichment UI. Orange accent, clean SaaS surface, motion used sparingly and purposefully (not decoratively).

## Anti-references

No generic SaaS-cream dashboard template. No gradient-text hero-metric clichés, no tiny uppercase eyebrows, no side-stripe card borders. Nothing that reads as a cloned template — this product was previously scaffolded on Firecrawl's own UI kit and is actively being de-branded; new UI must not reintroduce that "borrowed template" feel.

## Design Principles

- Never claim a value without a source — every enriched field carries a citation and confidence score; UI must always have room to show both.
- Provider-agnostic by construction — UI never implies one vendor is default/required; picking a scraper or LLM is a first-class, equally-weighted choice.
- Match the existing system, don't reinvent — new blocks (e.g. provider picker) extend the current card/shadow/spacing language already in `app/page.tsx`, not a new visual language.
- Technical confidence over marketing flourish — this is a tool people configure and trust with real data, not a landing page trying to convert them.

## Accessibility & Inclusion

Standard WCAG AA. Normal contrast and keyboard-navigation bar, nothing specialized.
