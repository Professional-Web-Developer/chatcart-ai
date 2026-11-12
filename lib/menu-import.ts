import type { MenuItem } from './types';

export const MAX_ITEMS = 40;
export const MIN_PRICE = 0.5;
export const MAX_PRICE = 2000;

export function slugify(s: string, max = 40): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}

const clip = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

const EMOJI_RE = /\p{Extended_Pictographic}/u;
function pickEmoji(e: unknown): string {
  const m = String(e ?? '').match(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️)*/u);
  return m && EMOJI_RE.test(m[0]) ? m[0] : '🛍️';
}

export type RawItem = { name?: unknown; description?: unknown; price?: unknown; category?: unknown; emoji?: unknown };

/** Pure clean-up of AI-extracted menu rows: never trust model output. */
export function cleanMenu(raw: RawItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  const ids = new Set<string>();
  const seen = new Set<string>();
  for (const r of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_ITEMS) break;
    const name = clip(r?.name, 80);
    const price = typeof r?.price === 'number' ? r.price : Number(String(r?.price ?? '').replace(/[^0-9.]/g, ''));
    if (!name || !Number.isFinite(price)) continue;
    const cents = Math.round(price * 100);
    if (cents < MIN_PRICE * 100 || cents > MAX_PRICE * 100) continue;
    const key = name.toLowerCase() + '|' + cents;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = slugify(name) || 'item';
    let id = base, n = 2;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);
    out.push({
      id, name, description: clip(r.description, 200), priceUsd: cents / 100,
      category: clip(r.category, 40) || 'Menu', emoji: pickEmoji(r.emoji),
    });
  }
  return out;
}

const USD_MARKERS = new Set(['', 'USD', '$', 'US$']);

/**
 * Prices are stored in US dollars only. The model reports the currency each price was written in
 * (empty or "USD"/"$" when it was written with $ or no marker); anything else is dropped, not converted.
 */
export function filterUsdItems<T extends RawItem & { currency?: unknown }>(raw: T[]): { kept: T[]; skipped: string[] } {
  const kept: T[] = [];
  const skipped: string[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const cur = String(r?.currency ?? '').trim().toUpperCase();
    if (USD_MARKERS.has(cur)) kept.push(r);
    else if (skipped.length < MAX_ITEMS) skipped.push(clip(r?.name, 80) || 'Unnamed item');
  }
  return { kept, skipped };
}
