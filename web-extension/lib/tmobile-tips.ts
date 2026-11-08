import type { SiteReport } from './types';

export type Tip = { title: string; text: string; url: string };

const SCAM_SHIELD = 'https://www.t-mobile.com/benefits/scam-shield';

const TIPS = {
  account: {
    title: 'Protect your number',
    text: "Scammers who get your login often try to move your number to their phone next. T-Mobile's free Account Takeover Protection makes that much harder.",
    url: SCAM_SHIELD,
  },
  texts: {
    title: 'Forward scam texts to 7726',
    text: 'Got a link like this by text? Forward it to 7726 (SPAM) for free so T-Mobile can block the sender.',
    url: SCAM_SHIELD,
  },
  calls: {
    title: 'Dial #662# for Scam Block',
    text: 'Scam stores often follow up with calls. Dial #662# and T-Mobile blocks Scam Likely calls for free.',
    url: SCAM_SHIELD,
  },
  shield: {
    title: 'Scam Shield is free',
    text: 'Every T-Mobile customer gets Scam Shield at no cost. It labels suspicious calls "Scam Likely" before you answer.',
    url: SCAM_SHIELD,
  },
} satisfies Record<string, Tip>;

/** Picks the T-Mobile service that best fits the kind of scam in the report. */
export function tipFor(report: SiteReport): Tip {
  const text = [report.headline, report.summary, ...report.reasons.map(r => `${r.title} ${r.detail}`)].join(' ').toLowerCase();
  if (/password|log ?in|sign.?in|phish|bank|account|imperson|look.?alike|pretend/.test(text)) return TIPS.account;
  if (/job|rent|listing|text message|sms|whatsapp|telegram/.test(text)) return TIPS.texts;
  if (/pay|card|shop|store|price|discount|crypto|gift|wire|checkout/.test(text)) return TIPS.calls;
  return TIPS.shield;
}
