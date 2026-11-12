import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCapacityError } from '../lib/ai.ts';

test('rate limits, overload and unknown models are capacity errors', () => {
  assert.equal(isCapacityError({ statusCode: 429, message: 'x' }), true);
  assert.equal(isCapacityError({ message: 'Failed after 3 attempts', lastError: { statusCode: 429 } }), true);
  assert.equal(isCapacityError({ message: 'Rate limit reached for model on tokens per day' }), true);
  assert.equal(isCapacityError({ errors: [{ message: 'The model `x` does not exist' }] }), true);
  assert.equal(isCapacityError({ statusCode: 503 }), true);
});

test('other errors are not capacity errors', () => {
  assert.equal(isCapacityError(new Error('invalid JSON schema for response_format')), false);
  assert.equal(isCapacityError({ statusCode: 400, message: 'bad request' }), false);
  assert.equal(isCapacityError(null), false);
  assert.equal(isCapacityError('boom'), false);
});
