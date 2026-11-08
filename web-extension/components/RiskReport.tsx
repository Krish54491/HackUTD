import { useEffect, useRef } from 'react';
import type { SiteReport } from '@/lib/types';
import { Character, LEVEL_LABEL, Logo, RiskBar, SeverityIcon, moodFor } from './ui';

type Action = { label: string; onClick: () => void };

type Props = {
  report: SiteReport;
  onClose: () => void;
  /** Pink button, bottom right (mockup: "Leave this website"). */
  primary: Action;
  /** Underlined link, bottom left (mockup: "Continue to site anyway"). */
  secondary: Action;
  /** Optional extra link next to the secondary one (popup: "Check another website"). */
  tertiary?: Action;
  /** 'page' = blocking modal over the website; 'popup' = same report inside the toolbar popup. */
  variant?: 'page' | 'popup';
};

/**
 * "Website security report" (mockup image-1).
 * The [data-tango-hornet-slot] element is the hook for the future
 * "Tango swoops in and kills the hornet" entrance animation.
 */
export function RiskReport({ report, onClose, primary, secondary, tertiary, variant = 'page' }: Props) {
  const level = report.risk_level;
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (variant === 'page') primaryRef.current?.focus();
  }, [variant]);

  return (
    <div
      className={`pg-modal${variant === 'popup' ? ' pg-modal-embedded' : ''}`}
      role={variant === 'page' ? 'alertdialog' : undefined}
      aria-modal={variant === 'page' ? true : undefined}
      aria-labelledby="pg-title"
      aria-describedby="pg-summary"
    >
      <header className="pg-modal-head">
        <Logo />
        <span className="pg-modal-kicker">Website security report</span>
        <button className="pg-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <div className="pg-modal-body">
        <section className="pg-modal-main">
          <div className="pg-title-row">
            <h1 id="pg-title">Risk level: {LEVEL_LABEL[level]}</h1>
            <span className={`pg-pill pg-pill-${level}`}>{LEVEL_LABEL[level]} risk</span>
          </div>
          <RiskBar score={report.score} />

          <h2>Why this site was flagged</h2>
          <p className="pg-summary" id="pg-summary">
            {report.summary}
          </p>
          <ul className="pg-reasons">
            {report.reasons.map((r, i) => (
              <li key={i}>
                <SeverityIcon severity={r.severity} />
                <span>
                  <b>{r.title}.</b> {r.detail}
                </span>
              </li>
            ))}
          </ul>
          <p className="pg-meta">
            {report.domain} · {report.confidence} confidence · checked {timeAgo(report.checked_at_ms)}
          </p>
        </section>

        <aside className="pg-modal-side">
          <div data-tango-hornet-slot className="pg-hornet-slot">
            <Character mood={moodFor(level)} size={140} />
          </div>
          <p className="pg-side-title">Pause before you pay.</p>
          <p className="pg-side-sub">A little caution goes a long way.</p>
        </aside>
      </div>

      <footer className="pg-modal-foot">
        <span className="pg-foot-links">
          <button className="pg-link" onClick={secondary.onClick}>
            {secondary.label}
          </button>
          {tertiary && (
            <button className="pg-link" onClick={tertiary.onClick}>
              {tertiary.label}
            </button>
          )}
        </span>
        <button className="pg-btn" ref={primaryRef} onClick={primary.onClick}>
          {primary.label}
        </button>
      </footer>
    </div>
  );
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
