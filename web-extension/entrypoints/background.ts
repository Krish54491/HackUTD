import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import * as api from '@/lib/api';
import { LOCAL_REPORT_TTL_MS } from '@/lib/config';
import { normalizeDomain } from '@/lib/domain';
import { playSound } from '@/lib/sound';
import type { BgMessage, CachedForPage, PopupState, RiskLevel, SiteReport, TabMessage, TabState } from '@/lib/types';

// ---------- small storage helpers ----------

const session = browser.storage.session;
const local = browser.storage.local;

async function getTab(tabId: number): Promise<TabState | null> {
  return ((await session.get(`tab:${tabId}`))[`tab:${tabId}`] as TabState) ?? null;
}
async function setTab(tabId: number, patch: Partial<TabState> & { domain: string }) {
  const cur = await getTab(tabId);
  const next: TabState = cur && cur.domain === patch.domain ? { ...cur, ...patch } : { scan: { state: 'idle' }, ...patch };
  await session.set({ [`tab:${tabId}`]: next });
}

async function cachedReport(domain: string): Promise<SiteReport | null> {
  const v = (await local.get(`report:${domain}`))[`report:${domain}`] as { report: SiteReport; savedAt: number } | undefined;
  if (v && Date.now() - v.savedAt < LOCAL_REPORT_TTL_MS && v.report.expires_at_ms > Date.now()) return v.report;
  return null;
}
async function saveReport(report: SiteReport) {
  await local.set({ [`report:${report.domain}`]: { report, savedAt: Date.now() } });
}

/** The user chose "Continue anyway" for this domain at this risk level (until the browser restarts). */
async function ackedLevel(domain: string): Promise<RiskLevel | null> {
  return ((await session.get(`ack:${domain}`))[`ack:${domain}`] as RiskLevel | undefined) ?? null;
}

async function listingsEnabled(site: string) {
  return !(await local.get(`listings_off:${site}`))[`listings_off:${site}`];
}

// ---------- badge ----------

const BADGE: Record<RiskLevel | 'checking', { text: string; color: string }> = {
  checking: { text: '…', color: '#8A8A8A' },
  none: { text: '✓', color: '#1E8E4F' },
  low: { text: '!', color: '#1E8E4F' },
  medium: { text: '!', color: '#D9A400' },
  high: { text: '!!', color: '#D2232A' },
};
const TITLE: Record<RiskLevel | 'checking', string> = {
  checking: 'Tango · Checking',
  none: 'Safe · T-Mobile Scam Shield active',
  low: 'Low risk · Tango',
  medium: 'Medium risk · Tango',
  high: 'High risk · Tango',
};

type IconSet = Record<number, ImageData>;
let icons: Promise<{ plain: IconSet; safe: IconSet }> | null = null;

/** Tango's face for the toolbar; the safe version has a T-Mobile magenta dot. */
function loadIcons() {
  icons ??= (async () => {
    const url = (browser.runtime.getURL as (p: string) => string)('/characters/light-mode.png');
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const side = bmp.height * 0.66;
    const draw = (size: number, dot: boolean) => {
      const g = new OffscreenCanvas(size, size).getContext('2d')!;
      g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
      if (dot) {
        const r = size * 0.19;
        const c = size - r - size * 0.04;
        g.beginPath();
        g.arc(c, c, r + size * 0.06, 0, Math.PI * 2);
        g.fillStyle = '#fff';
        g.fill();
        g.beginPath();
        g.arc(c, c, r, 0, Math.PI * 2);
        g.fillStyle = '#E20074';
        g.fill();
      }
      return g.getImageData(0, 0, size, size);
    };
    return { plain: { 16: draw(16, false), 32: draw(32, false) }, safe: { 16: draw(16, true), 32: draw(32, true) } };
  })();
  return icons;
}

async function setIndicator(tabId: number, kind: keyof typeof BADGE | null) {
  try {
    const i = await loadIcons();
    await browser.action.setIcon({ tabId, imageData: kind === 'none' ? i.safe : i.plain });
  } catch {
    /* tab closed, or icon unavailable */
  }
  await browser.action.setTitle({ tabId, title: kind ? TITLE[kind] : 'Tango' }).catch(() => {});
}

async function setBadge(tabId: number, kind: keyof typeof BADGE | null, listingCount = 0) {
  await setIndicator(tabId, kind);
  try {
    if (listingCount > 0 && (kind === 'none' || kind === null)) {
      await browser.action.setBadgeBackgroundColor({ tabId, color: '#E20074' });
      await browser.action.setBadgeText({ tabId, text: String(listingCount) });
      return;
    }
    if (!kind || kind === 'none') return void (await browser.action.setBadgeText({ tabId, text: '' }));
    await browser.action.setBadgeBackgroundColor({ tabId, color: BADGE[kind].color });
    await browser.action.setBadgeText({ tabId, text: BADGE[kind].text });
  } catch {
    /* tab closed */
  }
}

// ---------- handlers ----------

/** Scans in flight per tab, so the page and the popup never start the same check twice. */
const inFlight = new Map<string, Promise<SiteReport | null>>(); // key: `${tabId}:${domain}`

/**
 * Check the site open in a tab (cache first), record the result for the popup,
 * and tell the page, which warns for medium and high risk.
 * `signals` are the in-page signals, or null when the popup triggered the check.
 */
function checkTab(tabId: number, domain: string, signals: unknown | null, force = false): Promise<SiteReport | null> {
  const key = `${tabId}:${domain}`;
  const running = inFlight.get(key);
  if (running && !force) return running;
  const p = (async () => {
    await setTab(tabId, { domain, scan: { state: 'checking' } });
    let report = force ? null : await cachedReport(domain);
    if (!report) await setBadge(tabId, 'checking');
    try {
      report ??= await api.scan(domain, signals, { manual: !signals, force });
      await saveReport(report);
    } catch (e) {
      const error = (e as Error).message;
      await setTab(tabId, { domain, scan: { state: 'error', error } });
      await setBadge(tabId, null);
      await tellTab(tabId, { type: 'SCAN_RESULT', domain, report: null, error });
      return null;
    }
    await setTab(tabId, { domain, scan: { state: 'done', report } });
    await setBadge(tabId, report.risk_level);
    await tellTab(tabId, { type: 'SCAN_RESULT', domain, report });
    if (report.risk_level === 'medium' || report.risk_level === 'high') await countWarning(report);
    return report;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function tellTab(tabId: number, msg: TabMessage) {
  await browser.tabs.sendMessage(tabId, msg).catch(() => {});
}

async function countWarning(report: SiteReport) {
  // One hornet per risky site per day.
  const key = `warned:${report.domain}`;
  const last = (await local.get(key))[key] as number | undefined;
  if (!last || Date.now() - last > 86_400_000) {
    await local.set({ [key]: Date.now() });
    api.recordHornets('site', 1).catch(() => {});
  }
}

async function onListingsBlocked(tabId: number, site: string, blocked: { key: string; title: string; reason: string }[]) {
  const cur = await getTab(tabId);
  const prev = new Set((cur?.domain === site ? cur.listings?.blocked : [])?.map(b => b.key));
  const fresh = blocked.filter(b => !prev.has(b.key));
  const all = [...(cur?.domain === site ? cur.listings?.blocked ?? [] : []), ...fresh];
  await setTab(tabId, { domain: site, listings: { site, enabled: true, blocked: all } });
  const level = cur?.scan.state === 'done' ? cur.scan.report.risk_level : null;
  await setBadge(tabId, level, all.length);
  // Count each listing once per tab, even if filtering is toggled off and on again.
  const ck = `counted:${tabId}:${site}`;
  const counted = new Set(((await session.get(ck))[ck] as string[] | undefined) ?? []);
  const toCount = fresh.filter(b => !counted.has(b.key));
  if (toCount.length) {
    toCount.forEach(b => counted.add(b.key));
    await session.set({ [ck]: [...counted] });
    api.recordHornets('listing', toCount.length).catch(() => {});
  }
}

async function popupState(tabId: number | undefined, domain: string | null): Promise<PopupState> {
  const tab = tabId !== undefined ? await getTab(tabId) : null;
  const hornets = await api.getHornets().catch(() => 0);
  return { domain, tab: tab && domain && tab.domain === domain ? tab : null, hornets };
}

async function handle(msg: BgMessage, tabId: number | undefined): Promise<unknown> {
  switch (msg.type) {
    case 'PAGE_SIGNALS':
      if (tabId !== undefined) void checkTab(tabId, msg.domain, msg.signals);
      return { ok: true };

    case 'GET_CACHED_REPORT': {
      // Local only (no network), so the page can raise the modal before it finishes loading.
      const out: CachedForPage = { report: await cachedReport(msg.domain), ackedLevel: await ackedLevel(msg.domain) };
      return out;
    }

    case 'ACK_SITE':
      await session.set({ [`ack:${msg.domain}`]: msg.level });
      return { ok: true };

    case 'CHECK_CURRENT_PAGE': {
      const cur = await getTab(msg.tabId);
      const fresh = cur?.domain === msg.domain && (cur.scan.state === 'checking' || cur.scan.state === 'done');
      if (!fresh || msg.force) void checkTab(msg.tabId, msg.domain, null, msg.force);
      return { ok: true };
    }

    case 'MANUAL_CHECK': {
      const domain = normalizeDomain(msg.input);
      if (!domain) throw new Error('Enter a website name like example.com');
      const report = (!msg.force && (await cachedReport(domain))) || (await api.scan(domain, null, { manual: true, force: msg.force }));
      await saveReport(report);
      return report;
    }

    case 'GET_POPUP_STATE':
      return popupState(msg.tabId, msg.domain ?? null);

    case 'GET_LISTINGS_ENABLED':
      return listingsEnabled(msg.site);

    case 'CHECK_LISTINGS':
      if (!(await listingsEnabled(msg.site))) return { enabled: false, results: [] };
      return { enabled: true, results: await api.checkListings(msg.site, msg.items) };

    case 'LISTINGS_BLOCKED':
      if (tabId !== undefined) await onListingsBlocked(tabId, msg.site, msg.blocked);
      return { ok: true };

    case 'SET_LISTINGS_ENABLED': {
      if (msg.enabled) await local.remove(`listings_off:${msg.site}`);
      else await local.set({ [`listings_off:${msg.site}`]: true });
      api.syncListingFilter(msg.site, msg.enabled).catch(() => {});
      const cur = await getTab(msg.tabId);
      if (cur?.listings) {
        await setTab(msg.tabId, {
          domain: cur.domain,
          listings: { ...cur.listings, enabled: msg.enabled, blocked: msg.enabled ? cur.listings.blocked : [] },
        });
      }
      const out: TabMessage = { type: 'LISTINGS_ENABLED_CHANGED', enabled: msg.enabled };
      await browser.tabs.sendMessage(msg.tabId, out).catch(() => {});
      if (!msg.enabled) await setBadge(msg.tabId, cur?.scan.state === 'done' ? cur.scan.report.risk_level : null, 0);
      return { ok: true };
    }

    case 'SOUND':
      await playSound(msg.sound, msg.action);
      return { ok: true };

    case 'DEMO_LEVEL':
      if (tabId !== undefined) await setBadge(tabId, msg.level);
      return { ok: true };

    case 'LEAVE_SITE': {
      const target = msg.tabId ?? tabId; // popup passes tabId; the page modal is the sender tab
      if (target === undefined) return { ok: false };
      try {
        await browser.tabs.goBack(target);
      } catch {
        await browser.tabs.update(target, { url: 'chrome://newtab/' }).catch(() => browser.tabs.remove(target));
      }
      return { ok: true };
    }
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: BgMessage, sender, sendResponse) => {
    handle(msg, sender.tab?.id)
      .then(data => sendResponse({ ok: true, data }))
      .catch(e => sendResponse({ ok: false, error: (e as Error).message }));
    return true; // async response
  });

  browser.tabs.onRemoved.addListener(tabId => {
    for (const k of inFlight.keys()) if (k.startsWith(`${tabId}:`)) inFlight.delete(k);
    void session.remove(`tab:${tabId}`);
  });

  loadIcons()
    .then(i => browser.action.setIcon({ imageData: i.plain }))
    .catch(() => {});

  // Warm up the identity so the first scan is fast.
  api.client().catch(e => console.warn('[tango] Spacetime unavailable:', e));
});
