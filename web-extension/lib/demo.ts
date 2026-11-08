import type { RiskLevel, SiteReport } from './types';

/** Seconds of browsing before the demo warning appears. */
export const DEMO_DELAY_MS = 5000;

/** Hosts allowed to turn on demo mode: local dev and the deployed demo page (`web-extension/demo/`). */
const DEMO_HOSTS = new Set(['localhost', '127.0.0.1', 'brightpath-scholars.devpost67.workers.dev']);

/**
 * Demo mode for testing the warning without a scan: a page on a demo host
 * with <meta name="tango-demo" content="high|medium|safe">. Other websites can't trigger it.
 */
export function demoLevel(): Extract<RiskLevel, 'high' | 'medium' | 'none'> | null {
  if (!DEMO_HOSTS.has(location.hostname)) return null;
  const level = document.querySelector('meta[name="tango-demo"]')?.getAttribute('content');
  if (level === 'safe') return 'none';
  return level === 'high' || level === 'medium' ? level : null;
}

export function demoReport(level: 'high' | 'medium'): SiteReport {
  const now = Date.now();
  const high = level === 'high';
  return {
    domain: location.host,
    risk_level: level,
    score: high ? 94 : 52,
    confidence: high ? 'high' : 'medium',
    headline: high ? 'This scholarship is a scam.' : 'This scholarship site is brand new and unproven.',
    summary: high
      ? 'This site asks prize "winners" for their SSN, bank details and a processing fee.'
      : 'This site was registered recently and nobody has reviewed it yet.',
    reasons: high
      ? [
          { title: 'Made 6 days ago', detail: 'The domain was registered 6 days ago, but claims to be "Est. 1998".', severity: 'high' },
          { title: 'Asks for your SSN', detail: 'Real scholarships collect tax details from your school, not a web form.', severity: 'high' },
          { title: 'Asks for your bank password', detail: 'Nobody needs your online banking login to pay you.', severity: 'high' },
          { title: 'Charges a $49 fee to pay you', detail: 'Real scholarships never charge a fee to release an award.', severity: 'high' },
        ]
      : [
          { title: 'Made 3 weeks ago', detail: 'The site is new and nobody has reviewed it yet.', severity: 'medium' },
          { title: 'No contact address', detail: 'There is no mailing address or phone number.', severity: 'low' },
        ],
    checked_at_ms: now,
    expires_at_ms: now + 60_000,
  };
}
