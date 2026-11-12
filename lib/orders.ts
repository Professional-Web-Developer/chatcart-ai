import { randomUUID } from 'node:crypto';
import type { Order, Shop } from './types';
import { priceCart, toCents, type CartInput } from './menu';
import * as db from './db';
import * as paypal from './paypal';

/** Prices come from the shop menu only; PayPal order is created with the server-computed total. */
export async function placeOrder(shop: Shop, input: { customerName: string; items: CartInput; pickupDate?: string; notes?: string }): Promise<Order> {
  const name = input.customerName?.trim();
  if (!name) throw new Error("A customer name is required before placing an order.");
  const { lines, total } = priceCart(input.items, shop.items);
  const id = randomUUID();
  const pp = await paypal.createOrder({ orderId: id, shopName: shop.name, lines, total });
  return db.createOrder({
    id, shortCode: db.newShortCode(), paypalOrderId: pp.id, status: 'PENDING_PAYMENT',
    customerName: name.slice(0, 80), lines, total, currency: 'USD',
    pickupDate: input.pickupDate?.slice(0, 80) || undefined, notes: input.notes?.slice(0, 300) || undefined,
    createdAt: new Date().toISOString(),
    shopSlug: shop.slug, fulfilment: 'NEW', kind: 'MENU',
  });
}

export type OrderResult = { ok: true; order: Order } | { ok: false; error: string };

/** Server-side rules: only PAID orders with a capture can be refunded. */
export async function refundOrderByCode(shortCode: string, shopSlug: string): Promise<OrderResult> {
  const order = await db.getByShortCode(shortCode, shopSlug);
  if (!order) return { ok: false, error: `No order found with code ${shortCode}.` };
  if (order.status === 'REFUNDED') return { ok: false, error: `Order ${order.shortCode} was already refunded.` };
  if (order.status !== 'PAID') return { ok: false, error: `Order ${order.shortCode} is ${order.status} and cannot be refunded (only paid orders can).` };
  if (!order.captureId) return { ok: false, error: `Order ${order.shortCode} has no payment capture on record (it may have been paid by invoice; refund it from PayPal).` };
  try {
    await paypal.refundCapture(order.captureId, `Refund for order ${order.shortCode}`);
  } catch (e) {
    // Already refunded at PayPal (e.g. from the PayPal dashboard): bring our record in line instead of failing forever.
    if (!(e instanceof paypal.PayPalError && e.issue === 'CAPTURE_FULLY_REFUNDED')) throw e;
  }
  const updated = await db.markRefunded(order.id);
  return { ok: true, order: updated ?? order };
}

export async function markReadyByCode(shortCode: string, shopSlug: string): Promise<OrderResult> {
  const order = await db.getByShortCode(shortCode, shopSlug);
  if (!order) return { ok: false, error: `No order found with code ${shortCode}.` };
  if (order.status !== 'PAID') return { ok: false, error: `Order ${order.shortCode} is ${order.status}; only paid orders can be marked ready.` };
  return { ok: true, order: (await db.markReady(order.id)) ?? order };
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/** PayPal Invoicing v2: create draft, send, store as a CUSTOM order in INVOICED status. */
export async function createCustomInvoice(shop: Shop, input: { customerName: string; customerEmail: string; description: string; amountUsd: number; quoteId?: string }): Promise<OrderResult> {
  const name = input.customerName?.trim();
  const email = input.customerEmail?.trim();
  const desc = input.description?.trim();
  if (!name || !desc) return { ok: false, error: 'Customer name and a description are required.' };
  if (!email || !EMAIL.test(email)) return { ok: false, error: 'A valid customer email is required to send a PayPal invoice.' };
  const cents = toCents(input.amountUsd);
  if (!Number.isFinite(cents) || cents < 100 || cents > 500000) return { ok: false, error: 'Invoice amount must be between $1.00 and $5,000.00.' };
  const shortCode = db.newShortCode();
  const { invoiceId, url } = await paypal.createAndSendInvoice({ shopName: shop.name, customerName: name, customerEmail: email, description: desc, amountCents: cents, orderCode: shortCode });
  const total = cents / 100;
  const order = await db.createOrder({
    id: randomUUID(), shortCode, paypalOrderId: `invoice:${invoiceId}`, status: 'INVOICED',
    customerName: name.slice(0, 80), lines: [{ itemId: 'custom', name: desc.slice(0, 200), qty: 1, unitPrice: total, lineTotal: total }],
    total, currency: 'USD', createdAt: new Date().toISOString(),
    shopSlug: shop.slug, fulfilment: 'NEW', kind: 'CUSTOM', invoiceId, invoiceUrl: url || undefined, customerEmail: email,
  });
  if (input.quoteId) await db.markQuoteInvoiced(input.quoteId, shop.slug, order.shortCode);
  return { ok: true, order };
}

export type CaptureResult = { ok: true; order: Order } | { ok: false; error: string; status: number };

/**
 * Verify-then-capture. Idempotent: an order that is already PAID/REFUNDED returns as-is without calling
 * PayPal, a PayPal order that is already COMPLETED is not captured again, and the state change is guarded
 * in the store. Throws PayPalError / PayPalConfigError for the route to map.
 */
export async function captureByPaypalOrderId(paypalOrderId: string): Promise<CaptureResult> {
  const order = await db.getByPaypalOrderId(paypalOrderId);
  if (!order) return { ok: false, error: 'We could not find an order for that PayPal payment.', status: 404 };
  if (order.status === 'PAID' || order.status === 'REFUNDED') return { ok: true, order };
  if (order.status !== 'PENDING_PAYMENT' || order.kind !== 'MENU') {
    return { ok: false, error: 'This order cannot be paid with the PayPal button.', status: 409 };
  }

  // Verify PayPal's copy of the order matches ours before taking the money.
  const pp = await paypal.getOrder(paypalOrderId);
  const unit = pp.purchase_units?.[0];
  if (unit?.custom_id !== order.id || !unit.amount || unit.amount.currency_code !== 'USD' || toCents(Number(unit.amount.value)) !== toCents(order.total)) {
    console.error('[capture] mismatch for', order.shortCode, unit?.custom_id, unit?.amount);
    return { ok: false, error: 'This payment does not match the order, so it was not accepted.', status: 409 };
  }

  let captured = pp;
  if (pp.status !== 'COMPLETED') {
    try {
      captured = await paypal.captureOrder(paypalOrderId);
    } catch (e) {
      if (e instanceof paypal.PayPalConfigError) throw e;
      // Concurrent/duplicate capture: re-read and carry on if it is actually complete.
      captured = await paypal.getOrder(paypalOrderId);
      if (captured.status !== 'COMPLETED') {
        if (e instanceof paypal.PayPalError && e.issue === 'ORDER_NOT_APPROVED') {
          return { ok: false, error: 'This payment has not been approved in PayPal yet.', status: 409 };
        }
        throw e;
      }
    }
  }
  const cap = captured.purchase_units?.[0]?.payments?.captures?.[0];
  if (captured.status !== 'COMPLETED' || !cap || (cap.status && cap.status !== 'COMPLETED')) {
    return { ok: false, error: 'PayPal has not completed this payment yet. If you were charged, please contact the shop.', status: 402 };
  }
  if (cap.amount && (cap.amount.currency_code !== 'USD' || toCents(Number(cap.amount.value)) !== toCents(order.total))) {
    console.error('[capture] captured amount differs for', order.shortCode, cap.amount);
    return { ok: false, error: 'The captured amount does not match the order. Please contact the shop.', status: 409 };
  }
  const updated = await db.markPaid(order.id, cap.id);
  return { ok: true, order: updated ?? order };
}
