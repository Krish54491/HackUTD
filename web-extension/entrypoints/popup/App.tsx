/**
 * Toolbar popup.
 *
 * Opening it always starts from the CURRENT TAB (nothing from a previous
 * popup session is kept, so closing and reopening returns here):
 *   - listing site (LinkedIn Jobs, Zillow, Apartments.com) -> listings popup (mockup image-2)
 *   - any other website -> that page's security result:
 *       no risk -> "No security issues found" (mockup image.png)
 *       risk    -> the full security report (mockup image-1)
 *       still checking -> checking screen
 *     each with a link to the manual checker
 *   - no website (new tab, chrome:// pages) -> manual checker (mockup image-3)
 */
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { bg } from '@/lib/messaging';
import { scannableDomain } from '@/lib/domain';
import { siteFor } from '@/lib/listing-sites';
import type { PopupState, SiteReport } from '@/lib/types';
import { Character, GlobeIcon, Logo } from '@/components/ui';
import { RiskReport, timeAgo } from '@/components/RiskReport';

type View =
  | { name: 'loading' }
  | { name: 'page' } // the current tab's result
  | { name: 'checker' }
  | { name: 'manual'; report: SiteReport } // result of a manual check from the checker
  | { name: 'listings' };

const close = () => window.close();

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [state, setState] = useState<PopupState | null>(null);
  const [tabId, setTabId] = useState<number | undefined>();
  const [domain, setDomain] = useState<string | null>(null);
  const [listingSite, setListingSite] = useState<string | null>(null);
  const [listingsOn, setListingsOn] = useState(true);

  const refresh = async (id = tabId, d = domain) => {
    const s = await bg<PopupState>({ type: 'GET_POPUP_STATE', tabId: id, domain: d ?? undefined }).catch(
      () => ({ domain: d, tab: null, hornets: state?.hornets ?? 0 }) as PopupState
    );
    setState(s);
    return s;
  };

  useEffect(() => {
    (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const d = scannableDomain(tab?.url);
      setTabId(tab?.id);
      setDomain(d);
      const site = tab?.url ? siteFor(new URL(tab.url)) : null;
      setListingSite(site?.site ?? null);
      const s = await refresh(tab?.id, d);

      if (site) {
        setListingsOn(s.tab?.listings?.enabled ?? (await bg<boolean>({ type: 'GET_LISTINGS_ENABLED', site: site.site }).catch(() => true)));
        setView({ name: 'listings' });
      } else if (d && tab?.id !== undefined) {
        setView({ name: 'page' });
        // Page not checked yet (e.g. it was open before Protego was installed): check it now.
        if (!s.tab || s.tab.scan.state === 'idle' || s.tab.scan.state === 'error') {
          await bg({ type: 'CHECK_CURRENT_PAGE', tabId: tab.id, domain: d }).catch(() => {});
          await refresh(tab.id, d);
        }
      } else {
        setView({ name: 'checker' });
      }
    })();
  }, []);

  // While the current page is being checked, keep the popup live.
  const scanState = state?.tab?.scan.state;
  useEffect(() => {
    if (view.name !== 'page' || scanState !== 'checking') return;
    const t = setInterval(() => void refresh(), 1200);
    return () => clearInterval(t);
  }, [view.name, scanState]);

  const hornets = state?.hornets ?? 0;
  const toChecker = () => setView({ name: 'checker' });
  const toPage = domain && !listingSite ? () => setView({ name: 'page' }) : null;
  const leave = () => {
    if (tabId !== undefined) void bg({ type: 'LEAVE_SITE', tabId }).finally(close);
  };

  if (view.name === 'loading') {
    return (
      <div className="pg-popup">
        <div className="pg-popup-body pg-center" style={{ padding: 40 }}>
          <div className="pg-spinner" style={{ margin: '0 auto', color: 'var(--pg-pink)' }} />
        </div>
      </div>
    );
  }

  if (view.name === 'page') {
    const scan = state?.tab?.scan;
    if (scan?.state === 'done' && scan.report.risk_level !== 'none') {
      return (
        <div className="pg-popup pg-popup-wide">
          <RiskReport
            variant="popup"
            report={scan.report}
            onClose={close}
            secondary={{ label: 'Continue to site anyway', onClick: close }}
            tertiary={{ label: 'Check another website', onClick: toChecker }}
            primary={{ label: '← Leave this website', onClick: leave }}
          />
        </div>
      );
    }
    if (scan?.state === 'done') return <CleanResult report={scan.report} onChecker={toChecker} />;
    if (scan?.state === 'error') {
      return (
        <div className="pg-popup">
          <Head />
          <div className="pg-popup-body pg-center">
            <div className="pg-hero">
              <Character mood="suspicious" size={116} />
            </div>
            <h1>We couldn't finish this check</h1>
            <p className="pg-sub">{scan.error}</p>
            <button
              className="pg-btn pg-btn-block"
              onClick={async () => {
                await bg({ type: 'CHECK_CURRENT_PAGE', tabId: tabId!, domain: domain!, force: true }).catch(() => {});
                await refresh();
              }}
            >
              Try again
            </button>
            <CheckerLink onClick={toChecker} />
          </div>
          <Foot hornets={hornets} />
        </div>
      );
    }
    return (
      <div className="pg-popup">
        <Head />
        <div className="pg-popup-body pg-center">
          <div className="pg-hero">
            <Character mood="happy" size={116} />
          </div>
          <h1>Checking this website…</h1>
          <p className="pg-sub">Protego is looking for scam warning signs. The first check of a site can take up to a minute.</p>
          <div className="pg-domain-pill">
            <span className="pg-spinner" style={{ color: 'var(--pg-pink)' }} /> {domain}
          </div>
          <CheckerLink onClick={toChecker} />
        </div>
        <Foot hornets={hornets} />
      </div>
    );
  }

  if (view.name === 'manual') {
    const r = view.report;
    if (r.risk_level === 'none') return <CleanResult report={r} onChecker={toChecker} />;
    return (
      <div className="pg-popup pg-popup-wide">
        <RiskReport
          variant="popup"
          report={r}
          onClose={close}
          secondary={{ label: 'Check another website', onClick: toChecker }}
          tertiary={toPage ? { label: "Back to this page's results", onClick: toPage } : undefined}
          primary={{ label: 'Done', onClick: close }}
        />
      </div>
    );
  }

  if (view.name === 'checker') {
    return (
      <Checker
        initial={domain ?? ''}
        hornets={hornets}
        onResult={report => setView({ name: 'manual', report })}
        onNotNow={toPage ?? close}
        notNowLabel={toPage ? "Back to this page's results" : 'Not now'}
      />
    );
  }

  // listings
  const blocked = state?.tab?.listings?.blocked ?? [];
  return (
    <div className="pg-popup">
      <div className="pg-popup-head">
        <Character mood={blocked.length > 0 ? 'suspicious' : 'happy'} size={28} />
        <Logo />
      </div>
      <div className="pg-popup-body">
        <div className="pg-domain-pill" style={{ justifyContent: 'flex-start' }}>
          <GlobeIcon /> {domain ?? listingSite}
        </div>
        <div className="pg-big">
          <span className="pg-big-num">{listingsOn ? blocked.length : '–'}</span>
          <span className="pg-big-text">
            <b>suspicious listings</b>
            <span>{listingsOn ? 'blocked on this page' : 'filtering is off for this site'}</span>
          </span>
        </div>
        <button
          className="pg-btn pg-btn-block"
          onClick={async () => {
            if (!listingSite || tabId === undefined) return;
            const enabled = !listingsOn;
            setListingsOn(enabled);
            await bg({ type: 'SET_LISTINGS_ENABLED', tabId, site: listingSite, enabled }).catch(() => setListingsOn(!enabled));
            await refresh();
          }}
        >
          {listingsOn ? 'Turn off for this site' : 'Turn on for this site'}
        </button>
      </div>
      <BlockedList items={blocked} />
      <div className="pg-popup-foot">
        <button className="pg-link" onClick={toChecker}>
          Check a website
        </button>
      </div>
    </div>
  );
}

// ---------------- views ----------------

function CleanResult({ report, onChecker }: { report: SiteReport; onChecker: () => void }) {
  return (
    <div className="pg-popup">
      <Head />
      <div className="pg-popup-body pg-center">
        <div className="pg-hero">
          <Character mood="happy" size={116} />
        </div>
        <h1>No security issues found</h1>
        <p className="pg-sub">Nothing suspicious detected in this check.</p>
        <div className="pg-domain-pill">
          <GlobeIcon /> {report.domain}
        </div>
        <button className="pg-btn pg-btn-block" onClick={close}>
          Thanks for checking
        </button>
        <p className="pg-meta" style={{ marginBottom: 0 }}>
          {report.confidence} confidence · checked {timeAgo(report.checked_at_ms)}
        </p>
        <CheckerLink onClick={onChecker} />
      </div>
    </div>
  );
}

function Checker(props: {
  initial: string;
  hornets: number;
  onResult: (r: SiteReport) => void;
  onNotNow: () => void;
  notNowLabel: string;
}) {
  const [input, setInput] = useState(props.initial);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.select(), []);

  async function run() {
    setError(null);
    setChecking(true);
    try {
      props.onResult(await bg<SiteReport>({ type: 'MANUAL_CHECK', input }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="pg-popup">
      <Head />
      <div className="pg-popup-body pg-center">
        <div className="pg-hero">
          <Character mood="happy" size={116} />
        </div>
        <h1>Check before you pay</h1>
        <p className="pg-sub">Look for signs of scams before you share payment or personal details.</p>
        <form
          className="pg-card"
          onSubmit={e => {
            e.preventDefault();
            if (input.trim() && !checking) void run();
          }}
        >
          <div className="pg-card-in">
            <label className="pg-label" htmlFor="pg-url">
              Website name or URL
            </label>
            <div className="pg-input">
              <SearchIcon />
              <input
                id="pg-url"
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Enter website name or URL"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <div className="pg-status">
            <span>Status</span>
            <b>{checking ? 'Checking…' : <><ClockIcon /> Not checked yet</>}</b>
          </div>
        </form>
        {error && <p className="pg-error">{error}</p>}
        <button className="pg-btn pg-btn-block" disabled={checking || !input.trim()} onClick={() => void run()}>
          {checking ? <span className="pg-spinner" /> : <ScanIcon />}
          {checking ? 'Checking… this can take a moment' : 'Check this website'}
        </button>
        <p style={{ margin: '12px 0 0' }}>
          <button className="pg-link" onClick={props.onNotNow}>
            {props.notNowLabel}
          </button>
        </p>
      </div>
      <Foot hornets={props.hornets} />
    </div>
  );
}

function BlockedList({ items }: { items: { title: string; reason: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pg-acc">
      <button className="pg-acc-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        Blocked listings <span aria-hidden>{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <ul className="pg-acc-list">
          {items.length === 0 && <li style={{ color: 'var(--pg-muted)' }}>Nothing blocked yet.</li>}
          {items.map((b, i) => (
            <li key={i}>
              {b.title}
              {b.reason && <small>{b.reason}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckerLink({ onClick }: { onClick: () => void }) {
  return (
    <p style={{ margin: '12px 0 0' }}>
      <button className="pg-link" onClick={onClick}>
        Check another website
      </button>
    </p>
  );
}

function Head() {
  return (
    <div className="pg-popup-head">
      <Logo />
      <button className="pg-x" onClick={close} aria-label="Close">
        ×
      </button>
    </div>
  );
}

function Foot({ hornets }: { hornets: number }) {
  return (
    <div className="pg-popup-foot">
      <b>{hornets}</b> hornet{hornets === 1 ? '' : 's'} blocked
    </div>
  );
}

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const ScanIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ verticalAlign: '-1px', marginRight: 4 }} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
