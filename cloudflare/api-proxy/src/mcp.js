// Minimal, stateless Model Context Protocol (MCP) server exposed over
// "Streamable HTTP" at POST /api/mcp.
//
// Design choices:
//   - Read-only tools only. No booking, no pass lookup, no contact email:
//     those stay behind API-key protected REST routes.
//   - Stateless: no Mcp-Session-Id is issued. `GET`/`DELETE` return 405, which
//     is allowed for a server without SSE streams.
//   - JSON responses only (no SSE). Compatible with MCP clients that accept
//     `application/json` for a single JSON-RPC response.

import {callBackend} from './backend.js';
import {
  JSONRPC_ERRORS,
  isNotification,
  rpcError,
  rpcResult,
  validateEnvelope,
} from './jsonrpc.js';
import {emptyResponse, jsonRpcResponse} from './http.js';

export const MCP_PROTOCOL_VERSION = '2025-06-18';
export const MCP_SERVER_INFO = {
  name: 'fluance',
  title: 'Fluance',
  version: '1.0.0',
};

const INSTRUCTIONS = [
  'Fluance helps people release tension and regain fluidity through movement,',
  'breath and play. Use these tools to discover in-person classes and explain',
  'the Fluance offers. Read-only: booking and account actions are not exposed',
  'through MCP and must be completed on https://fluance.io/.',
].join(' ');

const OFFERS = [
  {
    id: '21-jours-mouvement',
    type: 'online-course',
    title: 'Défi 21 jours',
    url: {fr: 'https://fluance.io/cours-en-ligne/21-jours-mouvement/', en: 'https://fluance.io/en/cours-en-ligne/21-jours-mouvement/'},
    description: 'Programme de 21 jours, pratiques quotidiennes de 2 à 5 minutes.',
  },
  {
    id: 'fluance-illimite',
    type: 'subscription',
    title: 'Fluance Illimité',
    url: {fr: 'https://fluance.io/decouvrir-ma-pratique/', en: 'https://fluance.io/en/discover-my-practice/'},
    description: 'Accès complet à toutes les pratiques (mensuel ou annuel).',
  },
  {
    id: 'cours-hebdomadaires',
    type: 'in-person',
    title: 'Cours hebdomadaires à Fribourg',
    url: 'https://fluance.io/presentiel/cours-hebdomadaires/',
    bookingUrl: 'https://fluance.io/presentiel/reserver/',
    description: 'Cours en présentiel à Fribourg, Suisse.',
  },
];

const TOOLS = [
  {
    name: 'list_fluance_classes',
    title: 'List Fluance classes',
    description: 'List currently available Fluance in-person classes with date, time, location, price and remaining spots.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, destructiveHint: false, openWorldHint: false},
  },
  {
    name: 'get_fluance_class_status',
    title: 'Get Fluance class status',
    description: 'Return the status and remaining capacity of a single Fluance class, by courseId.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'string',
          description: 'Identifier returned by list_fluance_classes.',
        },
      },
      required: ['courseId'],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, destructiveHint: false, openWorldHint: false},
  },
  {
    name: 'get_fluance_offers',
    title: 'Get Fluance offers',
    description: 'Return the static catalogue of Fluance offers (online programme, subscription, in-person classes) with their URLs.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, destructiveHint: false, openWorldHint: false},
  },
  {
    name: 'get_fluance_api_status',
    title: 'Get Fluance API status',
    description: 'Lightweight health check of the public Fluance API.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, destructiveHint: false, openWorldHint: false},
  },
];

function toolText(text) {
  return {content: [{type: 'text', text}]};
}

function toolError(text) {
  return {content: [{type: 'text', text}], isError: true};
}

function summarizeCourses(data) {
  const courses = (data && data.courses) || [];
  if (courses.length === 0) {
    return 'Aucun cours Fluance n’est actuellement disponible. Consultez https://fluance.io/presentiel/reserver/ plus tard.';
  }
  const lines = courses.map((course) => {
    const spots = course.isFull ?
      'complet' :
      `${course.spotsRemaining} place(s) restante(s)`;
    return `- ${course.title} — ${course.date} ${course.time} — ${course.location} — ${course.price} CHF — ${spots} (id: ${course.id})`;
  });
  return ['Cours Fluance disponibles :', ...lines].join('\n');
}

async function callTool(name, args, env) {
  switch (name) {
    case 'list_fluance_classes': {
      const {ok, data} = await callBackend(env, 'getAvailableCourses');
      if (!ok) {
        return toolError('La liste des cours est temporairement indisponible.');
      }
      return {
        ...toolText(summarizeCourses(data)),
        structuredContent: data,
      };
    }
    case 'get_fluance_class_status': {
      const courseId = args && args.courseId;
      if (!courseId) {
        return toolError('Le paramètre courseId est requis.');
      }
      const {ok, data} = await callBackend(env, 'getCourseStatus', {query: {courseId}});
      if (!ok) {
        return toolError(`Statut indisponible pour le cours ${courseId}.`);
      }
      return {
        ...toolText(`Statut du cours ${courseId} : ${JSON.stringify(data)}`),
        structuredContent: data,
      };
    }
    case 'get_fluance_offers':
      return {
        ...toolText('Offres Fluance : ' + OFFERS.map((o) => o.title).join(', ')),
        structuredContent: {offers: OFFERS},
      };
    case 'get_fluance_api_status': {
      const {ok, data} = await callBackend(env, 'apiStatus');
      if (!ok) {
        return toolError('Le statut de l’API est indisponible.');
      }
      return {...toolText('API Fluance opérationnelle.'), structuredContent: data};
    }
    default:
      return null;
  }
}

async function handleMessage(message, env) {
  if (isNotification(message)) {
    // Notifications (initialized, cancelled, ...) are acknowledged with 202.
    return null;
  }

  const invalid = validateEnvelope(message);
  if (invalid) {
    return invalid;
  }

  const {id, method, params} = message;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {tools: {listChanged: false}},
        serverInfo: MCP_SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, {tools: TOOLS});
    case 'tools/call': {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      if (!name) {
        return rpcError(id, JSONRPC_ERRORS.INVALID_PARAMS, 'Missing tool name');
      }
      const result = await callTool(name, args, env);
      if (result === null) {
        return rpcError(id, JSONRPC_ERRORS.INVALID_PARAMS, `Unknown tool: ${name}`);
      }
      return rpcResult(id, result);
    }
    default:
      if (id === undefined || id === null) {
        return null;
      }
      return rpcError(id, JSONRPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

/**
 * Handle a Streamable HTTP MCP request.
 * @returns {Promise<Response>}
 */
export async function handleMcp(request, env) {
  if (request.method === 'OPTIONS') {
    return emptyResponse(204);
  }

  if (request.method !== 'POST') {
    return emptyResponse(405, {Allow: 'POST, OPTIONS'});
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonRpcResponse(
        rpcError(null, JSONRPC_ERRORS.PARSE_ERROR, 'Parse error'),
        400,
    );
  }

  const isBatch = Array.isArray(payload);
  const messages = isBatch ? payload : [payload];
  if (messages.length === 0) {
    return jsonRpcResponse(
        rpcError(null, JSONRPC_ERRORS.INVALID_REQUEST, 'Invalid Request'),
        400,
    );
  }

  const responses = [];
  for (const message of messages) {
    const response = await handleMessage(message, env);
    if (response !== null) {
      responses.push(response);
    }
  }

  if (responses.length === 0) {
    return emptyResponse(202);
  }

  return jsonRpcResponse(isBatch ? responses : responses[0], 200, {
    'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION,
  });
}
