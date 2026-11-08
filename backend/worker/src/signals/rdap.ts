import type { ServerEvidence } from '../types';

/** Registration date via RDAP (rdap.org bootstraps to the right registry). Free, no key. */
export async function lookupRdap(domain: string): Promise<NonNullable<ServerEvidence['rdap']>> {
  const registrable = registrableDomain(domain);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(registrable)}`, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { error: `RDAP HTTP ${res.status}` };
    const j: any = await res.json();
    const reg = (j.events ?? []).find((e: any) => e.eventAction === 'registration');
    const registrar = (j.entities ?? [])
      .find((e: any) => (e.roles ?? []).includes('registrar'))
      ?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3];
    if (!reg?.eventDate) return { registrar, error: 'no registration date' };
    const age_days = Math.floor((Date.now() - Date.parse(reg.eventDate)) / 86_400_000);
    return { created: reg.eventDate, age_days, registrar };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'co.in', 'co.jp', 'com.br', 'com.mx', 'co.nz', 'com.cn',
]);

/** Rough eTLD+1 (good enough for RDAP + lookalike checks without a PSL dependency). */
export function registrableDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  const last2 = parts.slice(-2).join('.');
  return MULTI_PART_TLDS.has(last2) ? parts.slice(-3).join('.') : last2;
}
