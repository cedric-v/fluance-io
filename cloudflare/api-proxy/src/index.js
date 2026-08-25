import {DISCOVERY_RESPONSES} from './discovery.generated.js';

const ROUTES = {
  '/api/courses': {
    functionName: 'getAvailableCourses',
    methods: ['GET'],
  },
  '/api/course-status': {
    functionName: 'getCourseStatus',
    methods: ['GET'],
  },
  '/api/pass-status': {
    functionName: 'checkUserPass',
    methods: ['GET'],
  },
  '/api/bookings': {
    functionName: 'bookCourse',
    methods: ['POST'],
  },
  '/api/status': {
    functionName: 'apiStatus',
    methods: ['GET'],
  },
};

const DEFAULT_BACKEND_ORIGIN =
  'https://europe-west1-fluance-protected-content.cloudfunctions.net';
const ALLOWED_ORIGINS = new Set(['https://fluance.io', 'https://www.fluance.io']);

function normalizePath(pathname) {
  if (pathname.length > 1) {
    return pathname.replace(/\/+$/, '');
  }
  return pathname;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  });

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

function jsonResponse(request, payload, status) {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), {status, headers});
}

function discoveryResponse(request, resource) {
  const headers = corsHeaders(request);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Content-Type', resource.contentType);
  headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  return new Response(request.method === 'HEAD' ? null : resource.body, {
    status: 200,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    const discovery = DISCOVERY_RESPONSES[path];

    if (discovery) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return jsonResponse(request, {error: 'Method not allowed'}, 405);
      }
      return discoveryResponse(request, discovery);
    }

    const route = ROUTES[path];

    if (!route) {
      return jsonResponse(request, {error: 'API route not found'}, 404);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (!route.methods.includes(request.method)) {
      return jsonResponse(request, {error: 'Method not allowed'}, 405);
    }

    const backendOrigin = env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN;
    const upstreamUrl = new URL(
        `${backendOrigin}/${route.functionName}`,
    );
    upstreamUrl.search = url.search;

    try {
      // Passing the original Request preserves the method, headers, and body
      // (including POST /api/bookings) while changing only the destination URL.
      const upstreamRequest = new Request(upstreamUrl, request);
      const upstreamResponse = await fetch(upstreamRequest);
      const responseHeaders = new Headers(upstreamResponse.headers);

      // API responses are dynamic. Do not let the Pages/CDN layer cache them.
      responseHeaders.set('Cache-Control', 'no-store');
      responseHeaders.set('Vary', 'Origin');

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('API proxy upstream error', {
        route: url.pathname,
        message: error.message,
      });
      return jsonResponse(request, {error: 'Upstream API unavailable'}, 502);
    }
  },
};
