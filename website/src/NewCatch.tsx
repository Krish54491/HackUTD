import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Anchor, Crown, Plus } from 'lucide-react';
import { Hornet } from './Hornet';
import { MYTHIC_ODDS, TIERS, rollMythic, tierOf, type Slain } from './hive';

const DROP_MS = 1000;
const DIVE_MS = 3800;
const ABYSS_MS = 3200;
const STASH_MS = 800;
const KRILL = Array.from({ length: 22 }, (_, i) => ({ left: (i * 37) % 100, top: (i * 53) % 100, d: 5 + (i % 5) * 2, delay: -(i * 1.3) }));
const depthOf = (points: number) => points * 10;
const SCALE = TIERS.filter(x => x.id !== 'mythic');
const MAX_DEPTH = depthOf(SCALE[SCALE.length - 1].points);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const v = (vars: Record<string, string | number>) => vars as CSSProperties;

/** Reads a fresh kill sent by the extension (`?slay=domain&title=…&cat=…&r=…`), then clears the URL. */
export function catchFromUrl(): Slain | null {
  const q = new URLSearchParams(location.search);
  const domain = q.get('slay');
  if (!domain) return null;
  history.replaceState(null, '', location.pathname + location.hash);
  return {
    id: `new-${Date.now()}`,
    domain,
    title: q.get('title') || domain,
    category: q.get('cat') || 'Scam site',
    date: new Date().toISOString(),
    reports: 0,
    mythic: rollMythic(),
    first: true,
    reasons: q.getAll('r'),
  };
}

type Stage = 'prompt' | 'dive' | 'shown' | 'stash';

/** The new hornet arrives unrated, sinks through One in a Krillion to its tier, then flies into the hive. */
export function NewCatch({ hornet, onDone }: { hornet: Slain; onDone: () => void }) {
  const t = tierOf(hornet);
  const mythic = t.id === 'mythic';
  const target = mythic ? MYTHIC_ODDS : depthOf(t.points);
  const [stage, setStage] = useState<Stage>('prompt');
  const [ready, setReady] = useState(false);
  const [meters, setMeters] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), DROP_MS);
    return () => { clearTimeout(id); cancelAnimationFrame(raf.current); };
  }, []);
  useEffect(() => { if (ready && (stage === 'prompt' || stage === 'shown')) action.current?.focus(); }, [ready, stage]);

  function dive() {
    if (reduced()) return setStage('shown');
    setStage('dive');
    const floor = Math.min(target, MAX_DEPTH);
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / DIVE_MS);
      const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setMeters(Math.round(floor * eased));
      if (k < 1) raf.current = requestAnimationFrame(step);
      else if (target > floor) raf.current = requestAnimationFrame(fallFrom(performance.now(), floor));
      else window.setTimeout(() => setStage('shown'), 450);
    };
    const fallFrom = (from: number, floor: number) => {
      const fall = (now: number) => {
        const k = Math.min(1, (now - from) / ABYSS_MS);
        setMeters(Math.round(floor * Math.pow(target / floor, k * k)));
        if (k < 1) raf.current = requestAnimationFrame(fall);
        else window.setTimeout(() => setStage('shown'), 700);
      };
      return fall;
    };
    raf.current = requestAnimationFrame(step);
  }

  function stash() {
    const el = card.current;
    const to = document.querySelector('.hive-grid')?.getBoundingClientRect();
    if (!el || !to || reduced()) return onDone();
    setStage('stash');
    const from = el.getBoundingClientRect();
    const dx = to.left + 90 - (from.left + from.width / 2);
    const dy = to.top + 100 - (from.top + from.height / 2);
    el.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 80}px) scale(.62) rotate(-10deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(.16) rotate(14deg)`, opacity: 0.3 },
      ],
      { duration: STASH_MS, easing: 'cubic-bezier(.55,0,.35,1)', fill: 'forwards' },
    ).finished.then(onDone, onDone);
  }

  const p = Math.min(1, meters / MAX_DEPTH);
  const abyss = meters > MAX_DEPTH;
  const passed = [...SCALE].reverse().find(x => meters >= depthOf(x.points));
  const revealed = stage === 'shown' || stage === 'stash';
  const kind = /scam/i.test(hornet.category) ? hornet.category : `${hornet.category} scam`;

  return (
    <div
      className={`catch catch-${stage}${mythic && revealed ? ' catch-mythic' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="catch-title"
      style={v({ '--c': revealed ? t.color : '#a78bfa' })}
      onKeyDown={e => { if (e.key === 'Escape' && stage === 'shown') stash(); }}
    >
      <div className={`catch-card${stage === 'dive' ? ' diving' : ''}`} ref={card}>
        {stage === 'prompt' && (
          <>
            <div className="catch-stage">
              <span className="catch-ring" aria-hidden="true" />
              <span className="catch-mystery"><Hornet tierId="common" size={200} dead /></span>
              <span className="catch-q" aria-hidden="true">?</span>
            </div>
            <span className="catch-new">New hornet</span>
            <h2 id="catch-title">{hornet.title}</h2>
            <p className="catch-domain">{kind}</p>
            <button ref={action} className="neon-button wide catch-go" onClick={dive} disabled={!ready}>
              <Anchor size={16} />Send to One in a Krillion
            </button>
          </>
        )}

        {stage === 'dive' && (
          <>
            <span className="catch-new">One in a Krillion</span>
            <h2 id="catch-title" className="kr-title">{hornet.title}</h2>
            <div className={abyss ? 'kr-ocean abyss' : 'kr-ocean'} aria-live="polite">
              <div className="kr-dark" style={{ opacity: p * 0.9 }} />
              {KRILL.map((k, i) => <span key={i} className="krill" style={{ left: `${k.left}%`, top: `${k.top}%`, animationDuration: `${k.d}s`, animationDelay: `${k.delay}s` }} />)}
              <div className="kr-ticks">
                {SCALE.map(x => (
                  <span key={x.id} className={meters >= depthOf(x.points) ? 'lit' : ''} style={v({ top: `${8 + x.points * 0.7}%`, '--c': x.color })}>
                    {x.name}<b>{depthOf(x.points)} m</b>
                  </span>
                ))}
              </div>
              <div className="kr-boat"><Anchor size={16} /></div>
              <div className="kr-line" style={{ height: `${8 + p * 70}%` }}>
                <div className="kr-hook">
                  <svg width="18" height="26" viewBox="0 0 18 26" aria-hidden="true"><path d="M9 0 V16 a6 6 0 1 1 -6 -6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" /></svg>
                  <span className="catch-mystery small"><Hornet tierId="common" size={90} dead /></span>
                </div>
              </div>
              <div className="kr-depth" style={v({ '--c': abyss ? t.color : passed?.color ?? '#ece8ff' })}>
                <strong>{meters.toLocaleString()} m</strong>
                <span>{abyss ? 'Past the bottom' : passed ? passed.name : 'Surface'}</span>
              </div>
            </div>
          </>
        )}

        {revealed && (
          <>
            <div className="catch-stage">
              <span className="catch-rays" aria-hidden="true" />
              <span className="catch-ring" aria-hidden="true" />
              <Hornet tierId={t.id} size={200} dead />
            </div>
            <span className="catch-new catch-reveal" style={v({ '--i': 0 })}>{mythic ? 'One in a million' : t.id === 'legendary' ? 'One in a Krillion' : 'New hornet'}</span>
            <span className="tier-pill catch-reveal" style={v({ '--i': 1 })}>{t.name} · {target.toLocaleString()} m</span>
            <h2 id="catch-title" className="catch-reveal" style={v({ '--i': 2 })}>{t.species}</h2>
            <p className="latin catch-reveal" style={v({ '--i': 2 })}>{t.latin}</p>
            <p className="catch-domain catch-reveal" style={v({ '--i': 3 })}>{hornet.title} · {kind}</p>
            <div className="catch-row catch-reveal" style={v({ '--i': 4 })}>
              <span className="first-flag inline"><Crown size={12} />First slayer</span>
              <b>+{t.points}</b>
            </div>
            <button ref={action} className="neon-button wide catch-reveal" style={v({ '--i': 5 })} onClick={stash} disabled={stage !== 'shown'}>
              <Plus size={16} />Add to hive
            </button>
          </>
        )}
      </div>
    </div>
  );
}
