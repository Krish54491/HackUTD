import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import type { SiteReport } from '@/lib/types';
import type { Sound } from '@/lib/sound-types';
import type { Rect } from '@/lib/lurk';
import { bragFor, tipFor } from '@/lib/tmobile-tips';
import { dashboardUrl } from '@/lib/dashboard';
import { Character, LEVEL_LABEL } from './ui';
import { RiskReport } from './RiskReport';
import { TMobileLogo, TMobileMark } from './TMobileLogo';

type Props = {
  report: SiteReport;
  /** Page element the hornet sneaks out of (high risk). */
  lurk: Rect;
  onLeave: () => void;
  onContinue: () => void;
  sound: (sound: Sound, action: 'play' | 'stop') => void;
};

/** Order matters: each phase keeps everything the earlier ones put on screen. Medium skips sneak and slash. */
const PHASES = ['sneak', 'roll', 'pop', 'slash', 'cheer', 'slide', 'talk'] as const;
type Phase = (typeof PHASES)[number];

/** Hornet: out of the page element, dancing around, to its spot beside Tango. */
const FLY_MS = 2400;
const DARK_AT = 400;
const ROLL_AT = FLY_MS - 400;
const ROLL_MS = 1500;
const SLIDE_MS = 450;

/**
 * Four cuts across the hornet, top to bottom, as [left edge %, right edge %]
 * of its height. They never cross, so they leave five pieces.
 */
const CUTS: [number, number][] = [
  [26, 6],
  [44, 38],
  [72, 50],
  [88, 84],
];
/** When each cut lands, in ms after the slash starts (matches `tg-swing`). */
const CUT_MS = [150, 260, 370, 480];
const PIECES_FLY_MS = 540;
/** Where each piece flies (x px, y px, rotation deg), top to bottom. */
const PIECE_FLY: [number, number, number][] = [
  [-90, -320, -34],
  [-330, -170, 24],
  [-400, 20, -18],
  [-310, 220, 28],
  [-80, 330, -24],
];
/** Hornet image height / width, for the cut angles. */
const HORNET_ASPECT = 207 / 320;
const SLASH_MS = PIECES_FLY_MS + 1100;
const SLASH_AT = ROLL_AT + ROLL_MS + 650;
/** Phase start times, in ms from mount. Cheer (cape and brag) waits for Next. */
const TIMELINE: Record<'high' | 'medium', [Phase, number][]> = {
  high: [
    ['roll', ROLL_AT],
    ['pop', ROLL_AT + ROLL_MS],
    ['slash', SLASH_AT],
    ['cheer', SLASH_AT + SLASH_MS],
  ],
  medium: [
    ['pop', ROLL_MS],
    ['cheer', ROLL_MS + 500],
  ],
};

const asset = (p: string) => (browser.runtime.getURL as (p: string) => string)(p);

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Medium / high risk warning. High: a hornet sneaks out of the page and dances
 * around while the page darkens, then Tango rolls in and slays it. Medium:
 * Tango rolls in. Both then explain the risk and share a T-Mobile tip.
 */
export function TangoAlert({ report, lurk, onLeave, onContinue, sound }: Props) {
  const high = report.risk_level === 'high';
  const [phase, setPhase] = useState<Phase>(high ? 'sneak' : 'roll');
  const [dark, setDark] = useState(!high);
  const [step, setStep] = useState<'why' | 'tip' | 'confirm'>('why');
  const [reportOpen, setReportOpen] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const reached = (p: Phase) => PHASES.indexOf(phase) >= PHASES.indexOf(p);

  useLayoutEffect(() => {
    const fly = flyRef.current;
    if (!high || !fly || reducedMotion()) return;
    const anim = fly.animate(flightPath(fly.parentElement!.getBoundingClientRect(), lurk), {
      duration: FLY_MS,
      fill: 'both',
    });
    return () => anim.cancel();
  }, [high, lurk]);

  useEffect(() => {
    if (reducedMotion()) {
      setDark(true);
      setPhase('cheer');
      return;
    }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    if (high) at(DARK_AT, () => setDark(true));
    else sound('scrape', 'play');
    for (const [p, ms] of TIMELINE[high ? 'high' : 'medium']) {
      at(ms, () => {
        if (p === 'roll') sound('scrape', 'play');
        if (p === 'pop') {
          sound('scrape', 'stop');
          sound('pop', 'play');
        }
        if (p === 'cheer') sound('pop', 'play');
        setPhase(p);
      });
      if (p === 'slash') for (const cut of CUT_MS) at(ms + cut, () => sound('slash', 'play'));
    }
    return () => {
      timers.forEach(clearTimeout);
      sound('scrape', 'stop');
    };
  }, [high, sound]);

  useEffect(() => {
    if ((phase === 'talk' || phase === 'cheer') && !reportOpen) nextRef.current?.focus();
  }, [phase, step, reportOpen]);

  const endCheer = () => {
    if (reducedMotion()) return setPhase('talk');
    setPhase('slide');
    window.setTimeout(() => setPhase('talk'), SLIDE_MS);
  };

  const tip = tipFor(report);
  const brag = bragFor(report);
  const risky = report.reasons.filter(r => r.severity !== 'info');
  const why = (risky.length ? risky : report.reasons).slice(0, 4);
  const sceneClass = [
    'tg-scene',
    high && 'tg-high',
    reached('pop') && 'tg-landed tg-popped',
    phase === 'slash' && 'tg-slash',
    phase === 'cheer' && 'tg-cheer',
    reached('cheer') && 'tg-talking',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className={`tg-dim${dark ? ' tg-dark' : ''}${high ? '' : ' tg-dim-fast'}`} />
      {high && phase === 'sneak' && (
        <div className="tg-lurk" style={{ left: lurk.x, top: lurk.y, width: lurk.w, height: lurk.h }} aria-hidden />
      )}
      <div
        className={sceneClass}
        style={reportOpen ? { visibility: 'hidden' } : undefined}
        role="alertdialog"
        aria-modal
        aria-labelledby="tg-say-title"
        aria-describedby="tg-say"
      >
        {high && !reached('cheer') && (
          <div className="tg-hornet-spot" aria-hidden>
            <div className="tg-hornet">
              <div className="tg-hornet-fly" ref={flyRef}>
                <div className="tg-hornet-bob">
                  {PIECE_FLY.map(([x, y, r], i) => (
                    <div key={i} className="tg-piece" style={pieceStyle(i, x, y, r)}>
                      <Hornet />
                    </div>
                  ))}
                </div>
              </div>
              {phase === 'slash' &&
                CUTS.map(([l, r], i) => (
                  <div
                    key={i}
                    className="tg-streak"
                    style={{
                      top: `${(l + r) / 2}%`,
                      transformOrigin: i % 2 ? 'left center' : 'right center',
                      ['--a' as string]: `${(Math.atan(((r - l) / 100) * HORNET_ASPECT) * 180) / Math.PI}deg`,
                      ['--d' as string]: `${(CUT_MS[i] ?? 0) - 60}ms`,
                    }}
                  />
                ))}
            </div>
          </div>
        )}

        {reached('roll') && (
          <div className="tg-anchor">
            <div className="tg-rig">
              <span className="tg-limb tg-leg-l">
                <img src={asset('/tango/leg-left.png')} alt="" draggable={false} />
              </span>
              <span className="tg-limb tg-leg-r">
                <img src={asset('/tango/leg-right.png')} alt="" draggable={false} />
              </span>
              {high ? (
                <span className="tg-limb tg-arm-sword">
                  <img src={asset('/tango/arm-sword.png')} alt="" draggable={false} />
                </span>
              ) : (
                <span className="tg-limb tg-arm-hip">
                  <img src={asset('/tango/arm-hip.png')} alt="" draggable={false} />
                </span>
              )}
              <span className="tg-limb tg-arm-point">
                <img src={asset('/tango/arm-point.png')} alt="" draggable={false} />
              </span>
              {phase === 'cheer' && (
                <span className="tg-cape" aria-hidden>
                  <TMobileMark />
                </span>
              )}
              <div className="tg-body">
                <Character mood={high ? 'angry' : 'suspicious'} size={150} />
                {(phase === 'cheer' || reached('talk')) && (
                  <span className="tg-tmo-pin" title="T-Mobile">
                    <TMobileMark />
                  </span>
                )}
              </div>
            </div>

            {phase === 'cheer' && (
              <div className="tg-bubble tg-brag" role="status" aria-labelledby="tg-brag-tmo">
                <TMobileLogo />
                <p id="tg-brag-tmo"><strong>{brag.tmo}</strong> {brag.tango}</p>
                <div className="tg-actions">
                  <span />
                  <button className="pg-btn" ref={nextRef} onClick={endCheer}>
                    Next
                  </button>
                </div>
              </div>
            )}

            {phase === 'talk' && (
              <div className="tg-bubble" key={step}>
                {step === 'why' && (
                  <>
                    <span className={`pg-pill pg-pill-${report.risk_level}`}>{LEVEL_LABEL[report.risk_level]} risk</span>
                    <p className="tg-say-title" id="tg-say-title">
                      {report.headline}
                    </p>
                    {why.length > 0 && (
                      <ul className="tg-reasons" id="tg-say">
                        {why.map(r => (
                          <li key={r.title} className={`tg-sev-${r.severity}`}>
                            {r.title}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="tg-actions">
                      <button className="pg-link" onClick={() => setReportOpen(true)}>
                        Full report
                      </button>
                      <button className="pg-btn" ref={nextRef} onClick={() => setStep('tip')}>
                        Next
                      </button>
                    </div>
                  </>
                )}
                {step === 'tip' && (
                  <>
                    <span className="pg-pill tg-pill-tmo"><TMobileLogo /> tip</span>
                    <p className="tg-say-title" id="tg-say-title">
                      {tip.title}
                    </p>
                    <p className="tg-say" id="tg-say">
                      {tip.text}{' '}
                      <a href={tip.url} target="_blank" rel="noreferrer">
                        Learn more
                      </a>
                    </p>
                    <div className="tg-actions">
                      <button className="pg-link" onClick={() => setStep('confirm')}>
                        Continue to site
                      </button>
                      <span className="tg-actions-btns">
                        <button className="pg-btn tg-btn-dash" onClick={() => window.open(dashboardUrl(report, document.title), '_blank', 'noopener')}>
                          Dashboard
                        </button>
                        <button className="pg-btn" ref={nextRef} onClick={onLeave}>
                          Leave site
                        </button>
                      </span>
                    </div>
                  </>
                )}
                {step === 'confirm' && (
                  <>
                    <span className={`pg-pill pg-pill-${report.risk_level}`}>{LEVEL_LABEL[report.risk_level]} risk</span>
                    <p className="tg-say-title" id="tg-say-title">
                      Continue to {report.domain}?
                    </p>
                    <p className="tg-say" id="tg-say">
                      {report.headline}
                    </p>
                    <div className="tg-actions">
                      <span className="tg-actions-links">
                        <button className="pg-link" onClick={() => setStep('tip')}>
                          Back
                        </button>
                        <button className="pg-link tg-link-danger" onClick={onContinue}>
                          Continue anyway
                        </button>
                      </span>
                      <button className="pg-btn" ref={nextRef} onClick={onLeave}>
                        Leave site
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {reportOpen && (
        <div className="tg-report">
          <RiskReport
            report={report}
            onClose={() => setReportOpen(false)}
            secondary={{
              label: 'Continue to site anyway',
              onClick: () => {
                setReportOpen(false);
                setStep('confirm');
              },
            }}
            primary={{ label: '← Leave this website', onClick: onLeave }}
          />
        </div>
      )}
    </>
  );
}

/** Piece `i` of the hornet: the band between cut i-1 and cut i, plus where it flies. */
function pieceStyle(i: number, x: number, y: number, r: number): CSSProperties {
  const [tl, tr] = CUTS[i - 1] ?? [0, 0];
  const [bl, br] = CUTS[i] ?? [100, 100];
  return {
    clipPath: `polygon(0 ${tl}%, 100% ${tr}%, 100% ${br}%, 0 ${bl}%)`,
    ['--tx' as string]: `${x}px`,
    ['--ty' as string]: `${y}px`,
    ['--r' as string]: `${r}deg`,
    ['--fd' as string]: `${PIECES_FLY_MS}ms`,
  };
}

/**
 * Keyframes for the hornet's wrapper, relative to where it ends up (`end`):
 * peek out of the page element, duck back, slip out, then dance around the
 * screen growing to full size.
 */
function flightPath(end: DOMRect, from: Rect): Keyframe[] {
  const ex = end.left + end.width / 2;
  const ey = end.top + end.height / 2;
  const small = Math.min(1, 80 / end.width);
  const grow = (k: number) => small + (1 - small) * k;
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  const vw = innerWidth;
  const vh = innerHeight;
  const frame = (offset: number, x: number, y: number, s: number, r = 0, opacity = 1): Keyframe => ({
    offset,
    opacity,
    easing: 'ease-in-out',
    transform: `translate(${x - ex}px, ${y - ey}px) rotate(${r}deg) scale(${s})`,
  });
  return [
    frame(0, cx, cy, small * 0.2, 0, 0),
    frame(0.06, cx, from.y + 4, small, -12),
    frame(0.11, cx + 6, cy, small * 0.4, 8, 0.6),
    frame(0.17, from.x + from.w - 6, from.y + 4, small, 16),
    frame(0.38, vw * 0.7, vh * 0.25, grow(0.3), -20),
    frame(0.58, vw * 0.78, vh * 0.65, grow(0.55), 18),
    frame(0.8, vw * 0.3, vh * 0.6, grow(0.8), -16),
    frame(1, ex, ey, 1, 0),
  ];
}

function Hornet() {
  return <img src={asset('/tango/hornet.png')} alt="" draggable={false} />;
}