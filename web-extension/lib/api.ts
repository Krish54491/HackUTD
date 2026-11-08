/**
 * Background-only wrapper around the Protego SpacetimeDB module.
 * Every call goes through reducers / public-table SQL; no other server exists.
 */
import { browser } from 'wxt/browser';
import { Spacetime, ReducerError, sqlStr } from './stdb';
import { STDB_DB, STDB_HOST, SCAN_TIMEOUT_MS, LISTING_TIMEOUT_MS, FORCE_RESCAN_MIN_MS } from './config';
import type { ListingItem, ListingResult, Reason, SiteReport } from './types';
import { sha256Hex } from './domain';

let clientPromise: Promise<{ st: Spacetime; userId: string }> | null = null;

/** One anonymous SpacetimeDB identity per install, kept in local storage. */
export function client() {
  clientPromise ??= (async () => {
    const saved = (await browser.storage.local.get('stdb_identity')).stdb_identity as
      | { identity: string; token: string }
      | undefined;
    const id = saved ?? (await Spacetime.newIdentity(STDB_HOST));
    if (!saved) await browser.storage.local.set({ stdb_identity: id });
    return { st: new Spacetime(STDB_HOST, STDB_DB, id.token), userId: id.identity.replace(/^0x/i, '').toLowerCase() };
  })().catch(e => {
    clientPromise = null;
    throw e;
  });
  return clientPromise;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function toReport(r: Record<string, unknown>): SiteReport {
  let reasons: Reason[] = [];
  try {
    reasons = JSON.parse(String(r.reasons_json ?? '[]'));
  } catch {
    /* keep empty */
  }
  return {
    domain: String(r.domain),
    risk_level: r.risk_level as SiteReport['risk_level'],
    score: Number(r.score),
    confidence: r.confidence as SiteReport['confidence'],
    headline: String(r.headline ?? ''),
    summary: String(r.summary ?? ''),
    reasons,
    checked_at_ms: Number(r.checked_at_ms),
    expires_at_ms: Number(r.expires_at_ms),
  };
}

export async function getReport(domain: string): Promise<SiteReport | null> {
  const { st } = await client();
  const rows = await st.sql(`SELECT * FROM site_report WHERE domain = ${sqlStr(domain)}`);
  return rows[0] ? toReport(rows[0]) : null;
}

/**
 * Queue a scan (idempotent on the server) and wait for the agent's report.
 * `signals` are the privacy-filtered page signals, or null for a manual check.
 */
export async function scan(domain: string, signals: unknown | null, opts: { manual?: boolean; force?: boolean } = {}): Promise<SiteReport> {
  const { st } = await client();
  const cached = await getReport(domain);
  if (cached && cached.expires_at_ms > Date.now()) {
    // The server rate-limits forced re-scans to one per 10 minutes per domain.
    if (!opts.force || Date.now() - cached.checked_at_ms < FORCE_RESCAN_MIN_MS) return cached;
  }
  const startedAt = Date.now();
  await st.call('request_scan', domain, signals ? JSON.stringify(signals) : '', opts.manual ? 'manual' : 'auto', !!opts.force);

  for (let delay = 1200; Date.now() - startedAt < SCAN_TIMEOUT_MS; delay = Math.min(delay * 1.3, 4000)) {
    await sleep(delay);
    const r = await getReport(domain);
    if (r && r.checked_at_ms >= startedAt - 5000) return r;
    if (r && !opts.force && r.expires_at_ms > Date.now()) return r;
    const q = await st.sql(`SELECT * FROM scan_request WHERE domain = ${sqlStr(domain)}`);
    if (q[0]?.status === 'failed') throw new Error(String(q[0].error || 'Scan failed'));
  }
  throw new Error('The security check is taking too long. Try again in a minute.');
}

export async function checkListings(site: string, items: ListingItem[]): Promise<ListingResult[]> {
  const { st } = await client();
  const batchId = crypto.randomUUID();
  await st.call('request_listing_check', batchId, site, JSON.stringify(items));
  const started = Date.now();
  for (let delay = 600; Date.now() - started < LISTING_TIMEOUT_MS; delay = Math.min(delay * 1.4, 3000)) {
    const rows = await st.sql(`SELECT * FROM listing_batch WHERE id = ${sqlStr(batchId)}`);
    const b = rows[0];
    if (b?.status === 'done') return JSON.parse(String(b.results_json));
    if (b?.status === 'failed') throw new Error(String(b.error || 'Listing check failed'));
    await sleep(delay);
  }
  throw new Error('Listing check timed out');
}

export async function recordHornets(kind: 'site' | 'listing', count: number) {
  if (count <= 0) return;
  const { st } = await client();
  await st.call('record_hornets', kind, Math.min(count, 100));
}

export async function getHornets(): Promise<number> {
  const { st, userId } = await client();
  const rows = await st.sql(`SELECT * FROM user_stats WHERE user_id = ${sqlStr(userId)}`);
  return rows[0] ? Number(rows[0].hornets_blocked) : 0;
}

/** Synced to Spacetime as a SHA-256 of the domain so the server never learns which site it is. */
export async function syncListingFilter(site: string, enabled: boolean) {
  const { st } = await client();
  await st.call('set_listing_filter', await sha256Hex(site), enabled);
}

export { ReducerError };
