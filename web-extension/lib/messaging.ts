import { browser } from 'wxt/browser';
import type { BgMessage } from './types';

/** Send a message to the background and unwrap its {ok, data | error} envelope. */
export async function bg<T = unknown>(msg: BgMessage): Promise<T> {
  const res = (await browser.runtime.sendMessage(msg)) as { ok: boolean; data?: T; error?: string } | undefined;
  if (!res) throw new Error('Protego background is not responding');
  if (!res.ok) throw new Error(res.error ?? 'Unknown error');
  return res.data as T;
}
