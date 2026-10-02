import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('serves the A2A agent card from discovery', async () => {
  const response = await worker.fetch(
      new Request('https://fluance.io/.well-known/agent-card.json'),
      {},
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /application\/json/);
  const card = await response.json();
  assert.equal(card.url, 'https://fluance.io/api/a2a');
  assert.ok(Array.isArray(card.skills));
});

test('serves the MCP server card from discovery', async () => {
  const response = await worker.fetch(
      new Request('https://fluance.io/.well-known/mcp/server-card.json'),
      {},
  );
  assert.equal(response.status, 200);
  const card = await response.json();
  assert.ok(card.transports.some((t) => t.url === 'https://fluance.io/api/mcp'));
});

test('unknown routes return 404', async () => {
  const response = await worker.fetch(new Request('https://fluance.io/api/nope'), {});
  assert.equal(response.status, 404);
});

test('public read route is proxied', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (request) => {
    assert.match(request.url || String(request), /getAvailableCourses/);
    return new Response(JSON.stringify({success: true, courses: []}), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  };
  const response = await worker.fetch(new Request('https://fluance.io/api/courses'), {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('protected route returns 503 when no API keys are configured', async () => {
  const response = await worker.fetch(
      new Request('https://fluance.io/api/bookings', {method: 'POST'}),
      {},
  );
  assert.equal(response.status, 503);
  const json = await response.json();
  assert.equal(json.error, 'API_AUTH_NOT_CONFIGURED');
});

test('protected route returns 401 without a key', async () => {
  const response = await worker.fetch(
      new Request('https://fluance.io/api/bookings', {method: 'POST'}),
      {FLUANCE_API_KEYS: '[{"key":"flu_a","scopes":["booking:write"]}]'},
  );
  assert.equal(response.status, 401);
});

test('protected route strips the API key before proxying', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let seenApiKey = 'not-called';
  globalThis.fetch = async (request) => {
    seenApiKey = request.headers.get('x-api-key');
    return new Response(JSON.stringify({success: true}), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  };
  const response = await worker.fetch(
      new Request('https://fluance.io/api/bookings', {
        method: 'POST',
        headers: {'X-API-Key': 'flu_a', 'Content-Type': 'application/json'},
        body: JSON.stringify({courseId: 'c1', email: 'user@example.com', firstName: 'A', lastName: 'B'}),
      }),
      {FLUANCE_API_KEYS: '[{"key":"flu_a","scopes":["booking:write"]}]'},
  );
  assert.equal(response.status, 200);
  assert.equal(seenApiKey, null);
});

test('MCP initialize is routed to the protocol handler', async () => {
  const response = await worker.fetch(
      new Request('https://fluance.io/api/mcp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {}}),
      }),
      {},
  );
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.result.serverInfo.name, 'fluance');
});
