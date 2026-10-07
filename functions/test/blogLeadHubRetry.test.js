const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

// blogLeadHub initialise Firestore au chargement: on fournit une app factice.
if (!admin.getApps().length) {
  admin.initializeApp({projectId: 'test-project'});
}

const {helpers} = require('../blogLeadHub');
const {fetchWithRetry, describeFetchError} = helpers;

function makeFetchError(code, syscall = 'read') {
  const cause = new Error('socket');
  cause.code = code;
  cause.syscall = syscall;
  const error = new TypeError('fetch failed');
  error.cause = cause;
  return error;
}

function response(status, body = '') {
  return {
    status,
    ok: status >= 200 && status < 300,
    arrayBuffer: async () => Buffer.from(body),
    text: async () => body,
  };
}

test('describeFetchError expose la cause reseau reelle', () => {
  assert.equal(describeFetchError(makeFetchError('ECONNRESET')), 'fetch failed (ECONNRESET, read)');
  assert.equal(describeFetchError({name: 'TimeoutError', message: 'timeout'}), 'fetch failed (timeout)');
  assert.equal(describeFetchError({message: 'boom'}), 'boom');
  assert.equal(describeFetchError(null), 'unknown');
});

test('fetchWithRetry re-essaie sur ECONNRESET puis reussit', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1) throw makeFetchError('ECONNRESET');
    return response(200);
  };
  try {
    const res = await fetchWithRetry('https://example.test', {}, {baseDelayMs: 1});
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  } finally {
    global.fetch = original;
  }
});

test('fetchWithRetry n insiste pas sur une erreur non transitoire', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    throw makeFetchError('EINVAL');
  };
  try {
    await assert.rejects(() => fetchWithRetry('https://example.test', {}, {baseDelayMs: 1}));
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});

test('fetchWithRetry re-essaie les statuts 5xx par defaut', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return calls === 1 ? response(503) : response(200);
  };
  try {
    const res = await fetchWithRetry('https://example.test', {}, {baseDelayMs: 1});
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  } finally {
    global.fetch = original;
  }
});

test('fetchWithRetry avec retryOnStatus false ne re-essaie pas un 5xx', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return response(500);
  };
  try {
    const res = await fetchWithRetry('https://example.test', {}, {baseDelayMs: 1, retryOnStatus: false});
    assert.equal(res.status, 500);
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});

test('fetchWithRetry avec retryCodes stricts ne re-essaie pas un ECONNRESET', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    throw makeFetchError('ECONNRESET');
  };
  try {
    await assert.rejects(() => fetchWithRetry('https://example.test', {}, {
      baseDelayMs: 1,
      retryCodes: new Set(['ECONNREFUSED']),
    }));
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});

test('fetchWithRetry re-essaie un timeout par defaut', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1) throw Object.assign(new Error('timeout'), {name: 'TimeoutError'});
    return response(200);
  };
  try {
    const res = await fetchWithRetry('https://example.test', {}, {baseDelayMs: 1});
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  } finally {
    global.fetch = original;
  }
});

test('fetchWithRetry avec retryOnTimeout false ne re-essaie pas un timeout', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    throw Object.assign(new Error('timeout'), {name: 'TimeoutError'});
  };
  try {
    await assert.rejects(() => fetchWithRetry('https://example.test', {}, {
      baseDelayMs: 1,
      retryOnTimeout: false,
    }));
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});
