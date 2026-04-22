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
- Complete Fluance approach: https://fluance.io/fr/cours-en-ligne/approche-fluance-complete/

## Agent-facing technical state

- API discovery: https://fluance.io/.well-known/api-catalog
- Human API docs: https://fluance.io/docs/api/
- OpenAPI: https://fluance.io/docs/api/openapi.json
- Agent skills index: https://fluance.io/.well-known/agent-skills/index.json
- Public routes exposed for agents: `GET /api/courses`, `GET /api/course-status`, `GET /api/pass-status`, `POST /api/bookings`, `GET /api/status`

## Current limitations

- Fluance publishes dedicated markdown resources for agents, but does not yet provide full `Accept: text/markdown` negotiation on the same HTML URLs.
- The public website is served on GitHub Pages, so browser requests cannot rely on Firebase Hosting rewrites for `/api/*`.
- The public booking frontend therefore continues to call the public Cloud Functions endpoints directly.
- No OAuth/OIDC discovery metadata is currently published for the public API surface.

## Contact

- https://fluance.io/contact/
