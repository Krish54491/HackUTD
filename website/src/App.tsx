import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ScanLine, X, Crown, Trophy, Flame, Swords, ArrowUpRight, Award, Lock, Sun, Moon, Fish, Users, Skull, Gem, type LucideIcon } from 'lucide-react';
import { members } from './data';
import { scanWebsite, type SiteReport } from './scan';
import { Hornet } from './Hornet';
import { Trophies } from './Trophies';
import { TMobileLogo } from './TMobileLogo';
import { NewCatch, catchFromUrl } from './NewCatch';
import { TIERS, badges as baseBadges, slain as seeded, tier, tierOf, tips, weekly, type Badge, type Slain, type TierId } from './hive';

const BADGE_ICON: Record<string, LucideIcon> = { first: Crown, century: Swords, giant: Skull, streak: Flame, phish: Fish, hive: Users, shelf: Trophy, million: Gem };
const badgeIcon = (b: Badge) => BADGE_ICON[b.id.startsWith('first-') ? 'first' : b.id] ?? Award;

type Route = 'home' | 'week';
const ME = 'QuietOrbit';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
const WEEK_START = '2026-11-02';
const routeFromHash = (): Route => (location.hash === '#week' ? 'week' : 'home');
const incoming = catchFromUrl();
const startHive = incoming ? seeded.filter(s => s.domain !== incoming.domain) : seeded;

function CharacterAvatar() {
  return <span className="character-avatar"><img src={`${import.meta.env.BASE_URL}characters/light-mode.png`} alt="" draggable={false} /></span>;
}

function Modal({ title, children, close, className = '' }: { title: string; children: ReactNode; close: () => void; className?: string }) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${className}`} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="modal-title"><h2 id={titleId}>{title}</h2><button aria-label="Close" onClick={close}><X size={20} /></button></div>{children}</dialog>;
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('tango-theme', theme); }, [theme]);
  const [filter, setFilter] = useState<TierId | 'all'>('all');
  const [selected, setSelected] = useState<Slain | null>(null);
  const [badge, setBadge] = useState<Badge | null>(null);
  const [slain, setSlain] = useState<Slain[]>(startHive);
  const [newCatch, setNewCatch] = useState<Slain | null>(incoming);
  const [fresh, setFresh] = useState<string | null>(null);
  const [board, setBoard] = useState<'week' | 'all'>('all');
  const [checker, setChecker] = useState(false);
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SiteReport | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const on = () => { setRoute(routeFromHash()); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => { removeEventListener('hashchange', on); abort.current?.abort(); };
  }, []);

  const go = (r: Route) => { location.hash = r === 'week' ? 'week' : ''; setRoute(r); };

  const inBoard = (h: Slain[]) => (board === 'all' ? h.length : h.filter(s => s.date >= WEEK_START).length);
  const scale = inBoard(seeded) / 42;
  const ranked = members.map(m => m.alias === ME ? { ...m, self: true, score: inBoard(slain) } : { ...m, self: false, score: Math.round(m.scores * scale) }).sort((a, b) => b.score - a.score);
  const rank = ranked.findIndex(m => m.self) + 1;
  const shown = slain.filter(s => filter === 'all' || tierOf(s).id === filter);
  const legendary = slain.filter(s => tierOf(s).id === 'legendary').length;
  const mythic = slain.some(s => s.mythic);
  const badges: Badge[] = [
    ...slain.filter(s => s.first).map(s => ({ id: `first-${s.id}`, name: 'First slayer', detail: s.title, tier: 'legendary' as const, earned: true, domain: s.domain, date: s.date })),
    ...baseBadges.map(b => (b.id === 'giant' ? { ...b, earned: legendary > 0 } : b.id === 'million' ? { ...b, earned: mythic } : b)),
  ];
  const earned = badges.filter(b => b.earned).length;
  const caught = slain.filter(s => s.id.startsWith('new-')).map(s => ({ id: s.id, alias: ME, domain: s.domain, title: s.title, category: s.category, date: s.date, reports: s.reports, mythic: s.mythic }));

  function closeChecker() { abort.current?.abort(); setChecker(false); setChecking(false); }
  async function submitScan(e: React.FormEvent) {
    e.preventDefault(); abort.current?.abort();
    const c = new AbortController(); abort.current = c;
    setChecking(true); setError(''); setReport(null);
    try { const r = await scanWebsite(url, c.signal); if (!c.signal.aborted) setReport(r); }
    catch (err) { if (!c.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to connect to Tango.'); }
    finally { if (!c.signal.aborted) setChecking(false); }
  }

  return <div className="app">
    <div className="streaks" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <header className="topbar">
      <button className="brand" onClick={() => go('home')}><CharacterAvatar />tango<span>.</span></button>
      <nav>
        <button className={route === 'home' ? 'active' : ''} onClick={() => go('home')}>Home</button>
        <button className={route === 'week' ? 'active' : ''} onClick={() => go('week')}>Hornets of the Week</button>
      </nav>
      <div className="header-actions">
        <button className="theme-toggle" aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button className="neon-button" onClick={() => { setChecker(true); setError(''); setReport(null); }}><ScanLine size={16} />Check a site</button>
        <span className="me"><span className="avatar">QO</span>{ME}</span>
      </div>
    </header>

    {route === 'week' ? <main><Trophies me={ME} caught={caught} /><footer><span>tango<b>.</b></span><span>HackUTD 2026 · Zero Day</span></footer></main> : (
      <main className="fit">
        <section className="hero">
          <h1 className={mythic ? 'glitch mythic-glow' : 'glitch'} data-text={`You slew ${slain.length} hornets`}>You slew {slain.length} hornets</h1>
          <div className="stats">
            <div><Trophy size={16} /><strong>#{rank}</strong><span>Rank</span></div>
            <div><Crown size={16} /><strong>{legendary}</strong><span>Legendary</span></div>
            <div><Flame size={16} /><strong>7</strong><span>Day streak</span></div>
            <div><Award size={16} /><strong>{earned}</strong><span>Badges</span></div>
          </div>
        </section>

        <div className="home-grid">
          <div className="col">
            <section className="panel tips">
              <div className="panel-head"><h2 className="tmo-head"><TMobileLogo />Tips</h2></div>
              <div className="tip-list scroll">
                {tips.map(t => <article key={t.id} className="tip">
                  <span className="trend">{t.trend} · {t.count} this week</span>
                  <h3>{t.title}</h3>
                  <p>{t.action}</p>
                  <a href={t.href} target="_blank" rel="noreferrer">{t.link}<ArrowUpRight size={13} /></a>
                </article>)}
              </div>
            </section>

            <section className="panel badges">
              <div className="panel-head"><h2><Award size={18} />Badges</h2><span className="muted">{earned}/{badges.length}</span></div>
              <div className="badge-grid scroll">
                {badges.map(b => { const Icon = badgeIcon(b); return (
                  <button key={b.id} className={b.earned ? 'badge-icon' : 'badge-icon locked'} style={{ ['--c' as string]: tier(b.tier).color }} aria-label={b.name} title={b.name} onClick={() => setBadge(b)}>
                    <Icon size={20} />
                    {!b.earned && <span className="badge-lock"><Lock size={10} /></span>}
                  </button>
                ); })}
              </div>
            </section>
          </div>

          <section className="panel hive">
            <div className="panel-head">
              <h2><Swords size={18} />The Hive</h2>
              <div className="chips">
                <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>All {slain.length}</button>
                {TIERS.map(t => { const n = slain.filter(s => tierOf(s).id === t.id).length; if (t.id === 'mythic' && !n) return null; return <button key={t.id} style={{ ['--c' as string]: t.color }} className={filter === t.id ? 'chip active' : 'chip'} onClick={() => setFilter(t.id)}>{t.name} {n}</button>; })}
              </div>
            </div>
            <div className="hive-grid scroll">
              {shown.map(s => { const t = tierOf(s); return (
                <button key={s.id} className={`hornet-card tier-${t.id}${s.id === fresh ? ' fresh' : ''}`} style={{ ['--c' as string]: t.color }} onClick={() => setSelected(s)}>
                  {s.first && <span className="first-flag"><Crown size={11} />First</span>}
                  <div className="hornet-stage"><Hornet tierId={t.id} size={84} dead /><span className="slash" /></div>
                  <span className="tier-pill">{t.name}</span>
                  <strong>{s.title}</strong>
                  <small>{fmtDate(s.date)} · {s.category}</small>
                </button>
              ); })}
            </div>
          </section>

          <div className="col">
            <section className="panel board">
              <div className="panel-head">
                <h2><Trophy size={18} />Leaderboard</h2>
                <div className="segmented small">
                  <button className={board === 'week' ? 'active' : ''} onClick={() => setBoard('week')}>Week</button>
                  <button className={board === 'all' ? 'active' : ''} onClick={() => setBoard('all')}>All time</button>
                </div>
              </div>
              <ol className="ranks scroll">
                {ranked.map((m, i) => (
                  <li key={m.alias} className={`${m.self ? 'you' : ''}${m.self && mythic ? ' mythic' : ''} ${i < 3 ? `podium p${i + 1}` : ''}`}>
                    <span className="pos">{String(i + 1).padStart(2, '0')}</span>
                    <span className="avatar small">{m.alias.match(/[A-Z]/g)?.join('').slice(0, 2)}</span>
                    <span className="alias">{m.alias}{m.self && <em>You</em>}{m.self && mythic && <em className="million-tag"><Gem size={10} />1 in 1M</em>}</span>
                    <b>{m.score}</b>
                  </li>
                ))}
              </ol>
            </section>

            <button className="panel week-cta" onClick={() => go('week')}>
              <div className="panel-head"><h2><Crown size={18} />Hornets of the Week</h2><ArrowUpRight size={16} /></div>
              <div className="mini-shelf">
                {[...caught, ...weekly].slice(0, 3).map(w => { const t = tierOf(w); return (
                  <div key={w.id} className="mini-trophy" style={{ ['--c' as string]: t.color }}>
                    <Hornet tierId={t.id} size={70} flutter />
                    <span className="mini-pedestal" />
                    <strong>{w.alias}</strong>
                    <small>{t.name}</small>
                  </div>
                ); })}
              </div>
            </button>
          </div>
        </div>
    </main>
    )}

    {newCatch && route === 'home' && <NewCatch hornet={newCatch} onDone={() => {
      setSlain(h => [newCatch, ...h]);
      setFilter('all');
      setFresh(newCatch.id);
      setNewCatch(null);
      document.querySelector('.hive-grid')?.scrollTo({ top: 0 });
    }} />}

    {selected && (() => { const t = tierOf(selected); return (
      <Modal title={selected.title} close={() => setSelected(null)} className="slain-modal">
        <div className="slain-hero" style={{ ['--c' as string]: t.color }}>
          <Hornet tierId={t.id} size={170} dead />
          <div>
            <span className="tier-pill">{t.name}</span>
            <h3>{t.species}</h3>
            <p className="latin">{t.latin}</p>
            {selected.first && <span className="first-flag inline"><Crown size={12} />First slayer</span>}
          </div>
        </div>
        <dl className="facts">
          <div><dt>Slain</dt><dd>{fmtDate(selected.date)}, {fmtTime(selected.date)}</dd></div>
          <div><dt>Type</dt><dd>{selected.category}</dd></div>
          <div><dt>Reports</dt><dd>{selected.reports === 0 ? 'First' : selected.reports.toLocaleString()}</dd></div>
          <div><dt>Status</dt><dd>Blocked</dd></div>
        </dl>
        <ul className="reasons">{selected.reasons.map(r => <li key={r}>{r}</li>)}</ul>
      </Modal>
    ); })()}

    {badge && (() => { const Icon = badgeIcon(badge); return (
      <Modal title={badge.name} close={() => setBadge(null)} className="badge-modal">
        <div className={badge.earned ? 'badge-hero' : 'badge-hero locked'} style={{ ['--c' as string]: tier(badge.tier).color }}>
          <span className={badge.earned ? 'badge-icon big' : 'badge-icon big locked'}><Icon size={44} /></span>
          <div>
            <span className="tier-pill">{tier(badge.tier).name}</span>
            <h3>{badge.detail}</h3>
          </div>
        </div>
        <dl className="facts">
          <div><dt>Status</dt><dd>{badge.earned ? 'Earned' : 'Locked'}</dd></div>
          {badge.date && <div><dt>Earned</dt><dd>{fmtDate(badge.date)}</dd></div>}
        </dl>
      </Modal>
    ); })()}

    {checker && <Modal title="Check a site" close={closeChecker}>
      <form onSubmit={submitScan}>
        <label className="field">Site<input required type="text" placeholder="example.com" value={url} onChange={e => setUrl(e.target.value)} disabled={checking} /></label>
        <button type="submit" className="neon-button wide" disabled={checking}><ScanLine size={16} />{checking ? 'Checking…' : 'Check'}</button>
      </form>
      {checking && <p role="status" className="muted">Checking… up to 2 minutes.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {report && <div className="report" role="status">
        <span className={`tier-pill risk-${report.risk_level}`}>{report.risk_level === 'none' ? 'No risk found' : `${report.risk_level} risk`} · {report.score}/100</span>
        <h3>{report.headline}</h3>
        <ul className="reasons">{report.reasons.map((r, i) => <li key={i}><strong>{r.title}</strong> {r.detail}</li>)}</ul>
        <small className="muted">Confidence: {report.confidence}</small>
      </div>}
    </Modal>}
  </div>;
}
