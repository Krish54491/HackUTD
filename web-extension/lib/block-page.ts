/**
 * Make everything except the modal's host non-interactive and stop scrolling.
 * Returns a function that undoes exactly what it changed.
 */
export function blockPage(host: HTMLElement): () => void {
  const madeInert: HTMLElement[] = [];
  // Walk up from the host; at each level make every sibling inert.
  for (let node: HTMLElement | null = host; node && node !== document.documentElement; node = node.parentElement) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sib of Array.from(parent.children)) {
      if (sib !== node && sib instanceof HTMLElement && !sib.inert && sib.tagName !== 'HEAD') {
        sib.inert = true;
        madeInert.push(sib);
      }
    }
  }
  const html = document.documentElement;
  const body = document.body;
  const prev = { html: html.style.overflow, body: body?.style.overflow ?? '' };
  html.style.setProperty('overflow', 'hidden', 'important');
  body?.style.setProperty('overflow', 'hidden', 'important');
  (document.activeElement as HTMLElement | null)?.blur?.();

  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    madeInert.forEach(el => (el.inert = false));
    html.style.overflow = prev.html;
    if (body) body.style.overflow = prev.body;
  };
}
