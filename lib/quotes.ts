import type { QuoteRequest } from './types';
import * as db from './db';

export const QUOTE_DEDUPE_WINDOW_MS = 30 * 60_000;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Pure: the PENDING quote of the same shop that this request repeats (same customer, same description, last 30 minutes), if any. */
export function findDuplicateQuote(existing: QuoteRequest[], candidate: Pick<QuoteRequest, 'shopSlug' | 'customerName' | 'description'>, nowMs: number): QuoteRequest | undefined {
  const name = norm(candidate.customerName);
  const desc = norm(candidate.description);
  return existing.find((q) => {
    const age = nowMs - new Date(q.createdAt).getTime();
    return q.status === 'PENDING' && q.shopSlug === candidate.shopSlug && norm(q.customerName) === name && norm(q.description) === desc
      && age >= 0 && age <= QUOTE_DEDUPE_WINDOW_MS;
  });
}

/** Creates the quote unless an identical recent PENDING one exists, in which case that one is returned. Works on both stores. */
export async function createQuoteOnce(q: QuoteRequest): Promise<{ quote: QuoteRequest; duplicate: boolean }> {
  const dup = findDuplicateQuote(await db.listQuotes(q.shopSlug, 'PENDING'), q, Date.now());
  if (dup) return { quote: dup, duplicate: true };
  return { quote: await db.createQuote(q), duplicate: false };
}
