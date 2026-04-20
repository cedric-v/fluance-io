const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getAllowedOrigin,
  getRecurringPaymentMethod,
  isRecurringProduct,
} = require('../services/mollieUtils');

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

test('isRecurringProduct identifies recurring Mollie products', () => {
  assert.equal(isRecurringProduct('focus-sos', '3x'), true);
  assert.equal(isRecurringProduct('complet', 'mensuel'), true);
  assert.equal(isRecurringProduct('21jours', null), false);
});

test('getRecurringPaymentMethod restricts recurring products to cards', () => {
  assert.equal(getRecurringPaymentMethod('focus-sos', '3x'), 'creditcard');
  assert.equal(getRecurringPaymentMethod('21jours', null), null);
});
