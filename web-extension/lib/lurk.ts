/** Viewport rectangle, in CSS px. */
export type Rect = { x: number; y: number; w: number; h: number };

const BAIT = /buy|pay|checkout|order|sign ?in|log ?in|download|claim|cart|deal|offer|win|free/i;
const CANDIDATES = 'form, button, [type="submit"], [role="button"], a, input, img, video, iframe, h1, h2';

/**
 * The on-screen page element the hornet sneaks out of: preferably the thing
 * the scam wants you to use (payment form, buy button), else a big image or heading.
 * A visible `[data-tango-lurk]` element wins outright (used by the demo page).
 */
export function lurkSpot(): Rect {
  const vw = innerWidth;
  const vh = innerHeight;
  const pinned = document.querySelector<HTMLElement>('[data-tango-lurk]')?.getBoundingClientRect();
  if (pinned && pinned.width > 0 && pinned.bottom > 0 && pinned.top < vh) {
    return { x: pinned.left, y: pinned.top, w: pinned.width, h: pinned.height };
  }
  let best: Rect | null = null;
  let bestScore = 0;

  for (const el of document.querySelectorAll<HTMLElement>(CANDIDATES)) {
    const r = el.getBoundingClientRect();
    const x = Math.max(r.left, 0);
    const y = Math.max(r.top, 0);
    const w = Math.min(r.right, vw) - x;
    const h = Math.min(r.bottom, vh) - y;
    if (w < 40 || h < 20) continue;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;

    const area = (w * h) / (vw * vh);
    if (area > 0.6) continue;
    let score = 1 + Math.min(area * 10, 2);
    if (el.matches('form') && el.querySelector('input[type="password"], input[autocomplete^="cc"], input[name*="card" i]')) score += 6;
    if (el.matches('input[type="password"], input[autocomplete^="cc"]')) score += 4;
    if (el.matches('button, [type="submit"], [role="button"], a') && BAIT.test(el.textContent ?? '')) score += 5;
    if (el.matches('img, video')) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = { x, y, w, h };
    }
  }
  return best ?? { x: vw / 2 - 60, y: vh / 2 - 30, w: 120, h: 60 };
}
