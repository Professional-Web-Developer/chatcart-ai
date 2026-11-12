import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakePayPal } from './fake-paypal.mjs';

const pp = installFakePayPal(); // must run before the app modules read the environment
const { placeOrder, captureByPaypalOrderId, refundOrderByCode, markReadyByCode, createCustomInvoice } = await import('../lib/orders.ts');
const db = await import('../lib/db.ts');
const { buildVerifyBody } = await import('../lib/paypal.ts');
const { customerOrderView } = await import('../lib/agent.ts').catch(() => ({ customerOrderView: null }));

const shop = await db.getShop('anus-home-bakery');
const cart = { customerName: ' Priya ', items: [{ itemId: 'red-velvet-cake', qty: 3 }, { itemId: 'cinnamon-rolls-4', qty: 1, notes: 'extra icing' }], pickupDate: 'Saturday' };
const newOrder = () => placeOrder(shop, cart);

test('placeOrder sends PayPal an itemised order whose breakdown equals the items', async () => {
  const o = await newOrder();
  assert.equal(o.status, 'PENDING_PAYMENT');
  assert.equal(o.kind, 'MENU');
  assert.equal(o.fulfilment, 'NEW');
  assert.equal(o.customerName, 'Priya');
  assert.equal(o.total, 116.25);
  assert.match(o.shortCode, /^CC-\d{4}$/);
  const call = pp.calls('POST', /^\/v2\/checkout\/orders$/).at(-1);
  const unit = call.body.purchase_units[0];
  assert.equal(call.body.intent, 'CAPTURE');
  assert.equal(unit.custom_id, o.id);
  assert.equal(unit.amount.value, '116.25');
  assert.equal(unit.amount.breakdown.item_total.value, unit.amount.value);
  const money = /^\d+\.\d{2}$/;
  let cents = 0;
  for (const it of unit.items) {
    assert.match(it.unit_amount.value, money);
    assert.equal(it.unit_amount.currency_code, 'USD');
    assert.equal(typeof it.quantity, 'string');
    cents += Math.round(Number(it.unit_amount.value) * 100) * Number(it.quantity);
  }
  assert.equal(cents, 11625);
  assert.ok(call.headers['PayPal-Request-Id'], 'idempotency key sent');
  assert.ok(call.headers.Authorization.startsWith('Bearer '));
});

test('placeOrder refuses unknown items and missing names without calling PayPal', async () => {
  const before = pp.calls('POST', /^\/v2\/checkout\/orders$/).length;
  await assert.rejects(placeOrder(shop, { customerName: 'A', items: [{ itemId: 'gold-bar', qty: 1 }] }), /not on the menu/);
  await assert.rejects(placeOrder(shop, { customerName: '  ', items: [{ itemId: 'banana-bread', qty: 1 }] }), /name is required/);
  assert.equal(pp.calls('POST', /^\/v2\/checkout\/orders$/).length, before);
});

test('capture: unknown order, unapproved order, then pay; second capture is idempotent', async () => {
  assert.deepEqual(await captureByPaypalOrderId('NOPE12345'), { ok: false, error: 'We could not find an order for that PayPal payment.', status: 404 });

  const o = await newOrder();
  const early = await captureByPaypalOrderId(o.paypalOrderId);
  assert.equal(early.ok, false);
  assert.equal(early.status, 409);
  assert.equal((await db.getById(o.id)).status, 'PENDING_PAYMENT');

  pp.approve(o.paypalOrderId);
  const paid = await captureByPaypalOrderId(o.paypalOrderId);
  assert.equal(paid.ok, true);
  assert.equal(paid.order.status, 'PAID');
  assert.match(paid.order.captureId, /^CAP/);
  assert.ok(paid.order.paidAt);

  const capturesBefore = pp.calls('POST', /\/capture$/).length, callsBefore = pp.state.calls.length;
  const again = await captureByPaypalOrderId(o.paypalOrderId);
  assert.equal(again.ok, true);
  assert.equal(again.order.captureId, paid.order.captureId);
  assert.equal(pp.calls('POST', /\/capture$/).length, capturesBefore, 'no second capture');
  assert.equal(pp.state.calls.length, callsBefore, 'no PayPal call at all for a paid order');
});

test('capture: an order PayPal already completed (e.g. webhook race) is not captured twice', async () => {
  const o = await newOrder();
  const remote = pp.state.orders.get(o.paypalOrderId);
  remote.status = 'COMPLETED';
  remote.purchase_units[0].payments = { captures: [{ id: 'CAP-EXISTING', status: 'COMPLETED', amount: remote.purchase_units[0].amount }] };
  const n = pp.calls('POST', /\/capture$/).length;
  const r = await captureByPaypalOrderId(o.paypalOrderId);
  assert.equal(r.ok, true);
  assert.equal(r.order.captureId, 'CAP-EXISTING');
  assert.equal(pp.calls('POST', /\/capture$/).length, n);
});

test('capture: concurrent requests end in exactly one PAID state', async () => {
  const o = await newOrder();
  pp.approve(o.paypalOrderId);
  const rs = await Promise.all([captureByPaypalOrderId(o.paypalOrderId), captureByPaypalOrderId(o.paypalOrderId), captureByPaypalOrderId(o.paypalOrderId)]);
  assert.ok(rs.every((r) => r.ok && r.order.status === 'PAID'));
  assert.equal(new Set(rs.map((r) => r.order.captureId)).size, 1);
});

test('capture: refuses when PayPal holds a different amount or a different order', async () => {
  const o = await newOrder();
  pp.state.orders.get(o.paypalOrderId).purchase_units[0].amount = { currency_code: 'USD', value: '1.00' };
  pp.approve(o.paypalOrderId);
  const r = await captureByPaypalOrderId(o.paypalOrderId);
  assert.equal(r.status, 409);
  assert.equal((await db.getById(o.id)).status, 'PENDING_PAYMENT');
  assert.equal(pp.state.orders.get(o.paypalOrderId).status, 'APPROVED', 'money was not taken');

  const o2 = await newOrder();
  pp.state.orders.get(o2.paypalOrderId).purchase_units[0].custom_id = 'someone-else';
  pp.approve(o2.paypalOrderId);
  assert.equal((await captureByPaypalOrderId(o2.paypalOrderId)).status, 409);
});

test('mark ready and refund follow the state machine', async () => {
  const o = await newOrder();
  assert.match((await markReadyByCode(o.shortCode, shop.slug)).error, /only paid orders/);
  assert.match((await refundOrderByCode(o.shortCode, shop.slug)).error, /cannot be refunded/);
  assert.match((await refundOrderByCode('CC-0000', shop.slug)).error, /No order found/);
  assert.match((await refundOrderByCode(o.shortCode, 'another-shop')).error, /No order found/, 'codes are scoped to the shop');

  pp.approve(o.paypalOrderId);
  await captureByPaypalOrderId(o.paypalOrderId);
  const ready = await markReadyByCode(o.shortCode.toLowerCase(), shop.slug);
  assert.equal(ready.order.fulfilment, 'READY');
  assert.ok(ready.order.readyAt);
  const readyAt = ready.order.readyAt;
  assert.equal((await markReadyByCode(o.shortCode, shop.slug)).order.readyAt, readyAt, 'marking ready twice changes nothing');

  const refunds = () => pp.calls('POST', /\/refund$/).length;
  const n = refunds();
  const ref = await refundOrderByCode(o.shortCode, shop.slug);
  assert.equal(ref.ok, true);
  assert.equal(ref.order.status, 'REFUNDED');
  assert.ok(ref.order.refundedAt);
  assert.equal(refunds(), n + 1);
  assert.equal(pp.calls('POST', /\/refund$/).at(-1).path, `/v2/payments/captures/${ref.order.captureId}/refund`);

  assert.match((await refundOrderByCode(o.shortCode, shop.slug)).error, /already refunded/);
  assert.equal(refunds(), n + 1, 'no second refund request');
  assert.match((await markReadyByCode(o.shortCode, shop.slug)).error, /only paid orders/);
  const afterRefund = await captureByPaypalOrderId(o.paypalOrderId);
  assert.equal(afterRefund.order.status, 'REFUNDED', 'a late capture call cannot flip a refunded order back to paid');
});

test('refund: a PayPal failure leaves the order PAID; "already refunded at PayPal" syncs it', async () => {
  const o = await newOrder();
  pp.approve(o.paypalOrderId);
  const { order } = await captureByPaypalOrderId(o.paypalOrderId);
  pp.failOnce('POST', /\/refund$/, 500, 'INTERNAL_ERROR');
  await assert.rejects(refundOrderByCode(o.shortCode, shop.slug));
  assert.equal((await db.getById(o.id)).status, 'PAID');
  pp.state.refunded.add(order.captureId); // refunded from the PayPal dashboard
  const r = await refundOrderByCode(o.shortCode, shop.slug);
  assert.equal(r.order.status, 'REFUNDED');
});

test('stats count each state and revenue only from paid orders', async () => {
  const s = await db.stats(shop.slug);
  const all = await db.listOrders({ shopSlug: shop.slug });
  assert.equal(s.paidCount, all.filter((o) => o.status === 'PAID').length);
  assert.equal(s.refundedCount, all.filter((o) => o.status === 'REFUNDED').length);
  assert.equal(s.pendingCount, all.filter((o) => o.status === 'PENDING_PAYMENT').length);
  assert.equal(Math.round(s.revenue * 100), all.filter((o) => o.status === 'PAID').reduce((n, o) => n + Math.round(o.total * 100), 0));
  assert.equal(typeof s.invoicedCount, 'number');
});

test('custom invoice: validated, stored as INVOICED, never payable through checkout capture', async () => {
  const base = { customerName: 'Ravi Kumar', customerEmail: 'ravi@example.com', description: '3-tier wedding cake', amountUsd: 250 };
  for (const bad of [{ amountUsd: 0.99 }, { amountUsd: 5000.01 }, { amountUsd: NaN }, { customerEmail: 'not-an-email' }, { customerEmail: '' }, { description: ' ' }, { customerName: '' }]) {
    const r = await createCustomInvoice(shop, { ...base, ...bad });
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
  assert.equal(pp.calls('POST', /^\/v2\/invoicing\/invoices$/).length, 0, 'nothing reached PayPal');

  const q = await db.createQuote({ id: 'q-1', shopSlug: shop.slug, customerName: 'Ravi Kumar', description: 'wedding cake', status: 'PENDING', createdAt: new Date().toISOString() });
  const r = await createCustomInvoice(shop, { ...base, quoteId: q.id });
  assert.equal(r.ok, true);
  assert.equal(r.order.status, 'INVOICED');
  assert.equal(r.order.kind, 'CUSTOM');
  assert.equal(r.order.paypalOrderId, `invoice:${r.order.invoiceId}`);
  assert.equal(r.order.total, 250);
  assert.ok(r.order.invoiceUrl);

  const draft = pp.calls('POST', /^\/v2\/invoicing\/invoices$/).at(-1).body;
  assert.equal(draft.detail.currency_code, 'USD');
  assert.equal(draft.detail.reference, r.order.shortCode);
  assert.deepEqual(draft.primary_recipients[0].billing_info, { name: { given_name: 'Ravi', surname: 'Kumar' }, email_address: 'ravi@example.com' });
  assert.deepEqual(draft.items, [{ name: '3-tier wedding cake', quantity: '1', unit_amount: { currency_code: 'USD', value: '250.00' } }]);
  assert.equal(pp.calls('POST', /\/send$/).length, 1);

  assert.deepEqual((await db.listQuotes(shop.slug, 'PENDING')).map((x) => x.id), []);
  assert.equal((await db.listQuotes(shop.slug, 'INVOICED'))[0].orderShortCode, r.order.shortCode);
  assert.equal((await db.stats(shop.slug)).invoicedCount, 1);

  const cap = await captureByPaypalOrderId(r.order.paypalOrderId);
  assert.equal(cap.ok, false);
  assert.equal(cap.status, 409);
  assert.match((await refundOrderByCode(r.order.shortCode, shop.slug)).error, /cannot be refunded/);

  // INVOICING.INVOICE.PAID path
  const paid = await db.markPaid(r.order.id, 'TXN-1');
  assert.equal(paid.status, 'PAID');
  assert.equal((await db.markPaid(r.order.id, 'TXN-2')).captureId, 'TXN-1', 'a repeated webhook does not overwrite');
});

test('webhook verification forwards the event bytes exactly as received', () => {
  const raw = '{"id":"WH-1","resource":{"amount":{"value":"10.00","n":10.0,"big":12345678901234567890},"note":"caf\\u00e9"}}';
  const headers = new Headers({ 'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://paypal.test/cert', 'paypal-transmission-id': 't-1', 'paypal-transmission-sig': 'sig==', 'paypal-transmission-time': '2026-11-12T00:00:00Z' });
  const body = buildVerifyBody(headers, raw, 'WH-ID');
  assert.ok(body.includes(`"webhook_event":${raw}}`), 'raw text embedded untouched');
  const parsed = JSON.parse(body);
  assert.deepEqual(Object.keys(parsed).sort(), ['auth_algo', 'cert_url', 'transmission_id', 'transmission_sig', 'transmission_time', 'webhook_event', 'webhook_id']);
  assert.equal(parsed.webhook_id, 'WH-ID');
  assert.equal(parsed.transmission_sig, 'sig==');
  assert.notEqual(JSON.stringify(JSON.parse(raw)), raw, 'this payload would not survive a parse/stringify round trip');
});

test('what a customer can see from an order code leaves out personal details', { skip: !customerOrderView }, async () => {
  const o = await placeOrder(shop, { ...cart, notes: 'gate code 4411' });
  const view = customerOrderView({ ...o, customerEmail: 'p@example.com', invoiceUrl: 'https://paypal.test/i' });
  const text = JSON.stringify(view);
  for (const secret of ['Priya', 'gate code', 'p@example.com', 'paypal.test', o.id, o.paypalOrderId]) assert.ok(!text.includes(secret), secret);
  assert.equal(view.shortCode, o.shortCode);
  assert.equal(view.total, o.total);
});
