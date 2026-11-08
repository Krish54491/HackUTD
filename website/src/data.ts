export type Scam = { id: number; date: string; title: string; domain: string; category: string; action: string; reason: string };
const examples = [
  ['Lookalike account sign-in', 'account-verify.example', 'Phishing', 'The address imitates an account sign-in page and asks for credentials. Open the official app directly instead.'],
  ['Scholarship application fee', 'student-award.example', 'Fake scholarships', 'An unsolicited scholarship asks for an upfront fee. Verify the award with your school before paying.'],
  ['Unverified storefront', 'flash-deals.example', 'Shopping scams', 'The store uses unusually low prices and urgent payment requests. Verify the seller independently.'],
  ['Fake delivery payment', 'parcel-release.example', 'Impersonation', 'A delivery notice asks for an unexpected payment. Check your tracking number on the carrier’s official website.'],
  ['Password reset lookalike', 'secure-reset.example', 'Phishing', 'The password reset link leads to an unfamiliar domain. Change passwords only through the official service.'],
  ['Guaranteed student grant', 'campus-grants.example', 'Fake scholarships', 'A guaranteed grant requests personal details before verification. Contact your financial aid office.'],
];
const weekExamples = [0, 1, 2, 3, 4, 5, ...Array(16).fill(0), ...Array(10).fill(1), ...Array(7).fill(2), ...Array(3).fill(3)];
const mockupDates = ['2026-11-07T16:42:00Z', '2026-11-06T21:18:00Z', '2026-11-06T17:06:00Z', '2026-11-05T22:31:00Z', '2026-11-05T15:24:00Z', '2026-11-04T19:52:00Z'];
// Fixed, fictional demo records: no browsing history or personal messages are collected.
export const scams: Scam[] = Array.from({ length: 128 }, (_, i) => {
  const e = examples[i < 42 ? weekExamples[i] : i % examples.length];
  const dayOffset = i < 42 ? 4 + Math.floor((i - 6) / 12) : 7 + Math.floor((i - 42) / 3);
  const date = mockupDates[i] ?? new Date(Date.UTC(2026, 10, 7 - dayOffset, 16 - i % 7, 42 - i % 30)).toISOString();
  return { id: i + 1, date, title: e[0], domain: e[1], category: e[2], action: 'Navigation blocked', reason: e[3] };
});
export const members = ['CobaltFern','LunarKite','VelvetComet','SilverMeadow','AmberHarbor','CedarEcho','PebblePilot','QuietOrbit','MapleSignal','MossLantern','IndigoTrail','CopperCloud','BirchWave','CoralSummit','WillowBeacon'].map((alias, i) => ({ alias, scores: [92,85,78,69,63,55,47,42,39,36,33,28,24,21,18][i] }));
export const concepts = [
  { title: 'T-Mobile Link Guard', subtitle: 'A second look before the next tap.', label: 'LINK SAFETY', icon: 'link', description: 'A concept for reviewing suspicious links in text messages before opening them. Lookalike addresses and urgent requests would be explained in plain language.', example: 'A “missed delivery” text asks for a small redelivery fee. Link Guard would flag the unfamiliar destination before you continue.' },
  { title: 'T-Mobile Identity Watch', subtitle: 'Know when your details need attention.', label: 'IDENTITY AWARENESS', icon: 'fingerprint', description: 'A concept for notifying you when a monitored email address appears in a known breach, with a focused checklist for changing passwords and securing accounts.', example: 'An old shopping account appears in a breach. Identity Watch would suggest a unique password and two-step verification.' },
  { title: 'T-Mobile Family Scam Alerts', subtitle: 'Share the warning, not the worry.', label: 'FAMILY AWARENESS', icon: 'users', description: 'A concept for a private, invitation-only family circle. Share a suspicious message and a short safety reminder without exposing browsing history or account details.', example: 'Someone receives a “new number” message asking for money. A shared alert would remind the family to verify by calling a trusted number.' },
  { title: 'T-Mobile Payment Pause', subtitle: 'Make room for a safer decision.', label: 'PAYMENT AWARENESS', icon: 'card', description: 'A concept for a guided check when an unfamiliar contact asks for payment. Spot gift-card demands, unexpected transfer requests and pressure to act immediately.', example: 'A supposed support agent requests gift cards. Payment Pause would explain the warning signs and suggest contacting the company directly.' },
];
export type Period = 'week' | 'month' | 'all';
export function filterScams(query: string, category: string, period: Period) {
  const cutoff = period === 'week' ? '2026-11-01' : period === 'month' ? '2026-10-09' : '';
  return scams.filter(s => (!cutoff || s.date >= cutoff) && (category === 'All threat categories' || s.category === category) && `${s.title} ${s.domain} ${s.category}`.toLowerCase().includes(query.trim().toLowerCase()));
}
export function csvLog(rows: Scam[]) {
  const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
  return [['Time','Attempted scam / site','Domain','Category','Action taken','Outcome'], ...rows.map(s => [s.date,s.title,s.domain,s.category,s.action,'Prevented'])].map(row => row.map(escape).join(',')).join('\r\n');
}
