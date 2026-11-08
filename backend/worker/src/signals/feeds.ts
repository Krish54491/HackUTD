/**
 * Public phishing/malware feeds, refreshed every 30 minutes and held in memory.
 * OpenPhish community feed (URLs) + Phishing.Database active domains. Free, no key.
 * (URLhaus retired its public text downloads in 2026; they now return HTTP 410.)
 */
const FEEDS = {
  openphish: 'https://openphish.com/feed.txt',
  phishing_db: 'https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt',
} as const;
type FeedName = keyof typeof FEEDS;
const REFRESH_MS = 30 * 60 * 1000;

let hosts: Record<FeedName, Set<string>> = { openphish: new Set(), phishing_db: new Set() };
let loadedAt = 0;
let lastError: string | undefined;

function hostOf(line: string): string | null {
  const s = line.trim();
  if (!s || s.startsWith('#')) return null;
  try {
    // Feeds mix full URLs and bare domains.
    return new URL(s.includes('://') ? s : `http://${s}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function refreshFeeds(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return;
  const next: Record<FeedName, Set<string>> = { openphish: new Set(), phishing_db: new Set() };
  const errors: string[] = [];
  await Promise.all(
    (Object.keys(FEEDS) as FeedName[]).map(async k => {
      try {
        const res = await fetch(FEEDS[k], { signal: AbortSignal.timeout(60000) });
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
    `[feeds] openphish=${hosts.openphish.size} phishing_db=${hosts.phishing_db.size}${lastError ? ` errors=${lastError}` : ''}`
  );
}

export function checkFeeds(domain: string) {
  return { openphish: hosts.openphish.has(domain), phishing_db: hosts.phishing_db.has(domain), error: lastError };
}

/** Test hook. */
export function _setFeedHosts(feed: FeedName, list: string[]) {
  hosts[feed] = new Set(list);
}
