// Minimal JSON-RPC 2.0 helpers shared by the MCP and A2A endpoints.

export const JSONRPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

export function rpcResult(id, result) {
  return {jsonrpc: '2.0', id: id ?? null, result};
}

export function rpcError(id, code, message, data) {
  const error = {code, message};
  if (data !== undefined) {
    error.data = data;
  }
  return {jsonrpc: '2.0', id: id ?? null, error};
}

/**
 * Home-made validation of the JSON-RPC envelope. Returns the offending
 * response when invalid, or null when the message looks usable.
 */
export function validateEnvelope(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return rpcError(null, JSONRPC_ERRORS.INVALID_REQUEST, 'Invalid Request');
  }
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message.id ?? null, JSONRPC_ERRORS.INVALID_REQUEST, 'Invalid Request');
  }
  return null;
}

export function isNotification(message) {
  return typeof message.method === 'string' && message.method.startsWith('notifications/');
}
