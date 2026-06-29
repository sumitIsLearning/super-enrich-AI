# Design: Integration Hub (Credential Vault & Connectors)

**Date:** 2026-06-29
**Status:** Approved (design); pending implementation plan
**Relates to:** [Pluggable Providers design](2026-06-29-pluggable-providers-design.md) — this is **Sub-project 4** and supersedes that work's env/header key handling.

## Summary

A user-facing **integration hub**: a single "Connections" system where the user adds API keys/tokens for tools once, the app stores them **encrypted at rest**, and fetches them itself at runtime. It covers both **enrichment providers** (Firecrawl, OpenAI, Gemini, OpenRouter, Tavily, Serper) and **downstream destinations**. The first deliverable ships the encrypted vault + connector interface, migrates the providers onto it, and adds **one generic outbound action**: a webhook/HTTP push of enriched results. Named connectors (HubSpot, Sheets, Slack) and OAuth flows come later; the schema is **OAuth-ready**.

## Goals

1. Persistent, UI-managed credentials for providers + downstream tools (global to the instance).
2. Encryption at rest with app-level **AES-256-GCM** and an env-held master key.
3. A connector catalog + façade so new tools are added as data, not bespoke code.
4. Runtime credential injection — app code passes a connector id, never raw secrets.
5. One generic webhook/HTTP push of enriched results (proves the outbound half).

## Non-Goals

- No OAuth redirect/token-refresh flow yet (schema-ready only).
- No named third-party connectors at launch (webhook is the only destination).
- No multi-user/tenant model — connections are **global**.
- No external KMS/Vault dependency (app-level crypto; interface allows later swap).

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Scope | Unified hub: providers + downstream, global |
| Auth types | API key / token now; OAuth schema-ready, not built |
| First deliverable | Vault + connector interface + provider migration + 1 generic webhook push |
| Crypto | App-level AES-256-GCM, 32-byte master key from env, isolated behind an interface |
| Storage | SQLite `connections` table (shared storage interface from Sub-project 2) |
| Secret exposure | Never returned by API or logged; masked `••••1234` previews only |
| Source of record | Hub is primary for credentials; env vars / `X-*-API-Key` headers are fallback |

## Architecture

New module `lib/integrations/`, four independently-testable units:

```
            API routes (/api/connections, /api/connectors)
                              │
                              ▼
                         hub.ts  (façade)
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        connectors/        store.ts        crypto/secrets.ts
        (catalog data)   (SQLite CRUD)    (AES-256-GCM only)
```

**Dependency rule:** callers touch only `hub`. `hub` → (`connectors` + `store` + `crypto`). `crypto` knows nothing about connections or DB, so a KMS backend can replace it without touching callers.

### crypto/secrets.ts

```ts
interface SecretCipher {
  encrypt(plaintext: string): { ciphertext: Buffer; nonce: Buffer; tag: Buffer };
  decrypt(p: { ciphertext: Buffer; nonce: Buffer; tag: Buffer }): string;
}
```

- AES-256-GCM via Node `crypto`. Fresh random 12-byte nonce per `encrypt`. Returns ciphertext + nonce + 16-byte auth tag.
- Master key from `SUPER_ENRICH_ENCRYPTION_KEY` (base64-encoded 32 bytes). Loaded once, server-side only, never logged.
- Missing/invalid key → cipher construction throws; hub endpoints return a 503 with setup instructions. Never falls back to plaintext storage.

### connectors/

```ts
interface CredentialField { key: string; label: string; secret: boolean; }
interface Connector {
  id: string;                               // 'openai' | 'firecrawl' | 'webhook' | ...
  displayName: string;
  category: 'provider' | 'destination';
  authType: 'api_key' | 'token' | 'oauth';  // oauth = schema-ready, not built
  fields: CredentialField[];
  test?(creds: Record<string, string>): Promise<boolean>;
}
```

- Static catalog (one descriptor per supported tool). Launch set: provider connectors for Firecrawl, OpenAI, Gemini, OpenRouter, Tavily, Serper; one `webhook` destination connector.
- `webhook` fields: `url` (non-secret, → `meta_json`), optional `authHeader` (secret).

### store.ts

SQLite implementation behind the storage interface from Sub-project 2.

```sql
CREATE TABLE connections (
  id           TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  label        TEXT,
  auth_type    TEXT NOT NULL,                 -- 'api_key' | 'token' | 'oauth'
  secret_ct    BLOB NOT NULL,                 -- AES-256-GCM ciphertext of {field: value} JSON
  secret_nonce BLOB NOT NULL,                 -- 12-byte nonce
  secret_tag   BLOB NOT NULL,                 -- 16-byte auth tag
  meta_json    TEXT,                          -- non-secret config (webhook url, oauth scopes later)
  status       TEXT NOT NULL DEFAULT 'active',-- 'active' | 'error' | 'disabled'
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
```

All secret fields for a connection are encrypted together as one JSON blob. OAuth tokens (later) are added as encrypted fields + `meta_json` — no schema change.

### hub.ts (façade)

```ts
getCredential(connectorId: string): Promise<Record<string,string> | null>; // decrypted, server-only
listConnections(): Promise<ConnectionMeta[]>;   // masked previews, no secrets
saveConnection(connectorId: string, creds: Record<string,string>, label?: string): Promise<ConnectionMeta>;
updateConnection(id: string, creds?: Record<string,string>, label?: string): Promise<ConnectionMeta>;
deleteConnection(id: string): Promise<void>;
testConnection(id: string): Promise<boolean>;
```

`ConnectionMeta` = `{ id, connectorId, label, category, authType, status, preview, createdAt, updatedAt }`. `preview` masks each secret to its last 4 chars.

## API routes

| Route | Method | Returns |
|-------|--------|---------|
| `/api/connectors` | GET | Catalog descriptors for rendering forms |
| `/api/connections` | GET | `ConnectionMeta[]` (masked, never secrets) |
| `/api/connections` | POST | Create (encrypt + store) → masked meta |
| `/api/connections/:id` | PUT | Update creds/label → masked meta |
| `/api/connections/:id` | DELETE | Remove |
| `/api/connections/:id/test` | POST | Run connector `test()` → `{ ok }` |

All Node runtime. Endpoints return 503 with setup instructions if the master key is absent.

## Data flow

1. **Save:** form → `POST /api/connections` → `hub.saveConnection` → `crypto.encrypt(JSON)` → `store` insert → masked meta back.
2. **Use (enrichment):** enrich route calls `hub.getCredential('firecrawl')` → `store` read → `crypto.decrypt` → key passed to the provider adapter server-side. If no connection, fall back to env var / `X-*-API-Key` header.
3. **Outbound push:** after a run, if a `webhook` connection exists, `POST` enriched-results JSON to `meta_json.url` with optional auth header from its decrypted secret.

## Security

- AES-256-GCM, unique 12-byte nonce per write; store ct + nonce + tag.
- Master key only in `SUPER_ENRICH_ENCRYPTION_KEY` env var (base64, 32 bytes); never in DB, never in client responses, never logged.
- Secrets never serialized into any API response or log line — masked previews only.
- All decryption + outbound calls server-side.
- `.env.example` documents `SUPER_ENRICH_ENCRYPTION_KEY` with a generation hint (`openssl rand -base64 32`).

## Error handling

- Decrypt failure (tampered data or rotated/wrong key) → set `status='error'`, surface in UI, do not crash enrichment (env fallback applies).
- Missing master key → 503 + setup instructions on hub endpoints.
- `test()` failure → `status='error'`; never blocks saving.
- Webhook push failure → logged and flagged on the run; never fails the enrichment.

## Testing

- **Crypto:** encrypt→decrypt round-trip; tampered tag/ciphertext rejected; nonces differ across writes; missing key throws.
- **Store:** CRUD round-trip; assert stored bytes are ciphertext (plaintext secret absent on disk).
- **Hub:** `listConnections` masks secrets; `getCredential` decrypts; env fallback when no connection.
- **Connectors:** catalog descriptors valid; `test()` mocked per connector.
- **Webhook push:** correct payload posted to a mock endpoint; failure is non-fatal.

## Dependency & build order

- Requires the **SQLite storage interface from Sub-project 2** (lands first, or this sub-project introduces the storage layer if built earlier).
- **Supersedes** Sub-project 1's key handling: SP1 ships with env/header support; this sub-project makes the hub primary with env fallback — no rework.
- Revised overall order: **1 → 2 → 4**, with **3 (field bundles)** in parallel.

## Open Items

- Exact `test()` implementation per provider connector (lightweight auth ping) — finalized in the implementation plan.
- Webhook payload shape (full results vs. summary) — finalized in the plan; default is full enriched rows + metadata.
