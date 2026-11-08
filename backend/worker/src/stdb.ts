/**
 * Minimal SpacetimeDB HTTP client (no codegen needed).
 * The same shape is used by the web extension (web-extension/lib/stdb.ts),
 * and the website and phone app can reuse it as-is.
 */
export type Row = Record<string, unknown>;

export class Spacetime {
  constructor(
    readonly host: string, // e.g. https://maincloud.spacetimedb.com
    readonly db: string, // database name, e.g. tango
    public token?: string
  ) {}

  /** Mint a fresh anonymous identity + token. */
  static async newIdentity(host: string): Promise<{ identity: string; token: string }> {
    const res = await fetch(`${host}/v1/identity`, { method: 'POST' });
    if (!res.ok) throw new Error(`identity: HTTP ${res.status} ${await res.text()}`);
    return (await res.json()) as { identity: string; token: string };
  }

  private headers(extra: Record<string, string> = {}) {
    const h: Record<string, string> = { ...extra };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  /** Call a reducer. Args are positional, in the order the reducer declares them. */
  async call(reducer: string, ...args: unknown[]): Promise<void> {
    const res = await fetch(`${this.host}/v1/database/${this.db}/call/${reducer}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new ReducerError(reducer, res.status, await res.text());
  }

  /** Run one SQL statement and decode the rows into objects keyed by column name. */
  async sql<T extends Row = Row>(query: string): Promise<T[]> {
    const res = await fetch(`${this.host}/v1/database/${this.db}/sql`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'text/plain' }),
      body: query,
    });
    if (!res.ok) throw new Error(`sql: HTTP ${res.status} ${await res.text()}`);
    const out = (await res.json()) as SqlStatementResult[];
    return out[0] ? decodeRows<T>(out[0]) : [];
  }
}

export class ReducerError extends Error {
  constructor(
    readonly reducer: string,
    readonly status: number,
    readonly body: string
  ) {
    super(`${reducer}: HTTP ${status} ${body}`);
  }
}

type SqlStatementResult = {
  schema: { elements: { name: { some: string } | { none: unknown } | string | null }[] };
  rows: unknown[][];
};

export function decodeRows<T extends Row>(r: SqlStatementResult): T[] {
  const cols = r.schema.elements.map((e, i) => {
    const n = e.name as any;
    if (typeof n === 'string') return n;
    if (n && typeof n.some === 'string') return n.some;
    return `col${i}`;
  });
  return r.rows.map(row => {
    const o: Row = {};
    cols.forEach((c, i) => (o[c] = row[i]));
    return o as T;
  });
}

/** Quote a string literal for SpacetimeDB SQL. */
export function sqlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
