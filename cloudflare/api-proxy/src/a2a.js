// Minimal Agent2Agent (A2A) endpoint exposed at POST /api/a2a.
//
// It answers a `message/send` JSON-RPC call with a direct agent Message
// (text only, no streaming, no tasks). This is enough for A2A-compatible
// clients to discover Fluance and list the current in-person classes.

import {callBackend} from './backend.js';
import {
  JSONRPC_ERRORS,
  rpcError,
  rpcResult,
  validateEnvelope,
} from './jsonrpc.js';
import {emptyResponse, jsonRpcResponse} from './http.js';

export const A2A_PROTOCOL_VERSION = '0.2.5';
export const A2A_AGENT_VERSION = '1.0.0';

export const A2A_SKILLS = [
  {
    id: 'list-fluance-classes',
    name: 'List Fluance classes',
    description: 'List currently available Fluance in-person classes with dates, locations, prices and remaining spots.',
    tags: ['booking', 'classes', 'wellness', 'fribourg'],
    examples: [
      'Quels cours Fluance sont disponibles ?',
      'When is the next Fluance class?',
    ],
  },
  {
    id: 'present-fluance-offers',
    name: 'Present Fluance offers',
    description: 'Explain the Fluance offers: online 21-day programme, Fluance Illimité subscription, in-person classes in Fribourg.',
    tags: ['wellness', 'online-course', 'subscription'],
    examples: [
      'Que propose Fluance ?',
      'What does Fluance offer?',
    ],
  },
];

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function extractText(params) {
  const parts = params && params.message && Array.isArray(params.message.parts) ?
    params.message.parts :
    [];
  return parts
      .filter((part) => part && (part.kind === 'text' || part.type === 'text'))
      .map((part) => part.text || '')
      .join('\n')
      .trim();
}

async function formatClasses(env) {
  const {ok, data} = await callBackend(env, 'getAvailableCourses');
  if (!ok) {
    return 'La liste des cours est temporairement indisponible. Consultez https://fluance.io/presentiel/reserver/.';
  }
  const courses = (data && data.courses) || [];
  if (courses.length === 0) {
    return 'Aucun cours Fluance n’est actuellement disponible. Consultez https://fluance.io/presentiel/reserver/ plus tard.';
  }
  const lines = courses.map((course) => {
    const spots = course.isFull ? 'complet' : `${course.spotsRemaining} place(s)`;
    return `- ${course.title} — ${course.date} ${course.time} — ${course.location} — ${course.price} CHF — ${spots}`;
  });
  return ['Cours Fluance disponibles :', ...lines, '',
    'Réservation : https://fluance.io/presentiel/reserver/'].join('\n');
}

async function buildReply(text, env) {
  const q = (text || '').toLowerCase();

  if (/(class|cours|séance|seance|réserver|reserver|book|booking|disponib|horaire|schedule|date)/.test(q)) {
    return formatClasses(env);
  }

  if (/(prix|price|tarif|coût|cout|cost|chf)/.test(q)) {
    return [
      'Tarifs Fluance :',
      '- Cours en présentiel : à partir de 25 CHF la séance (première séance offerte).',
      '- Défi 21 jours en ligne : programme court, pratiques de 2 à 5 minutes.',
      '- Fluance Illimité : abonnement mensuel ou annuel, accès complet.',
      'Détails : https://fluance.io/decouvrir-ma-pratique/',
    ].join('\n');
  }

  if (/(stress|tension|mobilit|mobility|calme|calm|méditation|meditation|souffle|breath|douleur|pain)/.test(q)) {
    return [
      'Fluance convient aux personnes qui veulent relâcher les tensions par le mouvement,',
      'le souffle et le jeu — en particulier celles qui trouvent la méditation assise difficile.',
      'Formats : cours hebdomadaires à Fribourg, Défi 21 jours en ligne, Fluance Illimité.',
      'En savoir plus : https://fluance.io/',
    ].join('\n');
  }

  return [
    'Fluance aide à relâcher les tensions et à retrouver de la fluidité par le mouvement, le souffle et le jeu.',
    'Offres : cours hebdomadaires à Fribourg, Défi 21 jours en ligne, Fluance Illimité.',
    'Cours et réservation : https://fluance.io/presentiel/reserver/',
  ].join('\n');
}

async function handleMessageSend(id, params, env) {
  const text = extractText(params);
  const reply = await buildReply(text, env);
  return rpcResult(id, {
    kind: 'message',
    role: 'agent',
    messageId: randomId(),
    parts: [{kind: 'text', text: reply}],
  });
}

/**
 * Handle an A2A JSON-RPC request.
 * @returns {Promise<Response>}
 */
export async function handleA2a(request, env) {
  if (request.method === 'OPTIONS') {
    return emptyResponse(204);
  }

  if (request.method !== 'POST') {
    return emptyResponse(405, {Allow: 'POST, OPTIONS'});
  }

  let message;
  try {
    message = await request.json();
  } catch {
    return jsonRpcResponse(rpcError(null, JSONRPC_ERRORS.PARSE_ERROR, 'Parse error'), 400);
  }

  if (Array.isArray(message)) {
    return jsonRpcResponse(
        rpcError(null, JSONRPC_ERRORS.INVALID_REQUEST, 'Batch requests are not supported'),
        400,
    );
  }

  const invalid = validateEnvelope(message);
  if (invalid) {
    return jsonRpcResponse(invalid, 200);
  }

  const {id, method, params} = message;

  switch (method) {
    case 'message/send':
      return jsonRpcResponse(await handleMessageSend(id, params, env));
    case 'message/stream':
      return jsonRpcResponse(
          rpcError(id, JSONRPC_ERRORS.METHOD_NOT_FOUND, 'Streaming is not supported'),
      );
    default:
      return jsonRpcResponse(
          rpcError(id, JSONRPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`),
      );
  }
}
