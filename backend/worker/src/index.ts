/**
 * Protego agent worker.
 *
 * SpacetimeDB is the system of record; this process only does what reducers
 * can't: outbound HTTP (RDAP, blocklists, Safe Browsing) and the Claude agent.
 * It polls the public queue tables and writes results back through
 * worker-only reducers.
 */
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Spacetime, sqlStr } from './stdb';
import { lookupRdap } from './signals/rdap';
import { checkFeeds, refreshFeeds } from './signals/feeds';
import { checkSafeBrowsing } from './signals/safebrowsing';
import { detectLookalike } from './signals/lookalike';
import { fetchSignals } from './signals/fetchPage';
import { scoreSignals } from './heuristics';
import { analyzeSite, classifyListings, heuristicReport, type ListingInput } from './agent';
import type { ClientSignals, Report, ServerEvidence } from './types';

const HOST = process.env.SPACETIME_HOST ?? 'https://maincloud.spacetimedb.com';
const DB = process.env.SPACETIME_DB ?? 'protego';
const POLL_MS = Number(process.env.POLL_MS ?? 1500);
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL ?? 3);
const IDENTITY_FILE = '.worker-identity.json';
const USE_LLM = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && process.env.DISABLE_LLM !== '1';

const inFlight = new Set<string>();

async function loadIdentity(): Promise<{ identity: string; token: string }> {
  if (process.env.WORKER_TOKEN && process.env.WORKER_IDENTITY) {
    return { identity: process.env.WORKER_IDENTITY, token: process.env.WORKER_TOKEN };
  }
  if (existsSync(IDENTITY_FILE)) return JSON.parse(readFileSync(IDENTITY_FILE, 'utf8'));
  const id = await Spacetime.newIdentity(HOST);
  writeFileSync(IDENTITY_FILE, JSON.stringify(id, null, 2));
  return id;
}

async function waitForRegistration(st: Spacetime, identityHex: string) {
  for (let warned = false; ; ) {
    const rows = await st.sql(`SELECT * FROM worker WHERE identity_hex = ${sqlStr(identityHex)}`);
    if (rows.length) return;
    if (!warned) {
      console.log(
        `\n[worker] Not registered yet. As the module owner, run:\n\n  spacetime call --server ${HOST.includes('maincloud') ? 'maincloud' : 'local'} ${DB} register_worker ${identityHex}\n\nWaiting...`
      );
      warned = true;
    }
    await sleep(3000);
  }
}

// ---------------- site scans ----------------

async function processScan(st: Spacetime, req: { domain: string; signals_json: string }) {
  const { domain } = req;
  try {
    await st.call('claim_scan', domain);
  } catch {
    return; // someone else claimed it
  }
  const started = Date.now();
  try {
    let signals: ClientSignals = req.signals_json ? JSON.parse(req.signals_json) : {};
    const evidence: ServerEvidence = {};
    const needsFetch = !req.signals_json || Object.keys(signals).length === 0;

    const [rdap, sb, fetched] = await Promise.all([
      lookupRdap(domain),
      checkSafeBrowsing(domain),
      needsFetch ? fetchSignals(domain) : Promise.resolve(null),
      refreshFeeds(),
    ]);
    evidence.rdap = rdap;
    evidence.safe_browsing = sb;
    evidence.feeds = checkFeeds(domain);
    evidence.lookalike = detectLookalike(domain);
    if (fetched) {
      signals = fetched.signals;
      evidence.fetched_page = { ok: fetched.ok, status: fetched.status, error: fetched.error };
    }

    const h = scoreSignals(domain, signals, evidence);
    let report: Report;
    if (USE_LLM) {
      try {
        report = await analyzeSite(domain, signals, evidence, h);
      } catch (e) {
        console.warn(`[scan] ${domain}: LLM failed, using heuristics: ${(e as Error).message}`);
        report = heuristicReport(domain, h);
      }
    } else {
      report = heuristicReport(domain, h);
    }

    await st.call(
      'submit_report',
      domain,
      report.risk_level,
      report.score,
      report.confidence,
      report.headline,
      report.summary,
      JSON.stringify(report.reasons),
      JSON.stringify({ ...evidence, heuristic_score: h.score })
    );
    console.log(`[scan] ${domain}: ${report.risk_level} (${report.score}) in ${Date.now() - started}ms`);
  } catch (e) {
    console.error(`[scan] ${domain} failed:`, e);
    await st.call('fail_scan', domain, (e as Error).message).catch(() => {});
  }
}

// ---------------- listing batches ----------------

async function processBatch(st: Spacetime, b: { id: string; site: string; items_json: string }) {
  try {
    await st.call('claim_listing_batch', b.id);
  } catch {
    return;
  }
  try {
    const items: ListingInput[] = JSON.parse(b.items_json);
    const verdicts = USE_LLM ? await classifyListings(b.site, items) : items.map(i => ({ key: i.key, suspicious: false, score: 0, reason: '' }));
    await st.call('submit_listing_verdicts', b.id, JSON.stringify(verdicts));
    const flagged = verdicts.filter(v => v.suspicious).length;
    console.log(`[listings] ${b.site} batch ${b.id.slice(0, 8)}: ${flagged}/${items.length} suspicious`);
  } catch (e) {
    console.error(`[listings] batch ${b.id} failed:`, e);
    await st.call('fail_listing_batch', b.id, (e as Error).message).catch(() => {});
  }
}

// ---------------- main loop ----------------

const STALE_MS = 2 * 60 * 1000;

async function tick(st: Spacetime) {
  const now = Date.now();
  const scans = await st.sql<{ domain: string; signals_json: string; status: string; claimed_at_ms: number }>(
    'SELECT * FROM scan_request'
  );
  for (const s of scans) {
    const ready = s.status === 'pending' || (s.status === 'processing' && now - Number(s.claimed_at_ms) > STALE_MS);
    if (!ready || inFlight.has(`s:${s.domain}`) || inFlight.size >= MAX_PARALLEL) continue;
    inFlight.add(`s:${s.domain}`);
    processScan(st, s).finally(() => inFlight.delete(`s:${s.domain}`));
  }

  const batches = await st.sql<{ id: string; site: string; items_json: string; status: string }>(
    "SELECT * FROM listing_batch WHERE status = 'pending'"
  );
  for (const b of batches) {
    if (inFlight.has(`b:${b.id}`) || inFlight.size >= MAX_PARALLEL + 2) continue;
    inFlight.add(`b:${b.id}`);
    processBatch(st, b).finally(() => inFlight.delete(`b:${b.id}`));
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const { identity, token } = await loadIdentity();
  const identityHex = identity.replace(/^0x/i, '').toLowerCase();
  const st = new Spacetime(HOST, DB, token);
  console.log(`[worker] ${HOST}/${DB} as ${identityHex.slice(0, 12)}…  LLM=${USE_LLM ? 'on' : 'off (heuristics only)'}`);
  if (!USE_LLM && process.env.DISABLE_LLM !== '1') {
    console.log(`[worker] No ANTHROPIC_API_KEY found. Put it in ${process.cwd()}\.env (copy .env.example) and restart.`);
  }
  await waitForRegistration(st, identityHex);
  await refreshFeeds(true);
  console.log('[worker] ready');
  for (;;) {
    try {
      await tick(st);
    } catch (e) {
      console.error('[worker] tick failed:', (e as Error).message);
    }
    await sleep(POLL_MS);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
