import test from 'node:test';
import assert from 'node:assert/strict';
import {parseApiKeys, authorize, extractApiKey, timingSafeEqual} from '../src/auth.js';

function apiRequest(headers = {}) {
  return new Request('https://fluance.io/api/bookings', {
    method: 'POST',
    headers,
  });
}

const BOOKING_ROUTE = {auth: 'apiKey', scopes: ['booking:write']};
const PUBLIC_ROUTE = {auth: 'public'};

test('parseApiKeys accepts a JSON array', () => {
  const keys = parseApiKeys('[{"key":"flu_a","name":"a","scopes":["pass:read"]}]');
  assert.equal(keys.length, 1);
  assert.equal(keys[0].key, 'flu_a');
  assert.deepEqual(keys[0].scopes, ['pass:read']);
});

test('parseApiKeys accepts a JSON object', () => {
  const keys = parseApiKeys('{"flu_a":{"scopes":["*"]},"flu_b":"pass:read"}');
  assert.equal(keys.length, 2);
  const a = keys.find((k) => k.key === 'flu_a');
  const b = keys.find((k) => k.key === 'flu_b');
  assert.deepEqual(a.scopes, ['*']);
  assert.deepEqual(b.scopes, ['pass:read']);
});

test('parseApiKeys accepts a CSV list with wildcard scope', () => {
  const keys = parseApiKeys('flu_a, flu_b');
  assert.equal(keys.length, 2);
  assert.deepEqual(keys[0].scopes, ['*']);
});

test('parseApiKeys returns an empty list for empty input', () => {
  assert.deepEqual(parseApiKeys(''), []);
  assert.deepEqual(parseApiKeys(undefined), []);
});

test('timingSafeEqual compares strings', () => {
  assert.equal(timingSafeEqual('flu_a', 'flu_a'), true);
  assert.equal(timingSafeEqual('flu_a', 'flu_b'), false);
  assert.equal(timingSafeEqual('flu_a', 'flu_aa'), false);
});

test('extractApiKey reads X-API-Key and Bearer flu_ tokens only', () => {
  assert.equal(extractApiKey(apiRequest({'X-API-Key': 'flu_a'})), 'flu_a');
  assert.equal(extractApiKey(apiRequest({Authorization: 'Bearer flu_b'})), 'flu_b');
  assert.equal(extractApiKey(apiRequest({Authorization: 'Bearer eyJhbGci'})), null);
  assert.equal(extractApiKey(apiRequest()), null);
});

test('public routes are always authorized', () => {
  const result = authorize(apiRequest(), PUBLIC_ROUTE, undefined);
  assert.equal(result.ok, true);
});

test('protected route without configured keys returns 503', () => {
  const result = authorize(apiRequest(), BOOKING_ROUTE, '');
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.error, 'API_AUTH_NOT_CONFIGURED');
});

test('protected route without a key returns 401', () => {
  const result = authorize(apiRequest(), BOOKING_ROUTE, 'flu_a');
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.error, 'API_KEY_REQUIRED');
});

test('protected route with an unknown key returns 401', () => {
  const result = authorize(apiRequest({'X-API-Key': 'flu_nope'}), BOOKING_ROUTE, 'flu_a');
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.error, 'INVALID_API_KEY');
});

test('protected route with insufficient scope returns 403', () => {
  const result = authorize(
      apiRequest({'X-API-Key': 'flu_a'}),
      BOOKING_ROUTE,
      '[{"key":"flu_a","scopes":["pass:read"]}]',
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.error, 'INSUFFICIENT_SCOPE');
  assert.deepEqual(result.required, ['booking:write']);
});

test('protected route with the matching scope is authorized', () => {
  const result = authorize(
      apiRequest({'X-API-Key': 'flu_a'}),
      BOOKING_ROUTE,
      '[{"key":"flu_a","name":"gpt","scopes":["booking:write"]}]',
  );
  assert.equal(result.ok, true);
  assert.equal(result.keyName, 'gpt');
});

test('wildcard scope authorizes any protected route', () => {
  const result = authorize(
      apiRequest({'X-API-Key': 'flu_a'}),
      BOOKING_ROUTE,
      '[{"key":"flu_a","scopes":["*"]}]',
  );
  assert.equal(result.ok, true);
});
