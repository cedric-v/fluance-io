import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUTES, DYNAMIC_ROUTES} from '../src/routes.js';

test('every route declares a function, methods and auth mode', () => {
  for (const [path, route] of Object.entries(ROUTES)) {
    assert.equal(typeof route.functionName, 'string', `${path} functionName`);
    assert.ok(Array.isArray(route.methods) && route.methods.length > 0, `${path} methods`);
    assert.ok(['public', 'apiKey'].includes(route.auth), `${path} auth`);
  }
});

test('protected routes declare at least one scope', () => {
  for (const [path, route] of Object.entries(ROUTES)) {
    if (route.auth === 'apiKey') {
      assert.ok(Array.isArray(route.scopes) && route.scopes.length > 0, `${path} scopes`);
    }
  }
});

test('read-only routes stay public', () => {
  for (const path of ['/api/courses', '/api/course-status', '/api/status']) {
    assert.equal(ROUTES[path].auth, 'public', path);
  }
});

test('PII and transactional routes are keyed', () => {
  const protectedPaths = {
    '/api/pass-status': 'pass:read',
    '/api/bookings': 'booking:write',
    '/api/send-contact-email': 'contact:write',
  };
  for (const [path, scope] of Object.entries(protectedPaths)) {
    assert.equal(ROUTES[path].auth, 'apiKey', path);
    assert.deepEqual(ROUTES[path].scopes, [scope], path);
  }
});

test('dynamic protocol routes are declared', () => {
  assert.equal(DYNAMIC_ROUTES['/api/mcp'], 'mcp');
  assert.equal(DYNAMIC_ROUTES['/api/a2a'], 'a2a');
});
