/**
 * Runs on every page: extracts privacy-filtered signals, hands them to the
 * background for a (cached) security check, and shows the report modal over
 * the page when the background says the site is risky.
 */
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { RiskReport } from '@/components/RiskReport';
import { collectSignals } from '@/lib/signals';
import { scannableDomain } from '@/lib/domain';
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

    browser.runtime.onMessage.addListener((msg: TabMessage) => {
      if (msg.type === 'SHOW_REPORT' && msg.report.domain === domain && !ui) {
        void showReport(ctx, msg.report).then(u => (ui = u));
      }
    });

    // Let late-loading checkout widgets and scripts settle before sampling.
    ctx.setTimeout(() => {
      bg({ type: 'PAGE_SIGNALS', domain, signals: collectSignals(domain) }).catch(() => {});
    }, 1200);

    async function showReport(ctx: ContentScriptContext, report: SiteReport) {
      const created = await createShadowRootUi(ctx, {
        name: 'protego-report',
        position: 'modal',
        zIndex: 2147483646,
        isolateEvents: true,
        onMount(container) {
          const root = ReactDOM.createRoot(container);
          const close = () => {
            created.remove();
            ui = null;
          };
          root.render(
            <div className="pg-backdrop" onClick={e => e.target === e.currentTarget && close()}>
              <RiskReport
                report={report}
                onClose={close}
                onContinue={() => {
                  bg({ type: 'CONTINUE_ANYWAY', domain: report.domain }).catch(() => {});
                  close();
                }}
                onLeave={() => bg({ type: 'LEAVE_SITE' }).catch(() => history.back())}
              />
            </div>
          );
          return root;
        },
        onRemove(root) {
          root?.unmount();
        },
      });
      created.mount();
      return created;
    }
  },
});
