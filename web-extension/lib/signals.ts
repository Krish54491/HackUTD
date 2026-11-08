/**
 * In-page signal extraction. PRIVACY BOUNDARY: this is everything that leaves
 * the browser for an automatic check. It only contains structural facts about
 * the page (which domains it talks to, whether policy links exist, etc.).
 * Never form values, cookies, query strings, page text, or full HTML.
 * Shape mirrors ClientSignals in backend/worker/src/types.ts.
 */
const URGENCY = [
  'only today', 'limited time', 'act now', '90% off', '80% off', 'clearance sale', 'last chance',
  'account suspended', 'verify your account', 'final notice',
];
const RISKY_PAYMENTS = ['bitcoin', 'usdt', 'crypto', 'gift card', 'wire transfer', 'zelle', 'western union', 'moneygram'];

function bareHost(h: string) {
  return h.toLowerCase().replace(/^www\./, '');
}

function foreignHosts(urls: (string | null | undefined)[], own: string): string[] {
  const out = new Set<string>();
  for (const u of urls) {
    if (!u) continue;
    try {
      const h = bareHost(new URL(u, location.href).hostname);
      if (h && h !== own && !h.endsWith(`.${own}`) && !own.endsWith(`.${h}`)) out.add(h);
    } catch {
      /* ignore */
    }
  }
  return [...out].slice(0, 30);
}

export function collectSignals(domain: string) {
  const doc = document;
  const inputs = [...doc.querySelectorAll('input')];
  const attrs = (i: HTMLInputElement) => `${i.name} ${i.id} ${i.autocomplete} ${i.placeholder}`.toLowerCase();
  const has_payment_fields = inputs.some(i => /(^|\W)cc-|card.?num|cardnumber|cvv|cvc|security.?code|expir/.test(attrs(i)));
  const path = location.pathname.toLowerCase();

  const inline = [...doc.querySelectorAll('script:not([src])')]
    .map(s => s.textContent ?? '')
    .join('\n')
    .slice(0, 300_000);
  const count = (re: RegExp) => (inline.match(re) ?? []).length;

  const links = [...doc.querySelectorAll('a')].slice(0, 1500);
  const linkText = links.map(a => `${a.textContent ?? ''} ${a.getAttribute('href') ?? ''}`.toLowerCase()).join(' | ');

  // Visible text is only scanned locally for a fixed phrase list; the text itself is never sent.
  const text = (doc.body?.innerText ?? '').slice(0, 80_000).toLowerCase();
  const year = text.match(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/);

  return {
    protocol: location.protocol,
    path: location.pathname.slice(0, 120), // no query string
    title: doc.title.slice(0, 150),
    is_checkout: /(checkout|cart|payment|billing|pay\b)/.test(path) || has_payment_fields,
    has_password_field: inputs.some(i => i.type === 'password'),
    has_payment_fields,
    form_action_domains: foreignHosts([...doc.forms].map(f => f.getAttribute('action')), domain),
    payment_iframe_domains: foreignHosts([...doc.querySelectorAll('iframe')].map(f => f.getAttribute('src')), domain),
    external_script_domains: foreignHosts([...doc.querySelectorAll('script[src]')].map(s => s.getAttribute('src')), domain),
    inline_script_flags: {
      eval: count(/\beval\s*\(/g),
      atob: count(/\batob\s*\(/g),
      long_base64: count(/[A-Za-z0-9+/]{400,}={0,2}/g),
      document_write: count(/document\.write\s*\(/g),
      hex_escapes: count(/(\\x[0-9a-f]{2}){20,}/gi),
      devtools_block: count(/\bdebugger\b/g) > 3 || /contextmenu['"]?\s*,[^)]*preventDefault/.test(inline) ? 1 : 0,
    },
    policy_links: {
      privacy: /privacy/.test(linkText),
      refund: /(refund|return)/.test(linkText),
      terms: /(terms|conditions)/.test(linkText),
      contact: /(contact|support|help)/.test(linkText),
      shipping: /shipping|delivery/.test(linkText),
      about: /about/.test(linkText),
    },
    urgency_phrases: URGENCY.filter(p => text.includes(p)),
    payment_methods_mentioned: RISKY_PAYMENTS.filter(p => text.includes(p)),
    copyright_year: year ? Number(year[1]) : null,
  };
}
