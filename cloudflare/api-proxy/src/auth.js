// API key authentication for the public façade.
//
// Keys are stored in the Worker secret `FLUANCE_API_KEYS`, never in the
// repository. Two formats are accepted:
//
//   JSON array:
//     [{"key":"flu_xxx","name":"gpt-action","scopes":["pass:read"]}]
//
//   JSON object:
//     {"flu_xxx":{"name":"gpt-action","scopes":["pass:read"]}}
//
//   CSV (all keys get the wildcard scope "*"):
//     flu_xxx,flu_yyy
//
// All API keys must start with the `flu_` prefix so they can never be confused
// with a Firebase ID token sent in the Authorization header.

export const KEY_PREFIX = 'flu_';

function normalizeEntry(entry) {
  if (!entry) return null;
  const key = String(entry.key || '').trim();
  if (!key) return null;
  let scopes = entry.scopes;
  if (typeof scopes === 'string') {
    scopes = scopes.split(/[\s,]+/).filter(Boolean);
  }
  if (!Array.isArray(scopes) || scopes.length === 0) {
    scopes = ['*'];
  }
  return {
    key,
    name: entry.name ? String(entry.name) : null,
    scopes: scopes.map((scope) => String(scope)),
  };
}

/**
 * Parse the `FLUANCE_API_KEYS` secret into a normalized list of keys.
 * Returns an empty array when nothing is configured.
 */
export function parseApiKeys(raw) {
  if (!raw) return [];
  const trimmed = String(raw).trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeEntry).filter(Boolean);
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
          .map(([key, value]) => normalizeEntry(
              value && typeof value === 'object' ? {key, ...value} : {key, scopes: value},
          ))
          .filter(Boolean);
    }
  } catch {
    // Not JSON: fall back to a comma-separated list.
  }

  return trimmed
      .split(',')
      .map((key) => normalizeEntry({key: key.trim(), scopes: ['*']}))
      .filter(Boolean);
}

/**
 * Constant-time-ish string comparison to avoid leaking key bytes through
 * response timing. Length differences are still observable, which is
 * acceptable for high-entropy API keys.
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Extract an API key from `X-API-Key`, or from `Authorization: Bearer flu_...`.
 * A Firebase ID token (which does not start with `flu_`) is ignored here and
 * forwarded upstream untouched.
 */
export function extractApiKey(request) {
  const headerKey = request.headers.get('x-api-key');
  if (headerKey && headerKey.trim()) {
    return headerKey.trim();
  }
  const auth = request.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token.startsWith(KEY_PREFIX)) {
      return token;
    }
  }
  return null;
}

/**
 * Authorize a request against a route definition.
 * @returns {{ok: boolean, status?: number, error?: string, message?: string,
 *            required?: string[], keyName?: string|null}}
 */
export function authorize(request, route, rawKeys) {
  if (!route || !route.auth || route.auth === 'public') {
    return {ok: true};
  }

  const keys = parseApiKeys(rawKeys);
  if (keys.length === 0) {
    return {
      ok: false,
      status: 503,
      error: 'API_AUTH_NOT_CONFIGURED',
      message: 'The API is not accepting keyed requests yet.',
    };
  }

  const provided = extractApiKey(request);
  if (!provided) {
    return {
      ok: false,
      status: 401,
      error: 'API_KEY_REQUIRED',
      message: 'Provide an API key via the X-API-Key header.',
    };
  }

  const match = keys.find((candidate) => timingSafeEqual(candidate.key, provided));
  if (!match) {
    return {
      ok: false,
      status: 401,
      error: 'INVALID_API_KEY',
      message: 'The provided API key is unknown or revoked.',
    };
  }

  const required = route.scopes || [];
  const granted = Boolean(
      match.scopes.includes('*') ||
      required.every((scope) => match.scopes.includes(scope)),
  );
  if (!granted) {
    return {
      ok: false,
      status: 403,
      error: 'INSUFFICIENT_SCOPE',
      message: 'The API key does not grant the required scope.',
      required,
    };
  }

  return {ok: true, keyName: match.name || null};
}
