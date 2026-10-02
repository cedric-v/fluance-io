// HTTP helpers for the agent-facing endpoints (MCP, A2A).

export function agentCorsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID, A2A-Version',
    'Access-Control-Expose-Headers': 'Mcp-Protocol-Version, Mcp-Session-Id, A2A-Version',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  });
}

export function emptyResponse(status = 204, extraHeaders = {}) {
  const headers = agentCorsHeaders();
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Response(null, {status, headers});
}

export function jsonRpcResponse(payload, status = 200, extraHeaders = {}) {
  const headers = agentCorsHeaders();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers,
  });
}
