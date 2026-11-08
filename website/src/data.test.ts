import { describe, expect, it } from 'vitest';
import { csvLog, filterScams, scams } from './data';
import { normalizeDomain } from './scan';
describe('dashboard records',()=>{
  it('provides 128 unique records and 42 for the mockup week',()=>{
    expect(new Set(scams.map(s=>s.id)).size).toBe(128);
    expect(filterScams('','All threat categories','week')).toHaveLength(42);
    expect(['Phishing','Fake scholarships','Shopping scams','Impersonation'].map(c=>filterScams('',c,'week').length)).toEqual([18,12,8,4]);
  });
  it('combines case-insensitive search, category and date filters',()=>{
    const rows=filterScams('ACCOUNT','Phishing','week');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(s=>s.category==='Phishing'&&s.date>='2026-11-01'&&s.domain.includes('account'))).toBe(true);
    expect(filterScams('nonexistent','All threat categories','all')).toEqual([]);
  });
  it('quotes exported CSV fields and embedded quotes',()=>{
    const csv=csvLog([{...scams[0],title:'A "quoted", title'}]);
    expect(csv).toContain('"A ""quoted"", title"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
describe('website input',()=>{
  it('extracts a hostname without sending paths or credentials',()=>{
    expect(normalizeDomain('https://www.Example.com/private?q=secret')).toBe('example.com');
    expect(normalizeDomain('example.com')).toBe('example.com');
    expect(()=>normalizeDomain('https://user:pass@example.com')).toThrow();
    expect(()=>normalizeDomain('javascript:alert(1)')).toThrow();
    expect(()=>normalizeDomain('localhost')).toThrow();
  });
});
