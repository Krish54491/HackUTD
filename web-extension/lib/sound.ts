import { browser, type Browser } from 'wxt/browser';
import type { OffscreenSoundMessage, Sound } from './sound-types';

const OFFSCREEN_PATH = '/offscreen.html';
let creating: Promise<void> | null = null;

async function hasOffscreen() {
  const contexts = await browser.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT' as Browser.runtime.ContextType] });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  creating ??= browser.offscreen
    .createDocument({ url: OFFSCREEN_PATH, reasons: ['AUDIO_PLAYBACK' as Browser.offscreen.Reason], justification: 'Sound effects for scam warnings' })
    .finally(() => (creating = null));
  await creating;
}

/** Background only. */
export async function playSound(sound: Sound, action: 'play' | 'stop') {
  if (action === 'stop' && !(await hasOffscreen())) return;
  await ensureOffscreen();
  const msg: OffscreenSoundMessage = { target: 'offscreen', sound, action };
  await browser.runtime.sendMessage(msg).catch(() => {});
}
