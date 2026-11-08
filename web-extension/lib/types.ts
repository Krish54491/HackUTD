import type { Sound } from './sound-types';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type Severity = 'info' | 'low' | 'medium' | 'high';
export type Reason = { title: string; detail: string; severity: Severity };

/** A decoded `site_report` row. */
export type SiteReport = {
  domain: string;
  risk_level: RiskLevel;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  headline: string;
  summary: string;
  reasons: Reason[];
  checked_at_ms: number;
  expires_at_ms: number;
};

export type ScanStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'done'; report: SiteReport }
  | { state: 'error'; error: string };

export type ListingItem = {
  key: string;
  title: string;
  company?: string;
  location?: string;
  price?: string;
  snippet?: string;
  /** Full description of the listing the user has open. */
  description?: string;
  url?: string;
};
export type ListingResult = { key: string; suspicious: boolean; score: number; reason: string };

export type TabState = {
  domain: string;
  scan: ScanStatus;
  listings?: { site: string; enabled: boolean; blocked: { key: string; title: string; reason: string }[] };
};

/** Messages sent to the background service worker. */
export type BgMessage =
  | { type: 'PAGE_SIGNALS'; domain: string; signals: unknown }
  | { type: 'GET_CACHED_REPORT'; domain: string }
  | { type: 'ACK_SITE'; domain: string; level: RiskLevel }
  | { type: 'CHECK_CURRENT_PAGE'; tabId: number; domain: string; force?: boolean }
  | { type: 'MANUAL_CHECK'; input: string; force?: boolean }
  | { type: 'GET_POPUP_STATE'; tabId?: number; domain?: string }
  | { type: 'CHECK_LISTINGS'; site: string; items: ListingItem[] }
  | { type: 'LISTINGS_BLOCKED'; site: string; blocked: { key: string; title: string; reason: string }[] }
  | { type: 'GET_LISTINGS_ENABLED'; site: string }
  | { type: 'SET_LISTINGS_ENABLED'; tabId: number; site: string; enabled: boolean }
  | { type: 'LEAVE_SITE'; tabId?: number }
  | { type: 'SOUND'; sound: Sound; action: 'play' | 'stop' }
  | { type: 'DEMO_LEVEL'; level: RiskLevel };

/** Messages sent from the background to content scripts. */
export type TabMessage =
  /** Sent for every finished check of the tab's site, clean or not. */
  | { type: 'SCAN_RESULT'; domain: string; report: SiteReport | null; error?: string }
  | { type: 'LISTINGS_ENABLED_CHANGED'; enabled: boolean };

/** What the page needs on load: a locally cached report, and the risk level the user already chose to continue past. */
export type CachedForPage = { report: SiteReport | null; ackedLevel: RiskLevel | null };

export type PopupState = {
  domain: string | null;
  tab: TabState | null;
  hornets: number;
};
