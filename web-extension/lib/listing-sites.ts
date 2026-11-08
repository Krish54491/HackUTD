/**
 * Per-site selectors for listing cards. Real sites change their markup often,
 * so every field has several fallbacks, ordered newest-known first.
 * If a site stops working, update the selectors here; nothing else needs to change.
 */
export type ListingSite = {
  id: string;
  /** Registrable domain used as the site key (also what the toggle is stored under). */
  site: string;
  /** Host this config applies to. */
  host: RegExp;
  /** Optional path filter (e.g. LinkedIn only on /jobs). Checked on every scan because these are SPAs. */
  active?: (url: URL) => boolean;
  card: string[];
  idFrom: (card: Element) => string | null;
  title: string[];
  company?: string[];
  location?: string[];
  price?: string[];
  snippet?: string[];
  link?: string[];
  /** The listing the user has open (detail pane or page), where the full description lives. */
  detail?: {
    id: (url: URL) => string | null;
    title: string[];
    company?: string[];
    price?: string[];
    description: string[];
  };
};

const attr = (name: string) => (el: Element) => el.getAttribute(name) ?? el.querySelector(`[${name}]`)?.getAttribute(name) ?? null;

export const LISTING_SITES: ListingSite[] = [
  {
    id: 'linkedin-jobs',
    site: 'linkedin.com',
    host: /(^|\.)linkedin\.com$/,
    active: u => u.pathname.startsWith('/jobs'),
    card: [
      'li[data-occludable-job-id]',
      'div.job-card-container[data-job-id]',
      'ul.jobs-search__results-list > li',
      'div.base-card[data-entity-urn*="jobPosting"]',
      // LinkedIn rotates class names; any list item linking to a job is a card.
      'li:has(a[href*="/jobs/view/"])',
    ],
    idFrom: el =>
      attr('data-occludable-job-id')(el) ??
      attr('data-job-id')(el) ??
      attr('data-entity-urn')(el)?.split(':').pop() ??
      el.querySelector('a[href*="/jobs/view/"]')?.getAttribute('href')?.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/)?.[1] ??
      null,
    title: [
      '.job-card-list__title--link strong',
      '.job-card-list__title--link',
      '.job-card-list__title',
      '.artdeco-entity-lockup__title',
      '.base-search-card__title',
      'a[href*="/jobs/view/"][aria-label]',
      'a[href*="/jobs/view/"]',
    ],
    company: ['.artdeco-entity-lockup__subtitle', '.job-card-container__primary-description', '.base-search-card__subtitle'],
    location: ['.job-card-container__metadata-wrapper li', '.artdeco-entity-lockup__caption', '.job-search-card__location'],
    price: ['.job-card-container__metadata-item--salary', '.job-search-card__salary-info', '.artdeco-entity-lockup__metadata'],
    snippet: ['.job-card-container__job-insight-text', '.job-card-list__insight', '.job-posting-benefits__text'],
    link: ['a[href*="/jobs/view/"]', 'a.base-card__full-link'],
    detail: {
      id: u => u.searchParams.get('currentJobId') ?? u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/)?.[1] ?? null,
      title: ['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', 'h1.top-card-layout__title', '.jobs-details h1', 'main h1'],
      company: ['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '.topcard__org-name-link'],
      price: ['.job-details-jobs-unified-top-card__job-insight', '.salary', '.compensation__salary'],
      description: ['#job-details', '.jobs-description__content', '.jobs-description-content__text', '.jobs-box__html-content', '.show-more-less-html__markup', '.description__text'],
    },
  },
  {
    id: 'zillow',
    site: 'zillow.com',
    host: /(^|\.)zillow\.com$/,
    card: ['article[data-test="property-card"]', 'li[data-test="search-result-list-item"] article'],
    idFrom: el => {
      const z = el.closest('[id^="zpid_"]')?.id ?? el.querySelector('[id^="zpid_"]')?.id;
      if (z) return z.replace('zpid_', '');
      const href = el.querySelector('a[href*="_zpid"]')?.getAttribute('href') ?? '';
      return href.match(/(\d+)_zpid/)?.[1] ?? null;
    },
    title: ['address[data-test="property-card-addr"]', 'address'],
    price: ['[data-test="property-card-price"]', 'span[data-test*="price"]'],
    snippet: ['[data-test="property-card-details"]', 'ul[class*="HomeDetailsList"]', '[data-test="property-card-description"]'],
    company: ['[class*="PropertyCardDataArea"] div:last-child', '[data-test="property-card-broker"]'],
    link: ['a[data-test="property-card-link"]', 'a[href*="homedetails"]'],
    detail: {
      id: u => u.pathname.match(/(\d+)_zpid/)?.[1] ?? u.searchParams.get('zpid'),
      title: ['h1', '[data-testid="bdp-address"]'],
      price: ['[data-testid="price"]', 'span[data-testid*="price"]'],
      description: ['[data-testid="description"]', 'article [class*="Description"]', '.ds-overview-section'],
    },
  },
  {
    id: 'apartments',
    site: 'apartments.com',
    host: /(^|\.)apartments\.com$/,
    card: ['article.placard[data-listingid]', 'li.mortar-wrapper article', 'article[data-listingid]'],
    idFrom: attr('data-listingid'),
    title: ['.property-title', '.js-placardTitle', '[class*="property-title"]'],
    location: ['.property-address', '.property-address.js-url'],
    price: ['.property-pricing', '.price-range', '.property-rents'],
    snippet: ['.property-amenities', '.property-specials', '.bed-range'],
    company: ['.property-logo[alt]', '.property-phone'],
    link: ['a.property-link', 'a[href*="apartments.com/"]'],
    detail: {
      id: u => (/^\/[^/]+\/[a-z0-9]{5,}\/?$/i.test(u.pathname) ? u.pathname.split('/').filter(Boolean).pop() ?? null : null),
      title: ['h1#propertyName', 'h1'],
      price: ['.priceBedRangeInfo', '.rentInfoDetail'],
      description: ['#descriptionSection', '.descriptionSection', 'section[class*="description"]'],
    },
  },
];

/** Config for this host, regardless of path. */
export function siteForHost(url: URL): ListingSite | null {
  return LISTING_SITES.find(s => s.host.test(url.hostname)) ?? null;
}

/** Config only if listing filtering applies to this exact page. */
export function siteFor(url: URL): ListingSite | null {
  const s = siteForHost(url);
  return s && (!s.active || s.active(url)) ? s : null;
}

function textOf(card: ParentNode, selectors?: string[]): string {
  if (!selectors) return '';
  for (const sel of selectors) {
    const el = card.querySelector(sel);
    const t = (el?.getAttribute('alt') || el?.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) return t;
  }
  return '';
}

export type ExtractedDetail = { el: HTMLElement; id: string; title: string; company: string; price: string; description: string };

/** The listing currently open on the page, if the site shows one. */
export function extractDetail(site: ListingSite, url: URL, root: ParentNode = document): ExtractedDetail | null {
  const d = site.detail;
  const id = d?.id(url);
  if (!d || !id) return null;
  const el = d.description.map(s => root.querySelector<HTMLElement>(s)).find(Boolean);
  const description = (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  if (!el || description.length < 60) return null; // not rendered yet
  return {
    el,
    id,
    title: textOf(root, d.title),
    company: textOf(root, d.company),
    price: textOf(root, d.price),
    description: description.slice(0, 3000),
  };
}

export type ExtractedCard = { el: HTMLElement; id: string; title: string; company: string; location: string; price: string; snippet: string; url: string };

export function extractCards(site: ListingSite, root: ParentNode = document): ExtractedCard[] {
  const seen = new Set<Element>();
  const out: ExtractedCard[] = [];
  for (const sel of site.card) {
    for (const el of root.querySelectorAll<HTMLElement>(sel)) {
      // Skip cards nested inside an already-matched card.
      if (seen.has(el) || [...seen].some(s => s.contains(el) || el.contains(s))) continue;
      seen.add(el);
      const title = textOf(el, site.title);
      if (!title) continue; // virtualized / not yet rendered
      const linkEl = site.link?.map(s => el.querySelector<HTMLAnchorElement>(s)).find(Boolean);
      const url = linkEl?.href ? linkEl.href.split('?')[0] ?? '' : '';
      out.push({
        el,
        id: site.idFrom(el) ?? url ?? title,
        title,
        company: textOf(el, site.company),
        location: textOf(el, site.location),
        price: textOf(el, site.price),
        snippet: textOf(el, site.snippet).slice(0, 400),
        url,
      });
    }
  }
  return out;
}
