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
import { analyzeSite, classifyListings, heuristicReport, triage, type ListingInput, type TraceStep } from './agent';
import { AGENT_MODEL, FALLBACK_MODEL, FAST_MODEL, hasNvidiaKey } from './nemotron';
import type { ClientSignals, Report, ServerEvidence } from './types';

const HOST = process.env.SPACETIME_HOST ?? 'https://maincloud.spacetimedb.com';
const DB = process.env.SPACETIME_DB ?? 'protego';
const POLL_MS = Number(process.env.POLL_MS ?? 750);
/** Scans and listing batches get separate slots so a slow one never queues the other. */
const MAX_SCANS = Number(process.env.MAX_PARALLEL ?? 6);
const MAX_BATCHES = Number(process.env.MAX_BATCHES ?? 4);
const IDENTITY_FILE = '.worker-identity.json';
const USE_LLM = hasNvidiaKey() && process.env.DISABLE_LLM !== '1';
const EVIDENCE_MAX = 23_000; // module clips evidence_json at 24k

const inFlight = new Set<string>();
const count = (prefix: string) => [...inFlight].filter(k => k.startsWith(prefix)).length;

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
    ]);
    void refreshFeeds(); // every 30 min, in the background: never on a user's critical path
    evidence.rdap = rdap;
    evidence.safe_browsing = sb;
    evidence.feeds = checkFeeds(domain);
    evidence.lookalike = detectLookalike(domain);
    if (fetched) {
      signals = fetched.signals;
      evidence.fetched_page = { ok: fetched.ok, status: fetched.status, error: fetched.error };
    }

    const h = scoreSignals(domain, signals, evidence);
    const lane = USE_LLM ? triage(h, evidence) : 'rules';
    let report: Report;
    let agent: { model: string; lane: string; trace: TraceStep[] } | undefined;
    if (lane === 'rules') {
      report = heuristicReport(domain, h, evidence);
    } else {
      try {
        const out = await analyzeSite(domain, signals, evidence, h, lane);
        report = out.report;
        agent = { model: out.model, lane, trace: out.trace };
        logTrace(domain, out.trace);
      } catch (e) {
        console.warn(`[scan] ${domain}: LLM failed, using heuristics: ${(e as Error).message}`);
        report = heuristicReport(domain, h, evidence);
      }
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
      evidenceJson({ ...evidence, heuristic_score: h.score, agent })
    );
    console.log(`[scan] ${domain}: ${report.risk_level} (${report.score}) via ${lane} in ${Date.now() - started}ms`);
  } catch (e) {
    console.error(`[scan] ${domain} failed:`, e);
    await st.call('fail_scan', domain, (e as Error).message).catch(() => {});
  }
}

/** Stored with the report so anyone can see how the agent reached its verdict. */
function evidenceJson(ev: Record<string, unknown> & { agent?: { trace: TraceStep[] } }): string {
  let json = JSON.stringify(ev);
  if (json.length > EVIDENCE_MAX && ev.agent) {
    const trace = ev.agent.trace.map(t => (t.step === 'tool' ? { ...t, preview: t.preview.slice(0, 60) } : t.step === 'notes' ? { ...t, text: t.text.slice(0, 400) } : t));
    json = JSON.stringify({ ...ev, agent: { ...ev.agent, trace } });
  }
  return json.length > EVIDENCE_MAX ? JSON.stringify({ ...ev, agent: { truncated: true } }) : json;
}

function logTrace(domain: string, trace: TraceStep[]) {
  for (const t of trace) {
    if (t.step === 'plan') console.log(`[agent] ${domain} plan: ${t.steps.map(s => s.tool).join(', ')} | ${t.hypotheses.join(' / ').slice(0, 120)}`);
    else if (t.step === 'tool') {
      const mark = { baseline: '·', planned: '→', 'follow-up': '↪' }[t.phase];
      console.log(`[agent] ${domain}   ${mark} ${t.tool}(${JSON.stringify(t.args).slice(0, 60)}) ${t.cached ? 'reused' : `${t.ok ? 'ok' : 'ERR'} ${t.ms}ms`}`);
    }
    else if (t.step === 'verdict') console.log(`[agent] ${domain} verdict ${t.score} (${t.ms}ms)`);
    else if (t.step === 'error') console.log(`[agent] ${domain} ${t.where} error: ${t.message.slice(0, 160)}`);
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
    const verdicts = await classifyListings(b.site, items, USE_LLM); // rules always run, even without an API key
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
    if (!ready || inFlight.has(`s:${s.domain}`) || count('s:') >= MAX_SCANS) continue;
    inFlight.add(`s:${s.domain}`);
    processScan(st, s).finally(() => inFlight.delete(`s:${s.domain}`));
  }

  const batches = await st.sql<{ id: string; site: string; items_json: string; status: string }>(
    "SELECT * FROM listing_batch WHERE status = 'pending'"
  );
  for (const b of batches) {
    if (inFlight.has(`b:${b.id}`) || count('b:') >= MAX_BATCHES) continue;
    inFlight.add(`b:${b.id}`);
    processBatch(st, b).finally(() => inFlight.delete(`b:${b.id}`));
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const { identity, token } = await loadIdentity();
  const identityHex = identity.replace(/^0x/i, '').toLowerCase();
  const st = new Spacetime(HOST, DB, token);
  console.log(`[worker] ${HOST}/${DB} as ${identityHex.slice(0, 12)}…  Nemotron=${USE_LLM ? `on (agent ${AGENT_MODEL}, fallback ${FALLBACK_MODEL}, listings ${FAST_MODEL})` : 'off (rules only)'}`);
  if (!USE_LLM && process.env.DISABLE_LLM !== '1') {
    console.log(`[worker] No NVIDIA_API_KEY found. Put it in ${process.cwd()}\.env (copy .env.example) and restart.`);
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
