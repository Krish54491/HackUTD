export type TierId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type Tier = { id: TierId; name: string; species: string; latin: string; points: number; minReports: number; color: string };

export const TIERS: Tier[] = [
  { id: 'common', name: 'Common', species: 'European hornet', latin: 'Vespa crabro', points: 10, minReports: 200, color: '#9aa3b8' },
  { id: 'uncommon', name: 'Uncommon', species: 'Yellow-legged hornet', latin: 'Vespa velutina', points: 30, minReports: 50, color: '#34d399' },
  { id: 'rare', name: 'Rare', species: 'Lesser banded hornet', latin: 'Vespa affinis', points: 60, minReports: 10, color: '#38bdf8' },
  { id: 'epic', name: 'Epic', species: 'Black-tailed hornet', latin: 'Vespa ducalis', points: 85, minReports: 2, color: '#c084fc' },
  { id: 'legendary', name: 'Legendary', species: 'Northern giant hornet', latin: 'Vespa mandarinia', points: 100, minReports: 0, color: '#fbbf24' },
  { id: 'mythic', name: 'Mythic', species: 'Crimson hornet', latin: 'Vespa sanguinea', points: 1000, minReports: Infinity, color: '#ff1f3d' },
];
/** Each new kill rolls once: a 1 in 1,000,000 chance of Mythic, whatever its reports. */
export const MYTHIC_ODDS = 1_000_000;
export const rollMythic = () => crypto.getRandomValues(new Uint32Array(1))[0] % MYTHIC_ODDS === 0;
export const tier = (id: TierId) => TIERS.find(t => t.id === id)!;
export const tierFor = (reports: number) => TIERS.find(t => reports >= t.minReports)!;
export const tierOf = (h: { reports: number; mythic?: boolean }) => (h.mythic ? tier('mythic') : tierFor(h.reports));

export type Slain = { id: string; domain: string; title: string; category: string; date: string; reports: number; first: boolean; reasons: string[]; mythic?: boolean };

export const slain: Slain[] = [
  { id: 'h2', domain: 'tmobile-rewards-claim.net', title: 'Loyalty reward claim', category: 'Carrier impersonation', date: '2026-11-07T22:40:00Z', reports: 2, first: false, reasons: ['Made 2 days ago', 'Copies the T-Mobile logo', 'Asks for your account PIN'] },
  { id: 'h3', domain: 'usps-redelivery-fee.info', title: 'Package redelivery fee', category: 'Delivery', date: '2026-11-07T18:05:00Z', reports: 1840, first: false, reasons: ['Not a USPS domain', 'Asks for a $1.99 card payment', 'Arrived by text'] },
  { id: 'h4', domain: 'fafsa-grant-office.org', title: 'Federal grant pre-approval', category: 'Fake scholarship', date: '2026-11-07T15:22:00Z', reports: 6, first: false, reasons: ['Not a .gov domain', 'Asks for your FSA ID', 'Guarantees approval'] },
  { id: 'h5', domain: 'chase-secure-login.co', title: 'Bank sign-in', category: 'Phishing', date: '2026-11-06T23:51:00Z', reports: 412, first: false, reasons: ['Lookalike domain', 'Password form posts offsite', 'Made 9 days ago'] },
  { id: 'h6', domain: 'airpods-clearance.shop', title: 'AirPods Pro for $29', category: 'Shopping', date: '2026-11-06T20:14:00Z', reports: 133, first: false, reasons: ['Price 88% below retail', 'No return address', 'Crypto or gift card only'] },
  { id: 'h7', domain: 'crypto-doubler.app', title: 'Double your Bitcoin', category: 'Investment', date: '2026-11-06T16:37:00Z', reports: 27, first: false, reasons: ['Promises guaranteed returns', 'Fake celebrity endorsement', 'Wallet address changes per visit'] },
  { id: 'h8', domain: 'irs-taxrefund-portal.com', title: 'Unclaimed tax refund', category: 'Government impersonation', date: '2026-11-05T21:09:00Z', reports: 96, first: false, reasons: ['Not an irs.gov domain', 'Asks for your SSN', 'Countdown to "forfeit"'] },
  { id: 'h9', domain: 'paypa1-dispute.com', title: 'Payment dispute', category: 'Phishing', date: '2026-11-05T14:48:00Z', reports: 655, first: false, reasons: ['Digit 1 replaces letter l', 'Made 4 days ago', 'Asks for card number'] },
  { id: 'h10', domain: 'remote-dataentry-hiring.work', title: 'Remote job offer', category: 'Job', date: '2026-11-04T19:30:00Z', reports: 14, first: false, reasons: ['Asks you to deposit a check', 'Hiring via chat only', 'No company registration'] },
  { id: 'h11', domain: 'steam-gift-free.gg', title: 'Free Steam gift card', category: 'Giveaway', date: '2026-11-04T17:02:00Z', reports: 288, first: false, reasons: ['Asks for your Steam login', 'Made 3 days ago', 'Fake winner list'] },
  { id: 'h12', domain: 'zelle-hold-release.net', title: 'Payment on hold', category: 'Phishing', date: '2026-11-03T22:26:00Z', reports: 4, first: false, reasons: ['Zelle has no hold-release page', 'Asks for a one-time code', 'Made 1 day ago'] },
  { id: 'h13', domain: 'ticketmaster-resale.live', title: 'Sold-out tour tickets', category: 'Shopping', date: '2026-11-03T13:44:00Z', reports: 71, first: false, reasons: ['Not a Ticketmaster domain', 'Wire transfer only', 'Reviews copied from other sites'] },
  { id: 'h14', domain: 'apple-icloud-locked.support', title: 'iCloud locked', category: 'Tech support', date: '2026-11-02T20:11:00Z', reports: 38, first: false, reasons: ['Fake lock screen', 'Lists a phone number to call', 'Blocks the back button'] },
  { id: 'h15', domain: 'netflix-billing-update.co', title: 'Billing update', category: 'Phishing', date: '2026-11-02T11:55:00Z', reports: 1203, first: false, reasons: ['Lookalike domain', 'Asks for card and CVV', 'Copied Netflix styling'] },
  { id: 'h16', domain: 'campus-housing-deposit.com', title: 'Dorm deposit', category: 'Fake scholarship', date: '2026-11-01T16:18:00Z', reports: 9, first: false, reasons: ['Not your school domain', 'Deposit by Zelle only', 'Made 5 days ago'] },
];

export type Badge = { id: string; name: string; detail: string; tier: TierId; earned: boolean; domain?: string; date?: string };

export const badges: Badge[] = [
  { id: 'century', name: 'Double digits', detail: '10 hornets slain', tier: 'epic', earned: true },
  { id: 'giant', name: 'Giant slayer', detail: 'Slay a Northern giant hornet', tier: 'legendary', earned: false },
  { id: 'streak', name: 'On patrol', detail: '7-day streak', tier: 'rare', earned: true },
  { id: 'phish', name: 'Phish fryer', detail: '3 phishing sites', tier: 'uncommon', earned: true },
  { id: 'hive', name: 'Hive mind', detail: 'Reach the top 5', tier: 'epic', earned: false },
  { id: 'shelf', name: 'Full shelf', detail: 'A trophy in every tier', tier: 'legendary', earned: false },
  { id: 'million', name: 'One in a million', detail: 'Find a Mythic Crimson hornet', tier: 'mythic', earned: false },
];

export const tips = [
  { id: 'scholarship', trend: 'Fake scholarships', count: 3, title: 'Turn on Scam Block', action: 'Dial #662# from your T-Mobile phone. Scam Likely calls stop ringing.', link: 'Scam Shield', href: 'https://www.t-mobile.com/benefits/scam-shield' },
  { id: 'carrier', trend: 'T-Mobile impersonation', count: 1, title: 'Turn on SIM Protection', action: 'T-Life › Manage › ⚙ › Security › SIM Protection. Free on postpaid.', link: 'SIM Protection', href: 'https://www.t-mobile.com/support/plans-features/help-with-t-mobile-account-fraud' },
  { id: 'delivery', trend: 'Delivery texts', count: 2, title: 'Forward it to 7726', action: 'Forward the text unedited to 7726. Free, and it doesn’t count toward your plan.', link: 'Report spam', href: 'https://www.t-mobile.com/support/plans-features/help-with-scams-spam-and-fraud' },
  { id: 'phishing', trend: 'Phishing texts', count: 4, title: 'Report it as junk', action: 'iPhone: Delete and Report Junk. Android Messages: hold the chat › Block › Report spam.', link: 'Report junk', href: 'https://www.t-mobile.com/support/plans-features/help-with-scams-spam-and-fraud' },
];

export type Trophy = { id: string; alias: string; domain: string; title: string; category: string; date: string; reports: number; mythic?: boolean };

export const weekly: Trophy[] = [
  { id: 'w2', alias: 'CobaltFern', domain: 'venmo-verify-id.com', title: 'Identity verification', category: 'Phishing', date: '2026-11-06T19:20:00Z', reports: 0 },
  { id: 'w3', alias: 'LunarKite', domain: 'costco-anniversary-gift.club', title: 'Anniversary gift card', category: 'Giveaway', date: '2026-11-05T14:02:00Z', reports: 1 },
  { id: 'w4', alias: 'QuietOrbit', domain: 'tmobile-rewards-claim.net', title: 'Loyalty reward claim', category: 'Carrier impersonation', date: '2026-11-07T22:40:00Z', reports: 2 },
  { id: 'w5', alias: 'VelvetComet', domain: 'fedex-customs-duty.co', title: 'Customs duty payment', category: 'Delivery', date: '2026-11-07T11:48:00Z', reports: 3 },
  { id: 'w6', alias: 'SilverMeadow', domain: 'coinbase-wallet-unlock.app', title: 'Wallet unlock', category: 'Investment', date: '2026-11-06T08:31:00Z', reports: 5 },
  { id: 'w7', alias: 'QuietOrbit', domain: 'fafsa-grant-office.org', title: 'Federal grant pre-approval', category: 'Fake scholarship', date: '2026-11-07T15:22:00Z', reports: 6 },
  { id: 'w8', alias: 'AmberHarbor', domain: 'utd-sublet-rentals.com', title: 'Campus sublet deposit', category: 'Housing', date: '2026-11-04T17:15:00Z', reports: 8 },
  { id: 'w9', alias: 'CedarEcho', domain: 'robux-generator.gg', title: 'Free Robux generator', category: 'Giveaway', date: '2026-11-05T20:44:00Z', reports: 18 },
  { id: 'w10', alias: 'MapleSignal', domain: 'student-loan-forgiveness.help', title: 'Loan forgiveness filing', category: 'Government impersonation', date: '2026-11-03T13:09:00Z', reports: 22 },
  { id: 'w11', alias: 'QuietOrbit', domain: 'crypto-doubler.app', title: 'Double your Bitcoin', category: 'Investment', date: '2026-11-06T16:37:00Z', reports: 27 },
  { id: 'w12', alias: 'MossLantern', domain: 'utd-parking-citation.com', title: 'Unpaid parking citation', category: 'Government impersonation', date: '2026-11-02T09:55:00Z', reports: 31 },
];
