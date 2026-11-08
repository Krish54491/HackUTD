/**
 * Protego — SpacetimeDB module.
 *
 * This is the shared backend for the web extension, website, and phone app.
 * All state lives here; clients only ever call reducers and read public tables.
 *
 * Flow (website security check):
 *   client  --request_scan(domain, signals)-->  scan_request (pending)
 *   worker  --claim_scan / submit_report-->     site_report (cached w/ TTL)
 *   client  <--SQL: SELECT * FROM site_report WHERE domain = '...'
 *
 * Flow (fake listing detection):
 *   client  --request_listing_check(batch_id, site, items)--> listing_batch
 *           (items already in listing_verdict are answered from cache)
 *   worker  --submit_listing_verdicts-->  listing_verdict + listing_batch (done)
 *   client  <--SQL: SELECT * FROM listing_batch WHERE id = '...'
 *
 * Privacy: nothing here is keyed by user identity except the hornet counter
 * and per-site toggles, and those store a SHA-256 of the domain, never the domain.
 */
import { schema, table, t, SenderError } from 'spacetimedb/server';
import {
  REPORT_TTL_MS,
  VERDICT_TTL_MS,
  STALE_CLAIM_MS,
  FORCE_RESCAN_MIN_MS,
  MAX_SIGNALS_BYTES,
  MAX_LISTINGS_PER_BATCH,
  RISK_LEVELS,
  hex,
  nowMs,
  normalizeDomain,
  clip,
  parseJson,
  type ListingItem,
  type ListingResult,
} from './lib';

// ---------- tables ----------

const config = table(
  { name: 'config' },
  { key: t.string().primaryKey(), value: t.string() }
);

const worker = table(
  { name: 'worker', public: true },
  { identity_hex: t.string().primaryKey(), registered_at_ms: t.u64() }
);

const scan_request = table(
  { name: 'scan_request', public: true },
  {
    domain: t.string().primaryKey(),
    signals_json: t.string(),
    source: t.string(), // 'auto' | 'manual'
    status: t.string(), // 'pending' | 'processing' | 'failed'
    error: t.string(),
    attempts: t.u32(),
    created_at_ms: t.u64(),
    claimed_at_ms: t.u64(),
  }
);

const site_report = table(
  { name: 'site_report', public: true },
  {
    domain: t.string().primaryKey(),
    risk_level: t.string(), // none | low | medium | high
    score: t.u32(), // 0-100, drives the arrow on the risk bar
    confidence: t.string(), // low | medium | high — honest confidence
    headline: t.string(),
    summary: t.string(),
    reasons_json: t.string(), // [{title, detail, severity}]
    evidence_json: t.string(), // raw signal results, for transparency
    checked_at_ms: t.u64(),
    expires_at_ms: t.u64(),
  }
);

const listing_batch = table(
  { name: 'listing_batch', public: true },
  {
    id: t.string().primaryKey(), // client-generated uuid
    site: t.string(),
    items_json: t.string(), // items still needing classification
    results_json: t.string(), // [{key, suspicious, score, reason}]
    status: t.string(), // pending | processing | done | failed
    error: t.string(),
    created_at_ms: t.u64(),
  }
);

const listing_verdict = table(
  { name: 'listing_verdict', public: true },
  {
    key: t.string().primaryKey(),
    site: t.string(),
    title: t.string(),
    suspicious: t.bool(),
    score: t.u32(),
    reason: t.string(),
    checked_at_ms: t.u64(),
  }
);

const user_stats = table(
  { name: 'user_stats', public: true },
  {
    user_id: t.string().primaryKey(),
    hornets_blocked: t.u64(),
    sites_warned: t.u64(),
    listings_blocked: t.u64(),
    updated_at_ms: t.u64(),
  }
);

const site_setting = table(
  { name: 'site_setting', public: true },
  {
    id: t.string().primaryKey(), // `${user_id}:${domain_hash}`
    user_id: t.string(),
    domain_hash: t.string(),
    listings_enabled: t.bool(),
    updated_at_ms: t.u64(),
  }
);

const spacetimedb = schema({
  config,
  worker,
  scan_request,
  site_report,
  listing_batch,
  listing_verdict,
  user_stats,
  site_setting,
});
export default spacetimedb;

// ---------- helpers ----------

function requireWorker(ctx: any) {
  if (!ctx.db.worker.identity_hex.find(hex(ctx.sender))) {
    throw new SenderError('Only a registered Protego worker may call this reducer');
  }
}



// ---------- lifecycle ----------

export const init = spacetimedb.init(ctx => {
  ctx.db.config.insert({ key: 'owner', value: hex(ctx.sender) });
});

// ---------- admin ----------

/** Owner-only: authorize the agent worker's identity to submit results. */
export const register_worker = spacetimedb.reducer(
  { identity_hex: t.string() },
  (ctx, { identity_hex }) => {
    const owner = ctx.db.config.key.find('owner');
    if (!owner || owner.value !== hex(ctx.sender)) {
      throw new SenderError('Only the module owner can register workers');
    }
    const id = identity_hex.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(id)) throw new SenderError('identity_hex must be 64 hex chars');
    if (!ctx.db.worker.identity_hex.find(id)) {
      ctx.db.worker.insert({ identity_hex: id, registered_at_ms: nowMs(ctx) });
    }
  }
);

// ---------- website security check ----------

/**
 * Ask for a security report on a domain. Idempotent: if a fresh report exists
 * (and force=false) or a scan is already queued, this is a no-op, so clients can
 * call it freely on every new domain.
 */
export const request_scan = spacetimedb.reducer(
  { domain: t.string(), signals_json: t.string(), source: t.string(), force: t.bool() },
  (ctx, { domain, signals_json, source, force }) => {
    const d = normalizeDomain(domain);
    if (signals_json.length > MAX_SIGNALS_BYTES) throw new SenderError('signals_json too large');
    if (signals_json) parseJson(signals_json, 'signals_json');
    const now = nowMs(ctx);

    const report = ctx.db.site_report.domain.find(d);
    if (report && report.expires_at_ms > now) {
      // Cached report is fresh. A forced re-scan costs an agent run, so rate-limit it.
      if (!force || now - report.checked_at_ms < BigInt(FORCE_RESCAN_MIN_MS)) return;
    }

    const existing = ctx.db.scan_request.domain.find(d);
    if (existing) {
      const stale = existing.status === 'processing' && now - existing.claimed_at_ms > BigInt(STALE_CLAIM_MS);
      if (existing.status === 'pending' || (existing.status === 'processing' && !stale)) {
        // Prefer richer client signals if the queued request has none yet.
        if (existing.status === 'pending' && !existing.signals_json && signals_json) {
          ctx.db.scan_request.domain.update({ ...existing, signals_json });
        }
        return;
      }
      ctx.db.scan_request.domain.update({
        ...existing,
        signals_json: signals_json || existing.signals_json,
        source: clip(source, 16) || 'auto',
        status: 'pending',
        error: '',
        created_at_ms: now,
        claimed_at_ms: 0n,
      });
      return;
    }

    ctx.db.scan_request.insert({
      domain: d,
      signals_json,
      source: clip(source, 16) || 'auto',
      status: 'pending',
      error: '',
      attempts: 0,
      created_at_ms: now,
      claimed_at_ms: 0n,
    });
  }
);

export const claim_scan = spacetimedb.reducer({ domain: t.string() }, (ctx, { domain }) => {
  requireWorker(ctx);
  const req = ctx.db.scan_request.domain.find(domain);
  if (!req) throw new SenderError('No such scan request');
  const now = nowMs(ctx);
  const stale = req.status === 'processing' && now - req.claimed_at_ms > BigInt(STALE_CLAIM_MS);
  if (req.status !== 'pending' && !stale) throw new SenderError('Scan already claimed');
  ctx.db.scan_request.domain.update({
    ...req,
    status: 'processing',
    attempts: req.attempts + 1,
    claimed_at_ms: now,
  });
});

export const submit_report = spacetimedb.reducer(
  {
    domain: t.string(),
    risk_level: t.string(),
    score: t.u32(),
    confidence: t.string(),
    headline: t.string(),
    summary: t.string(),
    reasons_json: t.string(),
    evidence_json: t.string(),
  },
  (ctx, args) => {
    requireWorker(ctx);
    if (!(RISK_LEVELS as readonly string[]).includes(args.risk_level)) {
      throw new SenderError(`risk_level must be one of ${RISK_LEVELS.join(', ')}`);
    }
    parseJson(args.reasons_json, 'reasons_json');
    const now = nowMs(ctx);
    const row = {
      domain: args.domain,
      risk_level: args.risk_level,
      score: Math.min(100, args.score),
      confidence: clip(args.confidence, 16),
      headline: clip(args.headline, 200),
      summary: clip(args.summary, 2000),
      reasons_json: clip(args.reasons_json, 8000),
      evidence_json: clip(args.evidence_json, 8000),
      checked_at_ms: now,
      expires_at_ms: now + BigInt(REPORT_TTL_MS),
    };
    if (ctx.db.site_report.domain.find(args.domain)) ctx.db.site_report.domain.update(row);
    else ctx.db.site_report.insert(row);
    ctx.db.scan_request.domain.delete(args.domain);
  }
);

export const fail_scan = spacetimedb.reducer(
  { domain: t.string(), error: t.string() },
  (ctx, { domain, error }) => {
    requireWorker(ctx);
    const req = ctx.db.scan_request.domain.find(domain);
    if (!req) return;
    ctx.db.scan_request.domain.update({ ...req, status: 'failed', error: clip(error, 500) });
  }
);

// ---------- fake listing detection ----------

export const request_listing_check = spacetimedb.reducer(
  { batch_id: t.string(), site: t.string(), items_json: t.string() },
  (ctx, { batch_id, site, items_json }) => {
    if (!/^[A-Za-z0-9-]{8,64}$/.test(batch_id)) throw new SenderError('Invalid batch_id');
    if (ctx.db.listing_batch.id.find(batch_id)) return;
    const s = normalizeDomain(site);
    const raw = parseJson<ListingItem[]>(items_json, 'items_json');
    if (!Array.isArray(raw)) throw new SenderError('items_json must be an array');
    if (raw.length > MAX_LISTINGS_PER_BATCH) throw new SenderError('Too many listings in one batch');

    const now = nowMs(ctx);
    const cached: ListingResult[] = [];
    const todo: ListingItem[] = [];
    for (const it of raw) {
      if (!it || typeof it.key !== 'string' || !it.key) continue;
      const item: ListingItem = {
        key: clip(it.key, 128),
        title: clip(it.title, 200),
        company: clip(it.company, 120),
        location: clip(it.location, 120),
        price: clip(it.price, 60),
        snippet: clip(it.snippet, 500),
        description: clip(it.description, 3000),
        url: clip(it.url, 300),
      };
      const v = ctx.db.listing_verdict.key.find(item.key);
      if (v && now - v.checked_at_ms < BigInt(VERDICT_TTL_MS)) {
        cached.push({ key: v.key, suspicious: v.suspicious, score: v.score, reason: v.reason });
      } else {
        todo.push(item);
      }
    }

    ctx.db.listing_batch.insert({
      id: batch_id,
      site: s,
      items_json: JSON.stringify(todo),
      results_json: JSON.stringify(cached),
      status: todo.length === 0 ? 'done' : 'pending',
      error: '',
      created_at_ms: now,
    });
  }
);

export const claim_listing_batch = spacetimedb.reducer({ batch_id: t.string() }, (ctx, { batch_id }) => {
  requireWorker(ctx);
  const b = ctx.db.listing_batch.id.find(batch_id);
  if (!b || b.status !== 'pending') throw new SenderError('Batch not pending');
  ctx.db.listing_batch.id.update({ ...b, status: 'processing' });
});

export const submit_listing_verdicts = spacetimedb.reducer(
  { batch_id: t.string(), verdicts_json: t.string() },
  (ctx, { batch_id, verdicts_json }) => {
    requireWorker(ctx);
    const b = ctx.db.listing_batch.id.find(batch_id);
    if (!b) throw new SenderError('No such batch');
    const verdicts = parseJson<ListingResult[]>(verdicts_json, 'verdicts_json');
    const items = new Map(parseJson<ListingItem[]>(b.items_json, 'items_json').map(i => [i.key, i]));
    const now = nowMs(ctx);
    const results = parseJson<ListingResult[]>(b.results_json, 'results_json');

    for (const v of verdicts) {
      const item = items.get(v.key);
      if (!item) continue; // only accept verdicts for listings in this batch
      const row = {
        key: v.key,
        site: b.site,
        title: item.title,
        suspicious: !!v.suspicious,
        score: Math.max(0, Math.min(100, Math.round(v.score))),
        reason: clip(v.reason, 300),
        checked_at_ms: now,
      };
      if (ctx.db.listing_verdict.key.find(v.key)) ctx.db.listing_verdict.key.update(row);
      else ctx.db.listing_verdict.insert(row);
      results.push({ key: row.key, suspicious: row.suspicious, score: row.score, reason: row.reason });
    }

    ctx.db.listing_batch.id.update({
      ...b,
      items_json: '[]',
      results_json: JSON.stringify(results),
      status: 'done',
    });
  }
);

export const fail_listing_batch = spacetimedb.reducer(
  { batch_id: t.string(), error: t.string() },
  (ctx, { batch_id, error }) => {
    requireWorker(ctx);
    const b = ctx.db.listing_batch.id.find(batch_id);
    if (!b) return;
    ctx.db.listing_batch.id.update({ ...b, status: 'failed', error: clip(error, 500) });
  }
);

// ---------- per-user: hornet counter & site toggles ----------

/** kind: 'site' (warned about a risky site) | 'listing' (hid fake listings). */
export const record_hornets = spacetimedb.reducer(
  { kind: t.string(), count: t.u32() },
  (ctx, { kind, count }) => {
    if (kind !== 'site' && kind !== 'listing') throw new SenderError("kind must be 'site' or 'listing'");
    const n = BigInt(Math.min(count, 100));
    if (n === 0n) return;
    const id = hex(ctx.sender);
    const now = nowMs(ctx);
    const cur = ctx.db.user_stats.user_id.find(id) ?? {
      user_id: id,
      hornets_blocked: 0n,
      sites_warned: 0n,
      listings_blocked: 0n,
      updated_at_ms: now,
    };
    const next = {
      ...cur,
      hornets_blocked: cur.hornets_blocked + n,
      sites_warned: cur.sites_warned + (kind === 'site' ? n : 0n),
      listings_blocked: cur.listings_blocked + (kind === 'listing' ? n : 0n),
      updated_at_ms: now,
    };
    if (ctx.db.user_stats.user_id.find(id)) ctx.db.user_stats.user_id.update(next);
    else ctx.db.user_stats.insert(next);
  }
);

/** domain_hash = hex SHA-256 of the normalized domain, computed client-side. */
export const set_listing_filter = spacetimedb.reducer(
  { domain_hash: t.string(), enabled: t.bool() },
  (ctx, { domain_hash, enabled }) => {
    if (!/^[0-9a-f]{64}$/.test(domain_hash)) throw new SenderError('domain_hash must be sha256 hex');
    const user_id = hex(ctx.sender);
    const id = `${user_id}:${domain_hash}`;
    const row = { id, user_id, domain_hash, listings_enabled: enabled, updated_at_ms: nowMs(ctx) };
    if (ctx.db.site_setting.id.find(id)) ctx.db.site_setting.id.update(row);
    else ctx.db.site_setting.insert(row);
  }
);
