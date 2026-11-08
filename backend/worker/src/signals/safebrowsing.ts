import type { ServerEvidence } from '../types';

/** Google Safe Browsing v4 Lookup API. Skipped (checked=false) when no key is configured. */
export async function checkSafeBrowsing(domain: string): Promise<NonNullable<ServerEvidence['safe_browsing']>> {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return { checked: false, threats: [] };
  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        client: { clientId: 'tango', clientVersion: '0.1.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: `http://${domain}/` }, { url: `https://${domain}/` }],
        },
      }),
    });
    if (!res.ok) return { checked: false, threats: [], error: `HTTP ${res.status}` };
    const j: any = await res.json();
    const threats = [...new Set<string>((j.matches ?? []).map((m: any) => m.threatType))];
    return { checked: true, threats };
  } catch (e) {
    return { checked: false, threats: [], error: (e as Error).message };
  }
}
