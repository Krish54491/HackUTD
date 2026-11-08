import hornetPng from '../../web-extension/public/tango/hornet.png';
import type { Tier, TierId, Trophy } from './hive';

const W = 1080;
const H = 1350;
export const INSTAGRAM_URL = 'https://www.instagram.com/';

/** Same tints as `.hornet-*` in styles.css. */
const TINT: Record<TierId, string> = {
  common: 'grayscale(1) sepia(.3) brightness(1.08) contrast(1.05)',
  uncommon: 'hue-rotate(190deg) saturate(1.35)',
  rare: 'hue-rotate(240deg) saturate(1.5)',
  epic: 'hue-rotate(305deg) saturate(1.6) brightness(1.05)',
  legendary: 'hue-rotate(80deg) saturate(2) brightness(1.18)',
  mythic: 'grayscale(1) brightness(.75) sepia(1) hue-rotate(-50deg) saturate(14) contrast(1.15)',
};

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric' });

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Portrait (4:5) trophy card for an Instagram feed post. */
export async function trophyImage(w: Trophy, t: Tier, featured: boolean): Promise<Blob> {
  await Promise.all(['900 64px Orbitron', '700 40px Orbitron', '600 34px "Chakra Petch"', '600 30px "JetBrains Mono"'].map(f => document.fonts.load(f)));
  const hornet = await loadImage(hornetPng);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#06050b';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 470, 0, W / 2, 470, 620);
  glow.addColorStop(0, `${t.color}66`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, 470);
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    const ray = ctx.createLinearGradient(0, 0, 0, -520);
    ray.addColorStop(0, `${t.color}55`);
    ray.addColorStop(1, 'transparent');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-38, -520);
    ctx.lineTo(38, -520);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = t.color;
  ctx.lineWidth = 6;
  ctx.shadowColor = t.color;
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.roundRect(40, 40, W - 80, H - 80, 48);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const hw = 640;
  const hh = (hw * hornet.height) / hornet.width;
  ctx.filter = `${TINT[t.id]} drop-shadow(0 0 36px ${t.color})`;
  ctx.drawImage(hornet, (W - hw) / 2, 470 - hh / 2, hw, hh);
  ctx.filter = 'none';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e20074';
  ctx.font = '800 34px Orbitron';
  ctx.letterSpacing = '8px';
  ctx.fillText(t.id === 'mythic' ? 'ONE IN A MILLION' : featured ? 'HORNET OF THE WEEK' : 'TROPHY', W / 2, 140);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = t.color;
  ctx.font = '700 30px "JetBrains Mono"';
  ctx.letterSpacing = '6px';
  ctx.fillText(t.name.toUpperCase(), W / 2, 830);
  ctx.letterSpacing = '0px';

  ctx.shadowColor = t.color;
  ctx.shadowBlur = 30;
  ctx.font = '900 64px Orbitron';
  ctx.fillText(fitText(ctx, t.species, W - 180), W / 2, 912);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#9a92b8';
  ctx.font = '500 32px "Chakra Petch"';
  ctx.fillText(t.latin, W / 2, 962);

  ctx.fillStyle = '#ece8ff';
  ctx.font = '600 40px "Chakra Petch"';
  ctx.fillText(fitText(ctx, `Scam slain: ${w.title}`, W - 180), W / 2, 1060);
  ctx.fillStyle = '#9a92b8';
  ctx.font = '600 28px "JetBrains Mono"';
  ctx.fillText(fitText(ctx, /scam/i.test(w.category) ? w.category : `${w.category} scam`, W - 180), W / 2, 1110);
  ctx.font = '600 30px "Chakra Petch"';
  ctx.fillText(`Slain by ${w.alias} · ${fmt(w.date)}`, W / 2, 1160);

  ctx.font = '800 44px Orbitron';
  ctx.fillStyle = '#ece8ff';
  const brand = 'tango';
  const bw = ctx.measureText(brand).width;
  ctx.textAlign = 'left';
  ctx.fillText(brand, W / 2 - bw / 2 - 8, 1250);
  ctx.fillStyle = '#e20074';
  ctx.fillText('.', W / 2 + bw / 2 - 8, 1250);

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No image'))), 'image/png'));
}

export type Platform = 'instagram' | 'x' | 'threads';

export const postText = (w: Trophy, t: Tier) =>
  `I slew a ${t.name} scam hornet with Tango: ${w.title} (${/scam/i.test(w.category) ? w.category : `${w.category} scam`}). #ScamShield #Tango`;

/** X and Threads take text by URL; the image goes in by paste. Instagram's site takes neither. */
const composeUrl = (platform: Platform, text: string) =>
  platform === 'x' ? `https://x.com/intent/post?text=${encodeURIComponent(text)}`
  : platform === 'threads' ? `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`
  : INSTAGRAM_URL;

/**
 * Phones: share sheet with the image and caption, so the app opens a ready post.
 * Desktop: save + copy the image, then open the platform's composer.
 */
export async function shareTrophy(platform: Platform, w: Trophy, t: Tier, featured: boolean): Promise<'shared' | 'copied'> {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const text = postText(w, t);
  const blob = await trophyImage(w, t, featured);
  const file = new File([blob], `tango-${w.id}.png`, { type: 'image/png' });
  if (mobile && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return 'shared';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  await navigator.clipboard?.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
  window.open(composeUrl(platform, text), '_blank');
  return 'copied';
}
