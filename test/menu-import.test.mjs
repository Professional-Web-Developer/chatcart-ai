import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanMenu, slugify, MAX_ITEMS } from '../lib/menu-import.ts';

test('keeps sellable rows and normalises them', () => {
  const out = cleanMenu([
    { name: '  Blouse   stitching ', description: 'with\nlining', price: 18, category: 'Stitching', emoji: '🧵' },
    { name: 'Laddu box of 8', price: '$9.50' },
  ]);
  assert.deepEqual(out[0], { id: 'blouse-stitching', name: 'Blouse stitching', description: 'with lining', priceUsd: 18, category: 'Stitching', emoji: '🧵' });
  assert.equal(out[1].priceUsd, 9.5);
  assert.equal(out[1].category, 'Menu');
  assert.equal(out[1].emoji, '🛍️');
});

test('drops rows without a usable name or price', () => {
  const out = cleanMenu([
    { name: '', price: 5 }, { name: 'No price' }, { name: 'Text price', price: 'ask' }, { name: 'Too cheap', price: 0.49 },
    { name: 'Too dear', price: 2000.01 }, { name: 'Negative', price: -5 }, { name: 'NaN', price: NaN }, { name: 'Inf', price: Infinity },
    null, 'junk', { name: 'Lower bound', price: 0.5 }, { name: 'Upper bound', price: 2000 },
  ]);
  assert.deepEqual(out.map((i) => i.name), ['Lower bound', 'Upper bound']);
});

test('ids are slugs, unique, and exact duplicates are removed', () => {
  const out = cleanMenu([
    { name: 'Chocolate Cake', price: 30 }, { name: 'chocolate cake', price: 30 }, { name: 'Chocolate Cake', price: 45 },
    { name: 'Chocolate-Cake!', price: 50 }, { name: '🎂🎂', price: 9 }, { name: 'Crème brûlée', price: 6 },
  ]);
  assert.deepEqual(out.map((i) => i.id), ['chocolate-cake', 'chocolate-cake-2', 'chocolate-cake-3', 'item', 'creme-brulee']);
  assert.equal(new Set(out.map((i) => i.id)).size, out.length);
  for (const i of out) assert.match(i.id, /^[a-z0-9-]+$/);
});

test('caps the menu and field lengths, strips control characters, rounds to cents', () => {
  const many = Array.from({ length: 60 }, (_, n) => ({ name: `Item ${n}`, price: 1 + n }));
  assert.equal(cleanMenu(many).length, MAX_ITEMS);
  const [it] = cleanMenu([{ name: 'x'.repeat(300), description: 'd'.repeat(500) + '\u0000', price: 12.345, category: 'c'.repeat(90), emoji: 'not an emoji' }]);
  assert.equal(it.name.length, 80);
  assert.equal(it.description.length, 200);
  assert.equal(it.category.length, 40);
  assert.ok(it.id.length <= 40);
  assert.equal(it.priceUsd, 12.35);
  assert.equal(it.emoji, '🛍️');
  assert.deepEqual(cleanMenu('not an array'), []);
});

test('slugify', () => {
  assert.equal(slugify("Meena's Tailoring"), 'meena-s-tailoring');
  assert.equal(slugify('  --Hello   World--  '), 'hello-world');
  assert.equal(slugify('!!!'), '');
  assert.ok(!slugify('a'.repeat(29) + ' b', 30).endsWith('-'));
});

test('filterUsdItems keeps USD/$/empty currency and reports the rest as skipped', async () => {
  const { filterUsdItems } = await import('../lib/menu-import.ts');
  const { kept, skipped } = filterUsdItems([
    { name: 'A', price: 5, currency: 'USD' }, { name: 'B', price: 6, currency: '$' }, { name: 'C', price: 7, currency: '' },
    { name: 'D', price: 8 }, { name: 'E', price: 450, currency: 'Rs' }, { name: ' F ', price: 350, currency: '₹' }, { name: 'G', price: 9, currency: ' usd ' },
    { name: 'H', price: 1, currency: 'INR' },
  ]);
  assert.deepEqual(kept.map((i) => i.name), ['A', 'B', 'C', 'D', 'G']);
  assert.deepEqual(skipped, ['E', 'F', 'H']);
  assert.deepEqual(filterUsdItems([{ name: 'X', price: 1, currency: 'EUR' }]), { kept: [], skipped: ['X'] });
});
