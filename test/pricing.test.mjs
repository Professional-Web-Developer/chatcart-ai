import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceCart, PricingError, MENU } from '../lib/menu.ts';

test('prices come from the menu and totals are exact to the cent', () => {
  const { lines, total } = priceCart([
    { itemId: 'red-velvet-cake', qty: 3 },      // 34.50
    { itemId: 'cinnamon-rolls-4', qty: 3 },     // 12.75
    { itemId: 'lemon-cupcakes-box-6', qty: 7 }, // 19.50
  ]);
  assert.deepEqual(lines.map((l) => l.lineTotal), [103.5, 38.25, 136.5]);
  assert.equal(total, 278.25);
  assert.equal(Math.round(total * 100), lines.reduce((s, l) => s + Math.round(l.unitPrice * 100) * l.qty, 0));
});

test('no float drift on awkward prices', () => {
  const menu = [{ id: 'a', name: 'A', description: '', priceUsd: 0.1, category: 'x', emoji: 'x' }, { id: 'b', name: 'B', description: '', priceUsd: 0.2, category: 'x', emoji: 'x' }, { id: 'c', name: 'C', description: '', priceUsd: 1.15, category: 'x', emoji: 'x' }];
  assert.equal(priceCart([{ itemId: 'a', qty: 1 }, { itemId: 'b', qty: 1 }], menu).total, 0.3);
  assert.equal(priceCart([{ itemId: 'c', qty: 3 }], menu).total, 3.45);
});

test('duplicate lines are merged and notes kept', () => {
  const { lines, total } = priceCart([{ itemId: 'sourdough-loaf', qty: 1, notes: 'sliced' }, { itemId: 'sourdough-loaf', qty: 2, notes: ' unsliced ' }]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].qty, 3);
  assert.equal(lines[0].notes, 'sliced; unsliced');
  assert.equal(total, 27);
});

test('a price smuggled into the cart input is ignored', () => {
  const { lines, total } = priceCart([{ itemId: 'banana-bread', qty: 1, unitPrice: 0.01, priceUsd: 0.01, lineTotal: 0.01 }]);
  assert.equal(lines[0].unitPrice, 10);
  assert.equal(total, 10);
});

test('rejects empty carts, unknown items and bad quantities', () => {
  assert.throws(() => priceCart([]), PricingError);
  assert.throws(() => priceCart(undefined), PricingError);
  assert.throws(() => priceCart([{ itemId: 'free-cake', qty: 1 }]), /not on the menu/);
  for (const qty of [0, -1, 1.5, 51, NaN, '2']) assert.throws(() => priceCart([{ itemId: 'banana-bread', qty }]), PricingError, `qty ${qty}`);
  assert.throws(() => priceCart([{ itemId: 'banana-bread', qty: 30 }, { itemId: 'banana-bread', qty: 30 }]), /50 or fewer/);
  assert.throws(() => priceCart(Array.from({ length: 21 }, () => ({ itemId: 'banana-bread', qty: 1 }))), /Too many/);
});

test('an item from another shop cannot be ordered', () => {
  const other = [{ id: 'kurta', name: 'Kurta', description: '', priceUsd: 22, category: 'x', emoji: 'x' }];
  assert.throws(() => priceCart([{ itemId: MENU[0].id, qty: 1 }], other), /not on the menu/);
});
