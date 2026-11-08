import { describe, it, expect } from 'vitest';
import { detectLookalike } from '../src/signals/lookalike';
import { registrableDomain } from '../src/signals/rdap';
import { signalsFromHtml } from '../src/signals/fetchPage';
import { scoreSignals, levelFromScore } from '../src/heuristics';
import { heuristicReport } from '../src/agent';
import { decodeRows } from '../src/stdb';

describe('lookalike', () => {
  it.each([
    ['amaz0n.com', 'amazon'],
    ['paypa1.com', 'paypal'],
    ['paypal-secure-login.top', 'paypal'],
    ['chase-verify.com', 'chase'],
    ['wellsfargoo.com', 'wellsfargo'],
  ])('%s', (domain, brand) => {
    expect(detectLookalike(domain)?.brand).toBe(brand);
  });
  it('ignores official domains and subdomains', () => {
    expect(detectLookalike('amazon.com')).toBeNull();
    expect(detectLookalike('smile.amazon.com')).toBeNull();
    expect(detectLookalike('www.t-mobile.com')).toBeNull();
    expect(detectLookalike('github.com')).toBeNull();
  });
});

it('registrableDomain', () => {
  expect(registrableDomain('pay.velora-outlet.example')).toBe('velora-outlet.example');
  expect(registrableDomain('shop.bbc.co.uk')).toBe('bbc.co.uk');
});

const SCAM_HTML = `<html><head><title>Velora Outlet - 90% off clearance sale</title>
<script>eval(atob("ZG9j"));eval(atob("x"));</script></head><body>
<form action="https://pay.velora-pay.example/charge"><input name="cardnumber"><input name="cvv"></form>
<p>Limited time! Act now. We accept Bitcoin and gift card.</p>
<a href="/">Home</a><a href="/about">About</a></body></html>`;

describe('signals + scoring', () => {
  it('extracts signals from html', () => {
    const s = signalsFromHtml(SCAM_HTML, 'velora-outlet.example');
    expect(s.has_payment_fields).toBe(true);
    expect(s.form_action_domains).toEqual(['pay.velora-pay.example']);
    expect(s.policy_links?.refund).toBe(false);
    expect(s.payment_methods_mentioned).toContain('bitcoin');
  });

  it('rates the synthetic scam checkout high', () => {
    const s = signalsFromHtml(SCAM_HTML, 'velora-outlet.example');
    const h = scoreSignals('velora-outlet.example', s, { rdap: { age_days: 12 }, feeds: { openphish: false, phishing_db: false } });
    expect(levelFromScore(h.score)).toBe('high');
    const ids = h.findings.map(f => f.id);
    expect(ids).toEqual(expect.arrayContaining(['payment_mismatch', 'missing_policies', 'age', 'risky_payment']));
    const r = heuristicReport('velora-outlet.example', h);
    expect(r.reasons[0].severity).toBe('high');
  });

  it('a blocklist hit is always high', () => {
    const h = scoreSignals('x.example', {}, { feeds: { openphish: true, phishing_db: false } });
    expect(h.hardHigh).toBe(true);
    expect(h.score).toBeGreaterThanOrEqual(95);
  });

  it('a normal, old site with a processor checkout is clean', () => {
    const h = scoreSignals(
      'shop.example',
      { is_checkout: true, has_payment_fields: true, form_action_domains: ['api.stripe.com'], policy_links: { refund: true, contact: true, privacy: true, shipping: true } },
      { rdap: { age_days: 4000 }, feeds: { openphish: false, phishing_db: false } }
    );
    expect(levelFromScore(h.score)).toBe('none');
  });
});

it('decodes SATS-JSON sql rows', () => {
  const rows = decodeRows({
    schema: { elements: [{ name: { some: 'domain' } }, { name: { some: 'score' } }] },
    rows: [['a.example', 42]],
  });
  expect(rows).toEqual([{ domain: 'a.example', score: 42 }]);
});
