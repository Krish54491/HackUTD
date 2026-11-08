export const STDB_HOST: string = import.meta.env.WXT_SPACETIME_HOST || 'https://maincloud.spacetimedb.com';
export const STDB_DB: string = import.meta.env.WXT_SPACETIME_DB || 'protego';

/** How long the extension keeps a report locally before asking Spacetime again. */
export const LOCAL_REPORT_TTL_MS = 6 * 60 * 60 * 1000;
/** Give up waiting on the agent after this long. */
export const SCAN_TIMEOUT_MS = 120_000;
export const LISTING_TIMEOUT_MS = 60_000;
/** Mirrors FORCE_RESCAN_MIN_MS in backend/spacetime/src/lib.ts. */
export const FORCE_RESCAN_MIN_MS = 10 * 60 * 1000;

export const PINK = '#E20074';
