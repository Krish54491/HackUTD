import type { ClientSignals } from '../types';

/**
 * For manual checks typed into the popup (no page open), fetch the public homepage
 * server-side and derive a reduced signal set. No user data is involved.
 */
export async function fetchSignals(
  domain: string
): Promise<{ signals: ClientSignals; ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(`https://${domain}/`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProtegoScanner/0.1)' },
    });
    const html = (await res.text()).slice(0, 500_000);
    return { signals: signalsFromHtml(html, domain, new URL(res.url).protocol), ok: res.ok, status: res.status };
  } catch (e) {
    return { signals: {}, ok: false, error: (e as Error).message };
  }
}

const URGENCY = [
  'only today', 'limited time', 'act now', '90% off', '80% off', 'clearance sale', 'last chance',
  'account suspended', 'verify your account', 'final notice',
];
const RISKY_PAYMENTS = ['bitcoin', 'usdt', 'crypto', 'gift card', 'wire transfer', 'zelle', 'western union', 'moneygram'];

export function signalsFromHtml(html: string, domain: string, protocol = 'https:'): ClientSignals {
  const lower = html.toLowerCase();
  const hostsOf = (re: RegExp) => {
    const out = new Set<string>();
    for (const m of html.matchAll(re)) {
      try {
        const h = new URL(m[1], `https://${domain}/`).hostname.replace(/^www\./, '');
        if (h && h !== domain && !h.endsWith(`.${domain}`)) out.add(h);
      } catch {
        /* ignore bad URLs */
      }
    }
    return [...out].slice(0, 30);
  };
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
  const count = (re: RegExp) => (inline.match(re) ?? []).length;
  const linkText = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, ' ').toLowerCase())
    .join(' | ');
  const year = lower.match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/);
  return {
    protocol,
    title: (html.match(/<title[^>]*>([^<]{0,200})/i)?.[1] ?? '').trim(),
    has_password_field: /type=["']?password/i.test(html),
    has_payment_fields: /(card.?number|cc-number|cvv|cvc|autocomplete=["']cc-)/i.test(html),
    form_action_domains: hostsOf(/<form[^>]+action=["']([^"']+)/gi),
    external_script_domains: hostsOf(/<script[^>]+src=["']([^"']+)/gi),
    payment_iframe_domains: hostsOf(/<iframe[^>]+src=["']([^"']+)/gi),
    inline_script_flags: {
      eval: count(/\beval\s*\(/g),
      atob: count(/\batob\s*\(/g),
      long_base64: count(/[A-Za-z0-9+/]{400,}={0,2}/g),
      document_write: count(/document\.write\s*\(/g),
      hex_escapes: count(/(\\x[0-9a-f]{2}){20,}/gi),
    },
    policy_links: {
      privacy: /privacy/.test(linkText),
      refund: /(refund|return)/.test(linkText),
      terms: /(terms|conditions)/.test(linkText),
      contact: /(contact|support|help)/.test(linkText),
      shipping: /shipping/.test(linkText),
      about: /about/.test(linkText),
    },
    urgency_phrases: URGENCY.filter(p => lower.includes(p)),
    payment_methods_mentioned: RISKY_PAYMENTS.filter(p => lower.includes(p)),
    copyright_year: year ? Number(year[1]) : null,
  };
}
