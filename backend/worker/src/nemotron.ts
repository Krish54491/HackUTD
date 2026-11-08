/**
 * Minimal client for NVIDIA Nemotron on the NVIDIA API catalog
 * (OpenAI-compatible: https://integrate.api.nvidia.com/v1/chat/completions).
 * Plain fetch, no SDK: just chat + tool calls + JSON extraction.
 */
import type { z } from 'zod';

const BASE = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
/**
 * Agent model: planning, tool use and the final report. Nemotron 3.5 Super VL leads
 * the family on web research (BrowseComp) and agentic tool use (Terminal-Bench)
 * while running at 12B active parameters.
 */
export const AGENT_MODEL = process.env.NEMOTRON_MODEL ?? 'nvidia/nemotron-3.5-super-vl-120b-a12b';
/** Used automatically if the agent model is unavailable to this API key. */
export const FALLBACK_MODEL = process.env.NEMOTRON_FALLBACK_MODEL ?? 'nvidia/nemotron-3-super-120b-a12b';
/** Fast model: bulk listing triage. */
export const FAST_MODEL = process.env.NEMOTRON_FAST_MODEL ?? 'nvidia/nemotron-3.5-lightning-30b-a3b';
/** Per-call reasoning choice, unless forced: NEMOTRON_THINKING=0 (always off) or 1 (always on). */
const THINKING_OVERRIDE = process.env.NEMOTRON_THINKING === '1' ? true : process.env.NEMOTRON_THINKING === '0' ? false : undefined;

/** Models that answered "not found / not available" once; skipped from then on. */
const unavailable = new Set<string>();

export const hasNvidiaKey = () => !!process.env.NVIDIA_API_KEY;

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; name: string; content: string };
export type ToolSpec = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type ChatResult = {
  content: string;
  toolCalls: ToolCall[];
  finish: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class NemotronError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function chat(opts: {
  messages: ChatMessage[];
  model?: string;
  tools?: ToolSpec[];
  maxTokens?: number;
  timeoutMs?: number;
  thinking?: boolean;
}): Promise<ChatResult> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new NemotronError('NVIDIA_API_KEY is not set');
  let model = opts.model ?? AGENT_MODEL;
  if (unavailable.has(model) && model !== FALLBACK_MODEL) model = FALLBACK_MODEL;
  const thinking = THINKING_OVERRIDE ?? opts.thinking ?? false;
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    // Reasoning tokens count toward max_tokens.
    max_tokens: (opts.maxTokens ?? 2000) + (thinking ? 3000 : 0),
    // NVIDIA's recommended sampling for Nemotron 3 / 3.5.
    temperature: 1.0,
    top_p: 0.95,
    chat_template_kwargs: { enable_thinking: thinking },
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = 'auto';
  }

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
    } catch (e) {
      if (attempt < 1) continue;
      throw new NemotronError(`Nemotron request failed: ${(e as Error).message}`);
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 2) {
        await sleep(Number(res.headers.get('retry-after')) * 1000 || 1500 * (attempt + 1));
        continue;
      }
    }
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      const missing = res.status === 404 || ((res.status === 400 || res.status === 422) && /model|not (found|available)|unknown|does not exist/i.test(text));
      if (missing && body.model !== FALLBACK_MODEL) {
        console.warn(`[nemotron] ${body.model} unavailable (HTTP ${res.status}); using ${FALLBACK_MODEL}`);
        unavailable.add(String(body.model));
        body.model = FALLBACK_MODEL;
        attempt = -1;
        continue;
      }
      throw new NemotronError(`Nemotron HTTP ${res.status}: ${text}`, res.status);
    }
    const j = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[];
      usage?: ChatResult['usage'];
    };
    const choice = j.choices?.[0];
    return {
      content: stripThinking(choice?.message?.content ?? ''),
      toolCalls: (choice?.message?.tool_calls ?? []).filter(t => t?.function?.name),
      finish: choice?.finish_reason ?? 'unknown',
      usage: j.usage,
    };
  }
}

/** Reasoning can come back inline; only the answer matters to us. */
export function stripThinking(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*?<\/think>/, '').trim();
}

/** Pull the first JSON object out of a reply (tolerates ```json fences and chatter around it). */
export function extractJson(s: string): unknown {
  const text = stripThinking(s).replace(/```(?:json)?/gi, '');
  const start = text.indexOf('{');
  if (start < 0) throw new Error('no JSON object in reply');
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('unterminated JSON object in reply');
}

/**
 * Ask for JSON matching `schema`. Validates with zod and, if the reply doesn't
 * fit, sends the validation error back once so the model can repair it.
 */
export async function chatJson<T>(opts: {
  schema: z.ZodType<T>;
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  thinking?: boolean;
}): Promise<{ value: T; raw: string }> {
  const messages = [...opts.messages];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await chat({ messages, model: opts.model, maxTokens: opts.maxTokens, timeoutMs: opts.timeoutMs, thinking: opts.thinking });
    try {
      return { value: opts.schema.parse(extractJson(res.content)), raw: res.content };
    } catch (e) {
      if (attempt === 1) throw new NemotronError(`Nemotron returned invalid JSON: ${(e as Error).message.slice(0, 200)}`);
      messages.push(
        { role: 'assistant', content: res.content },
        { role: 'user', content: `That was not valid. Error: ${(e as Error).message.slice(0, 500)}\nReply with ONLY the corrected JSON object.` }
      );
    }
  }
  throw new NemotronError('unreachable');
}
