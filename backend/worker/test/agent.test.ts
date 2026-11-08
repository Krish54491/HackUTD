import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractJson, stripThinking } from '../src/nemotron';
import { assertPublicUrl, htmlToText, parseDuckDuckGo } from '../src/tools';

describe('nemotron helpers', () => {
  it('extracts JSON from chatty or fenced replies', () => {
    expect(extractJson('Sure! ```json\n{"a": {"b": "x}"}}\n``` done')).toEqual({ a: { b: 'x}' } });
    expect(extractJson('<think>let me think {not json}</think>{"score": 5}')).toEqual({ score: 5 });
  });
  it('strips inline reasoning', () => {
    expect(stripThinking('<think>hmm</think>\nAnswer')).toBe('Answer');
  });
});

describe('tools', () => {
  it('parses DuckDuckGo HTML results', () => {
    const html = `<div class="result results_links results_links_deep web-result"><h2><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.bbb.org%2Fx&amp;rut=1">Velora <b>Outlet</b> | BBB</a></h2>
      <a class="result__snippet" href="#">Customers report <b>never</b> receiving orders.</a></div>`;
    expect(parseDuckDuckGo(html)).toEqual([{ title: 'Velora Outlet | BBB', url: 'https://www.bbb.org/x', snippet: 'Customers report never receiving orders.' }]);
  });
  it('turns HTML into text', () => {
    expect(htmlToText('<p>Hi&amp;bye<script>evil()</script></p>')).toBe('Hi&bye');
  });
  it('refuses internal addresses (the model chooses URLs)', async () => {
    await expect(assertPublicUrl('http://127.0.0.1/admin')).rejects.toThrow();
    await expect(assertPublicUrl('http://localhost:3000')).rejects.toThrow();
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(assertPublicUrl('http://metadata.internal/')).rejects.toThrow();
  });
});

describe('site investigation workflow (mocked Nemotron + services)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const REPORT = {
    analysis: 'Brand-new shop; buyers report orders never arriving.',
    score: 82,
    confidence: 'medium',
    headline: 'Likely a fake shop',
    summary: 'This shop is brand new and buyers report orders never arriving.',
    reasons: [{ title: 'Orders never arrive', detail: 'Several buyers report never receiving orders.', severity: 'high' }],
  };

  /** Fake Nemotron + Tavily + crt.sh. `decide` says what the review step does. */
  function mockServices(decide: 'answer' | 'research') {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
      const reply = (content: string | null, tool_calls?: unknown[]) =>
        json({ choices: [{ message: { content, tool_calls }, finish_reason: tool_calls ? 'tool_calls' : 'stop' }] });

      if (String(url).includes('integrate.api.nvidia.com')) {
        const system: string = body.messages[0].content;
        // Speed: reasoning mode is off everywhere by default.
        expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
        expect(body.model).toBe('nvidia/nemotron-3.5-super-vl-120b-a12b');
        if (system.includes('planning step')) {
          calls.push('plan');
          return reply(
            JSON.stringify({
              hypotheses: ['New shop selling at deep discounts'],
              steps: [
                { tool: 'web_search', args: { query: 'Velora Outlet company' }, purpose: 'verify the company' },
                { tool: 'certificate_history', args: {}, purpose: 'when it went live (same as baseline: reused)' },
              ],
            })
          );
        }
        if (system.includes('investigator and risk analyst')) {
          calls.push('decide');
          expect(body.tools.length).toBeGreaterThan(3);
          expect(body.messages[1].content).toContain('never received'); // baseline search result is in
          if (decide === 'answer') return reply(JSON.stringify(REPORT));
          return reply(null, [{ id: 'c1', type: 'function', function: { name: 'web_search', arguments: '{"query":"velora outlet bbb"}' } }]);
        }
        if (system.includes("Tango's risk analyst")) {
          calls.push('verdict');
          expect(body.messages[1].content).toContain('velora outlet bbb');
          return reply(JSON.stringify(REPORT));
        }
      }
      if (String(url).includes('api.tavily.com')) {
        const q = body.query as string;
        return json({ results: [{ title: `Results for ${q}`, url: 'https://reddit.com/r/scams/x', content: /scam|bbb/.test(q) ? 'I never received my order' : 'No reviews yet' }] });
      }
      if (String(url).includes('crt.sh')) return json([{ not_before: new Date(Date.now() - 5 * 86_400_000).toISOString(), issuer_name: "C=US, O=Let's Encrypt, CN=R11" }]);
      return new Response('not found', { status: 404 });
    });
    return calls;
  }

  const runCase = async () => {
    const { analyzeSite } = await import('../src/agent');
    return analyzeSite(
      'velora-outlet.shop',
      { is_checkout: true, has_payment_fields: true },
      { rdap: { age_days: 9 } },
      { score: 35, findings: [{ id: 'age', title: 'Brand-new website', detail: '9 days old', severity: 'high', points: 35 }], hardHigh: false }
    );
  };

  it('plans while baseline checks run, then answers in one review call when it has enough', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'nvapi-test');
    vi.stubEnv('TAVILY_API_KEY', 'tvly-test');
    const calls = mockServices('answer');
    const { report, trace } = await runCase();

    expect(calls).toEqual(['plan', 'decide']); // no separate verdict call
    expect(report.risk_level).toBe('high');
    expect(report.score).toBe(82);
    expect(report).not.toHaveProperty('analysis'); // reasoning goes to the trace, not the user
    const tools = trace.filter(t => t.step === 'tool');
    expect(tools.filter(t => t.phase === 'baseline').map(t => t.tool).sort()).toEqual(['certificate_history', 'dns_profile', 'web_search']);
    // The planner asked for certificate_history again: reused, not re-run.
    expect(tools.find(t => t.phase === 'planned' && t.tool === 'certificate_history')?.cached).toBe(true);
    expect(trace.some(t => t.step === 'notes' && t.text.includes('never arriving'))).toBe(true);
  });

  it('runs follow-up tools when the review asks for them, then writes the verdict', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'nvapi-test');
    vi.stubEnv('TAVILY_API_KEY', 'tvly-test');
    const calls = mockServices('research');
    const { report, trace } = await runCase();

    expect(calls).toEqual(['plan', 'decide', 'verdict']);
    expect(report.score).toBe(82);
    expect(trace.some(t => t.step === 'tool' && t.phase === 'follow-up' && t.tool === 'web_search')).toBe(true);
  });

  it('switches to the fallback model if the agent model is unavailable', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'nvapi-test');
    const models: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      models.push(body.model);
      if (body.model.includes('3.5-super-vl')) return new Response('{"detail":"Function not found for model"}', { status: 404 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), { status: 200 });
    });
    const { chat } = await import('../src/nemotron');
    expect((await chat({ messages: [{ role: 'user', content: 'hi' }] })).content).toBe('ok');
    await chat({ messages: [{ role: 'user', content: 'again' }] });
    // Fell back once, then went straight to the fallback model.
    expect(models).toEqual(['nvidia/nemotron-3.5-super-vl-120b-a12b', 'nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-3-super-120b-a12b']);
  });

  it('falls back to the rules report if Nemotron is down', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'nvapi-test');
    vi.stubGlobal('fetch', async () => new Response('{"detail":"Unauthorized"}', { status: 401 }));
    const { analyzeSite } = await import('../src/agent');
    const { report, trace } = await analyzeSite('x-shop.example', {}, {}, { score: 75, findings: [], hardHigh: false }, 'write-up');
    expect(report.risk_level).toBe('high');
    expect(report.confidence).toBe('low');
    expect(trace.some(t => t.step === 'error' && t.where === 'verdict')).toBe(true);
  });
});
