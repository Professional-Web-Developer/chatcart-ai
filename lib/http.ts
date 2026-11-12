import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AgentSetupError } from './agent';
import { PayPalConfigError, PayPalError } from './paypal';
import { DEFAULT_SHOP_SLUG } from './menu';
import { checkDemoPin, checkPinHash, clearFails, isLocked, recordFail } from './auth';
import * as db from './db';
import type { Shop } from './types';

export const slugParam = z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/);

export const messagesBody = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).min(1).max(60),
  shop: slugParam.optional(),
});

export function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function handleError(e: unknown) {
  if (e instanceof AgentSetupError || e instanceof PayPalConfigError) return fail(e.message, 503);
  if (e instanceof PayPalError) return fail(e.message, e.status === 404 ? 404 : 502);
  console.error('[api] unexpected error', e);
  return fail('Something went wrong on our side. Please try again in a moment.', 500);
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return undefined; }
}

/** Resolves an optional shop slug (default shop when absent). Returns null when unknown. */
export async function resolveShop(slug?: string | null): Promise<Shop | null> {
  const s = slug && slug.trim() ? slug.trim() : DEFAULT_SHOP_SLUG;
  if (!/^[a-z0-9-]{1,60}$/.test(s)) return null;
  return db.getShop(s);
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** Pure-ish PIN check against a shop (demo shop uses OWNER_PIN env). */
export async function pinMatches(slug: string, pin: string): Promise<boolean> {
  if (!/^\d{6}$/.test(pin)) return false;
  if (slug === DEFAULT_SHOP_SLUG) return checkDemoPin(pin);
  const rec = await db.getShopRecord(slug);
  return rec ? checkPinHash(pin, rec.pinHash) : false;
}

/**
 * PIN attempt limiting. Wrong guesses are counted per shop AND caller (8 per 5 min) so that one person
 * mistyping, or someone hammering the public demo PIN, does not lock the real owner out; a wider per-shop
 * cap (40 per 5 min) still bounds a guesser who rotates addresses. Counters are in memory, per instance.
 */
const SHOP_MAX_FAILS = 40;
const LOCKED = 'Too many wrong PIN attempts. Please wait a few minutes and try again.';

export async function checkOwnerPin(req: Request, slug: string, pin: string): Promise<'ok' | 'wrong' | 'locked'> {
  const mine = `pin:${slug}:${clientIp(req)}`;
  const shopWide = `pin:${slug}`;
  if (isLocked(mine) || isLocked(shopWide, Date.now(), SHOP_MAX_FAILS)) return 'locked';
  if (await pinMatches(slug, pin)) { clearFails(mine); return 'ok'; }
  recordFail(mine);
  recordFail(shopWide);
  return 'wrong';
}

/** Returns an error Response when the x-owner-pin header is missing/wrong/rate-limited, else null. */
export async function requireOwner(req: Request, slug: string): Promise<NextResponse | null> {
  const pin = req.headers.get('x-owner-pin')?.trim() ?? '';
  if (!pin) return fail('Owner PIN required.', 401);
  const r = await checkOwnerPin(req, slug, pin);
  if (r === 'locked') return fail(LOCKED, 429);
  if (r === 'wrong') return fail('Wrong owner PIN.', 401);
  return null;
}

export const lockedResponse = () => fail(LOCKED, 429);
