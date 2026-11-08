import { useEffect, useState } from 'react';
import { Character, Logo } from './ui';

export type CheckView = { kind: 'checking' } | { kind: 'safe' } | { kind: 'error'; message: string };

const STEPS = [
  'Checking how old this website is…',
  'Checking scam and phishing lists…',
  'Checking Google Safe Browsing…',
  'Looking for reviews and scam reports…',
  'Checking the payment page…',
];
/** After this long the user may skip the wait (the warning still appears if the site turns out risky). */
const SKIP_AFTER_MS = 8000;
export const SAFE_CLOSE_MS = 1600;

/**
 * Blocking "hold on while I check" popup shown on the first visit to a site.
 * Turns into "All clear" and closes itself when the site is clean.
 */
export function SiteCheck({ domain, view, onSkip }: { domain: string; view: CheckView; onSkip: () => void }) {
  const [step, setStep] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  useEffect(() => {
    if (view.kind !== 'checking') return;
    const a = setInterval(() => setStep(s => (s + 1) % STEPS.length), 1600);
    const b = setTimeout(() => setCanSkip(true), SKIP_AFTER_MS);
    return () => {
      clearInterval(a);
      clearTimeout(b);
    };
  }, [view.kind]);

  const mood = view.kind === 'safe' ? 'happy' : 'suspicious';
  return (
    <div className="pg-modal pg-check" role="alertdialog" aria-modal aria-labelledby="pg-check-title" aria-live="polite">
      <header className="pg-modal-head">
        <Logo />
        <span className="pg-modal-kicker">Website security check</span>
      </header>
      <div className="pg-check-body">
        <div data-protego-hornet-slot className={`pg-check-char${view.kind === 'checking' ? ' pg-bob' : ''}`}>
          <Character mood={mood} size={120} />
        </div>
        <div className={`pg-bubble${view.kind === 'safe' ? ' pg-bubble-safe' : ''}`}>
          {view.kind === 'checking' && (
            <>
              <p className="pg-bubble-title" id="pg-check-title">Hold on! Let me check this site first.</p>
              <p className="pg-bubble-sub">
                Please wait before typing or paying on <b>{domain}</b>.
              </p>
            </>
          )}
          {view.kind === 'safe' && (
            <>
              <p className="pg-bubble-title" id="pg-check-title">All clear, you're good to go!</p>
              <p className="pg-bubble-sub">
                No security issues found on <b>{domain}</b>.
              </p>
            </>
          )}
          {view.kind === 'error' && (
            <>
              <p className="pg-bubble-title" id="pg-check-title">I couldn't finish checking this site.</p>
              <p className="pg-bubble-sub">Be careful with payment or personal details on {domain}.</p>
            </>
          )}
        </div>

        {view.kind === 'checking' && (
          <p className="pg-check-step">
            <span className="pg-spinner" aria-hidden /> {STEPS[step]}
          </p>
        )}
        {view.kind === 'safe' && <div className="pg-drain" style={{ animationDuration: `${SAFE_CLOSE_MS}ms` }} aria-hidden />}
        {view.kind === 'error' && (
          <button className="pg-btn pg-check-btn" onClick={onSkip} autoFocus>
            Continue to site
          </button>
        )}
        {view.kind === 'checking' && canSkip && (
          <button className="pg-link pg-check-skip" onClick={onSkip}>
            Continue without waiting
          </button>
        )}
      </div>
    </div>
  );
}
