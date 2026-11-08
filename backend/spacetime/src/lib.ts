import { SenderError } from 'spacetimedb/server';

// ---------- constants ----------

export const REPORT_TTL_MS = 24 * 60 * 60 * 1000; // site reports: 24h
export const VERDICT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // listing verdicts: 7d
export const FORCE_RESCAN_MIN_MS = 10 * 60 * 1000; // forced re-scans at most every 10 min per domain
export const STALE_CLAIM_MS = 2 * 60 * 1000; // re-queue scans a dead worker claimed
export const MAX_SIGNALS_BYTES = 16_000;
export const MAX_LISTINGS_PER_BATCH = 60;
export const RISK_LEVELS = ['none', 'low', 'medium', 'high'] as const;

export function hex(id: { toHexString(): string }): string {
  return id.toHexString().replace(/^0x/i, '').toLowerCase();
}

export function nowMs(ctx: { timestamp: { toMillis(): bigint } }): bigint {
  return ctx.timestamp.toMillis();
}

export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '');
  d = d.split(/[/?#]/)[0];
  d = d.replace(/:\d+$/, '');
  d = d.replace(/^www\./, '');
  d = d.replace(/\.$/, '');
  if (!/^[a-z0-9.-]{1,253}$/.test(d) || !d.includes('.') || d.startsWith('.') || d.includes('..')) {
    throw new SenderError(`Invalid domain: ${input.slice(0, 80)}`);
  }
  return d;
}

export function parseJson<T>(raw: string, what: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SenderError(`${what} must be valid JSON`);
  }
}

export function clip(s: unknown, n: number): string {
  return String(s ?? '').slice(0, n);
}


export type ListingItem = {
  key: string;
  title: string;
  company?: string;
  location?: string;
  price?: string;
  snippet?: string;
  url?: string;
};
export type ListingResult = { key: string; suspicious: boolean; score: number; reason: string };

