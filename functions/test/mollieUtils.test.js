const test = require('node:test');
const assert = require('node:assert/strict');

const {getAllowedOrigin} = require('../services/mollieUtils');

test('getAllowedOrigin returns allowed origin', () => {
  const result = getAllowedOrigin('https://fluance.io/path?x=1', 'https://cedricv.com');
  assert.equal(result, 'https://fluance.io');
});

test('getAllowedOrigin falls back for disallowed origin', () => {
  const result = getAllowedOrigin('https://evil.example.com', 'https://fluance.io');
  assert.equal(result, 'https://fluance.io');
});

test('getAllowedOrigin falls back for invalid input', () => {
  const result = getAllowedOrigin('notaurl', 'https://cedricv.com');
  assert.equal(result, 'https://cedricv.com');
});
