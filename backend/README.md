# Protego backend

```
extension / website / phone app ──reducers + SQL (HTTP)──▶ SpacetimeDB module (backend/spacetime)
                                                                 ▲
                                    worker-only reducers         │ polls public queue tables
                                                                 │
                                         agent worker (backend/worker): RDAP, OpenPhish, URLhaus,
                                         Google Safe Browsing, Claude (Sonnet 5.5 + Haiku 5.5)
```

SpacetimeDB holds all state and rules: queues, the cache and its TTLs, rate limits, per-user counters, per-site toggles, and worker authorization. The worker exists only because it needs outbound HTTP and the LLM.

## Setup

1. Install the SpacetimeDB CLI (https://spacetimedb.com/install), then run `spacetime login`.
2. Publish the module:
   ```sh
   cd backend/spacetime && npm install && npm test
   spacetime publish --server maincloud protego
   ```
3. Start the worker:
   ```sh
   cd backend/worker && npm install && cp .env.example .env   # add ANTHROPIC_API_KEY (+ optional GOOGLE_SAFE_BROWSING_KEY)
   npm start
   ```
   On first run, the worker creates its own identity and prints a command. Run that command once as the module owner:
   ```sh
   spacetime call --server maincloud protego register_worker <worker-identity-hex>
   ```
   Without `ANTHROPIC_API_KEY` the worker still runs, using heuristics only (confidence is reported as `low`).

## API for clients (website and phone app)

Everything is plain HTTP; no code generation is needed. Copy `worker/src/stdb.ts` for a ready-made client.

- Identity: `POST {host}/v1/identity` returns `{identity, token}`. Store it, and send `Authorization: Bearer <token>`.
- Reducer: `POST {host}/v1/database/protego/call/<reducer>` with a JSON array of the arguments in order.
- Query: `POST {host}/v1/database/protego/sql` with SQL text in the body. All tables listed below are public.

| Reducer | Args | Notes |
|---|---|---|
| `request_scan` | `domain, signals_json, source, force` | Idempotent. `signals_json` may be `""` (the worker then fetches the homepage itself). `force` is limited to once per 10 minutes per domain. |
| `request_listing_check` | `batch_id (uuid), site, items_json` | Items: `[{key,title,company?,location?,price?,snippet?,url?}]`, at most 60. Cached verdicts are answered immediately. |
| `record_hornets` | `kind ('site'\|'listing'), count` | Per-identity counter. |
| `set_listing_filter` | `domain_hash (sha256 hex), enabled` | Per-identity toggle. Only the hash is stored, never the domain. |

| Table | Key | Read it for |
|---|---|---|
| `site_report` | `domain` | `risk_level` (none/low/medium/high), `score` 0-100, `confidence`, `headline`, `summary`, `reasons_json` `[{title,detail,severity}]`, `expires_at_ms` |
| `scan_request` | `domain` | `status` = pending/processing/failed (and `error`) |
| `listing_batch` | `id` | `status` = done → `results_json` `[{key,suspicious,score,reason}]` |
| `user_stats` | `user_id` (identity hex) | `hornets_blocked`, `sites_warned`, `listings_blocked` |

Example: poll `SELECT * FROM site_report WHERE domain = 'example.com'` until `checked_at_ms` is newer than your request.

## Risk rating

1. **Deterministic findings** (`worker/src/heuristics.ts`): blocklists (OpenPhish, URLhaus, Safe Browsing), look-alike domains, domain age (RDAP), payment-form destination mismatch, http forms that take passwords or cards, missing refund/contact/privacy pages, unrecoverable payment methods, pressure tactics, and obfuscated or anti-inspection scripts.
2. **Reputation research**: Claude Sonnet 5.5 with web search checks reviews, scam reports, and company registration.
3. **Verdict**: Claude turns all the evidence into a plain-language report with an honest confidence level. A blocklist hit can never be rated below 95.

Score bands: 0-14 none, 15-39 low, 40-69 medium, 70+ high.
