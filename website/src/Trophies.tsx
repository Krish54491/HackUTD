import { useState, type ReactElement } from 'react';
import { AtSign, Check, Crown, Trophy as TrophyIcon } from 'lucide-react';
import { Hornet } from './Hornet';
import { TIERS, tierOf, weekly as seededWeekly, type Trophy } from './hive';
import { shareTrophy, type Platform } from './shareCard';

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SHARES: { id: Platform; label: string; Icon: () => ReactElement }[] = [
  { id: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { id: 'x', label: 'X', Icon: XIcon },
  { id: 'threads', label: 'Threads', Icon: () => <AtSign size={15} /> },
];

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric' });

export function Trophies({ me, caught = [] }: { me: string; caught?: Trophy[] }) {
  const weekly = [...caught, ...seededWeekly];
  const shelves = [...TIERS].reverse().filter(t => weekly.some(w => tierOf(w).id === t.id));
  const [mine, setMine] = useState(false);
  const [shared, setShared] = useState<{ id: string; platform: Platform; how: 'busy' | 'shared' | 'copied' } | null>(null);
  const featured = weekly[0];
  const ft = tierOf(featured);
  const list = weekly.filter(w => !mine || w.alias === me);

  async function share(w: Trophy, platform: Platform) {
    setShared({ id: w.id, platform, how: 'busy' });
    try {
      const how = await shareTrophy(platform, w, tierOf(w), w.id === featured.id);
      setShared({ id: w.id, platform, how });
      setTimeout(() => setShared(s => (s?.id === w.id ? null : s)), 5000);
    } catch {
      setShared(null);
    }
  }

  const status = (w: Trophy) => {
    if (shared?.id !== w.id) return null;
    if (shared.how === 'busy') return 'Making image…';
    if (shared.how === 'shared') return 'Shared';
    return shared.platform === 'instagram' ? 'Image saved' : 'Image copied';
  };

  const ShareButton = ({ w }: { w: Trophy }) => {
    if (w.alias !== me) return null;
    const busy = shared?.id === w.id && shared.how === 'busy';
    const s = status(w);
    return (
      <div className="share-row">
        {SHARES.map(({ id, label, Icon }) => (
          <button key={id} className={`show-off share-${id}`} onClick={() => share(w, id)} disabled={busy} aria-label={`Post to ${label}`} title={`Post to ${label}`}>
            <Icon />
          </button>
        ))}
        {s && <span className="share-status" role="status">{shared?.how !== 'busy' && <Check size={12} />}{s}</span>}
      </div>
    );
  };

  return (
    <div className="week">
      <div className="week-head">
        <div>
          <span className="eyebrow"><TrophyIcon size={14} /> Nov 1–7, 2026</span>
          <h1 className="glitch" data-text="Hornets of the Week">Hornets of the Week</h1>
        </div>
        <div className="segmented">
          <button className={!mine ? 'active' : ''} onClick={() => setMine(false)}>Everyone</button>
          <button className={mine ? 'active' : ''} onClick={() => setMine(true)}>Mine</button>
        </div>
      </div>

      <section className="featured" style={{ ['--c' as string]: ft.color }}>
        <div className="spotlight" />
        <div className="featured-case">
          <Hornet tierId={ft.id} size={240} flutter />
          <div className="pedestal big" />
        </div>
        <div className="featured-info">
          <span className="ribbon"><Crown size={14} />Hornet of the week</span>
          <span className="tier-pill">{ft.name}</span>
          <h2>{ft.species}</h2>
          <p className="latin">{ft.latin}</p>
          <dl>
            <div><dt>Hunter</dt><dd>{featured.alias}{featured.alias === me && <em>You</em>}</dd></div>
            <div><dt>Scam</dt><dd>{featured.title}</dd></div>
            <div><dt>Slain</dt><dd>{fmt(featured.date)}</dd></div>
            <div><dt>Reports</dt><dd>{featured.reports === 0 ? 'First' : featured.reports}</dd></div>
          </dl>
          <ShareButton w={featured} />
        </div>
      </section>

      {shelves.map(t => {
        const items = list.filter(w => tierOf(w).id === t.id);
        if (!items.length) return null;
        return (
          <section key={t.id} className="shelf" style={{ ['--c' as string]: t.color }}>
            <div className="shelf-head"><h2>{t.name}</h2><span>{t.species}</span><b>{items.length}</b></div>
            <div className="shelf-row">
              {items.map(w => (
                <article key={w.id} className={w.alias === me ? 'trophy mine' : 'trophy'}>
                  <div className="case">
                    <div className="case-light" />
                    <Hornet tierId={t.id} size={130} flutter />
                    <div className="pedestal" />
                  </div>
                  <div className="plaque">
                    <strong>{w.alias}{w.alias === me && <em>You</em>}</strong>
                    <span>{w.title}</span>
                    <span className="muted">{w.category}</span>
                    <small>{fmt(w.date)} · {w.reports === 0 ? 'First report' : `${w.reports} report${w.reports === 1 ? '' : 's'}`}</small>
                  </div>
                  <ShareButton w={w} />
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
