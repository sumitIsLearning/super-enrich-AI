# Super Enrich AI — Feature Development Tracker

**Product Direction:**
Super Enrich converts messy business data into structured, verified, human-readable, search-ready, and AI-agent-ready knowledge.

**Core Promise:**
Messy data in → clean structured data, citations, confidence scores, schema.org, OKF, and AI-readable knowledge out.

---

## 1. Provider Abstraction Layer

**Status:** Completed

**Solves:**
The tool was locked to one scraper and one LLM, limiting flexibility, cost control, and model/provider choice.

**How I approached it:**
Traced the hardcoded wiring across scraper, LLM, orchestrator, and enrichment routes, then introduced a provider abstraction layer.

**What I built:**

* `ScraperProvider` interface with normalized `SearchResult[]`
* Firecrawl, Tavily, and Serper adapters
* Serper search-only flow with content-fetch fallback
* LLM abstraction using Vercel AI SDK
* Support for OpenAI, Google Gemini, and OpenRouter
* Provider registry
* Manual provider/model picker in the UI
* API keys through env variables or request headers

**Impact:**
Users can choose the best scraper and model per run. New providers can be added without changing the core agent logic.

---

## 2. Telemetry + Provider Ranking

**Status:** Planned

**Solves:**
Users can choose between multiple providers, but they do not yet know which provider is cheaper, faster, or more accurate for a specific enrichment task.

**How I approached it:**
Use real run data to measure quality and cost instead of guessing. Store provider performance across runs and surface recommendations inside the picker.

**What I will build:**

* SQLite-backed run metrics store
* Storage interface so SQLite can later be replaced with Postgres
* Track fields found, failed fields, confidence score, runtime, token usage, scraper usage, and estimated spend
* Static pricing config for LLMs and scrapers
* Provider/model ranking labels such as:

  * Cheapest
  * Best quality
  * Fastest
  * Best for deep research
  * Best for simple enrichment
* Run comparison dashboard

**Impact:**
Provider choice becomes data-driven. Users can optimize for quality, cost, or speed depending on the task.

---

## 3. Field Bundles / Custom Data Models

**Status:** Planned

**Solves:**
Users currently have to select or define enrichment fields manually for every run. This is repetitive for common use cases.

**How I approached it:**
Fields are already customizable, so the next layer is saving reusable field sets as named data models.

**What I will build:**

* Named field bundles
* Preset bundles:

  * SaaS Lead
  * Real Estate Listing
  * Local Business
  * Investor Profile
  * Job Listing
  * Product Catalog
  * Company Profile
* User-defined custom bundles
* Save current field selection as a new bundle
* Load bundle into the enrichment flow
* SQLite-backed `field_bundles` table
* Field mapper UI for selecting, editing, and saving bundles

**Impact:**
Users can reuse proven enrichment schemas instead of rebuilding field selections every time.

---

## 4. Multi-Source Data Intake

**Status:** Planned

**Solves:**
The current product is CSV-first, but messy business data comes from many sources: websites, scraped JSON, PDFs, pasted text, CRM exports, and old spreadsheets.

**How I approached it:**
Create a flexible intake layer where different input types are normalized into one internal enrichment format.

**What I will build:**

* CSV upload
* Pasted text input
* URL input
* Website scrape input
* Scraped JSON upload
* Basic PDF/text document extraction
* Manual row creation
* Input preview before enrichment
* Column detection
* Auto-detect fields such as email, company, domain, URL, phone, location, and title
* Normalize all inputs into a common row-based structure

**Impact:**
Super Enrich becomes useful for more than email CSV enrichment. It becomes a general messy-data transformation tool.

---

## 5. Data Cleaning + Normalization Engine

**Status:** Planned

**Solves:**
Messy data often contains inconsistent names, duplicate rows, missing values, broken URLs, bad formatting, and mixed field types.

**How I approached it:**
Before enrichment, clean and standardize the raw data so the AI layer works on better input.

**What I will build:**

* Duplicate detection
* Email/domain cleanup
* Phone number normalization
* URL normalization
* Company name cleanup
* Location formatting
* Empty field detection
* Invalid row flagging
* Basic data quality score per row
* Before/after preview
* “Fix automatically” option for safe corrections

**Impact:**
Users get cleaner output and fewer failed enrichment runs. The product becomes valuable even before AI enrichment starts.

---

## 6. Source Citations + Evidence Layer

**Status:** Planned / Partially Existing

**Solves:**
AI-enriched data is hard to trust unless users can see where each field came from.

**How I approached it:**
Every enriched field should ideally carry its source, confidence score, and reason.

**What I will build:**

* Source URL per enriched field
* Citation snippets
* Confidence score per field
* Confidence score per row
* “Why this value?” explanation
* Evidence drawer in the UI
* Highlight fields with weak evidence
* Allow users to reject or approve fields
* Export citations with CSV/JSON/OKF output

**Impact:**
Super Enrich becomes a trustworthy data enrichment tool, not just an AI guessing tool.

---

## 7. Human Review + Approval Workflow

**Status:** Planned

**Solves:**
Users may not want AI-generated data to go directly into their final database, website, or CRM without review.

**How I approached it:**
Add a lightweight review layer where users can approve, edit, reject, or rerun weak fields.

**What I will build:**

* Review table after enrichment
* Field-level approve/reject/edit
* Row-level status:

  * Pending
  * Approved
  * Needs review
  * Rejected
* Filter by low-confidence fields
* Rerun selected rows
* Rerun selected fields only
* Manual correction before export
* Audit trail of changes

**Impact:**
The product becomes safer for real business workflows where accuracy matters.

---

## 8. Structured Output Export

**Status:** Planned / Partially Existing

**Solves:**
Users need the cleaned and enriched data in formats they can actually use across tools.

**How I approached it:**
Support multiple export targets from the same enriched dataset.

**What I will build:**

* CSV export
* JSON export
* Markdown export
* Google Sheets export
* Airtable-ready CSV
* CRM-ready CSV
* Database import-ready format
* Export only approved rows
* Export with or without citations
* Export with confidence scores
* Export with original input columns preserved

**Impact:**
Super Enrich becomes easier to plug into existing business workflows.

---

## 9. Search-Engine-Ready Output

**Status:** Planned

**Solves:**
Businesses do not only need clean data. They need data that can become discoverable web pages for Google and other search engines.

**How I approached it:**
Generate search-ready structured markup and publishing assets from enriched data.

**What I will build:**

* schema.org JSON-LD generator
* Supported schema templates:

  * LocalBusiness
  * Product
  * JobPosting
  * RealEstateListing-style custom structure using available schema.org types
  * Organization
  * FAQPage
* SEO title generation
* Meta description generation
* Slug generation
* Sitemap-ready URL list
* Canonical URL field
* FAQ generation from structured data
* Validation warnings for missing required fields

**Impact:**
Super Enrich moves beyond data enrichment into search-ready publishing infrastructure.

---

## 10. Human-Readable Page Generator

**Status:** Planned

**Solves:**
Structured data is useful, but businesses also need readable pages for users, clients, and internal teams.

**How I approached it:**
Use enriched data to generate clean human-readable pages, not just machine-readable exports.

**What I will build:**

* Listing page generator
* Company profile page generator
* Product profile page generator
* Local business profile page generator
* Markdown page output
* HTML page output
* Page sections:

  * Overview
  * Key facts
  * Contact details
  * Location
  * Pricing
  * Verification notes
  * Sources
  * FAQs
* Page preview inside the app

**Impact:**
The same enriched data can be used for websites, directories, internal knowledge bases, and client reports.

---

## 11. OKF Export / AI-Readable Knowledge Bundles

**Status:** Planned

**Solves:**
AI agents need structured context that is readable, portable, and easy to inspect. Normal CSVs are useful, but they are not ideal as long-term knowledge bundles.

**How I approached it:**
Use OKF as an export layer that converts enriched datasets into Markdown files with YAML frontmatter.

**What I will build:**

* OKF bundle generator
* One Markdown file per concept/listing/company/product
* YAML frontmatter fields:

  * type
  * title
  * description
  * resource
  * tags
  * timestamp
  * source
  * confidence
  * verification_status
* `index.md` generator
* `log.md` generator
* Internal Markdown links between related entities
* Downloadable OKF bundle as ZIP
* OKF preview inside the UI
* OKF validation checks

**Impact:**
Super Enrich becomes an AI-agent-ready data infrastructure tool, not just an enrichment tool.

---

## 12. AI Agent Knowledge Base Output

**Status:** Planned

**Solves:**
Businesses want AI agents to answer questions using their cleaned and verified data.

**How I approached it:**
Turn enriched data into a knowledge base format that can be used by RAG systems, chatbots, internal copilots, and agents.

**What I will build:**

* Markdown knowledge base export
* Chunked JSON export for vector databases
* Qdrant-ready export
* Pinecone-ready export
* Metadata-rich documents
* Suggested retrieval tags
* Agent instructions file
* Dataset summary
* Common questions generated from the dataset
* “Ask this dataset” demo mode

**Impact:**
Users can take messy data and quickly turn it into a usable AI knowledge base.

---

## 13. Data Quality Score

**Status:** Planned

**Solves:**
Users need to know whether their dataset is reliable before using it for sales, SEO, AI agents, or publishing.

**How I approached it:**
Create a scoring layer that evaluates completeness, consistency, source quality, and confidence.

**What I will build:**

* Dataset-level quality score
* Row-level quality score
* Field-level confidence score
* Missing data report
* Duplicate report
* Weak source report
* Invalid URL/email/phone report
* “Ready for publishing” score
* “Ready for AI agent” score
* Improvement suggestions

**Impact:**
Super Enrich can tell users not just what data they have, but how usable and trustworthy it is.

---

## 14. Project + Run History

**Status:** Planned

**Solves:**
Users need to manage multiple enrichment jobs, compare past runs, and continue work later.

**How I approached it:**
Introduce projects and saved runs as a core workflow layer.

**What I will build:**

* Projects
* Saved enrichment runs
* Run status:

  * Draft
  * Running
  * Completed
  * Failed
  * Reviewed
  * Exported
* Run history
* Reopen previous runs
* Duplicate a previous run
* Compare two runs
* Export history
* Store selected providers, field bundles, input file, output file, and cost metrics

**Impact:**
Super Enrich becomes a repeatable workflow tool instead of a one-time enrichment script.

---

## 15. Vertical Templates

**Status:** Planned

**Solves:**
Different industries need different fields, outputs, and validation rules.

**How I approached it:**
Create industry-specific workflows on top of the same core enrichment engine.

**What I will build:**

* Real Estate Listing template
* Local Business Directory template
* SaaS Lead Enrichment template
* Job Listing template
* Product Catalog template
* Investor/Founder Profile template
* Course/Coaching Directory template
* Service Provider Database template

Each template includes:

* Recommended fields
* Cleaning rules
* Enrichment prompts
* Output format
* schema.org mapping
* OKF mapping
* Quality checks

**Impact:**
Users can start with a specific business use case instead of configuring everything from scratch.

---

## 16. Publishing Integrations

**Status:** Planned

**Solves:**
After enrichment, users need to send the cleaned data somewhere useful.

**How I approached it:**
Add export and publishing integrations after the core data workflow is stable.

**What I will build:**

* Google Sheets export
* Airtable export
* Notion database export
* Webhook export
* WordPress import-ready export
* Static site export
* API endpoint for approved data
* Optional scheduled export

**Impact:**
Super Enrich becomes part of a real business data pipeline.

---

## 17. API + Automation Layer

**Status:** Planned

**Solves:**
Power users and businesses may want to run enrichment automatically from their own systems.

**How I approached it:**
Expose core enrichment workflows through APIs after the product flow becomes stable.

**What I will build:**

* API key management
* Create enrichment run API
* Upload CSV API
* Check run status API
* Export result API
* Webhook on completion
* Webhook on failed run
* Webhook on low-confidence output
* Basic rate limits

**Impact:**
Super Enrich can be used by developers, agencies, internal teams, and automated workflows.

---

## 18. Verification Workflow

**Status:** Planned

**Solves:**
For listings, leads, and business directories, data must be verified before publishing or outreach.

**How I approached it:**
Add verification-specific fields, statuses, and evidence tracking.

**What I will build:**

* Verification status:

  * Unverified
  * Auto-verified
  * Needs review
  * Manually verified
  * Rejected
* Source freshness check
* Contact availability check
* Website availability check
* Duplicate business detection
* Conflicting data detection
* Last verified timestamp
* Verification notes
* Export only verified records

**Impact:**
Super Enrich becomes more useful for serious listing directories, lead databases, and public data products.

---

## 19. “Ask My Data” Demo Mode

**Status:** Planned

**Solves:**
Users may not immediately understand the value of structured AI-readable data.

**How I approached it:**
Let users ask questions directly on the enriched dataset after processing.

**What I will build:**

* Chat interface over enriched data
* Ask questions like:

  * Which records are missing phone numbers?
  * Which companies look most qualified?
  * Which listings are ready to publish?
  * Which rows have low confidence?
  * Which records should be reviewed first?
* Answers grounded in enriched rows and citations
* Link answer back to source rows

**Impact:**
This makes the product value obvious. Users can see how cleaned data becomes usable by an AI agent.

---

## 20. Public Demo Dataset

**Status:** Planned

**Solves:**
The product needs a clear public demo to explain the new direction.

**How I approached it:**
Create a small but polished demo around one niche.

**What I will build:**

* Demo: AI-readable local business or real estate listing dataset
* Messy CSV input
* Clean enriched output
* Human-readable pages
* schema.org JSON-LD
* OKF bundle
* Source citations
* Confidence scores
* Ask-the-data demo
* Case study page explaining the workflow

**Impact:**
This becomes the main proof for the brand: messy data transformed into useful knowledge for humans, search engines, and AI agents.

---

# Feature Pillars

## Pillar 1: Input

Bring messy data from CSV, websites, text, JSON, PDFs, and manual entry.

## Pillar 2: Clean

Normalize, deduplicate, validate, and score the data.

## Pillar 3: Enrich

Use search, scraping, and LLMs to fill missing fields with citations.

## Pillar 4: Review

Let humans approve, reject, fix, and verify enriched data.

## Pillar 5: Publish

Export as CSV, JSON, Markdown, web pages, schema.org, and OKF.

## Pillar 6: Activate

Use the structured data inside AI agents, search engines, websites, CRMs, and internal tools.

---

# Recommended MVP Direction

The next MVP should focus on this flow:

1. Upload messy CSV
2. Select a field bundle
3. Choose scraper + LLM provider
4. Run enrichment
5. Show confidence + citations
6. Review/edit results
7. Export clean CSV
8. Generate human-readable Markdown pages
9. Generate schema.org JSON-LD
10. Generate OKF bundle

This MVP clearly supports the new brand promise:

**Messy data → clean structured knowledge for humans, search engines, and AI agents.**
