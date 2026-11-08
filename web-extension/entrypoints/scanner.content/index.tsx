/**
 * Runs on every page: extracts privacy-filtered signals and hands them to the
 * background for a (cached) security check. Nothing shows while the check runs.
 *
 *  - Medium or high risk: the page is blocked and darkened, Tango rolls in
 *    (high: after a hornet sneaks out of a page element) and explains the risk
 *    (from the local cache right away on a known site).
 *  - None or low risk: nothing on the page; the toolbar badge has the result.
 *  - Once the user picks "Continue to site" the warning doesn't come back for
 *    that domain until the browser restarts, unless the risk level later goes UP.
 *
 * Blocking means the page behind is `inert` (no clicks, typing or focus),
 * scrolling is locked, and there's no click-outside / Escape dismissal.
 */
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { TangoAlert } from '@/components/TangoAlert';
import { collectSignals } from '@/lib/signals';
import { scannableDomain } from '@/lib/domain';
import { blockPage } from '@/lib/block-page';
import { createTopLayer, type TopLayer } from '@/lib/top-layer';
import { bg } from '@/lib/messaging';
import { DEMO_DELAY_MS, demoLevel, demoReport } from '@/lib/demo';
import { lurkSpot } from '@/lib/lurk';
import type { Sound } from '@/lib/sound-types';
import type { CachedForPage, RiskLevel, SiteReport, TabMessage } from '@/lib/types';
import '@/components/tango.css';

const RANK: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
const WARN_FROM = RANK.medium;
const SIGNALS_DELAY_MS = 500;

const sound = (s: Sound, action: 'play' | 'stop') => void bg({ type: 'SOUND', sound: s, action }).catch(() => {});

/** Resolves once the tab is in front, so the entrance isn't played to a background tab. */
function whenVisible(): Promise<void> {
  if (document.visibilityState === 'visible') return Promise.resolve();
  return new Promise(resolve => {
    const on = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', on);
      resolve();
    };
    document.addEventListener('visibilitychange', on);
  });
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const demo = demoLevel();
    const domain = demo ? location.host : scannableDomain(location.href);
    if (!domain) return;

    let ackedLevel: RiskLevel | null = null;
    let shown: SiteReport | null = null;
    let ui: ShadowRootContentScriptUi<ReactDOM.Root> | null = null;
    let layer: TopLayer | null = null;
    let unblock = () => {};

    const shouldWarn = (r: SiteReport) =>
      RANK[r.risk_level] >= WARN_FROM && (ackedLevel === null || RANK[r.risk_level] > RANK[ackedLevel]);

    async function show(report: SiteReport) {
      if (shown && RANK[report.risk_level] <= RANK[shown.risk_level]) return;
      shown = report;
      await whenVisible();
      if (shown !== report) return;
      close();
      const lurk = lurkSpot();
      // Inside our own modal <dialog>: the browser's top layer, above every z-index on the page.
      const l = (layer = createTopLayer());
      const u = await createShadowRootUi(ctx, {
        name: 'tango-report',
        position: 'modal',
        anchor: l.el,
        append: 'last',
        zIndex: 2147483647,
        isolateEvents: true,
        onMount(container, _shadow, host) {
          unblock = blockPage(host);
          return ReactDOM.createRoot(container);
        },
        onRemove(root) {
          unblock();
          root?.unmount();
        },
      });
      if (shown !== report || layer !== l) return;
      ui = u;
      l.open(); // in the document and the top layer first, so blockPage sees the real ancestors
      u.mount();
      u.mounted?.render(
        <TangoAlert
          report={report}
          lurk={lurk}
          sound={sound}
          onContinue={() => acknowledge(report)}
          onLeave={() => bg({ type: 'LEAVE_SITE' }).catch(() => history.back())}
        />
      );
    }

    function close() {
      ui?.remove();
      ui = null;
      layer?.destroy();
      layer = null;
    }

    function acknowledge(report: SiteReport) {
      ackedLevel = report.risk_level;
      if (!demo) void bg({ type: 'ACK_SITE', domain: domain!, level: report.risk_level }).catch(() => {});
      close();
    }

    if (demo) {
      void bg({ type: 'DEMO_LEVEL', level: demo }).catch(() => {});
      if (demo !== 'none') ctx.setTimeout(() => void show(demoReport(demo)), DEMO_DELAY_MS);
      return;
    }

    browser.runtime.onMessage.addListener((msg: TabMessage) => {
      if (msg.type === 'SCAN_RESULT' && msg.domain === domain && msg.report && shouldWarn(msg.report)) void show(msg.report);
    });

    // ---------- start ----------
    const cached = await bg<CachedForPage>({ type: 'GET_CACHED_REPORT', domain }).catch(
      (): CachedForPage => ({ report: null, ackedLevel: null })
    );
    ackedLevel = cached.ackedLevel;
    if (cached.report && shouldWarn(cached.report)) void show(cached.report);

    // Give late-loading checkout widgets a moment before sampling.
    ctx.setTimeout(() => {
      bg({ type: 'PAGE_SIGNALS', domain, signals: collectSignals(domain) }).catch(() => {});
    }, SIGNALS_DELAY_MS);
  },
});
