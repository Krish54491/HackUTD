/**
 * Runs on every page: extracts privacy-filtered signals, hands them to the
 * background for a (cached) security check, and controls the BLOCKING popup:
 *
 *  - First visit (no local result yet): "Hold on, let me check this site" with
 *    the character. Clean result: it says "All clear" and closes itself.
 *    Risky result: it turns into the full security report.
 *  - Known-risky site: the report goes up immediately from the local cache.
 *  - Once the user picks "Continue to site anyway" (or ×) the report doesn't
 *    come back for that domain until the browser restarts, unless the risk
 *    level later goes UP.
 *
 * Blocking means the page behind is `inert` (no clicks, typing or focus),
 * scrolling is locked, and there's no click-outside / Escape dismissal.
 */
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { RiskReport } from '@/components/RiskReport';
import { SiteCheck, SAFE_CLOSE_MS, type CheckView } from '@/components/SiteCheck';
import { collectSignals } from '@/lib/signals';
import { scannableDomain } from '@/lib/domain';
import { blockPage } from '@/lib/block-page';
import { createTopLayer, type TopLayer } from '@/lib/top-layer';
import { bg } from '@/lib/messaging';
import type { CachedForPage, RiskLevel, SiteReport, TabMessage } from '@/lib/types';
import '@/components/tango.css';

const RANK: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
/** Server-cached sites answer in well under a second; don't flash the popup for those. */
const CHECKING_GRACE_MS = 300;
const SIGNALS_DELAY_MS = 500;

type View = CheckView | { kind: 'report'; report: SiteReport };

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const domain = scannableDomain(location.href);
    if (!domain) return;

    let ackedLevel: RiskLevel | null = null;
    let resolved = false; // a result (or error) arrived for this page load
    let skipped = false; // the user skipped the wait; a risky result still warns
    let dismissed = false; // the user closed the report on this page load
    let current: View | null = null;
    let closeTimer: number | undefined;

    // ---------- the one shadow-root modal, re-rendered as the view changes ----------
    let ui: ShadowRootContentScriptUi<ReactDOM.Root> | null = null;
    let mounting: Promise<void> | null = null;
    let unblock = () => {};
    let layer: TopLayer | null = null;

    const ensureMounted = (): Promise<void> => {
      if (mounting) return mounting;
      // Inside our own modal <dialog>: the browser's top layer, above every z-index on the page.
      const l = (layer = createTopLayer());
      const p: Promise<void> = createShadowRootUi(ctx, {
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
      }).then(u => {
        if (mounting !== p) return; // closed before it finished mounting
        ui = u;
        l.open(); // in the document and the top layer first, so blockPage sees the real ancestors
        u.mount();
      });
      return (mounting = p);
    };

    async function show(view: View) {
      current = view;
      clearTimeout(closeTimer);
      await ensureMounted();
      if (current !== view) return; // superseded while mounting
      ui?.mounted?.render(
        <div className="pg-backdrop">
          {view.kind === 'report' ? (
            <RiskReport
              report={view.report}
              onClose={() => acknowledge(view.report)}
              secondary={{ label: 'Continue to site anyway', onClick: () => acknowledge(view.report) }}
              primary={{
                label: '← Leave this website',
                onClick: () => bg({ type: 'LEAVE_SITE' }).catch(() => history.back()),
              }}
            />
          ) : (
            <SiteCheck domain={domain!} view={view} onSkip={skip} />
          )}
        </div>
      );
    }

    function close() {
      clearTimeout(closeTimer);
      current = null;
      mounting = null;
      ui?.remove();
      ui = null;
      layer?.destroy();
      layer = null;
    }

    function acknowledge(report: SiteReport) {
      dismissed = true;
      ackedLevel = report.risk_level;
      void bg({ type: 'ACK_SITE', domain: domain!, level: report.risk_level }).catch(() => {});
      close();
    }

    function skip() {
      skipped = true;
      close();
    }

    const shouldWarn = (r: SiteReport) =>
      r.risk_level !== 'none' && !dismissed && (ackedLevel === null || RANK[r.risk_level] > RANK[ackedLevel]);

    function onResult(report: SiteReport | null, error?: string) {
      resolved = true;
      const checking = current?.kind === 'checking';
      if (report && shouldWarn(report)) {
        if (current?.kind !== 'report') void show({ kind: 'report', report });
        return;
      }
      if (!checking) return;
      if (report) {
        // Clean (or risky but already acknowledged): say so, then get out of the way.
        void show({ kind: 'safe' });
        closeTimer = ctx.setTimeout(close, SAFE_CLOSE_MS);
      } else if (!skipped) {
        void show({ kind: 'error', message: error ?? 'Check failed' });
      }
    }

    browser.runtime.onMessage.addListener((msg: TabMessage) => {
      if (msg.type === 'SCAN_RESULT' && msg.domain === domain) onResult(msg.report, msg.error);
    });

    // ---------- start ----------
    const cached = await bg<CachedForPage>({ type: 'GET_CACHED_REPORT', domain }).catch(
      (): CachedForPage => ({ report: null, ackedLevel: null })
    );
    ackedLevel = cached.ackedLevel;
    if (cached.report) {
      // Known site: warn right away if it's risky; clean sites see nothing.
      if (shouldWarn(cached.report)) void show({ kind: 'report', report: cached.report });
      resolved = true;
    } else {
      ctx.setTimeout(() => {
        if (!resolved && !skipped && !current) void show({ kind: 'checking' });
      }, CHECKING_GRACE_MS);
    }

    // Give late-loading checkout widgets a moment before sampling (the page is blocked meanwhile).
    ctx.setTimeout(() => {
      bg({ type: 'PAGE_SIGNALS', domain, signals: collectSignals(domain) }).catch(() => {});
    }, SIGNALS_DELAY_MS);
  },
});
