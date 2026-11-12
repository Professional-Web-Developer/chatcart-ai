import { randomInt } from 'node:crypto';
import { Pool } from 'pg';
import type { Order, OrderStatus, QuoteRequest, Review, Shop } from './types';
import { averageRating } from './reviews';
import { DEFAULT_SHOP_SLUG, MENU, SHOP } from './menu';

export type Stats = { paidCount: number; pendingCount: number; refundedCount: number; revenue: number; invoicedCount: number };
export type ShopRecord = Shop & { pinHash: string };
export const MAX_SHOPS = 200;
const MAX_MEMORY_ORDERS = 5000;

export interface OrderStore {
  createOrder(o: Order): Promise<Order>;
  getByShortCode(code: string, shopSlug?: string): Promise<Order | null>;
  getById(id: string): Promise<Order | null>;
  getByPaypalOrderId(id: string): Promise<Order | null>;
  getByCaptureId(id: string): Promise<Order | null>;
  getByInvoiceId(id: string): Promise<Order | null>;
  markPaid(id: string, captureId?: string): Promise<Order | null>;
  markRefunded(id: string): Promise<Order | null>;
  markReady(id: string): Promise<Order | null>;
  listOrders(opts?: { status?: OrderStatus; shopSlug?: string }): Promise<Order[]>;
  stats(shopSlug?: string): Promise<Stats>;
  createShop(s: ShopRecord): Promise<void>;
  getShopRecord(slug: string): Promise<ShopRecord | null>;
  countShops(): Promise<number>;
  createQuote(q: QuoteRequest): Promise<QuoteRequest>;
  listQuotes(shopSlug: string, status?: QuoteRequest['status']): Promise<QuoteRequest[]>;
  markQuoteInvoiced(id: string, shopSlug: string, orderShortCode: string): Promise<void>;
  markCollected(id: string): Promise<Order | null>;
  addReview(r: Review): Promise<{ ok: true; review: Review } | { ok: false; error: string }>;
  listReviews(shopSlug: string, limit: number): Promise<Review[]>;
  reviewStats(shopSlug: string): Promise<ReviewStats>;
}

export type ReviewStats = { count: number; average: number };
const DUPLICATE_REVIEW = 'This order already has a review';

export const dbKind = (): 'postgres' | 'memory' => (process.env.DATABASE_URL ? 'postgres' : 'memory');

/** 4 digits normally; pass a higher attempt number after collisions to widen the space instead of looping. */
export function newShortCode(attempt = 0): string {
  const digits = attempt < 5 ? 4 : 7;
  const min = 10 ** (digits - 1);
  return 'CC-' + String(min + randomInt(0, 9 * min));
}

/** Demo shop is seeded from lib/menu.ts and never stored; its PIN comes from env (see lib/auth.ts). */
const DEMO: ShopRecord = { slug: DEFAULT_SHOP_SLUG, name: SHOP.name, tagline: SHOP.tagline, items: MENU, createdAt: '2026-01-01T00:00:00.000Z', pinHash: '' };

function computeStats(orders: Order[]): Stats {
  const paid = orders.filter((o) => o.status === 'PAID');
  const cents = paid.reduce((s, o) => s + Math.round(o.total * 100), 0);
  return {
    paidCount: paid.length,
    pendingCount: orders.filter((o) => o.status === 'PENDING_PAYMENT').length,
    refundedCount: orders.filter((o) => o.status === 'REFUNDED').length,
    invoicedCount: orders.filter((o) => o.status === 'INVOICED').length,
    revenue: cents / 100,
  };
}

const gm = globalThis as unknown as { __ccOrders?: Order[]; __ccShops?: ShopRecord[]; __ccQuotes?: QuoteRequest[]; __ccReviews?: Review[]; __ccPool?: Pool; __ccReady?: Promise<void> };

// ---------- in-memory ----------
class MemoryStore implements OrderStore {
  private get arr(): Order[] { return (gm.__ccOrders ??= []); }
  private get shops(): ShopRecord[] { return (gm.__ccShops ??= []); }
  private get quotes(): QuoteRequest[] { return (gm.__ccQuotes ??= []); }
  private get reviews(): Review[] { return (gm.__ccReviews ??= []); }
  async createOrder(o: Order) {
    for (let i = 0; this.arr.some((x) => x.shortCode === o.shortCode); i++) o.shortCode = newShortCode(i);
    if (this.arr.length >= MAX_MEMORY_ORDERS) this.arr.shift(); // bounded: the memory store is a demo fallback
    this.arr.push(o);
    return o;
  }
  async getByShortCode(code: string, shopSlug?: string) {
    return this.arr.find((o) => o.shortCode.toUpperCase() === code.trim().toUpperCase() && (!shopSlug || o.shopSlug === shopSlug)) ?? null;
  }
  async getById(id: string) { return this.arr.find((o) => o.id === id) ?? null; }
  async getByPaypalOrderId(id: string) { return this.arr.find((o) => o.paypalOrderId === id) ?? null; }
  async getByCaptureId(id: string) { return this.arr.find((o) => o.captureId === id) ?? null; }
  async getByInvoiceId(id: string) { return this.arr.find((o) => o.invoiceId === id) ?? null; }
  async markPaid(id: string, captureId?: string) {
    const o = this.arr.find((x) => x.id === id);
    if (!o) return null;
    if (o.status === 'PENDING_PAYMENT' || o.status === 'INVOICED') { o.status = 'PAID'; o.captureId = captureId; o.paidAt = new Date().toISOString(); }
    return o;
  }
  async markRefunded(id: string) {
    const o = this.arr.find((x) => x.id === id);
    if (!o) return null;
    if (o.status === 'PAID') { o.status = 'REFUNDED'; o.refundedAt = new Date().toISOString(); }
    return o;
  }
  async markReady(id: string) {
    const o = this.arr.find((x) => x.id === id);
    if (!o) return null;
    if (o.status === 'PAID' && o.fulfilment !== 'READY') { o.fulfilment = 'READY'; o.readyAt = new Date().toISOString(); }
    return o;
  }
  async markCollected(id: string) {
    const o = this.arr.find((x) => x.id === id);
    if (!o) return null;
    if (o.status === 'PAID' && !o.collectedAt) o.collectedAt = new Date().toISOString();
    return o;
  }
  async addReview(r: Review) {
    if (this.reviews.some((x) => x.shopSlug === r.shopSlug && x.shortCode.toUpperCase() === r.shortCode.toUpperCase())) return { ok: false as const, error: DUPLICATE_REVIEW };
    this.reviews.push(r);
    return { ok: true as const, review: r };
  }
  async listReviews(shopSlug: string, limit: number) {
    return this.reviews.filter((x) => x.shopSlug === shopSlug).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  async reviewStats(shopSlug: string) {
    const ratings = this.reviews.filter((x) => x.shopSlug === shopSlug).map((x) => x.rating);
    return { count: ratings.length, average: averageRating(ratings) };
  }
  async listOrders(opts: { status?: OrderStatus; shopSlug?: string } = {}) {
    return this.arr.filter((o) => (!opts.status || o.status === opts.status) && (!opts.shopSlug || o.shopSlug === opts.shopSlug))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async stats(shopSlug?: string) { return computeStats(await this.listOrders({ shopSlug })); }
  async createShop(s: ShopRecord) { this.shops.push(s); }
  async getShopRecord(slug: string) { return slug === DEMO.slug ? DEMO : this.shops.find((s) => s.slug === slug) ?? null; }
  async countShops() { return this.shops.length; }
  async createQuote(q: QuoteRequest) { this.quotes.push(q); return q; }
  async listQuotes(shopSlug: string, status?: QuoteRequest['status']) {
    return this.quotes.filter((q) => q.shopSlug === shopSlug && (!status || q.status === status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async markQuoteInvoiced(id: string, shopSlug: string, code: string) {
    const q = this.quotes.find((x) => x.id === id && x.shopSlug === shopSlug);
    if (q) { q.status = 'INVOICED'; q.orderShortCode = code; }
  }
}

// ---------- postgres ----------
function getPool(): Pool {
  if (!gm.__ccPool) {
    const url = process.env.DATABASE_URL!;
    const local = /localhost|127\.0\.0\.1/.test(url);
    gm.__ccPool = new Pool({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false }, max: 5 });
  }
  return gm.__ccPool;
}

async function ready(): Promise<Pool> {
  const pool = getPool();
  if (!gm.__ccReady) {
    gm.__ccReady = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, short_code TEXT UNIQUE NOT NULL, paypal_order_id TEXT UNIQUE NOT NULL, capture_id TEXT,
        status TEXT NOT NULL, customer_name TEXT NOT NULL, lines JSONB NOT NULL, total NUMERIC(10,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD', pickup_date TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL,
        paid_at TIMESTAMPTZ, refunded_at TIMESTAMPTZ)`);
      for (const stmt of [
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_slug TEXT NOT NULL DEFAULT '${DEFAULT_SHOP_SLUG}'`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfilment TEXT NOT NULL DEFAULT 'NEW'`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'MENU'`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_id TEXT`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_url TEXT`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ`,
        `CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, shop_slug TEXT NOT NULL, short_code TEXT NOT NULL,
          rating INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '', customer_first_name TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL, UNIQUE (shop_slug, short_code))`,
        `CREATE INDEX IF NOT EXISTS orders_shop_idx ON orders (shop_slug, created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS shops (slug TEXT PRIMARY KEY, name TEXT NOT NULL, tagline TEXT NOT NULL DEFAULT '',
          items JSONB NOT NULL, pin_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, shop_slug TEXT NOT NULL, customer_name TEXT NOT NULL,
          customer_email TEXT, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', order_short_code TEXT,
          created_at TIMESTAMPTZ NOT NULL)`,
      ]) await pool.query(stmt);
    })().catch((e) => { gm.__ccReady = undefined; throw e; });
  }
  await gm.__ccReady;
  return pool;
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);
function rowToOrder(r: Row): Order {
  return {
    id: r.id, shortCode: r.short_code, paypalOrderId: r.paypal_order_id,
    captureId: r.capture_id ?? undefined, status: r.status, customerName: r.customer_name,
    lines: r.lines, total: Number(r.total), currency: 'USD',
    pickupDate: r.pickup_date ?? undefined, notes: r.notes ?? undefined,
    createdAt: iso(r.created_at)!, paidAt: iso(r.paid_at), refundedAt: iso(r.refunded_at),
    shopSlug: r.shop_slug, fulfilment: r.fulfilment, readyAt: iso(r.ready_at), collectedAt: iso(r.collected_at), kind: r.kind,
    invoiceId: r.invoice_id ?? undefined, invoiceUrl: r.invoice_url ?? undefined, customerEmail: r.customer_email ?? undefined,
  };
}
function rowToQuote(r: Row): QuoteRequest {
  return { id: r.id, shopSlug: r.shop_slug, customerName: r.customer_name, customerEmail: r.customer_email ?? undefined,
    description: r.description, status: r.status, orderShortCode: r.order_short_code ?? undefined, createdAt: iso(r.created_at)! };
}

function rowToReview(r: Row): Review {
  return { id: r.id, shopSlug: r.shop_slug, shortCode: r.short_code, rating: Number(r.rating), comment: r.comment,
    customerFirstName: r.customer_first_name, createdAt: iso(r.created_at)! };
}

class PgStore implements OrderStore {
  private async one(sql: string, params: unknown[]) {
    const r = await (await ready()).query(sql, params);
    return r.rows[0] ? rowToOrder(r.rows[0]) : null;
  }
  async createOrder(o: Order) {
    const pool = await ready();
    for (let i = 0; i < 12; i++) {
      try {
        await pool.query(
          `INSERT INTO orders (id, short_code, paypal_order_id, status, customer_name, lines, total, currency, pickup_date, notes, created_at,
             shop_slug, fulfilment, kind, invoice_id, invoice_url, customer_email)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'USD',$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [o.id, o.shortCode, o.paypalOrderId, o.status, o.customerName, JSON.stringify(o.lines), o.total, o.pickupDate ?? null, o.notes ?? null,
           o.createdAt, o.shopSlug, o.fulfilment, o.kind, o.invoiceId ?? null, o.invoiceUrl ?? null, o.customerEmail ?? null],
        );
        return o;
      } catch (e) {
        const err = e as { code?: string; constraint?: string };
        if (err.code === '23505' && String(err.constraint).includes('short_code')) { o.shortCode = newShortCode(i); continue; }
        throw e;
      }
    }
    throw new Error('Could not allocate an order code.');
  }
  getByShortCode(code: string, shopSlug?: string) {
    return shopSlug
      ? this.one('SELECT * FROM orders WHERE UPPER(short_code)=UPPER($1) AND shop_slug=$2', [code.trim(), shopSlug])
      : this.one('SELECT * FROM orders WHERE UPPER(short_code)=UPPER($1)', [code.trim()]);
  }
  getById(id: string) { return this.one('SELECT * FROM orders WHERE id=$1', [id]); }
  getByPaypalOrderId(id: string) { return this.one('SELECT * FROM orders WHERE paypal_order_id=$1', [id]); }
  getByCaptureId(id: string) { return this.one('SELECT * FROM orders WHERE capture_id=$1', [id]); }
  getByInvoiceId(id: string) { return this.one('SELECT * FROM orders WHERE invoice_id=$1', [id]); }
  async markPaid(id: string, captureId?: string) {
    await (await ready()).query(`UPDATE orders SET status='PAID', capture_id=$2, paid_at=now() WHERE id=$1 AND status IN ('PENDING_PAYMENT','INVOICED')`, [id, captureId ?? null]);
    return this.one('SELECT * FROM orders WHERE id=$1', [id]);
  }
  async markRefunded(id: string) {
    await (await ready()).query(`UPDATE orders SET status='REFUNDED', refunded_at=now() WHERE id=$1 AND status='PAID'`, [id]);
    return this.one('SELECT * FROM orders WHERE id=$1', [id]);
  }
  async markReady(id: string) {
    await (await ready()).query(`UPDATE orders SET fulfilment='READY', ready_at=now() WHERE id=$1 AND status='PAID' AND fulfilment<>'READY'`, [id]);
    return this.one('SELECT * FROM orders WHERE id=$1', [id]);
  }
  async markCollected(id: string) {
    await (await ready()).query(`UPDATE orders SET collected_at=now() WHERE id=$1 AND status='PAID' AND collected_at IS NULL`, [id]);
    return this.one('SELECT * FROM orders WHERE id=$1', [id]);
  }
  async addReview(r: Review) {
    const res = await (await ready()).query(
      `INSERT INTO reviews (id, shop_slug, short_code, rating, comment, customer_first_name, created_at) VALUES ($1,$2,UPPER($3),$4,$5,$6,$7)
       ON CONFLICT (shop_slug, short_code) DO NOTHING RETURNING id`,
      [r.id, r.shopSlug, r.shortCode, r.rating, r.comment, r.customerFirstName, r.createdAt]);
    return res.rows[0] ? { ok: true as const, review: r } : { ok: false as const, error: DUPLICATE_REVIEW };
  }
  async listReviews(shopSlug: string, limit: number) {
    const r = await (await ready()).query('SELECT * FROM reviews WHERE shop_slug=$1 ORDER BY created_at DESC LIMIT $2', [shopSlug, Math.max(1, Math.min(100, Math.floor(limit)))]);
    return r.rows.map(rowToReview);
  }
  async reviewStats(shopSlug: string) {
    const r = await (await ready()).query('SELECT count(*) AS n, COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS avg FROM reviews WHERE shop_slug=$1', [shopSlug]);
    return { count: Number(r.rows[0].n), average: Number(r.rows[0].avg) };
  }
  async listOrders(opts: { status?: OrderStatus; shopSlug?: string } = {}) {
    const pool = await ready();
    const where: string[] = []; const params: unknown[] = [];
    if (opts.status) { params.push(opts.status); where.push(`status=$${params.length}`); }
    if (opts.shopSlug) { params.push(opts.shopSlug); where.push(`shop_slug=$${params.length}`); }
    const r = await pool.query(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`, params);
    return r.rows.map(rowToOrder);
  }
  async stats(shopSlug?: string) { return computeStats(await this.listOrders({ shopSlug })); }
  async createShop(s: ShopRecord) {
    await (await ready()).query('INSERT INTO shops (slug,name,tagline,items,pin_hash,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [s.slug, s.name, s.tagline, JSON.stringify(s.items), s.pinHash, s.createdAt]);
  }
  async getShopRecord(slug: string) {
    if (slug === DEMO.slug) return DEMO;
    const r = await (await ready()).query('SELECT * FROM shops WHERE slug=$1', [slug]);
    const x = r.rows[0];
    return x ? { slug: x.slug, name: x.name, tagline: x.tagline, items: x.items, pinHash: x.pin_hash, createdAt: iso(x.created_at)! } : null;
  }
  async countShops() { return Number((await (await ready()).query('SELECT count(*) AS n FROM shops')).rows[0].n); }
  async createQuote(q: QuoteRequest) {
    await (await ready()).query('INSERT INTO quotes (id,shop_slug,customer_name,customer_email,description,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [q.id, q.shopSlug, q.customerName, q.customerEmail ?? null, q.description, q.status, q.createdAt]);
    return q;
  }
  async listQuotes(shopSlug: string, status?: QuoteRequest['status']) {
    const r = status
      ? await (await ready()).query('SELECT * FROM quotes WHERE shop_slug=$1 AND status=$2 ORDER BY created_at DESC LIMIT 200', [shopSlug, status])
      : await (await ready()).query('SELECT * FROM quotes WHERE shop_slug=$1 ORDER BY created_at DESC LIMIT 200', [shopSlug]);
    return r.rows.map(rowToQuote);
  }
  async markQuoteInvoiced(id: string, shopSlug: string, code: string) {
    await (await ready()).query(`UPDATE quotes SET status='INVOICED', order_short_code=$3 WHERE id=$1 AND shop_slug=$2`, [id, shopSlug, code]);
  }
}

let store: OrderStore | undefined;
export function getStore(): OrderStore {
  if (!store && !process.env.DATABASE_URL && process.env.VERCEL) {
    console.warn('[db] DATABASE_URL is not set on a serverless host: orders, shops and PIN lockouts live in the memory of ONE function instance and will be missing on other instances and after cold starts. Set DATABASE_URL.');
  }
  return (store ??= process.env.DATABASE_URL ? new PgStore() : new MemoryStore());
}

export const createOrder = (o: Order) => getStore().createOrder(o);
export const getByShortCode = (c: string, shopSlug?: string) => getStore().getByShortCode(c, shopSlug);
export const getById = (id: string) => getStore().getById(id);
export const getByPaypalOrderId = (id: string) => getStore().getByPaypalOrderId(id);
export const getByCaptureId = (id: string) => getStore().getByCaptureId(id);
export const getByInvoiceId = (id: string) => getStore().getByInvoiceId(id);
export const markPaid = (id: string, captureId?: string) => getStore().markPaid(id, captureId);
export const markRefunded = (id: string) => getStore().markRefunded(id);
export const markReady = (id: string) => getStore().markReady(id);
export const listOrders = (opts?: { status?: OrderStatus; shopSlug?: string }) => getStore().listOrders(opts);
export const stats = (shopSlug?: string) => getStore().stats(shopSlug);

export async function getShop(slug: string): Promise<Shop | null> {
  const r = await getStore().getShopRecord(slug);
  if (!r) return null;
  const { pinHash: _p, ...shop } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
  return shop;
}
export const getShopRecord = (slug: string) => getStore().getShopRecord(slug);
export const createShop = (s: ShopRecord) => getStore().createShop(s);
export const countShops = () => getStore().countShops();
export const createQuote = (q: QuoteRequest) => getStore().createQuote(q);
export const listQuotes = (shopSlug: string, status?: QuoteRequest['status']) => getStore().listQuotes(shopSlug, status);
export const markQuoteInvoiced = (id: string, shopSlug: string, code: string) => getStore().markQuoteInvoiced(id, shopSlug, code);
export const markCollected = (id: string) => getStore().markCollected(id);
export const addReview = (r: Review) => getStore().addReview(r);
export const listReviews = (shopSlug: string, limit: number) => getStore().listReviews(shopSlug, limit);
export const reviewStats = (shopSlug: string) => getStore().reviewStats(shopSlug);
