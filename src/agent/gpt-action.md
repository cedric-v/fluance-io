# GPT Action — Fluance

This document describes how to expose Fluance to ChatGPT through a Custom GPT
Action. It is the fastest of the AI-platform integrations because the OpenAPI
document already exists.

## Read-only action (recommended first)

1. Create a Custom GPT (ChatGPT → Explore GPTs → Create).
2. Add an Action and import the OpenAPI schema:
   `https://fluance.io/docs/api/openapi.json`
3. Keep only the public read operations:
   - `listAvailableCourses` (`GET /api/courses`)
   - `getCourseStatus` (`GET /api/course-status`)
   - `apiStatus` (`GET /api/status`)
4. Set authentication to **None** for these read operations.

Suggested GPT instructions:

```
You are the Fluance assistant. Fluance helps people release tension through
movement, breath and play. Use listAvailableCourses to answer questions about
upcoming in-person classes in Fribourg (date, time, location, price, remaining
spots). Never invent class data: if the list is empty, say so and point to
https://fluance.io/presentiel/reserver/. For booking, link to the booking page;
do not attempt to book directly.
```

## Transactional actions (optional, later)

`/api/pass-status`, `/api/bookings` and `/api/send-contact-email` require an API
key (`X-API-Key`) with a matching scope. For a Custom GPT, configure the Action
authentication as **API Key → Header → `X-API-Key`** and paste a key issued for
the GPT.

Keep writes out of the first iteration: `POST /api/bookings` creates a real
transaction and sends emails. If you enable it, restrict the key to the
`booking:write` scope and consider a dedicated GPT for internal use only.

## Prerequisites for a public GPT

- A public privacy policy URL (Fluance: `https://fluance.io/mentions-legales/`).
- Ownership/verification of the `fluance.io` domain in the OpenAI dashboard.
- A complete, valid OpenAPI document (validated in CI by
  `node scripts/validate-api-contract.mjs`).
