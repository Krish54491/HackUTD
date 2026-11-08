/**
 * Fake listing detection on job, scholarship and rental boards.
 * Extracts listing cards, asks Spacetime (via the background) for verdicts,
 * and collapses suspicious cards into a small stub that can be revealed.
 */
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { extractCards, extractDetail, siteForHost, type ExtractedCard } from '@/lib/listing-sites';
import { sha256Hex } from '@/lib/domain';
import { bg } from '@/lib/messaging';
import type { ListingItem, ListingResult, TabMessage } from '@/lib/types';

const HIDDEN_ATTR = 'data-protego-hidden';
const STUB_CLASS = 'protego-listing-stub';
const BANNER_CLASS = 'protego-listing-banner';
/** Bump when the classifier changes, so old cached "looks fine" verdicts aren't reused. */
const KEY_VERSION = 'v2';

export default defineContentScript({
  // All of LinkedIn (not just /jobs): it's a single-page app, so users often arrive from /feed.
  matches: ['*://*.linkedin.com/*', '*://*.zillow.com/*', '*://*.apartments.com/*'],
  runAt: 'document_idle',

  async main(ctx) {
    const site = siteForHost(new URL(location.href));
    if (!site) return;

    let enabled = await bg<boolean>({ type: 'GET_LISTINGS_ENABLED', site: site.site }).catch(() => true);
    const verdicts = new Map<string, ListingResult>(); // key -> verdict
    const pending = new Set<string>();
    const keyOf = new WeakMap<Element, string>();
    const blocked = new Map<string, { key: string; title: string; reason: string }>();

    async function keyFor(c: ExtractedCard) {
      const cached = keyOf.get(c.el);
      if (cached) return cached;
      const k = (await sha256Hex(`${KEY_VERSION}|${site!.site}|${c.id}|${c.title}|${c.company}`)).slice(0, 40);
      keyOf.set(c.el, k);
      return k;
    }

    function hide(c: ExtractedCard, v: ListingResult) {
      if (c.el.hasAttribute(HIDDEN_ATTR)) return;
      c.el.setAttribute(HIDDEN_ATTR, '1');
      c.el.style.setProperty('display', 'none', 'important');
      const stub = document.createElement('div');
      stub.className = STUB_CLASS;
      stub.setAttribute('style', [
        'display:flex', 'align-items:center', 'gap:8px', 'padding:8px 12px', 'margin:4px 0',
        'border:1px dashed #E20074', 'border-radius:8px', 'background:#fff5fa', 'color:#15151a',
        'font:400 12px/1.4 Inter,Segoe UI,system-ui,sans-serif',
      ].join(';'));
      const msg = document.createElement('span');
      msg.style.flex = '1';
      msg.textContent = `Protego hid a suspicious listing: ${v.reason || 'multiple scam warning signs'}`;
      const show = document.createElement('button');
      show.textContent = 'Show anyway';
      show.setAttribute('style', 'all:unset;cursor:pointer;color:#E20074;font-weight:600;text-decoration:underline');
      show.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        c.el.style.removeProperty('display');
        c.el.setAttribute(HIDDEN_ATTR, 'revealed');
        stub.remove();
      };
      stub.append(msg, show);
      c.el.insertAdjacentElement('beforebegin', stub);
    }

    /** Warning over the open listing's description (the card list may not be visible). */
    function warnDetail(el: HTMLElement, id: string, v: ListingResult) {
      if (document.querySelector(`.${BANNER_CLASS}[data-id="${CSS.escape(id)}"]`)) return;
      const b = document.createElement('div');
      b.className = BANNER_CLASS;
      b.dataset.id = id;
      b.setAttribute('role', 'alert');
      b.setAttribute('style', [
        'display:flex', 'align-items:flex-start', 'gap:10px', 'padding:12px 14px', 'margin:0 0 12px',
        'border:2px solid #E20074', 'border-radius:10px', 'background:#fff5fa', 'color:#15151a',
        'font:400 13px/1.45 Inter,Segoe UI,system-ui,sans-serif',
      ].join(';'));
      const icon = document.createElement('img');
      icon.src = (browser.runtime.getURL as (p: string) => string)('/characters/angry.png');
      icon.setAttribute('style', 'width:44px;height:44px;border-radius:50%;flex:none');
      icon.alt = '';
      const text = document.createElement('div');
      const h = document.createElement('b');
      h.textContent = 'Protego: this listing looks like a scam';
      h.style.display = 'block';
      const p = document.createElement('span');
      p.textContent = `${v.reason || 'It shows several common scam warning signs.'} Don't send money, ID or bank details, and don't move the conversation off this site.`;
      text.append(h, p);
      b.append(icon, text);
      el.insertAdjacentElement('beforebegin', b);
    }

    function unhideAll() {
      document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}="1"]`).forEach(el => {
        el.style.removeProperty('display');
        el.removeAttribute(HIDDEN_ATTR);
      });
      document.querySelectorAll(`.${STUB_CLASS}, .${BANNER_CLASS}`).forEach(s => s.remove());
    }

    async function scan() {
      if (!enabled || (site!.active && !site!.active(new URL(location.href)))) return;
      const cards = extractCards(site!);
      const fresh: ListingItem[] = [];
      const byKey = new Map<string, ExtractedCard>();
      const rehidden: { key: string; title: string; reason: string }[] = [];
      for (const c of cards) {
        const key = await keyFor(c);
        byKey.set(key, c);
        const v = verdicts.get(key);
        if (v) {
          if (v.suspicious && c.el.getAttribute(HIDDEN_ATTR) !== 'revealed') {
            hide(c, v);
            if (!blocked.has(key)) {
              const b = { key, title: c.title, reason: v.reason };
              blocked.set(key, b);
              rehidden.push(b);
            }
          }
          continue;
        }
        if (pending.has(key)) continue;
        pending.add(key);
        fresh.push({ key, title: c.title, company: c.company, location: c.location, price: c.price, snippet: c.snippet, url: c.url });
      }

      // The open listing: its full description carries most of the scam tells.
      const d = extractDetail(site!, new URL(location.href));
      // SPA: the user opened another listing, so the old warning no longer applies.
      document.querySelectorAll<HTMLElement>(`.${BANNER_CLASS}`).forEach(b => b.dataset.id !== d?.id && b.remove());
      let detailKey: string | null = null;
      if (d) {
        detailKey = (await sha256Hex(`${KEY_VERSION}|${site!.site}|detail|${d.id}|${d.title}|${d.description.length}`)).slice(0, 40);
        const v = verdicts.get(detailKey);
        if (v?.suspicious) applyDetail(v);
        else if (!v && !pending.has(detailKey)) {
          pending.add(detailKey);
          fresh.unshift({ key: detailKey, title: d.title || c0Title(d.id), company: d.company, price: d.price, description: d.description, url: location.href.split('?')[0] });
        }
      }
      function c0Title(id: string) {
        return cards.find(c => c.id === id)?.title ?? 'Open listing';
      }
      /** Suspicious open listing: banner on the description, and hide its card in the list. */
      function applyDetail(v: ListingResult) {
        if (!d) return;
        warnDetail(d.el, d.id, v);
        for (const c of cards) if (c.id === d.id && c.el.getAttribute(HIDDEN_ATTR) !== 'revealed') hide(c, v);
        if (!blocked.has(v.key)) {
          const b = { key: v.key, title: d.title || c0Title(d.id), reason: v.reason };
          blocked.set(v.key, b);
          rehidden.push(b);
        }
      }
      if (rehidden.length) await bg({ type: 'LISTINGS_BLOCKED', site: site!.site, blocked: rehidden }).catch(() => {});
      if (!fresh.length) return;

      for (let i = 0; i < fresh.length; i += 40) {
        const chunk = fresh.slice(i, i + 40);
        try {
          const res = await bg<{ enabled: boolean; results: ListingResult[] }>({ type: 'CHECK_LISTINGS', site: site!.site, items: chunk });
          if (!res.enabled) {
            enabled = false;
            return;
          }
          const newlyBlocked: { key: string; title: string; reason: string }[] = [];
          for (const v of res.results) {
            verdicts.set(v.key, v);
            if (v.key === detailKey) {
              if (v.suspicious) {
                const before = rehidden.length;
                applyDetail(v);
                newlyBlocked.push(...rehidden.splice(before));
              }
              continue;
            }
            const c = byKey.get(v.key);
            if (v.suspicious && c) {
              hide(c, v);
              if (!blocked.has(v.key)) {
                const b = { key: v.key, title: c.title, reason: v.reason };
                blocked.set(v.key, b);
                newlyBlocked.push(b);
              }
            }
          }
          if (newlyBlocked.length) await bg({ type: 'LISTINGS_BLOCKED', site: site!.site, blocked: newlyBlocked });
        } catch (e) {
          console.debug('[protego] listing check failed', e);
        } finally {
          chunk.forEach(it => pending.delete(it.key));
        }
      }
    }

    // Infinite scroll / SPA navigation: rescan on DOM changes, debounced.
    let timer: number | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = ctx.setTimeout(() => void scan(), 900);
    };
    const observer = new MutationObserver(muts => {
      if (muts.some(m => [...m.addedNodes].some(n => n instanceof HTMLElement && !n.classList.contains(STUB_CLASS) && !n.classList.contains(BANNER_CLASS)))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());

    browser.runtime.onMessage.addListener((msg: TabMessage) => {
      if (msg.type !== 'LISTINGS_ENABLED_CHANGED') return;
      enabled = msg.enabled;
      if (enabled) {
        blocked.clear();
        void scan();
      } else {
        unhideAll();
      }
    });

    void scan();
  },
});
