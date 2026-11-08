import { browser } from 'wxt/browser';
import type { RiskLevel, Severity } from '@/lib/types';

export const LEVEL_LABEL: Record<RiskLevel, string> = { none: 'None', low: 'Low', medium: 'Medium', high: 'High' };

export type Mood = 'happy' | 'suspicious' | 'angry';
export function moodFor(level: RiskLevel | null | undefined): Mood {
  if (level === 'high') return 'angry';
  if (level === 'medium' || level === 'low') return 'suspicious';
  return 'happy';
}

/** Light-mode character, with existing warning expressions for elevated risk. */
export function Character({ mood, size = 120 }: { mood: Mood; size?: number }) {
  // getURL's typing only knows files WXT has seen; characters live in /public.
  const src = (browser.runtime.getURL as (p: string) => string)(`/characters/${mood === 'happy' ? 'light-mode' : mood}.png`);
  if (mood === 'happy') return <span className="pg-character-frame" style={{ width: size, height: size }}><img src={src} width={size} height={size} alt="" draggable={false}/></span>;
  return <img className="pg-character" src={src} width={size} height={size} alt="" draggable={false} />;
}

export function Logo() {
  return <span className="pg-brand"><Character mood="happy" size={28}/><span className="pg-logo">tango.</span></span>;
}

/** Green → yellow → red bar with an arrow at `score`%. */
export function RiskBar({ score }: { score: number }) {
  const pct = Math.max(2, Math.min(98, score));
  return (
    <div className="pg-bar" role="img" aria-label={`Risk score ${score} out of 100`}>
      <div className="pg-bar-arrow" style={{ left: `${pct}%` }} />
      <div className="pg-bar-track">
        <span className="pg-seg pg-seg-low" />
        <span className="pg-seg pg-seg-mid" />
        <span className="pg-seg pg-seg-high" />
      </div>
      <div className="pg-bar-labels">
        <span>0% · Low</span>
        <span>Moderate</span>
        <span>High · 100%</span>
      </div>
    </div>
  );
}

export function SeverityIcon({ severity }: { severity: Severity }) {
  const glyph = severity === 'info' ? '✓' : '!';
  return <span className={`pg-sev pg-sev-${severity}`} aria-hidden>{glyph}</span>;
}

export function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}
