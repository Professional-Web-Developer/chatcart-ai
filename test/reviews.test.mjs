import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewProblem, ratingProblem, cleanComment, reviewerFirstName, collectProblem, averageRating } from '../lib/reviews.ts';

const order = (o = {}) => ({ shopSlug: 's', shortCode: 'CC-1234', status: 'PAID', ...o });

test('review allowed only for a PAID order of the same shop without a review', () => {
  assert.equal(reviewProblem(order(), 's', false), null);
  assert.match(reviewProblem(null, 's', false), /No order found/);
  assert.match(reviewProblem(order({ shopSlug: 'other' }), 's', false), /No order found/);
  for (const status of ['PENDING_PAYMENT', 'REFUNDED', 'INVOICED', 'CANCELLED']) {
    assert.equal(reviewProblem(order({ status }), 's', false), 'Only paid orders can be reviewed');
  }
  assert.equal(reviewProblem(order(), 's', true), 'This order already has a review');
});

test('rating must be an integer from 1 to 5', () => {
  for (const r of [1, 2, 3, 4, 5]) assert.equal(ratingProblem(r), null);
  for (const r of [0, 6, -1, 4.5, NaN, Infinity, '5', null, undefined]) assert.ok(ratingProblem(r));
});

test('comment is trimmed, stripped of control characters and cut to 500', () => {
  assert.equal(cleanComment('  Lovely cake!  '), 'Lovely cake!');
  assert.equal(cleanComment('a\u0000b\u0007c\u009fd\u007f'), 'abcd');
  assert.equal(cleanComment('line one\nline two\ttab'), 'line one line two tab');
  assert.equal(cleanComment(''), '');
  assert.equal(cleanComment(undefined), '');
  assert.equal(cleanComment('x'.repeat(900)).length, 500);
  assert.equal(Array.from(cleanComment('😀'.repeat(600))).length, 500);
});

test('reviewer name is the first word of the customer name, max 20 chars', () => {
  assert.equal(reviewerFirstName('Priya Sharma'), 'Priya');
  assert.equal(reviewerFirstName('  Anu   K  '), 'Anu');
  assert.equal(reviewerFirstName(''), '');
  assert.equal(reviewerFirstName('Bartholomewbartholomewbartholomew Smith').length, 20);
});

test('collected can be set only on PAID orders', () => {
  assert.equal(collectProblem(order()), null);
  for (const status of ['PENDING_PAYMENT', 'REFUNDED', 'INVOICED', 'CANCELLED']) assert.match(collectProblem(order({ status })), /only paid orders/);
});

test('average is rounded to one decimal and 0 when empty', () => {
  assert.equal(averageRating([]), 0);
  assert.equal(averageRating([5, 4, 4]), 4.3);
  assert.equal(averageRating([5, 5]), 5);
  assert.equal(averageRating([1, 2]), 1.5);
});

test('memory store: one review per order, stats and listing, collected only when PAID', async () => {
  delete process.env.DATABASE_URL;
  const db = await import('../lib/db.ts');
  const base = { paypalOrderId: 'p', customerName: 'Priya Sharma', lines: [], total: 5, currency: 'USD', createdAt: new Date().toISOString(), shopSlug: 'rv-shop', fulfilment: 'NEW', kind: 'MENU' };
  const paid = await db.createOrder({ ...base, id: 'o1', shortCode: 'CC-9001', paypalOrderId: 'p1', status: 'PENDING_PAYMENT' });
  assert.equal((await db.markCollected(paid.id)).collectedAt, undefined);
  await db.markPaid(paid.id, 'cap1');
  assert.ok((await db.markCollected(paid.id)).collectedAt);
  assert.deepEqual(await db.reviewStats('rv-shop'), { count: 0, average: 0 });
  const r = (o) => ({ id: o.id, shopSlug: 'rv-shop', shortCode: 'CC-9001', rating: 5, comment: 'Great', customerFirstName: 'Priya', createdAt: new Date().toISOString(), ...o });
  assert.equal((await db.addReview(r({ id: 'r1' }))).ok, true);
  const dup = await db.addReview(r({ id: 'r2', rating: 1 }));
  assert.deepEqual(dup, { ok: false, error: 'This order already has a review' });
  assert.equal((await db.addReview(r({ id: 'r3', shortCode: 'CC-9002', rating: 4 }))).ok, true);
  assert.deepEqual(await db.reviewStats('rv-shop'), { count: 2, average: 4.5 });
  assert.equal((await db.listReviews('rv-shop', 1)).length, 1);
  assert.deepEqual(await db.reviewStats('other-shop'), { count: 0, average: 0 });
});
