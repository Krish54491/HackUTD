import type { SiteReport } from './types';

export type Tip = { title: string; text: string; url: string };

const SCAM_SHIELD = 'https://www.t-mobile.com/benefits/scam-shield';
const ACCOUNT_FRAUD = 'https://www.t-mobile.com/support/plans-features/help-with-t-mobile-account-fraud';
const SCAMS_SPAM = 'https://www.t-mobile.com/support/plans-features/help-with-scams-spam-and-fraud';

const TIPS = {
  account: {
    title: 'Turn on SIM Protection',
    text: 'T-Life › Manage › ⚙ › Security › SIM Protection. Stops anyone moving your number to another phone. Free on postpaid.',
    url: ACCOUNT_FRAUD,
  },
  texts: {
    title: 'Forward scam texts to 7726',
    text: 'Forward the text unedited to 7726. Free, and it doesn’t count toward your plan.',
    url: SCAMS_SPAM,
  },
  calls: {
    title: 'Dial #662# for Scam Block',
    text: 'Dial #662# from your T-Mobile phone. Scam Likely calls stop ringing.',
    url: SCAMS_SPAM,
  },
  web: {
    title: 'Turn on Safe Web Browsing',
    text: 'Free in the T-Life app under ScamShield. Known phishing and scam sites get blocked before they load.',
    url: SCAM_SHIELD,
  },
} satisfies Record<string, Tip>;

const reportText = (report: SiteReport) =>
  [report.headline, report.summary, ...report.reasons.map(r => `${r.title} ${r.detail}`)].join(' ').toLowerCase();

/** What T-Mobile has done about this kind of scam, then what Tango just did. */
export type Brag = { tmo: string; tango: string; category: string };

const WEB = 'T-Mobile’s Safe Web Browsing blocks known scam and phishing sites: over 100 billion requests stopped since 2025.';

/**
 * First match wins. T-Mobile sources: "Understanding T-Mobile's Cybersecurity
 * Definitions" and "Advancing Cybersecurity at T-Mobile" (Nov 2026), Scam Shield page.
 */
const BRAGS: [RegExp, Brag][] = [
  [/scholarship|grant|fafsa|tuition|award/, { category: 'Fake scholarship', tmo: WEB, tango: 'This fake scholarship site is too new for any blocklist. I caught it before you paid the fee.' }],
  [/t-?mobile|carrier|sim\b|sim swap|account pin|port.?out/, { category: 'Carrier impersonation', tmo: 'T-Mobile cut SIM swap attacks by over 99% since 2022 with SIM Protection.', tango: 'This site is fishing for your T-Mobile login to try anyway. I caught it.' }],
  [/tech support|virus|locked|call this number|refund department/, { category: 'Tech support', tmo: 'T-Mobile’s Callback Protection warns you before you dial a known scam number.', tango: 'This page wants you to call. I caught it before you picked up the phone.' }],
  [/crypto|bitcoin|invest|trading|returns/, { category: 'Investment', tmo: WEB, tango: 'This crypto site is too new for any blocklist. I caught it before your money moved.' }],
  [/irs|\.gov|government|tax refund|social security|imperson/, { category: 'Government impersonation', tmo: WEB, tango: 'This fake agency site is too new for any blocklist. I caught it before you filled it in.' }],
  [/job|hiring|recruit|employ|remote work|deposit a check/, { category: 'Job', tmo: WEB, tango: 'This fake job site is too new for any blocklist. I caught it before you applied.' }],
  [/rent|rental|lease|landlord|sublet|apartment|housing/, { category: 'Housing', tmo: WEB, tango: 'This fake listing is too new for any blocklist. Your deposit stays yours.' }],
  [/giveaway|prize|sweepstake|lottery|winner|gift card/, { category: 'Giveaway', tmo: WEB, tango: 'This fake giveaway is too new for any blocklist. I caught it before you claimed it.' }],
  [/shop|store|price|discount|checkout|order|deliver/, { category: 'Shopping', tmo: WEB, tango: 'This fake store is too new for any blocklist. I caught it before checkout.' }],
  [/password|log ?in|sign.?in|phish|bank|look.?alike|verify/, { category: 'Phishing', tmo: WEB, tango: 'This phishing page is too new for any blocklist. I caught it before you signed in.' }],
];
const DEFAULT_BRAG: Brag = { category: 'Scam site', tmo: WEB, tango: 'This one is too new for any blocklist. I caught it.' };

export function bragFor(report: SiteReport): Brag {
  const text = reportText(report);
  return BRAGS.find(([re]) => re.test(text))?.[1] ?? DEFAULT_BRAG;
}

/** Picks the T-Mobile service that best fits the kind of scam in the report. */
export function tipFor(report: SiteReport): Tip {
  const text = reportText(report);
  if (/t-?mobile|carrier|sim\b|sim swap|account pin|port.?out/.test(text)) return TIPS.account;
  if (/tech support|call this number|call us|phone number to call/.test(text)) return TIPS.calls;
  if (/text message|sms|whatsapp|telegram/.test(text)) return TIPS.texts;
  return TIPS.web;
}
