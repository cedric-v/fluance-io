import test from 'node:test';
import assert from 'node:assert/strict';
import {handleA2a} from '../src/a2a.js';

function post(body) {
  return new Request('https://fluance.io/api/a2a', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
}

function userMessage(text) {
  return {
    jsonrpc: '2.0',
    id: 'req-1',
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        role: 'user',
        messageId: 'm1',
        parts: [{kind: 'text', text}],
      },
    },
  };
}

test('message/send about classes returns a list from the backend', async (t) => {
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
        spotsRemaining: 2,
        isFull: false,
      }],
    }), {status: 200, headers: {'Content-Type': 'application/json'}});
  };

  const response = await handleA2a(post(userMessage('Quels cours sont disponibles ?')), {});
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.result.kind, 'message');
  assert.equal(json.result.role, 'agent');
  assert.match(json.result.parts[0].text, /Fluance hebdo/);
});

test('message/send about pricing answers without a backend call', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    throw new Error('backend should not be called');
  };

  const response = await handleA2a(post(userMessage('Quels sont les tarifs ?')), {});
  const json = await response.json();
  assert.match(json.result.parts[0].text, /Tarifs/);
});

test('message/stream is not supported', async () => {
  const response = await handleA2a(post({
    jsonrpc: '2.0',
    id: 'req-2',
    method: 'message/stream',
    params: {},
  }), {});
  const json = await response.json();
  assert.equal(json.error.code, -32601);
});

test('invalid JSON returns a parse error', async () => {
  const response = await handleA2a(new Request('https://fluance.io/api/a2a', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: 'nope',
  }), {});
  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.error.code, -32700);
});
