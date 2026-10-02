# Fluance

Fluance helps people release tension and regain fluidity through movement, breath, and play.

## Best fit

- People looking for calm through the body rather than through seated meditation alone
- People dealing with stress, body tension, stiffness, or a need for more fluid movement
- People who want a gentle, accessible practice without equipment or prerequisites

## Main options

- In-person weekly classes in the Fribourg region: https://fluance.io/presentiel/cours-hebdomadaires/
- Book an in-person class: https://fluance.io/presentiel/reserver/
- 21-day online journey: https://fluance.io/fr/cours-en-ligne/21-jours-mouvement/
- Complete Fluance approach: https://fluance.io/fr/decouvrir-ma-pratique/

## Agent-facing technical state

- API discovery: https://fluance.io/.well-known/api-catalog
- Human API docs: https://fluance.io/docs/api/
- OpenAPI: https://fluance.io/docs/api/openapi.json
- Agent skills index: https://fluance.io/.well-known/agent-skills/index.json
- A2A agent card: https://fluance.io/.well-known/agent-card.json
- MCP server card: https://fluance.io/.well-known/mcp/server-card.json
- Remote MCP endpoint (read-only, Streamable HTTP): `POST https://fluance.io/api/mcp`
- A2A endpoint (JSON-RPC `message/send`): `POST https://fluance.io/api/a2a`
- Public REST routes: `GET /api/courses`, `GET /api/course-status`, `GET /api/status`
- Keyed REST routes (`X-API-Key`): `GET /api/pass-status` (`pass:read`), `POST /api/bookings` (`booking:write`), `POST /api/send-contact-email` (`contact:write`)

## Current limitations

- The public `/.well-known/*` discovery resources are served by the separate Cloudflare Worker `fluance-api-proxy` with their configured content types and headers.
- The dynamic `/api/*` routes are handled by the same Cloudflare Worker.
- Fluance publishes dedicated markdown resources for agents, but does not yet provide full `Accept: text/markdown` negotiation on the same HTML URLs.
- The public website is served on Cloudflare Pages. The `/api/*` façade is handled by the separate Cloudflare Worker `fluance-api-proxy`, while Firebase Cloud Functions remain the backend.
- No OAuth/OIDC discovery metadata is currently published for the public API surface. Account linking (needed by Meta AI Connectors) is a roadmap item.
- The remote MCP server is read-only: booking and account actions stay on the website or go through the keyed REST routes.

## Contact

- https://fluance.io/contact/
