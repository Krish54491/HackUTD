import type { SiteReport } from './types';
import { bragFor } from './tmobile-tips';

export const DASHBOARD_URL = 'http://localhost:5173/';

/** Dashboard link that adds this site to the hive as a fresh kill. */
export function dashboardUrl(report: SiteReport, pageTitle: string): string {
  const url = new URL(DASHBOARD_URL);
  const risky = report.reasons.filter(r => r.severity !== 'info');
  url.searchParams.set('slay', report.domain);
  url.searchParams.set('title', pageTitle.split(/\s+[·|–—-]\s+/)[0]?.trim() || report.headline);
  url.searchParams.set('cat', bragFor(report).category);
  for (const r of (risky.length ? risky : report.reasons).slice(0, 4)) url.searchParams.append('r', r.title);
  return url.href;
}
