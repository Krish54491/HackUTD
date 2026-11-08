import { ReducerError, Spacetime, sqlStr } from './stdb';
import { normalizeDomain } from './scan';
import type { CommunityFlag, ReportCategory } from '../../web-extension/lib/report-categories';
export { MAX_REPORT_NOTE, REPORT_CATEGORIES, reportsLabel, type CommunityFlag, type ReportCategory } from '../../web-extension/lib/report-categories';

const host = import.meta.env.VITE_SPACETIME_HOST || 'https://maincloud.spacetimedb.com';
const db = import.meta.env.VITE_SPACETIME_DB || 'protego';
// One anonymous identity per browser, so re-reporting a site updates the earlier report and the daily limit applies.
const TOKEN_KEY = 'tango.reporter-token';

async function client(fresh = false) {
  let token = fresh ? null : localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = (await Spacetime.newIdentity(host)).token;
    localStorage.setItem(TOKEN_KEY, token);
  }
  return new Spacetime(host, db, token);
}

export async function reportSite(input: string, category: ReportCategory, note: string): Promise<CommunityFlag> {
  const domain = normalizeDomain(input);
  const send = async (st: Spacetime) => st.call('report_site', domain, category, note.trim());
  try {
    try {
      await send(await client());
    } catch (e) {
      if (!(e instanceof ReducerError && e.status === 401)) throw e;
      await send(await client(true));
    }
  } catch (e) {
    if (e instanceof ReducerError && e.status === 404) throw new Error("Reporting isn't switched on for this Tango server yet. Please try again later.");
    // SpacetimeDB answers a reducer's SenderError (bad input, daily limit) with HTTP 530.
    if (e instanceof ReducerError && (e.status < 500 || e.status === 530)) throw new Error(e.body.trim() || 'Tango could not accept that report.');
    throw new Error('Unable to reach Tango. Check your connection and try again.');
  }
  return (await getCommunityFlag(domain)) ?? { domain, reports: 1, categories: { [category]: 1 } };
}

/** Public per-site totals. Never throws: no data, an old server, or a network error all mean "no flag". */
export async function getCommunityFlag(domain: string): Promise<CommunityFlag | null> {
  try {
    const rows = await (await client()).sql(`SELECT * FROM community_flag WHERE domain = ${sqlStr(domain)}`);
    const row = rows[0];
    if (!row) return null;
    return { domain, reports: Number(row.reports), categories: JSON.parse(String(row.categories_json || '{}')) };
  } catch {
    return null;
  }
}
