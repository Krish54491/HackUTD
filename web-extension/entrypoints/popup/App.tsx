import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { bg } from '@/lib/messaging';
import { scannableDomain } from '@/lib/domain';
import { siteFor } from '@/lib/listing-sites';
import type { PopupState, SiteReport } from '@/lib/types';
import { Character, GlobeIcon, LEVEL_LABEL, Logo, RiskBar, SeverityIcon, moodFor } from '@/components/ui';
import { timeAgo } from '@/components/RiskReport';

type View =
  | { name: 'loading' }
  | { name: 'check' }
  | { name: 'result'; report: SiteReport }
  | { name: 'listings' };

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [state, setState] = useState<PopupState | null>(null);
  const [tabId, setTabId] = useState<number | undefined>();
  const [listingSite, setListingSite] = useState<string | null>(null);
  const [listingsOn, setListingsOn] = useState(true);
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const domain = scannableDomain(tab?.url);
      setTabId(tab?.id);
      setInput(domain ?? '');
      const site = tab?.url ? siteFor(new URL(tab.url)) : null;
      setListingSite(site?.site ?? null);
      const s = await bg<PopupState>({ type: 'GET_POPUP_STATE', tabId: tab?.id, domain: domain ?? undefined }).catch(
        () => ({ domain, tab: null, hornets: 0 }) as PopupState
      );
      setState(s);
      if (site) {
        setListingsOn(s.tab?.listings?.enabled ?? (await bg<boolean>({ type: 'GET_LISTINGS_ENABLED', site: site.site }).catch(() => true)));
        setView({ name: 'listings' });
      } else {
        setView({ name: 'check' });
      }
    })();
  }, []);

  async function runCheck(force = false) {
    setError(null);
    setChecking(true);
    try {
      const report = await bg<SiteReport>({ type: 'MANUAL_CHECK', input, force });
      setView({ name: 'result', report });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function toggleListings() {
    if (!listingSite || tabId === undefined) return;
    const enabled = !listingsOn;
    setListingsOn(enabled);
    await bg({ type: 'SET_LISTINGS_ENABLED', tabId, site: listingSite, enabled }).catch(() => setListingsOn(!enabled));
    if (!enabled) setState(s => (s?.tab?.listings ? { ...s, tab: { ...s.tab, listings: { ...s.tab.listings, blocked: [] } } } : s));
  }

  const hornets = state?.hornets ?? 0;
  const close = () => window.close();

  return (
    <div className="pg-popup">
      {view.name === 'loading' && (
        <div className="pg-popup-body pg-center" style={{ padding: 40 }}>
          <div className="pg-spinner" style={{ margin: '0 auto', color: 'var(--pg-pink)' }} />
        </div>
      )}

      {view.name === 'check' && (
        <>
          <Head onClose={close} />
          <div className="pg-popup-body pg-center">
            <div className="pg-hero">
              <Character mood={autoMood(state)} size={116} />
            </div>
            <h1>Check before you pay</h1>
            <p className="pg-sub">Look for signs of scams before you share payment or personal details.</p>
            <form
              className="pg-card"
              onSubmit={e => {
                e.preventDefault();
                void runCheck();
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
                <AutoStatus state={state} input={input} checking={checking} />
              </div>
            </form>
            {error && <p className="pg-error">{error}</p>}
            <button className="pg-btn pg-btn-block" disabled={checking || !input.trim()} onClick={() => void runCheck()}>
              {checking ? <span className="pg-spinner" /> : <ScanIcon />}
              {checking ? 'Checking… this can take a moment' : 'Check this website'}
            </button>
            <p style={{ margin: '12px 0 0' }}>
              <button className="pg-link" onClick={close}>
                Not now
              </button>
            </p>
          </div>
          <Foot hornets={hornets} />
        </>
      )}

      {view.name === 'result' && view.report.risk_level === 'none' && (
        <>
          <Head onClose={close} />
          <div className="pg-popup-body pg-center">
            <div className="pg-hero">
              <Character mood="happy" size={116} />
            </div>
            <h1>No security issues found</h1>
            <p className="pg-sub">Nothing suspicious detected in this check.</p>
            <div className="pg-domain-pill">
              <GlobeIcon /> {view.report.domain}
            </div>
            <button className="pg-btn pg-btn-block" onClick={() => setView({ name: 'check' })}>
              Thanks for checking
            </button>
            <p className="pg-meta" style={{ marginBottom: 0 }}>
              {view.report.confidence} confidence · checked {timeAgo(view.report.checked_at_ms)} ·{' '}
              <button className="pg-link" onClick={() => void runCheck(true)}>
                re-check
              </button>
            </p>
          </div>
        </>
      )}

      {view.name === 'result' && view.report.risk_level !== 'none' && (
        <>
          <Head onClose={close} />
          <div className="pg-popup-body pg-compact">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <Character mood={moodFor(view.report.risk_level)} size={56} />
              <div>
                <h1 style={{ margin: 0 }}>Risk level: {LEVEL_LABEL[view.report.risk_level]}</h1>
                <span className="pg-meta" style={{ margin: 0 }}>
                  {view.report.domain} · {view.report.confidence} confidence
                </span>
              </div>
            </div>
            <RiskBar score={view.report.score} />
            <p className="pg-summary">{view.report.summary}</p>
            <ul className="pg-reasons">
              {view.report.reasons.map((r, i) => (
                <li key={i}>
                  <SeverityIcon severity={r.severity} />
                  <span>
                    <b>{r.title}.</b> {r.detail}
                  </span>
                </li>
              ))}
            </ul>
            <button className="pg-btn pg-btn-block" onClick={() => setView({ name: 'check' })}>
              Got it
            </button>
          </div>
          <Foot hornets={hornets} />
        </>
      )}

      {view.name === 'listings' && (
        <>
          <div className="pg-popup-head">
            <Character mood={(state?.tab?.listings?.blocked.length ?? 0) > 0 ? 'suspicious' : 'happy'} size={28} />
            <Logo />
          </div>
          <div className="pg-popup-body">
            <div className="pg-domain-pill" style={{ justifyContent: 'flex-start' }}>
              <GlobeIcon /> {state?.domain ?? listingSite}
            </div>
            <div className="pg-big">
              <span className="pg-big-num">{listingsOn ? (state?.tab?.listings?.blocked.length ?? 0) : '–'}</span>
              <span className="pg-big-text">
                <b>suspicious listings</b>
                <span>{listingsOn ? 'blocked on this page' : 'filtering is off for this site'}</span>
              </span>
            </div>
            <button className="pg-btn pg-btn-block" onClick={() => void toggleListings()}>
              {listingsOn ? 'Turn off for this site' : 'Turn on for this site'}
            </button>
          </div>
          <BlockedList items={state?.tab?.listings?.blocked ?? []} />
          <div className="pg-popup-foot">
            <button className="pg-link" onClick={() => setView({ name: 'check' })}>
              Check this website instead
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function autoMood(state: PopupState | null) {
  return state?.tab?.scan.state === 'done' ? moodFor(state.tab.scan.report.risk_level) : 'happy';
}

function AutoStatus({ state, input, checking }: { state: PopupState | null; input: string; checking: boolean }) {
  if (checking) return <b>Checking…</b>;
  const scan = state?.tab?.scan;
  const sameSite = state?.domain && input.trim().toLowerCase().replace(/^www\./, '') === state.domain;
  if (sameSite && scan?.state === 'checking') return <b>Checking automatically…</b>;
  if (sameSite && scan?.state === 'done') {
    const lvl = scan.report.risk_level;
    return <b>{lvl === 'none' ? 'No issues found' : `${LEVEL_LABEL[lvl]} risk`}</b>;
  }
  return (
    <b>
      <ClockIcon /> Not checked yet
    </b>
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

function Head({ onClose }: { onClose: () => void }) {
  return (
    <div className="pg-popup-head">
      <Logo />
      <button className="pg-x" onClick={onClose} aria-label="Close">
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
