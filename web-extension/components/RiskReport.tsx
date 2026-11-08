import type { SiteReport } from '@/lib/types';
import { Character, LEVEL_LABEL, Logo, RiskBar, SeverityIcon, moodFor } from './ui';

type Props = {
  report: SiteReport;
  onClose: () => void;
  onContinue: () => void;
  onLeave: () => void;
};

/**
 * "Website security report" modal shown over a risky page (mockup image-1).
 * The [data-protego-hornet-slot] element is the hook for the future
 * "Protego swoops in and kills the hornet" entrance animation.
 */
export function RiskReport({ report, onClose, onContinue, onLeave }: Props) {
  const level = report.risk_level;
  return (
    <div className="pg-modal" role="dialog" aria-modal="true" aria-labelledby="pg-title">
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
          <p className="pg-summary">{report.summary}</p>
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
          <div data-protego-hornet-slot className="pg-hornet-slot">
            <Character mood={moodFor(level)} size={140} />
          </div>
          <p className="pg-side-title">Pause before you pay.</p>
          <p className="pg-side-sub">A little caution goes a long way.</p>
        </aside>
      </div>

      <footer className="pg-modal-foot">
        <button className="pg-link" onClick={onContinue}>
          Continue to site anyway
        </button>
        <button className="pg-btn" onClick={onLeave}>
          ← Leave this website
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
