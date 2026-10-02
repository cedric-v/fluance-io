// Source of truth for the public API facade.
//
// Each route maps a public path to a Firebase Cloud Function. `auth` describes
// how the route is protected at the Worker (façade) level:
//
//   - "public": anyone can call it (read-only, no PII).
//   - "apiKey": an API key with the required scopes must be presented through
//     the `X-API-Key` header (or `Authorization: Bearer flu_...`).
//
// The frontend of fluance.io calls the Cloud Functions directly, so tightening
// the façade never breaks the website itself.
//
// This table is consumed by:
//   - cloudflare/api-proxy/src/index.js (routing)
//   - scripts/validate-api-contract.mjs (OpenAPI ↔ Worker consistency check)

export const ROUTES = {
  '/api/courses': {
    functionName: 'getAvailableCourses',
    methods: ['GET'],
    auth: 'public',
    summary: 'List available in-person classes.',
  },
  '/api/course-status': {
    functionName: 'getCourseStatus',
    methods: ['GET'],
    auth: 'public',
    summary: 'Status of a single class.',
  },
  '/api/pass-status': {
    functionName: 'checkUserPass',
    methods: ['GET'],
    auth: 'apiKey',
    scopes: ['pass:read'],
    summary: 'Check whether a person holds an active pass (PII).',
  },
  '/api/bookings': {
    functionName: 'bookCourse',
    methods: ['POST'],
    auth: 'apiKey',
    scopes: ['booking:write'],
    summary: 'Create a booking (transactional).',
  },
  '/api/send-contact-email': {
    functionName: 'sendContactEmail',
    methods: ['POST'],
    auth: 'apiKey',
    scopes: ['contact:write'],
    summary: 'Send a contact request to support (transactional).',
  },
  '/api/status': {
    functionName: 'apiStatus',
    methods: ['GET'],
    auth: 'public',
    summary: 'Lightweight health endpoint.',
  },
};

// Dynamic, protocol-oriented routes handled directly by the Worker (no
// upstream Cloud Function with the same name).
export const DYNAMIC_ROUTES = {
  '/api/mcp': 'mcp',
  '/api/a2a': 'a2a',
};
