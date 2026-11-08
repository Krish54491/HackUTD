/**
 * "Report a hornet" categories. Mirrors REPORT_CATEGORIES in backend/spacetime/src/lib.ts.
 * Dependency-free so the website can import it too.
 */
export const REPORT_CATEGORIES = [
  { id: 'phishing', label: 'Phishing / fake login' },
  { id: 'shopping', label: 'Fake store' },
  { id: 'job', label: 'Fake job' },
  { id: 'scholarship', label: 'Fake scholarship' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'other', label: 'Something else' },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]['id'];

export const MAX_REPORT_NOTE = 280;

/** A decoded public `community_flag` row. */
export type CommunityFlag = { domain: string; reports: number; categories: Partial<Record<ReportCategory, number>> };

export function reportsLabel(n: number): string {
  return n === 1 ? '1 person has' : `${n} people have`;
}
