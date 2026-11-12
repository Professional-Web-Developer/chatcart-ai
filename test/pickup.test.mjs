import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePickup } from '../lib/pickup.ts';

const now = new Date('2026-11-12T10:00:00+05:30'); // Thursday

test('weekday names and abbreviations', () => {
  assert.equal(resolvePickup('Saturday', now), '2026-11-14');
  assert.equal(resolvePickup('Monday', now), '2026-11-16');
  assert.equal(resolvePickup('Thursday', now), '2026-11-12');
  assert.equal(resolvePickup('sat', now), '2026-11-14');
  assert.equal(resolvePickup(' on Tues. ', now), '2026-11-17');
});

test('next <weekday>', () => {
  assert.equal(resolvePickup('next Thursday', now), '2026-11-19');
  assert.equal(resolvePickup('next Saturday', now), '2026-11-14');
});

test('relative days', () => {
  assert.equal(resolvePickup('today', now), '2026-11-12');
  assert.equal(resolvePickup('tomorrow', now), '2026-11-13');
  assert.equal(resolvePickup('Day after tomorrow', now), '2026-11-14');
});

test('uses Asia/Kolkata for today, not UTC', () => {
  // 01:00 IST on Friday 13th is still Thursday 12th in UTC
  assert.equal(resolvePickup('today', new Date('2026-11-13T01:00:00+05:30')), '2026-11-13');
});

test('dates', () => {
  assert.equal(resolvePickup('2026-12-25', now), '2026-12-25');
  assert.equal(resolvePickup('14 Nov', now), '2026-11-14');
  assert.equal(resolvePickup('Nov 14', now), '2026-11-14');
  assert.equal(resolvePickup('14th November 2026', now), '2026-11-14');
  assert.equal(resolvePickup('2 Jan', now), '2027-01-02');
  assert.equal(resolvePickup('12 Nov', now), '2026-11-12');
  assert.equal(resolvePickup('11 Nov', now), '2027-11-11');
});

test('anything else is returned trimmed and capped, never rejected', () => {
  assert.equal(resolvePickup('  after Diwali ', now), 'after Diwali');
  assert.equal(resolvePickup('31 Feb', now), '31 Feb');
  assert.equal(resolvePickup('2026-13-45', now), '2026-13-45');
  assert.equal(resolvePickup('x'.repeat(100), now).length, 60);
  assert.equal(resolvePickup('', now), '');
});
