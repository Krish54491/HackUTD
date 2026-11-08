/**
 * Puts Protego's popup in the browser's TOP LAYER, above anything a z-index can
 * reach: the page's own modal <dialog>s, popovers and fullscreen elements.
 *
 * A z-index alone loses to those, so the popup lives inside its own modal
 * <dialog>. If the page opens a top-layer element of its own later, the dialog
 * is re-opened so it goes back on top (the most recently opened wins).
 * Escape and other "close requests" are ignored; only Protego's buttons close it.
 */
const ATTR = 'data-protego-layer';
const IMPORTANT_STYLES: Record<string, string> = {
  position: 'fixed',
  inset: '0',
  width: '100vw',
  height: '100vh',
  'max-width': 'none',
  'max-height': 'none',
  margin: '0',
  padding: '0',
  border: '0',
  background: 'transparent',
  overflow: 'visible',
  color: 'inherit',
  'z-index': '2147483647',
  display: 'block',
  opacity: '1',
  visibility: 'visible',
};

export type TopLayer = { el: HTMLDialogElement; open: () => void; destroy: () => void };

export function createTopLayer(): TopLayer {
  const dialog = document.createElement('dialog');
  dialog.setAttribute(ATTR, '');
  dialog.setAttribute('closedby', 'none'); // Chrome 134+: no Escape / light dismiss
  dialog.setAttribute('aria-label', 'Protego security check');
  for (const [k, v] of Object.entries(IMPORTANT_STYLES)) dialog.style.setProperty(k, v, 'important');

  // The default ::backdrop would double-dim; ours is drawn inside the shadow root.
  const style = document.createElement('style');
  style.textContent = `dialog[${ATTR}]::backdrop{background:transparent!important}`;
  dialog.append(style);

  let alive = true;
  const show = () => {
    if (!alive || !dialog.isConnected) return;
    try {
      if (dialog.open) dialog.close(); // re-stack: close + reopen moves it to the top
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', ''); // very old browsers: still visible, z-index does the rest
    }
  };

  // Escape / close requests: refuse. If something closes it anyway, put it back.
  const onCancel = (e: Event) => e.preventDefault();
  // A re-stack reopens synchronously, so by the time any 'close' event runs the dialog is open again.
  const onClose = () => {
    if (alive && !dialog.open) queueMicrotask(show);
  };
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('close', onClose);

  // Re-stack above top-layer elements the page opens after us.
  const others = () =>
    [...document.querySelectorAll(':modal, :popover-open, :fullscreen')].filter(el => el !== dialog && !dialog.contains(el));
  let seen = new Set<Element>(others());
  // Watchdog: re-stack above anything new, and reopen if something closed us.
  // (Chrome doesn't always fire 'close' after a close + reopen, so don't rely on the event alone.)
  const timer = window.setInterval(() => {
    const now = others();
    if (!dialog.open || now.some(el => !seen.has(el))) show();
    seen = new Set(now);
  }, 300);

  return {
    el: dialog,
    open() {
      if (!dialog.isConnected) document.documentElement.append(dialog);
      show();
    },
    destroy() {
      alive = false;
      clearInterval(timer);
      dialog.removeEventListener('close', onClose);
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}
