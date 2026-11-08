import type { ClientSignals, Finding, RiskLevel, ServerEvidence } from './types';
import { registrableDomain } from './signals/rdap';

/** Payment processors whose domains are expected on a legitimate checkout. */
const PAYMENT_PROCESSORS = [
  'stripe.com', 'stripe.network', 'paypal.com', 'paypalobjects.com', 'braintreegateway.com', 'braintree-api.com',
  'adyen.com', 'squareup.com', 'square.site', 'shopify.com', 'shopifycdn.com', 'checkout.com', 'klarna.com',
  'affirm.com', 'authorize.net', 'apple.com', 'google.com', 'amazon.com', 'afterpay.com', 'sezzle.com', 'bolt.com',
];

function isProcessor(host: string) {
  return PAYMENT_PROCESSORS.some(p => host === p || host.endsWith(`.${p}`));
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 15) return 'low';
  return 'none';
}

/**
 * Deterministic, explainable scoring. The LLM agent sees these findings and may
 * adjust the final rating, but hard evidence (blocklists) can never be downgraded.
 */
export function scoreSignals(domain: string, s: ClientSignals, ev: ServerEvidence): { score: number; findings: Finding[]; hardHigh: boolean } {
  const f: Finding[] = [];
  const add = (x: Finding) => f.push(x);
  const shopping = !!(s.is_checkout || s.has_payment_fields);

  // --- blocklists (hard evidence) ---
  if (ev.feeds?.openphish || ev.feeds?.phishing_db) {
    add({ id: 'blocklist', title: 'On a scam/phishing list', detail: `This domain appears on ${[ev.feeds.openphish && 'OpenPhish', ev.feeds.phishing_db && 'Phishing.Database'].filter(Boolean).join(' and ')}.`, severity: 'high', points: 100 });
  }
  if (ev.safe_browsing?.threats.length) {
    add({ id: 'safe_browsing', title: 'Flagged by Google Safe Browsing', detail: `Listed for ${ev.safe_browsing.threats.join(', ').toLowerCase().replace(/_/g, ' ')}.`, severity: 'high', points: 100 });
  }

  // --- impersonation ---
  if (ev.lookalike) {
    add({ id: 'lookalike', title: `Looks like ${ev.lookalike.brand}`, detail: `The address uses ${ev.lookalike.how}, but the real site is ${ev.lookalike.official}.`, severity: 'high', points: 45 });
  }

  // --- domain age ---
  const age = ev.rdap?.age_days;
  if (age !== undefined) {
    if (age < 30) add({ id: 'age', title: 'Brand-new website', detail: `Registered ${age} day${age === 1 ? '' : 's'} ago. Most scam shops are less than a month old.`, severity: 'high', points: 35 });
    else if (age < 180) add({ id: 'age', title: 'Young website', detail: `Registered about ${Math.round(age / 30)} months ago.`, severity: 'medium', points: 18 });
    else if (age < 365) add({ id: 'age', title: 'Less than a year old', detail: `Registered ${Math.round(age / 30)} months ago.`, severity: 'low', points: 6 });
  }

  // --- payment destination ---
  const reg = registrableDomain(domain);
  const foreignForms = (s.form_action_domains ?? []).filter(h => registrableDomain(h) !== reg && !isProcessor(h));
  if (shopping && foreignForms.length) {
    add({ id: 'payment_mismatch', title: 'Payment mismatch', detail: `Checkout sends your details to ${foreignForms[0]}, a different domain that isn't a known payment processor.`, severity: 'high', points: 30 });
  }
  if (s.protocol === 'http:' && (s.has_password_field || s.has_payment_fields)) {
    add({ id: 'no_https', title: 'Not encrypted', detail: 'This page asks for passwords or card details over an unencrypted (http) connection.', severity: 'high', points: 35 });
  }

  // --- business legitimacy ---
  const p = s.policy_links ?? {};
  const missing = (['refund', 'contact', 'privacy', 'shipping'] as const).filter(k => p[k] === false);
  if (shopping && missing.length >= 2) {
    add({ id: 'missing_policies', title: 'Missing policies', detail: `No ${missing.join(', ')} page${missing.length > 1 ? 's' : ''} could be found.`, severity: 'medium', points: 8 + missing.length * 3 });
  }
  const risky = (s.payment_methods_mentioned ?? []).filter(m => !['zelle'].includes(m) || shopping);
  if (shopping && risky.length) {
    add({ id: 'risky_payment', title: 'Unrecoverable payment methods', detail: `Asks for ${risky.join(', ')}, which can't be reversed if something goes wrong.`, severity: 'high', points: 25 });
  }
  if ((s.urgency_phrases ?? []).length >= 2) {
    add({ id: 'urgency', title: 'Pressure tactics', detail: `Uses urgent language like "${s.urgency_phrases!.slice(0, 2).join('", "')}".`, severity: 'low', points: 10 });
  }

  // --- suspicious scripts ---
  const fl = s.inline_script_flags ?? {};
  const obf = (fl.eval ?? 0) + (fl.atob ?? 0) + (fl.long_base64 ?? 0) * 2 + (fl.hex_escapes ?? 0) * 2 + (fl.document_write ?? 0);
  if (obf >= 4) {
    add({ id: 'obfuscated_js', title: 'Hidden script code', detail: 'The page runs heavily obfuscated JavaScript, a common way to hide skimmers.', severity: 'medium', points: 15 });
  }
  if (fl.devtools_block) {
    add({ id: 'devtools_block', title: 'Blocks inspection', detail: 'The page tries to stop you from inspecting it.', severity: 'medium', points: 10 });
  }

  const hardHigh = f.some(x => x.id === 'blocklist' || x.id === 'safe_browsing');
  const score = Math.min(100, f.reduce((a, x) => a + x.points, 0));
  return { score: hardHigh ? Math.max(score, 95) : score, findings: f, hardHigh };
}
