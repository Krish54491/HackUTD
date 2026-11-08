/**
 * Deterministic red flags for job / rental listings. Free and instant, so they
 * run on every listing; the LLM only sees what these rules can't settle.
 */
export type ListingText = {
  title: string;
  company?: string;
  location?: string;
  price?: string;
  snippet?: string;
  description?: string;
};
export type RuleHit = { id: string; points: number; reason: string };

type Rule = { id: string; points: number; reason: string; re: RegExp; kind?: 'job' | 'rental' };

const RULES: Rule[] = [
  // Off-platform contact: the single strongest job-scam tell.
  { id: 'offplatform', points: 45, reason: 'Asks you to move the conversation to Telegram, WhatsApp or text', re: /\b(telegram|whats\s?app|signal app|text (me|us) (at|on)|kik|wechat)\b/i },
  { id: 'personal_email', points: 25, reason: 'Uses a personal email address instead of a company one', re: /[a-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|aol|proton(mail)?|icloud)\.(com|me)\b/i },
  // Money moving the wrong way.
  { id: 'upfront_fee', points: 45, reason: 'Asks for money up front (fee, deposit, equipment or training)', re: /\b(pay|send|purchase|buy)\b[^.]{0,40}\b(fee|deposit|starter kit|equipment|training|certification|background check)\b|\b(application|registration|processing|training) fee\b/i },
  { id: 'check_scam', points: 45, reason: 'Mentions cashing a check and sending money back (a classic fake-check scam)', re: /\b(cash|deposit)\b[^.]{0,30}\bchecks?\b[^.]{0,60}\b(send|wire|transfer|return|purchase)\b|\bmobile deposit\b/i },
  { id: 'unrecoverable_pay', points: 35, reason: 'Wants payment by gift card, crypto, wire or Zelle, which can’t be reversed', re: /\b(gift ?cards?|bitcoin|btc|usdt|crypto(currency)?|western union|moneygram|wire (transfer|the)|zelle|cash ?app)\b/i },
  { id: 'reshipping', points: 40, reason: 'Package reshipping / forwarding work, often used to launder stolen goods', re: /\b(reship(ping|per)?|package (forward|inspect|handl)\w*|parcel (forward|agent)|quality control inspector from home)\b/i },
  { id: 'too_easy', points: 20, reason: 'Promises pay with no experience, no interview or immediate hire', re: /\b(no (prior )?experience (needed|required)|no interview|hired (immediately|today|on the spot)|instant hire|start (today|immediately))\b/i },
  { id: 'big_easy_pay', points: 30, reason: 'Unrealistically high pay for simple remote work', re: /\$\s?(\d{3,}|[1-9]\d{3}),?\d*\s*(\/|per|a)\s*(day|daily)\b|\$\s?([7-9]\d|\d{3,})\s*(\/|per|an?)\s*(hr|hour)\b[^.]{0,60}\b(data entry|typing|remote|from home|assistant)\b|\b(earn|make)\b[^.]{0,20}\$\s?\d{1,3},?\d{3}\s*(\/|per|a|each)\s*(week|wk)\b/i },
  { id: 'vague_role', points: 12, reason: 'Vague work-from-home role commonly used in scams', re: /\b(data entry clerk|online (chat|typing) (job|assistant)|personal assistant to (ceo|executive)|mystery shopper|envelope stuffing|like (and|&) (review|rate)|task[- ]based (job|work))\b/i },
  { id: 'urgency', points: 10, reason: 'Pressure to act fast', re: /\b(urgent(ly)? hiring|limited (slots|positions|spots)|act now|apply (today|now) before|only \d+ (spots|positions) left)\b/i },
  { id: 'bank_info', points: 35, reason: 'Asks for bank details, SSN or ID before an offer', re: /\b(bank (account|login|details)|routing number|social security|ssn|id\.?me|driver'?s license (photo|copy|upload))\b/i },
  // Rentals.
  { id: 'absent_owner', points: 40, reason: 'Owner is "out of the country" or can’t show the place', re: /\b(out of (the )?(country|state|town)|overseas|missionary|deployed|military (assignment|deployment)|can'?t show|no showings?)\b/i, kind: 'rental' },
  { id: 'keys_mailed', points: 35, reason: 'Keys will be mailed instead of handed over in person', re: /\bkeys?\b[^.]{0,20}\b(mailed|shipped|sent|courier|fedex|ups)\b/i, kind: 'rental' },
  { id: 'deposit_unseen', points: 40, reason: 'Wants a deposit before you can see the home', re: /\b(deposit|first month)\b[^.]{0,40}\b(before|to (hold|secure|reserve))\b[^.]{0,30}\b(view|viewing|showing|tour|see)\w*/i, kind: 'rental' },
];

const TOO_GOOD = /\b(guaranteed|100% (legit|real|free)|risk[- ]free|no strings)\b/i;

function monthlyRent(price: string | undefined): number | null {
  if (!price) return null;
  const m = price.replace(/,/g, '').match(/\$\s?(\d{2,7})/);
  return m ? Number(m[1]) : null;
}
function bedrooms(text: string): number | null {
  const m = text.match(/(\d+)\s*(bd|bds|bed|beds|bedrooms?)\b/i);
  return m ? Number(m[1]) : null;
}

export function listingRuleHits(l: ListingText, kind: 'job' | 'rental'): RuleHit[] {
  const text = [l.title, l.company, l.location, l.price, l.snippet, l.description].filter(Boolean).join(' \n ');
  const hits: RuleHit[] = [];
  for (const r of RULES) {
    if (r.kind && r.kind !== kind) continue;
    if (r.re.test(text)) hits.push({ id: r.id, points: r.points, reason: r.reason });
  }
  if (TOO_GOOD.test(text)) hits.push({ id: 'too_good', points: 10, reason: 'Uses "guaranteed" / "100% legit" style claims' });

  if (kind === 'rental') {
    // Rent this low for a whole home in the US is almost always bait.
    const rent = monthlyRent(l.price);
    const beds = bedrooms(text);
    if (rent !== null && rent > 0) {
      if (rent < 400 || (beds !== null && beds >= 2 && rent < 700) || (beds !== null && beds >= 3 && rent < 900)) {
        hits.push({ id: 'price_too_low', points: 40, reason: `Rent of $${rent}/mo is far below the market for this home` });
      }
    }
  }
  return hits;
}

export function ruleScore(hits: RuleHit[]): number {
  return Math.min(100, hits.reduce((a, h) => a + h.points, 0));
}

/** Score at which rules alone are enough to hide a listing. */
export const RULES_HIDE_AT = 60;
/** Score at which an LLM verdict counts as suspicious. */
export const LLM_HIDE_AT = 50;

export function kindForSite(site: string): 'job' | 'rental' {
  return /zillow|apartments|trulia|rent|craigslist|hotpads/i.test(site) ? 'rental' : 'job';
}
