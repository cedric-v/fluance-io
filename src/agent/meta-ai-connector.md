# Meta AI Connectors (Muse) — readiness

Meta AI Connectors let a service become callable tools inside Meta AI (AI
glasses, Meta AI app and web). Per Meta's developer preview, onboarding relies
on:

- a **live REST API** described by an OpenAPI/Swagger spec;
- **MCP** for describing endpoints (guided UI or MCP onboarding);
- **OAuth account linking** so people connect their existing Fluance account.

Reference: https://dev.meta.ai/products/connectors

## What Fluance already provides

| Requirement | Fluance asset |
|---|---|
| Live REST API | `https://fluance.io/api/*` (Cloudflare Worker `fluance-api-proxy`) |
| OpenAPI spec | `https://fluance.io/docs/api/openapi.json` |
| MCP onboarding | `POST https://fluance.io/api/mcp` (read-only, Streamable HTTP) |
| MCP server card | `https://fluance.io/.well-known/mcp/server-card.json` |
| Agent skills | `https://fluance.io/.well-known/agent-skills/index.json` |

The read-only use cases Meta highlights (fitness/wellness) map directly to:

- `list_fluance_classes` — upcoming in-person classes in Fribourg;
- `get_fluance_offers` — online programme, subscription, in-person classes.

## Gap: OAuth account linking

Meta requires **OAuth** to link a person's account before calling
user-scoped actions. Fluance does not publish an OAuth/OIDC server yet. To
become a full connector, we would need to add:

1. OAuth 2.0 authorization-code + PKCE endpoints (authorize, token, revoke).
2. A consent screen bound to Firebase Auth accounts.
3. Short-lived access tokens with scopes matching the API scopes
   (`pass:read`, `booking:write`, ...).
4. Token storage (Cloudflare KV / Durable Objects or Firestore) and rotation.

Until then, the connector can be submitted as **read-only** (no account
linking): discovery and class listing do not need user identity.

## Application checklist

- Live REST API in production: **yes**.
- OpenAPI spec: **yes**.
- MCP onboarding surface: **yes** (read-only).
- Clear use case: "find and describe Fluance classes and offers through Meta AI".
- Privacy policy: `https://fluance.io/mentions-legales/`.
- OAuth account linking: **roadmap**.

## Next step if Meta access is granted

1. Register the connector in the Meta AI Developer Center.
2. Point MCP onboarding at `https://fluance.io/api/mcp`.
3. Start with the two read-only skills above.
4. Add OAuth only for account-scoped skills (pass status, booking).
