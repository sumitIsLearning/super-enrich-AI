# Feature Tracker — Version Plan

Working roadmap, version-sliced. `FEATURES.md` is the long-term vision backlog (20 features); this file says **what ships in which version, in what order, and why**. Update this file as versions complete — don't let it go stale.

Status legend: `Done` / `In Progress` / `Not Started`.

---

## V1.0 — Foundation: Auth + Postgres

Goal: multi-user accounts + a real database, so every feature after this can scope data to a user and persist it. Prerequisite for the bundles/telemetry work below. Spec: `docs/superpowers/specs/2026-07-01-auth-postgres-foundation-design.md`.

| Sub-feature | Status | Notes |
|---|---|---|
| Neon Postgres + Drizzle ORM (migrations via drizzle-kit only) | **Not Started** | `lib/db/` client + schema; `drizzle.config.ts` |
| Better Auth — email+password + Google OAuth, users in our Postgres | **Not Started** | `lib/auth/`, `app/api/auth/[...all]`, `app/login` |
| Gate existing app + API routes behind login | **Not Started** | `middleware.ts` + server-side session re-check |

Decision record: multi-user individual accounts (no teams yet); self-hosted auth so identity lives in our Postgres, not a vendor; Neon over discontinued Vercel Postgres.

---

## V1 — MVP: Close the enrichment loop

> Depends on V1.0. Field bundles (1.4/1.5) are now **DB-backed and user-scoped**, not localStorage.


Goal: a user can go CSV → enriched → reviewed → exported as data **and** as publishable knowledge (page + schema.org + OKF), end to end, without leaving the app.

Maps to `FEATURES.md` §1, §3, §6, §7, §8, §9, §10, §11 (the "Recommended MVP Direction" section).

| # | Sub-feature | Status | Notes |
|---|---|---|---|
| 1.1 | Provider abstraction (scraper + LLM registry, picker UI) | **Done** | Shipped — see `FEATURES.md` §1 |
| 1.2 | Confidence scores + source citations, surfaced in UI | **Done** | `lib/types/index.ts` `EnrichmentResult`; rendered in `enrichment-table.tsx` (Sources panel) and `source-context-tooltip.tsx` |
| 1.3 | CSV/JSON export with confidence + source columns | **Done** | `enrichment-table.tsx` `downloadCSV()`/`downloadJSON()` |
| 1.4 | Field bundles (named, saveable, reloadable field sets) | **Not Started** | DB-backed (`custom_bundles`, user-scoped) after V1.0. 5 read-only presets in code: Company Basics, SaaS Lead, Funding Snapshot, Tech Stack Snapshot, Company Profile. Today: only a hardcoded `PRESET_FIELDS` quick-add list in `unified-enrichment-view.tsx` |
| 1.5 | Post-run review: approve/reject/edit an enriched **value** before export | **Not Started** | Existing Accept/Reject in `unified-enrichment-view.tsx` applies to AI-suggested *fields* pre-run, not enriched *values* post-run — wrong stage, doesn't cover this |
| 1.6 | Markdown human-readable page generator (per row) | **Not Started** | No markdown page generation exists |
| 1.7 | schema.org JSON-LD generator (Organization type only, for MVP) | **Not Started** | No schema.org/JSON-LD code exists anywhere |
| 1.8 | OKF bundle export (Markdown + YAML frontmatter, zipped) | **Not Started** | No OKF code exists |

### V1 build order (direction)

1. **Field bundles (1.4)** first (after V1.0 foundation) — smallest vertical slice that exercises the new DB + auth seam.
   - Store: `custom_bundles` table (Drizzle), `userId` FK → `user`. Server actions for CRUD, scoped to the session user. No localStorage — foundation makes DB the right home from day one.
   - Shape: `{ id, userId, name, fields: EnrichmentField[] (jsonb) }`. 5 built-in presets stay read-only constants in code (`BUILT_IN_BUNDLES`), not in the DB.
   - Touch: `lib/db/schema.ts` (+ drizzle-kit migration), `lib/field-bundles.ts` (presets + query helpers), new `bundle-selector.tsx`, wire into `unified-enrichment-view.tsx` step 2 (grouped dropdown: Presets / Your Bundles; select **replaces** `selectedFields`).

2. **Post-run review (1.5)** second — needed before export makes sense to build on top of. Add per-value approve/reject/edit directly in `enrichment-table.tsx` and `detail-modal.tsx` (currently read-only). Row/field status: `pending | approved | rejected`. Export (1.3, done) should gain an "approved only" filter once this lands.

3. **Markdown page generator (1.6)** third — pure function over an already-approved `EnrichmentResult` row, no new UI shell needed beyond a preview + download button. Reuses the review-gate from step 2.

4. **schema.org JSON-LD (1.7)** — same input as 1.6 (approved row), different serializer. Ship one type (`Organization`) rather than the full template list in `FEATURES.md` §9 — expand types post-MVP.

5. **OKF bundle export (1.8)** — last, since it packages the outputs of 1.6/1.7 (one Markdown+frontmatter file per row, zipped) rather than being independent work.

---

## V2 — Telemetry + Provider Ranking

Maps to `FEATURES.md` §2. Single feature, ships alone.

| Sub-feature | Status |
|---|---|
| Postgres run-metrics store (fields found, confidence, runtime, spend), user-scoped | Not Started |
| Static pricing config per provider/model | Not Started |
| Cheapest / best-quality / fastest labels in the provider picker | Not Started |

Direction: reuses the V1.0 Postgres + Drizzle foundation — a `runs` table (`userId` FK) recording per-run metrics. No new storage tech needed; just new tables + migration.

---

## V3 — Data Cleaning + Normalization (pre-enrichment pass)

Maps to `FEATURES.md` §5, scoped down to a small slice: **not** the full report/scoring UI, just the automatic fixes that measurably improve enrichment success rate.

| Sub-feature | Status |
|---|---|
| Email/domain cleanup (strip whitespace, lowercase, fix common typos) | Not Started |
| Duplicate row detection (exact email match) | Not Started |
| Invalid row flagging (unparseable email → skip with reason, don't silently fail) | Not Started |

Direction: runs once, client-side, between CSV parse and enrichment start — no new backend surface. Defer URL/phone normalization, quality scoring, and the before/after preview UI to a later version.

---

## Backlog (unversioned)

`FEATURES.md` §4, §12–§20 — multi-source intake, human review reports, project/run history, vertical templates, publishing integrations, API layer, verification workflow, "ask my data," public demo. Not scheduled; pull into a version when V1–V3 ship and priorities are revisited.
