import { useState } from 'react';
import { Flag, LockKeyhole } from 'lucide-react';
import { MAX_REPORT_NOTE, REPORT_CATEGORIES, reportSite, reportsLabel, type CommunityFlag, type ReportCategory } from './report';

/** Body of the "Report a hornet" dialog. Shared by the sidebar, the dashboard card and the website checker. */
export function ReportHornet({ initial, close }: { initial: string; close: () => void }) {
  const [site, setSite] = useState(initial);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<CommunityFlag | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return setError('Choose what kind of scam it looks like.');
    setSending(true); setError('');
    try { setDone(await reportSite(site, category, note)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to connect to Tango.'); }
    finally { setSending(false); }
  }
  if (done) return <div className="report-done" role="status">
    <img src={`${import.meta.env.BASE_URL}characters/light-mode.png`} alt="" draggable={false}/>
    <h3>Hornet reported. Thanks for the heads-up!</h3>
    <p>Your report is in the Hornet’s Nest, where it helps keep the whole community safe.</p>
    <span className="badge">{done.domain}</span>
    <p>{reportsLabel(done.reports)} reported this site.</p>
    <button className="pink-button" onClick={close}>Done</button>
  </div>;
  return <form onSubmit={submit}>
    <p>Think a website is a scam that Tango missed? Let the hive know so others can steer clear.</p>
    <label className="field-label">Website address<input required type="text" placeholder="example.com" value={site} onChange={e=>setSite(e.target.value)} disabled={sending}/></label>
    <fieldset className="report-kinds" disabled={sending}><legend className="field-label">What kind of scam?</legend><div role="radiogroup" aria-label="Scam type">{REPORT_CATEGORIES.map(c=><button type="button" key={c.id} role="radio" aria-checked={category===c.id} className={category===c.id?'chip active':'chip'} onClick={()=>{setCategory(c.id);setError('');}}>{c.label}</button>)}</div></fieldset>
    <label className="field-label"><span>What happened? <span className="optional">(optional)</span></span><textarea rows={3} maxLength={MAX_REPORT_NOTE} placeholder="e.g. It asked for my bank login" value={note} onChange={e=>setNote(e.target.value)} disabled={sending}/><small>{note.length}/{MAX_REPORT_NOTE}</small></label>
    <p className="report-privacy"><LockKeyhole size={14}/>Only the website, category and your note are sent. Other people only see how many times a site was reported.</p>
    {error&&<p role="alert" className="error">{error}</p>}
    <button type="submit" className="pink-button" disabled={sending}><Flag size={15}/>{sending?'Sending report…':'Report this site'}</button>
  </form>;
}
