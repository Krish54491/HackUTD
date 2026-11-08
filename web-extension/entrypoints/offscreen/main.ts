/**
 * Offscreen document that plays Tango's sound effects. Audio started from a
 * content script is subject to the page's autoplay policy (silent on a fresh
 * navigation); an extension's offscreen document is not.
 */
import { browser } from 'wxt/browser';
import type { OffscreenSoundMessage, Sound } from '@/lib/sound-types';

const VOLUME: Record<Sound, number> = { scrape: 0.55, pop: 0.9, slash: 0.85 };
const scrape = new Audio('/sounds/scrape.mp3');
scrape.loop = true;
scrape.volume = VOLUME.scrape;
const oneShots: Record<Exclude<Sound, 'scrape'>, HTMLAudioElement> = {
  pop: new Audio('/sounds/pop.mp3'),
  slash: new Audio('/sounds/slash.mp3'),
};
for (const a of Object.values(oneShots)) a.preload = 'auto';

/** Back-to-back slashes get slightly different pitches so they don't sound copy-pasted. */
const SLASH_RATES = [1, 1.12, 0.93, 1.06];
let slashes = 0;

browser.runtime.onMessage.addListener((msg: OffscreenSoundMessage) => {
  if (msg?.target !== 'offscreen') return;
  if (msg.sound === 'scrape') {
    if (msg.action === 'play') {
      scrape.currentTime = 0;
      void scrape.play().catch(() => {});
    } else {
      scrape.pause();
    }
  } else if (msg.action === 'play') {
    // One-shots overlap, so each play gets its own element.
    const a = oneShots[msg.sound].cloneNode() as HTMLAudioElement;
    a.volume = VOLUME[msg.sound];
    if (msg.sound === 'slash') {
      a.preservesPitch = false;
      a.playbackRate = SLASH_RATES[slashes++ % SLASH_RATES.length] ?? 1;
    }
    void a.play().catch(() => {});
  }
});
