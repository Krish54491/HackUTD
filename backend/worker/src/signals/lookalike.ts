import { registrableDomain } from './rdap';

/** Brands commonly impersonated, mapped to their official registrable domains. */
export const BRANDS: Record<string, string[]> = {
  paypal: ['paypal.com'],
  amazon: ['amazon.com'],
  apple: ['apple.com', 'icloud.com'],
  microsoft: ['microsoft.com', 'live.com', 'office.com'],
  google: ['google.com'],
  netflix: ['netflix.com'],
  tmobile: ['t-mobile.com'],
  chase: ['chase.com'],
  wellsfargo: ['wellsfargo.com'],
  bankofamerica: ['bankofamerica.com'],
  walmart: ['walmart.com'],
  bestbuy: ['bestbuy.com'],
  ebay: ['ebay.com'],
  facebook: ['facebook.com'],
  instagram: ['instagram.com'],
  usps: ['usps.com'],
  fedex: ['fedex.com'],
  coinbase: ['coinbase.com'],
  binance: ['binance.com'],
  venmo: ['venmo.com'],
  cashapp: ['cash.app'],
  verizon: ['verizon.com'],
  linkedin: ['linkedin.com'],
  indeed: ['indeed.com'],
  zillow: ['zillow.com'],
  costco: ['costco.com'],
};

const HOMOGLYPHS: [RegExp, string][] = [
  [/0/g, 'o'],
  [/1/g, 'l'],
  [/3/g, 'e'],
  [/5/g, 's'],
  [/rn/g, 'm'],
  [/vv/g, 'w'],
];

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * Detects typosquats (amaz0n.com, paypa1.com), one-letter typos (amazom.com) and
 * brand names embedded in unrelated domains (paypal-secure-login.top).
 */
export function detectLookalike(domain: string): { brand: string; official: string; how: string } | null {
  const reg = registrableDomain(domain);
  for (const official of Object.values(BRANDS).flat()) {
    if (reg === official || domain.endsWith(`.${official}`)) return null;
  }
  const label = reg.split('.')[0].replace(/-/g, '');
  const flat = domain.replace(/[^a-z0-9]/g, '');
  let normalized = label;
  for (const [re, ch] of HOMOGLYPHS) normalized = normalized.replace(re, ch);

  for (const [brand, officials] of Object.entries(BRANDS)) {
    const official = officials[0];
    if (brand.length >= 5 && normalized !== label && normalized === brand)
      return { brand, official, how: 'look-alike characters' };
    if (brand.length >= 6 && Math.abs(normalized.length - brand.length) <= 1 && levenshtein(normalized, brand) === 1)
      return { brand, official, how: 'one-letter typo' };
    if (brand.length >= 5 && flat.includes(brand)) return { brand, official, how: 'brand name inside an unrelated domain' };
  }
  return null;
}
