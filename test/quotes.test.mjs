import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateQuote } from '../lib/quotes.ts';

const now = Date.parse('2026-11-12T10:00:00Z');
const q = (o = {}) => ({ id: 'q1', shopSlug: 's', customerName: 'Priya', description: 'Two-tier cake for 20', status: 'PENDING', createdAt: new Date(now - 10 * 60_000).toISOString(), ...o });
const cand = { shopSlug: 's', customerName: ' priya ', description: 'two-tier  CAKE\nfor 20' };

test('matches same shop, name and description ignoring case and whitespace', () => {
  assert.equal(findDuplicateQuote([q()], cand, now)?.id, 'q1');
});
test('no match when old, other shop, other name, other text or not PENDING', () => {
  assert.equal(findDuplicateQuote([q({ createdAt: new Date(now - 31 * 60_000).toISOString() })], cand, now), undefined);
  assert.equal(findDuplicateQuote([q({ shopSlug: 'x' })], cand, now), undefined);
  assert.equal(findDuplicateQuote([q({ customerName: 'Anu' })], cand, now), undefined);
  assert.equal(findDuplicateQuote([q({ description: 'Two-tier cake for 30' })], cand, now), undefined);
  assert.equal(findDuplicateQuote([q({ status: 'INVOICED' })], cand, now), undefined);
});
