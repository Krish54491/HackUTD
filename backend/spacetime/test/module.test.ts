import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionId, Timestamp } from 'spacetimedb';
import { createModuleTestHarness, TestAuth } from 'spacetimedb/server/test-utils';
import spacetimedb, * as mod from '../src/index';
import * as lib from '../src/lib';

const user = (sub: string) =>
  TestAuth.fromJwtPayload(JSON.stringify({ iss: 'https://test.local', sub, aud: 'tango' }), ConnectionId.random());

function setup() {
  const h = createModuleTestHarness(spacetimedb, mod);
  h.clock.set(Timestamp.fromDate(new Date('2026-11-07T12:00:00Z')));
  const owner = TestAuth.internal();
  h.withReducerTx(owner, ctx => mod.init(ctx, {}));
  const worker = user('worker');
  const workerHex = h.withReducerTx(worker, ctx => lib.hex(ctx.sender));
  h.withReducerTx(owner, ctx => mod.register_worker(ctx, { identity_hex: workerHex }));
  return { h, owner, worker };
}

describe('domain normalization', () => {
  it('strips scheme, www, path and port', () => {
    expect(lib.normalizeDomain('https://www.Velora-Outlet.example:443/checkout?x=1')).toBe('velora-outlet.example');
  });
  it('rejects garbage', () => {
    expect(() => lib.normalizeDomain('not a domain')).toThrow();
    expect(() => lib.normalizeDomain('localhost')).toThrow();
  });
});

describe('site scans', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => (s = setup()));

  it('queues once, is idempotent, and caches the report', () => {
    const { h, worker } = s;
    const alice = user('alice');
    h.withReducerTx(alice, ctx => mod.request_scan(ctx, { domain: 'https://shop.example/x', signals_json: '{"a":1}', source: 'auto', force: false }));
    h.withReducerTx(alice, ctx => mod.request_scan(ctx, { domain: 'shop.example', signals_json: '', source: 'auto', force: false }));
    expect(h.db.scan_request.count()).toBe(1n);

    h.withReducerTx(worker, ctx => mod.claim_scan(ctx, { domain: 'shop.example' }));
    expect(() => h.withReducerTx(worker, ctx => mod.claim_scan(ctx, { domain: 'shop.example' }))).toThrow();

    h.withReducerTx(worker, ctx =>
      mod.submit_report(ctx, {
        domain: 'shop.example', risk_level: 'high', score: 88, confidence: 'high',
        headline: 'x', summary: 'y', reasons_json: '[]', evidence_json: '{}',
      })
    );
    expect(h.db.scan_request.count()).toBe(0n);
    expect(h.db.site_report.domain.find('shop.example')?.risk_level).toBe('high');

    // fresh report => no new request
    h.withReducerTx(alice, ctx => mod.request_scan(ctx, { domain: 'shop.example', signals_json: '', source: 'auto', force: false }));
    expect(h.db.scan_request.count()).toBe(0n);
    // force right away => still rate-limited
    h.withReducerTx(alice, ctx => mod.request_scan(ctx, { domain: 'shop.example', signals_json: '', source: 'manual', force: true }));
    expect(h.db.scan_request.count()).toBe(0n);
    // force after 11 minutes => re-queued
    h.clock.set(Timestamp.fromDate(new Date('2026-11-07T12:11:00Z')));
    h.withReducerTx(alice, ctx => mod.request_scan(ctx, { domain: 'shop.example', signals_json: '', source: 'manual', force: true }));
    expect(h.db.scan_request.count()).toBe(1n);
  });

  it('only workers can submit, only owner can register', () => {
    const { h } = s;
    const mallory = user('mallory');
    expect(() =>
      h.withReducerTx(mallory, ctx =>
        mod.submit_report(ctx, { domain: 'evil.example', risk_level: 'none', score: 0, confidence: 'high', headline: '', summary: '', reasons_json: '[]', evidence_json: '' })
      )
    ).toThrow(/worker/);
    expect(() => h.withReducerTx(mallory, ctx => mod.register_worker(ctx, { identity_hex: 'a'.repeat(64) }))).toThrow(/owner/);
  });
});

describe('listings', () => {
  it('serves cached verdicts and only sends new ones to the worker', () => {
    const { h, worker } = setup();
    const alice = user('alice');
    const items = [{ key: 'k1', title: 'Data entry $90/hr' }, { key: 'k2', title: 'Software Engineer' }];
    h.withReducerTx(alice, ctx => mod.request_listing_check(ctx, { batch_id: 'batch-0001', site: 'linkedin.com', items_json: JSON.stringify(items) }));
    h.withReducerTx(worker, ctx => mod.claim_listing_batch(ctx, { batch_id: 'batch-0001' }));
    h.withReducerTx(worker, ctx =>
      mod.submit_listing_verdicts(ctx, {
        batch_id: 'batch-0001',
        verdicts_json: JSON.stringify([
          { key: 'k1', suspicious: true, score: 91, reason: 'Unrealistic pay' },
          { key: 'k2', suspicious: false, score: 5, reason: '' },
          { key: 'injected', suspicious: true, score: 100, reason: 'not in batch' },
        ]),
      })
    );
    const done = h.db.listing_batch.id.find('batch-0001')!;
    expect(done.status).toBe('done');
    expect(JSON.parse(done.results_json)).toHaveLength(2);
    expect(h.db.listing_verdict.key.find('injected')).toBeFalsy();

    h.withReducerTx(alice, ctx => mod.request_listing_check(ctx, { batch_id: 'batch-0002', site: 'linkedin.com', items_json: JSON.stringify([...items, { key: 'k3', title: 'New' }]) }));
    const b2 = h.db.listing_batch.id.find('batch-0002')!;
    expect(b2.status).toBe('pending');
    expect(JSON.parse(b2.items_json).map((i: any) => i.key)).toEqual(['k3']);
    expect(JSON.parse(b2.results_json)).toHaveLength(2);
  });
});

describe('per-user state', () => {
  it('counts hornets per user and stores hashed site toggles', () => {
    const { h } = setup();
    const alice = user('alice');
    const id = h.withReducerTx(alice, ctx => lib.hex(ctx.sender));
    h.withReducerTx(alice, ctx => mod.record_hornets(ctx, { kind: 'listing', count: 3 }));
    h.withReducerTx(alice, ctx => mod.record_hornets(ctx, { kind: 'site', count: 1 }));
    const st = h.db.user_stats.user_id.find(id)!;
    expect(st.hornets_blocked).toBe(4n);
    expect(st.listings_blocked).toBe(3n);
    const hash = 'b'.repeat(64);
    h.withReducerTx(alice, ctx => mod.set_listing_filter(ctx, { domain_hash: hash, enabled: false }));
    expect(h.db.site_setting.id.find(`${id}:${hash}`)?.listings_enabled).toBe(false);
  });
});
