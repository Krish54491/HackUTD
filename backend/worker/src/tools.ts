/**
 * The investigator agent's toolbox. Each tool wraps a real external service and
 * returns a small JSON summary (the model never sees raw HTML).
 *
 * Search providers, in order: Tavily (TAVILY_API_KEY) → Brave (BRAVE_SEARCH_API_KEY)
 * → DuckDuckGo HTML (no key, best effort; rate-limited) → Wikipedia.
 */
import { lookup, resolveMx, resolveNs } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { ToolSpec } from './nemotron';
import { lookupRdap, registrableDomain } from './signals/rdap';
import { checkFeeds } from './signals/feeds';
import { checkSafeBrowsing } from './signals/safebrowsing';
import { detectLookalike } from './signals/lookalike';
import { signalsFromHtml } from './signals/fetchPage';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

type Json = Record<string, unknown>;
export type Tool = { spec: ToolSpec; run: (args: Json) => Promise<unknown> };

const str = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max);
const domainArg = (v: unknown) =>
  str(v, 253)
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split(/[/?#]/)[0]!
    .replace(/^www\./, '');

function def(name: string, description: string, properties: Json, required: string[], run: Tool['run']): Tool {
  return {
    spec: { type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } },
    run,
  };
}

// ---------- safe fetching ----------

const PRIVATE = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^::1$/, /^f[cd]/i, /^fe80/i];

/** The model picks URLs, and pages are untrusted: only public http(s) hosts, never internal addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('only http(s) URLs');
  const host = u.hostname.toLowerCase();
  if (isIP(host) || host === 'localhost' || /\.(local|internal|lan|home|corp)$/.test(host) || !host.includes('.')) {
    throw new Error('only public website addresses');
  }
  const { address } = await lookup(host);
  if (PRIVATE.some(re => re.test(address))) throw new Error('address resolves to a private network');
  return u;
}

async function getText(url: string, timeoutMs = 10_000, init: RequestInit = {}): Promise<{ status: number; url: string; body: string }> {
  await assertPublicUrl(url);
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    ...init,
    headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...(init.headers ?? {}) },
  });
  return { status: res.status, url: res.url, body: (await res.text()).slice(0, 800_000) };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : m))
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- web search ----------

export type SearchHit = { title: string; url: string; snippet: string };

async function searchTavily(q: string): Promise<SearchHit[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, max_results: 5, search_depth: 'basic' }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const j = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
  return (j.results ?? []).map(r => ({ title: r.title, url: r.url, snippet: r.content }));
}

async function searchBrave(q: string): Promise<SearchHit[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?count=5&q=${encodeURIComponent(q)}`, {
    headers: { 'X-Subscription-Token': String(process.env.BRAVE_SEARCH_API_KEY), Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Brave HTTP ${res.status}`);
  const j = (await res.json()) as { web?: { results?: { title: string; url: string; description: string }[] } };
  return (j.web?.results ?? []).map(r => ({ title: htmlToText(r.title), url: r.url, snippet: htmlToText(r.description) }));
}

export function parseDuckDuckGo(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const blocks = html.split(/class="result results_links/).slice(1);
  for (const b of blocks) {
    const a = b.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let url = a[1]!.replace(/&amp;/g, '&');
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]!);
    if (url.startsWith('//')) url = `https:${url}`;
    const sn = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    hits.push({ title: htmlToText(a[2]!), url, snippet: htmlToText(sn?.[1] ?? '') });
    if (hits.length >= 5) break;
  }
  return hits;
}

async function searchDuckDuckGo(q: string): Promise<SearchHit[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10_000),
  });
  const html = await res.text();
  if (/anomaly|captcha/i.test(html) && !html.includes('result__a')) throw new Error('DuckDuckGo rate-limited this server');
  return parseDuckDuckGo(html);
}

async function searchWikipedia(q: string): Promise<SearchHit[]> {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=${encodeURIComponent(q)}`,
    { headers: { 'User-Agent': 'TangoHackathon/1.0 (anti-scam research)' }, signal: AbortSignal.timeout(8_000) }
  );
  const j = (await res.json()) as { query?: { search?: { title: string; snippet: string }[] } };
  return (j.query?.search ?? []).map(s => ({
    title: s.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`,
    snippet: htmlToText(s.snippet),
  }));
}

export async function webSearch(q: string): Promise<{ provider: string; results: SearchHit[]; note?: string }> {
  const chain: [string, (q: string) => Promise<SearchHit[]>, boolean][] = [
    ['tavily', searchTavily, !!process.env.TAVILY_API_KEY],
    ['brave', searchBrave, !!process.env.BRAVE_SEARCH_API_KEY],
    ['duckduckgo', searchDuckDuckGo, true],
  ];
  const errors: string[] = [];
  for (const [name, fn, enabled] of chain) {
    if (!enabled) continue;
    try {
      const results = await fn(q);
      if (results.length) return { provider: name, results: results.map(r => ({ ...r, snippet: r.snippet.slice(0, 300) })) };
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  }
  const wiki = await searchWikipedia(q).catch(() => []);
  return { provider: 'wikipedia', results: wiki, note: `General web search unavailable (${errors.join('; ') || 'no results'}); showing encyclopedia matches only.` };
}

// ---------- the tools ----------

let crtShDownUntil = 0;

export function buildTools(): Record<string, Tool> {
  const tools: Tool[] = [
    def(
      'domain_registration',
      'Look up when a domain was registered and by which registrar (RDAP/WHOIS). Brand-new domains are a major scam signal.',
      { domain: { type: 'string', description: 'e.g. example.com' } },
      ['domain'],
      async a => lookupRdap(domainArg(a.domain))
    ),
    def(
      'threat_intelligence',
      'Check a domain against Google Safe Browsing and public phishing blocklists (OpenPhish, Phishing.Database).',
      { domain: { type: 'string' } },
      ['domain'],
      async a => {
        const d = domainArg(a.domain);
        return { feeds: checkFeeds(d), safe_browsing: await checkSafeBrowsing(d) };
      }
    ),
    def(
      'brand_impersonation',
      'Check whether a domain imitates a well-known brand (typosquatting, homoglyphs, brand + extra words).',
      { domain: { type: 'string' } },
      ['domain'],
      async a => detectLookalike(domainArg(a.domain)) ?? { impersonates: null }
    ),
    def(
      'inspect_website',
      'Fetch a page of the website being investigated and extract security signals: title, checkout/payment forms and where they submit, policy pages, risky payment methods, urgency language, obfuscated scripts, plus a short text excerpt.',
      {
        domain: { type: 'string' },
        path: { type: 'string', description: 'Optional path such as /contact or /pages/refund-policy. Defaults to /.' },
      },
      ['domain'],
      async a => {
        const d = domainArg(a.domain);
        const path = str(a.path || '/', 200);
        const page = await getText(`https://${d}${path.startsWith('/') ? path : `/${path}`}`);
        const signals = signalsFromHtml(page.body, d, new URL(page.url).protocol);
        return { status: page.status, final_url: page.url, signals, text_excerpt: htmlToText(page.body).slice(0, 1500) };
      }
    ),
    def(
      'dns_profile',
      'DNS profile of a domain: mail (MX) servers and name servers. Real businesses usually have email set up; parked or throwaway domains often do not.',
      { domain: { type: 'string' } },
      ['domain'],
      async a => {
        const d = registrableDomain(domainArg(a.domain));
        const [mx, ns] = await Promise.all([
          resolveMx(d).then(r => r.sort((x, y) => x.priority - y.priority).map(m => m.exchange)).catch(() => []),
          resolveNs(d).catch(() => []),
        ]);
        return { domain: d, mail_servers: mx.slice(0, 5), has_email: mx.length > 0, name_servers: ns.slice(0, 4) };
      }
    ),
    def(
      'certificate_history',
      'Certificate Transparency history (crt.sh): when HTTPS certificates were first issued for the domain. A first certificate days ago means the site just went live.',
      { domain: { type: 'string' } },
      ['domain'],
      async a => {
        const d = registrableDomain(domainArg(a.domain));
        // crt.sh is often overloaded; after a failure, skip it for a while instead of making users wait.
        if (Date.now() < crtShDownUntil) return { skipped: 'certificate history service is currently unavailable' };
        let rows: { not_before: string; issuer_name: string }[];
        try {
          const res = await fetch(`https://crt.sh/json?q=${encodeURIComponent(d)}`, { signal: AbortSignal.timeout(5_000) });
          if (!res.ok) throw new Error(`crt.sh HTTP ${res.status}`);
          rows = (await res.json()) as typeof rows;
        } catch (e) {
          crtShDownUntil = Date.now() + 10 * 60_000;
          return { error: `${(e as Error).message} (service is often overloaded)` };
        }
        if (!rows.length) return { certificates: 0 };
        const dates = rows.map(r => Date.parse(r.not_before)).filter(Number.isFinite).sort((x, y) => x - y);
        const first = dates[0]!;
        return {
          certificates: rows.length,
          first_seen: new Date(first).toISOString().slice(0, 10),
          days_since_first_cert: Math.floor((Date.now() - first) / 86_400_000),
          issuers: [...new Set(rows.map(r => r.issuer_name.match(/O=([^,]+)/)?.[1] ?? 'unknown'))].slice(0, 3),
        };
      }
    ),
    def(
      'web_search',
      'Search the web. Use it for reputation: "<domain> reviews", "<domain> scam", "<company name> complaints", or to verify that a company exists.',
      { query: { type: 'string' } },
      ['query'],
      async a => webSearch(str(a.query, 200))
    ),
    def(
      'read_page',
      'Read the text of a public web page, e.g. a review, BBB or news page found with web_search. Returns the first ~3000 characters.',
      { url: { type: 'string' } },
      ['url'],
      async a => {
        const page = await getText(str(a.url, 500), 10_000);
        return { status: page.status, url: page.url, text: htmlToText(page.body).slice(0, 3000) };
      }
    ),
  ];
  return Object.fromEntries(tools.map(t => [t.spec.function.name, t]));
}
