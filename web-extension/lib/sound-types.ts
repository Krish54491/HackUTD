export type Sound = 'scrape' | 'pop' | 'slash';

/** Background → offscreen document. */
export type OffscreenSoundMessage = { target: 'offscreen'; sound: Sound; action: 'play' | 'stop' };
