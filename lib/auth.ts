import { createHash, randomInt, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const DEFAULT_SHOP = 'anus-home-bakery';

export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

function safeEq(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPinHash(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  return safeEq(scryptSync(pin, salt, 32), Buffer.from(hash, 'hex'));
}

/** Constant-time compare for the demo shop PIN from env (default 246810). */
export function checkDemoPin(pin: string, envPin = process.env.OWNER_PIN || '246810'): boolean {
  return safeEq(createHash('sha256').update(pin).digest(), createHash('sha256').update(envPin).digest());
}

// ---- attempt limiter (in-memory, per key) ----
const lim = globalThis as unknown as { __ccAttempts?: Map<string, { n: number; reset: number }> };
const WINDOW_MS = 5 * 60_000;
const MAX_FAILS = 8;

export function isLocked(key: string, now = Date.now(), max = MAX_FAILS): boolean {
  const a = (lim.__ccAttempts ??= new Map()).get(key);
  return !!a && a.reset > now && a.n >= max;
}
export function recordFail(key: string, now = Date.now()) {
  const m = (lim.__ccAttempts ??= new Map());
  if (m.size > 5000) for (const [k, v] of m) if (v.reset <= now) m.delete(k);
  const a = m.get(key);
  if (!a || a.reset <= now) m.set(key, { n: 1, reset: now + WINDOW_MS });
  else a.n++;
}
export function clearFails(key: string) { lim.__ccAttempts?.delete(key); }

/** Generic fixed-window rate limiter (used for shop import per IP). */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const m = ((globalThis as unknown as { __ccRl?: Map<string, { n: number; reset: number }> }).__ccRl ??= new Map());
  if (m.size > 5000) for (const [k, v] of m) if (v.reset <= now) m.delete(k); // keep the map bounded
  const a = m.get(key);
  if (!a || a.reset <= now) { m.set(key, { n: 1, reset: now + windowMs }); return true; }
  if (a.n >= max) return false;
  a.n++;
  return true;
}
