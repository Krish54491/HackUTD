import { describe, it, expect } from 'vitest';
import { classifyListings, triage } from '../src/agent';
import { listingRuleHits, ruleScore } from '../src/listingRules';

describe('triage', () => {
  it('blocklisted sites skip the LLM', () => {
    expect(triage({ score: 95, hardHigh: true }, {})).toBe('rules');
  });
  it('established clean sites skip the LLM', () => {
    expect(triage({ score: 0, hardHigh: false }, { rdap: { age_days: 4000 } })).toBe('rules');
  });
  it('young or unknown-age sites get researched', () => {
    expect(triage({ score: 0, hardHigh: false }, { rdap: { age_days: 100 } })).toBe('research');
    expect(triage({ score: 0, hardHigh: false }, { rdap: { error: 'no rdap' } })).toBe('research');
    expect(triage({ score: 5, hardHigh: false }, { rdap: { age_days: 4000 }, lookalike: { brand: 'paypal', official: 'paypal.com', how: 'x' } })).toBe('research');
  });
  it('conclusive heuristics only need a write-up', () => {
    expect(triage({ score: 80, hardHigh: false }, { rdap: { age_days: 3 } })).toBe('write-up');
  });
});

describe('listing rules', () => {
  const score = (l: Parameters<typeof listingRuleHits>[0], kind: 'job' | 'rental' = 'job') => ruleScore(listingRuleHits(l, kind));

  it('flags classic job scams', () => {
    expect(score({ title: 'Remote Data Entry Clerk - $45/hr, no experience needed', snippet: 'Contact our HR on Telegram @hr_desk' })).toBeGreaterThanOrEqual(60);
    expect(score({ title: 'Package Reshipping Coordinator', snippet: 'Work from home, start today' })).toBeGreaterThanOrEqual(60);
    expect(score({ title: 'Administrative Assistant', description: 'We will mail you a check. Deposit the check and send the balance to our vendor via Zelle.' })).toBeGreaterThanOrEqual(60);
  });
  it('leaves normal jobs alone', () => {
    expect(score({ title: 'Senior Software Engineer', company: 'T-Mobile', location: 'Bellevue, WA', price: '$150K/yr - $190K/yr' })).toBeLessThan(20);
    expect(score({ title: 'Barista', company: 'Starbucks', location: 'Dallas, TX', price: '$15/hr' })).toBeLessThan(20);
  });
  it('flags rental bait', () => {
    expect(score({ title: '123 Main St, Dallas, TX', price: '$450/mo', snippet: '3 bds 2 ba 1,800 sqft' }, 'rental')).toBeGreaterThanOrEqual(40);
    expect(score({ title: 'Lovely home', description: "I'm out of the country on a missionary trip; keys will be mailed after the deposit." }, 'rental')).toBeGreaterThanOrEqual(60);
  });
  it('leaves normal rentals alone', () => {
    expect(score({ title: '55 Elm St, Austin, TX', price: '$2,150/mo', snippet: '2 bds 2 ba 1,050 sqft' }, 'rental')).toBe(0);
    expect(score({ title: '9 Oak Ave', price: '$425,000', snippet: '3 bds 2 ba' }, 'rental')).toBe(0);
  });

  it('classifyListings works without the LLM', async () => {
    const v = await classifyListings(
      'linkedin.com',
      [
        { key: 'a', title: 'Online typing job $500/day', snippet: 'WhatsApp +1 555 0100' },
        { key: 'b', title: 'Product Designer', company: 'Figma' },
      ],
      false
    );
    expect(v.find(x => x.key === 'a')?.suspicious).toBe(true);
    expect(v.find(x => x.key === 'a')?.reason).toMatch(/Telegram|WhatsApp/);
    expect(v.find(x => x.key === 'b')?.suspicious).toBe(false);
  });
});
