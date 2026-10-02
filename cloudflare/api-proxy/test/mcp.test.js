import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMcp, MCP_PROTOCOL_VERSION} from '../src/mcp.js';

function post(body) {
  return new Request('https://fluance.io/api/mcp', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
}

test('initialize advertises the protocol version and tools capability', async () => {
  const response = await handleMcp(
      post({jsonrpc: '2.0', id: 1, method: 'initialize', params: {}}),
      {},
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Mcp-Protocol-Version'), MCP_PROTOCOL_VERSION);
  const json = await response.json();
  assert.equal(json.result.protocolVersion, MCP_PROTOCOL_VERSION);
  assert.equal(json.result.capabilities.tools.listChanged, false);
  assert.equal(json.result.serverInfo.name, 'fluance');
});

test('tools/list returns only read-only tools', async () => {
  const response = await handleMcp(
      post({jsonrpc: '2.0', id: 2, method: 'tools/list'}),
      {},
  );
  const json = await response.json();
  const names = json.result.tools.map((tool) => tool.name);
  assert.ok(names.includes('list_fluance_classes'));
  assert.ok(names.includes('get_fluance_class_status'));
  assert.ok(names.includes('get_fluance_offers'));
  for (const tool of json.result.tools) {
    assert.equal(tool.annotations.readOnlyHint, true, tool.name);
  }
});

test('notifications are acknowledged with 202 and no body', async () => {
  const response = await handleMcp(
      post({jsonrpc: '2.0', method: 'notifications/initialized'}),
      {},
  );
  assert.equal(response.status, 202);
});

test('tools/call list_fluance_classes proxies the backend', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url) => {
    assert.match(String(url), /getAvailableCourses/);
    return new Response(JSON.stringify({
      success: true,
      courses: [{
        id: 'c1',
        title: 'Fluance hebdo',
        date: '2026-01-06',
        time: '18:30',
        location: 'Fribourg',
        price: 25,
        spotsRemaining: 3,
        isFull: false,
      }],
    }), {status: 200, headers: {'Content-Type': 'application/json'}});
  };

  const response = await handleMcp(post({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {name: 'list_fluance_classes', arguments: {}},
  }), {});
  const json = await response.json();
  assert.equal(json.result.isError, undefined);
  assert.match(json.result.content[0].text, /Fluance hebdo/);
  assert.equal(json.result.structuredContent.courses[0].id, 'c1');
});

test('tools/call get_fluance_class_status requires courseId', async () => {
  const response = await handleMcp(post({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {name: 'get_fluance_class_status', arguments: {}},
  }), {});
  const json = await response.json();
  assert.equal(json.result.isError, true);
});

test('tools/call with an unknown tool is an invalid-params error', async () => {
  const response = await handleMcp(post({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {name: 'nope', arguments: {}},
  }), {});
  const json = await response.json();
  assert.equal(json.error.code, -32602);
});

test('unknown methods return a method-not-found error', async () => {
  const response = await handleMcp(
      post({jsonrpc: '2.0', id: 6, method: 'does/not/exist'}),
      {},
  );
  const json = await response.json();
  assert.equal(json.error.code, -32601);
});

test('invalid JSON returns a parse error', async () => {
  const response = await handleMcp(new Request('https://fluance.io/api/mcp', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: '{not json',
  }), {});
  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.error.code, -32700);
});

test('GET is rejected for a stateless server without SSE', async () => {
  const response = await handleMcp(new Request('https://fluance.io/api/mcp', {method: 'GET'}), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST, OPTIONS');
});
