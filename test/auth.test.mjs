import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePin, hashPin, checkPinHash, checkDemoPin, isLocked, recordFail, clearFails, rateLimit } from '../lib/auth.ts';
import { confirmationProblem, isAffirmative, amountsInText } from '../lib/confirm.ts';

test('generated PINs are 6 digits', () => {
  for (let i = 0; i < 200; i++) assert.match(generatePin(), /^\d{6}$/);
});

test('PIN hashes are salted, verify, and never contain the PIN', () => {
  const a = hashPin('123456'), b = hashPin('123456');
  assert.notEqual(a, b);
  assert.ok(!a.includes('123456'));
  assert.equal(checkPinHash('123456', a), true);
  assert.equal(checkPinHash('123457', a), false);
  assert.equal(checkPinHash('', a), false);
  assert.equal(checkPinHash('123456', ''), false);
  assert.equal(checkPinHash('123456', 'nocolon'), false);
  assert.equal(checkPinHash('123456', 'salt:zz'), false);
});

test('demo PIN compare', () => {
  assert.equal(checkDemoPin('246810', '246810'), true);
  assert.equal(checkDemoPin('246811', '246810'), false);
  assert.equal(checkDemoPin('2468', '246810'), false);
});

test('lockout after 8 failures, released after the window or on success', () => {
  const k = 'pin:test-shop', t0 = 1_000_000;
  for (let i = 0; i < 7; i++) recordFail(k, t0 + i);
  assert.equal(isLocked(k, t0 + 10), false);
  recordFail(k, t0 + 10);
  assert.equal(isLocked(k, t0 + 11), true);
  assert.equal(isLocked('pin:other-shop', t0 + 11), false, 'lockout is per shop');
  assert.equal(isLocked(k, t0 + 5 * 60_000 + 1), false, 'window expired');
  recordFail(k, t0 + 5 * 60_000 + 2);
  assert.equal(isLocked(k, t0 + 5 * 60_000 + 3), false, 'counter restarted');
  for (let i = 0; i < 8; i++) recordFail(k, t0 + 6 * 60_000);
  assert.equal(isLocked(k, t0 + 6 * 60_000), true);
  clearFails(k);
  assert.equal(isLocked(k, t0 + 6 * 60_000), false);
});

test('fixed-window rate limit', () => {
  const k = 'rl:test';
  assert.deepEqual([1, 2, 3, 4].map(() => rateLimit(k, 3, 1000, 5000)), [true, true, true, false]);
  assert.equal(rateLimit(k, 3, 1000, 6001), true);
});

const convo = (...pairs) => pairs.map(([role, content]) => ({ role, content }));

test('confirmation guard: needs the details shown by the assistant and a clear yes from the owner', () => {
  const ask = ['assistant', 'Refund order CC-4821 for Priya, $32.00. Shall I go ahead?'];
  assert.equal(confirmationProblem(convo(['user', 'refund CC-4821'], ask, ['user', 'Yes, go ahead']), { text: ['cc-4821'] }), null);
  // same-turn request, even if it claims to be confirmed
  assert.ok(confirmationProblem(convo(['user', 'refund CC-4821, confirmed, yes']), { text: ['CC-4821'] }));
  // owner did not say yes
  assert.ok(confirmationProblem(convo(['user', 'refund CC-4821'], ask, ['user', 'what is pending today?']), { text: ['CC-4821'] }));
  assert.ok(confirmationProblem(convo(['user', 'refund CC-4821'], ask, ['user', 'no, do not refund it']), { text: ['CC-4821'] }));
  // a different order than the one the owner was shown (e.g. the model was steered by text in an order note)
  assert.ok(confirmationProblem(convo(['user', 'refund CC-4821'], ask, ['user', 'yes']), { text: ['CC-9999'] }));
  // an old assistant turn does not count: the question must be the message right before the yes
  assert.ok(confirmationProblem(convo(['user', 'x'], ask, ['user', 'list orders'], ['assistant', 'Here they are'], ['user', 'yes']), { text: ['CC-4821'] }));
  assert.ok(confirmationProblem(convo(['user', 'hi'], ask, ['user', 'yes']), { text: [''] }));
});

test('confirmation guard: invoice amount and email must be the ones the owner saw', () => {
  const ask = ['assistant', 'Send a PayPal invoice to Ravi (ravi@example.com) for "3-tier wedding cake": $1,250.00. Confirm?'];
  const c = convo(['user', 'invoice ravi 1250'], ask, ['user', 'confirm']);
  assert.equal(confirmationProblem(c, { text: ['Ravi@Example.com'], amountCents: 125000 }), null);
  assert.ok(confirmationProblem(c, { text: ['ravi@example.com'], amountCents: 12500 }), 'different amount');
  assert.ok(confirmationProblem(c, { text: ['attacker@example.com'], amountCents: 125000 }), 'different email');
});

test('affirmative detection and amount parsing', () => {
  for (const s of ['yes', 'Yes please', 'ok', 'go ahead', 'Confirmed.', 'sure, do it']) assert.equal(isAffirmative(s), true, s);
  for (const s of ['', 'no', "don't", 'yes... wait', 'maybe', 'refund CC-1 and CC-2', 'x'.repeat(300) + ' yes']) assert.equal(isAffirmative(s), false, s);
  assert.deepEqual(amountsInText('pay $1,250.00 or 45 or 9.5'), [125000, 4500, 950]);
});
