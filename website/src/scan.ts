import { Spacetime, sqlStr } from './stdb';
import type { SiteReport } from '../../web-extension/lib/types';
export type { SiteReport };
export function normalizeDomain(input: string) {
  const url = new URL(input.includes('://') ? input : `https://${input}`);
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error('Enter a valid public website address, such as example.com.');
  return url.hostname.toLowerCase().replace(/^www\./, '');
}
export async function scanWebsite(input: string, signal: AbortSignal): Promise<SiteReport> {
  const domain = normalizeDomain(input);
  signal = AbortSignal.any([signal, AbortSignal.timeout(120_000)]);
  const host = import.meta.env.VITE_SPACETIME_HOST || 'https://maincloud.spacetimedb.com';
  const db = import.meta.env.VITE_SPACETIME_DB || 'tango';
  const id = await Spacetime.newIdentity(host, signal);
  signal.throwIfAborted();
  const st = new Spacetime(host, db, id.token, signal);
  const read = async () => {
    const rows = await st.sql(`SELECT * FROM site_report WHERE domain = ${sqlStr(domain)}`);
    const row = rows[0];
    if (!row || Number(row.expires_at_ms) < Date.now()) return null;
    return { ...row, reasons: JSON.parse(String(row.reasons_json || '[]')), score: Number(row.score), checked_at_ms: Number(row.checked_at_ms), expires_at_ms: Number(row.expires_at_ms) } as SiteReport;
  };
  const cached = await read();
  if (cached) return cached;
  await st.call('request_scan', domain, '', 'manual', false);
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    signal.throwIfAborted();
    await new Promise(resolve => setTimeout(resolve, 1500));
    signal.throwIfAborted();
    const report = await read();
    if (report) return report;
    const queue = await st.sql(`SELECT * FROM scan_request WHERE domain = ${sqlStr(domain)}`);
    if (queue[0]?.status === 'failed') throw new Error('The security check failed. Please try again.');
  }
  throw new Error('The security check is taking longer than expected. Check that the Tango worker is running and try again.');
}
