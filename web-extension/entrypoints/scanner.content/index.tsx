/**
 * Runs on every page: extracts privacy-filtered signals, hands them to the
 * background for a (cached) security check, and puts a BLOCKING report modal
 * over the page whenever the site has any risk (low, medium or high).
 *
 * Blocking means: the page behind is made `inert` (no clicks, typing or
 * keyboard focus), scrolling is locked, and the modal can't be dismissed by
 * clicking outside it or pressing Escape. Only an explicit choice closes it:
 * "Leave this website", "Continue to site anyway" or ×. It returns on every
 * page load of a risky site.
 */
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { RiskReport } from '@/components/RiskReport';
import { collectSignals } from '@/lib/signals';
import { scannableDomain } from '@/lib/domain';
import { blockPage } from '@/lib/block-page';
import { bg } from '@/lib/messaging';
import type { SiteReport, TabMessage } from '@/lib/types';
import '@/components/protego.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const domain = scannableDomain(location.href);
    if (!domain) return;

    let ui: ShadowRootContentScriptUi<ReactDOM.Root> | null = null;
    let opening = false;
    let dismissed = false; // the user made a choice on this page load

    const show = (report: SiteReport) => {
      if (report.domain !== domain || report.risk_level === 'none' || ui || opening || dismissed) return;
      opening = true;
      void mountModal(ctx, report)
        .then(u => (ui = u))
        .finally(() => (opening = false));
    };

    browser.runtime.onMessage.addListener((msg: TabMessage) => {
      if (msg.type === 'SHOW_REPORT') show(msg.report);
    });

    // Known-risky site: block immediately from the local cache, before the user can interact.
    bg<SiteReport | null>({ type: 'GET_CACHED_REPORT', domain })
      .then(r => r && show(r))
      .catch(() => {});

    // Let late-loading checkout widgets and scripts settle before sampling.
    ctx.setTimeout(() => {
      bg({ type: 'PAGE_SIGNALS', domain, signals: collectSignals(domain) }).catch(() => {});
    }, 1200);

    async function mountModal(ctx: ContentScriptContext, report: SiteReport) {
      let unblock = () => {};
      const created = await createShadowRootUi(ctx, {
        name: 'protego-report',
        position: 'modal',
        zIndex: 2147483647,
        isolateEvents: true,
        onMount(container, _shadow, host) {
          unblock = blockPage(host);
          const root = ReactDOM.createRoot(container);
          const dismiss = () => {
            dismissed = true;
            unblock();
            created.remove();
            ui = null;
          };
          root.render(
            <div className="pg-backdrop">
              <RiskReport
                report={report}
                onClose={dismiss}
                secondary={{ label: 'Continue to site anyway', onClick: dismiss }}
                primary={{
                  label: '← Leave this website',
                  onClick: () => bg({ type: 'LEAVE_SITE' }).catch(() => history.back()),
                }}
              />
            </div>
          );
          return root;
        },
        onRemove(root) {
          unblock();
          root?.unmount();
        },
      });
      created.mount();
      return created;
    }
  },
});
