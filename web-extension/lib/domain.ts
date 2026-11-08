/** Mirrors normalizeDomain in backend/spacetime/src/lib.ts, but returns null instead of throwing. */
export function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '');
  d = d.split(/[/?#]/)[0] ?? '';
  d = d.replace(/:\d+$/, '');
  d = d.replace(/^www\./, '');
  d = d.replace(/\.$/, '');
  if (!/^[a-z0-9.-]{1,253}$/.test(d) || !d.includes('.') || d.startsWith('.') || d.includes('..')) return null;
  return d;
}

/** Only scan real public websites: http(s), not IPs, not localhost. */
export function scannableDomain(url: string | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.includes(':')) return null;
  return normalizeDomain(u.hostname);
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
