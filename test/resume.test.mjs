import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumableOrder } from '../lib/agent.ts';

const base = { id: '1', shortCode: 'CC-1000', paypalOrderId: 'PP1', status: 'PENDING_PAYMENT', customerName: 'Kavin', customerEmail: 'k@example.com',
  lines: [{ itemId: 'a', name: 'Cake', qty: 1, unitPrice: 10, lineTotal: 10, notes: 'eggless' }], total: 10, currency: 'USD', notes: 'call me',
  createdAt: '2026-11-12T00:00:00Z', shopSlug: 'anus-home-bakery', fulfilment: 'NEW', kind: 'MENU' };

test('unpaid menu order can be resumed without personal details', () => {
  const r = resumableOrder(base);
  assert.equal(r.paypalOrderId, 'PP1');
  assert.equal(r.total, 10);
  assert.equal(r.customerName, '');
  assert.equal(r.notes, undefined);
  assert.equal(r.customerEmail, undefined);
  assert.equal(r.lines[0].notes, undefined);
});

test('paid, refunded and invoice orders are not resumable', () => {
  assert.equal(resumableOrder({ ...base, status: 'PAID' }), undefined);
  assert.equal(resumableOrder({ ...base, status: 'REFUNDED' }), undefined);
  assert.equal(resumableOrder({ ...base, kind: 'CUSTOM', status: 'INVOICED' }), undefined);
});
