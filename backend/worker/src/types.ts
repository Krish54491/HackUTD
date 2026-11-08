/** Signals the extension extracts in-page. Never contains form values, cookies, or full HTML. */
export type ClientSignals = {
  protocol?: string;
  path?: string;
  title?: string;
  is_checkout?: boolean;
  has_password_field?: boolean;
  has_payment_fields?: boolean;
  form_action_domains?: string[];
  payment_iframe_domains?: string[];
  external_script_domains?: string[];
  inline_script_flags?: Partial<
    Record<'eval' | 'atob' | 'long_base64' | 'document_write' | 'hex_escapes' | 'devtools_block', number>
  >;
  policy_links?: Partial<Record<'privacy' | 'refund' | 'terms' | 'contact' | 'shipping' | 'about', boolean>>;
  urgency_phrases?: string[];
  payment_methods_mentioned?: string[]; // e.g. bitcoin, gift card, wire transfer, zelle
  brand_mentions?: string[];
  copyright_year?: number | null;
};

export type Severity = 'info' | 'low' | 'medium' | 'high';
export type Finding = { id: string; title: string; detail: string; severity: Severity; points: number };

export type ServerEvidence = {
  rdap?: { created?: string; age_days?: number; registrar?: string; error?: string };
  feeds?: { openphish: boolean; phishing_db: boolean; error?: string };
  safe_browsing?: { checked: boolean; threats: string[]; error?: string };
  lookalike?: { brand: string; official: string; how: string } | null;
  fetched_page?: { ok: boolean; status?: number; error?: string };
};

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type Reason = { title: string; detail: string; severity: Severity };
export type Report = {
  risk_level: RiskLevel;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  headline: string;
  summary: string;
  reasons: Reason[];
};
