import { generateText, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';

export type Provider = 'google' | 'groq' | 'anthropic' | 'openai';

export const DEFAULT_MODELS: Record<Provider, string> = {
  google: 'gemini-flash-latest',
  groq: 'openai/gpt-oss-120b',
  anthropic: 'claude-haiku-5-5',
  openai: 'gpt-5.4-mini',
};

export function detectProvider(): Provider | null {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 'google';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

export type ModelResult = { model: LanguageModel; provider: Provider; modelId: string } | { model: null; reason: string };

export function getModel(): ModelResult {
  const provider = detectProvider();
  if (!provider) {
    return {
      model: null,
      reason: 'The AI assistant is not set up yet. Add GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY to the environment.',
    };
  }
  const modelId = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  const model =
    provider === 'google' ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId)
    : provider === 'groq' ? createGroq({ apiKey: process.env.GROQ_API_KEY })(modelId)
    : provider === 'anthropic' ? createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId)
    : createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
  return { model, provider, modelId };
}

/**
 * Free AI tiers have per-model daily limits. When the main model is out of capacity (or an id is
 * unavailable), the same request is retried on the next model in this list, so the shop keeps answering.
 * Override with AI_FALLBACK_MODELS (comma-separated model ids for the same provider).
 */
const GROQ_FALLBACKS = ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'];

export function fallbackModels(): LanguageModel[] {
  const provider = detectProvider();
  if (!provider) return [];
  const fromEnv = process.env.AI_FALLBACK_MODELS?.split(',').map((x) => x.trim()).filter(Boolean);
  const ids = fromEnv ?? (provider === 'groq' ? GROQ_FALLBACKS : []);
  const primary = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  return ids.filter((id) => id !== primary).map((id) =>
    provider === 'google' ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(id)
    : provider === 'groq' ? createGroq({ apiKey: process.env.GROQ_API_KEY })(id)
    : provider === 'anthropic' ? createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id)
    : createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id));
}

/** True for "this model cannot take the request right now" errors: rate limits, overload, unknown or retired model. */
export function isCapacityError(e: unknown): boolean {
  const seen = new Set<unknown>();
  const stack: unknown[] = [e];
  while (stack.length) {
    const x = stack.pop();
    if (!x || typeof x !== 'object' || seen.has(x)) continue;
    seen.add(x);
    const o = x as { statusCode?: number; message?: string; lastError?: unknown; errors?: unknown[]; cause?: unknown };
    if (o.statusCode === 429 || o.statusCode === 503 || o.statusCode === 529 || o.statusCode === 404 || o.statusCode === 413) return true;
    if (typeof o.message === 'string' && /rate limit|quota|overloaded|capacity|does not exist|decommissioned|not found|no longer supported/i.test(o.message)) return true;
    stack.push(o.lastError, o.cause, ...(Array.isArray(o.errors) ? o.errors : []));
  }
  return false;
}

type GenArgs = Parameters<typeof generateText>[0];

export const generateTextWithFallback = (async (opts: GenArgs) => {
  const models = [opts.model, ...fallbackModels()];
  let last: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      return await generateText({ ...opts, model: models[i], maxRetries: i === 0 ? 1 : 0 } as GenArgs);
    } catch (e) {
      last = e;
      if (!isCapacityError(e)) throw e;
      console.warn(`[ai] model ${i + 1}/${models.length} unavailable, trying the next one`);
    }
  }
  throw last;
}) as typeof generateText;
