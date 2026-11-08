/**
 * Public phishing/malware feeds, refreshed every 30 minutes and held in memory.
 * OpenPhish community feed + URLhaus online URLs. Free, no key.
 */
const FEEDS = {
  openphish: 'https://openphish.com/feed.txt',
  urlhaus: 'https://urlhaus.abuse.ch/downloads/text_online/',
} as const;
type FeedName = keyof typeof FEEDS;
const REFRESH_MS = 30 * 60 * 1000;

let hosts: Record<FeedName, Set<string>> = { openphish: new Set(), urlhaus: new Set() };
let loadedAt = 0;
let lastError: string | undefined;

function hostOf(line: string): string | null {
  const s = line.trim();
  if (!s || s.startsWith('#')) return null;
  try {
    return new URL(s).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function refreshFeeds(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return;
  const next: Record<FeedName, Set<string>> = { openphish: new Set(), urlhaus: new Set() };
  const errors: string[] = [];
  await Promise.all(
    (Object.keys(FEEDS) as FeedName[]).map(async k => {
      try {
        const res = await fetch(FEEDS[k], { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        for (const line of (await res.text()).split('\n')) {
          const h = hostOf(line);
          if (h) next[k].add(h);
        }
      } catch (e) {
        errors.push(`${k}: ${(e as Error).message}`);
        next[k] = hosts[k]; // keep the previous copy
      }
    })
  );
  hosts = next;
  loadedAt = Date.now();
  lastError = errors.length ? errors.join('; ') : undefined;
  console.log(
    `[feeds] openphish=${hosts.openphish.size} urlhaus=${hosts.urlhaus.size}${lastError ? ` errors=${lastError}` : ''}`
  );
}

export function checkFeeds(domain: string) {
  return { openphish: hosts.openphish.has(domain), urlhaus: hosts.urlhaus.has(domain), error: lastError };
}

/** Test hook. */
export function _setFeedHosts(feed: FeedName, list: string[]) {
  hosts[feed] = new Set(list);
}
