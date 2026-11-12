import type { LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export type Provider = 'google' | 'anthropic' | 'openai';

export const DEFAULT_MODELS: Record<Provider, string> = {
  google: 'gemini-flash-latest',
  anthropic: 'claude-haiku-5-5',
  openai: 'gpt-5.4-mini',
};

export function detectProvider(): Provider | null {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 'google';
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
      reason: 'The AI assistant is not set up yet. Add GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY to the environment.',
    };
  }
  const modelId = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  const model =
    provider === 'google' ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId)
    : provider === 'anthropic' ? createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId)
    : createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
  return { model, provider, modelId };
}
