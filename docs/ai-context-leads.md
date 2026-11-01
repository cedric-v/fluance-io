# AI Context - Leads and Contact Hub

## Mission

Ce systeme gere:

- les opt-ins de blogs externes relies a Fluance
- les formulaires de contact de ces memes blogs
- la preuve applicative des confirmations DOI

## Non negotiable rules

- all opt-ins must go through double opt-in
- contact forms must never subscribe users to the marketing list
- the marketing list is unique in Mailjet
- segmentation is property-based
- production API domain is `api.fluance.io`
- public `fluance.io` still stays on GitHub Pages in phase 1
- API routing is handled by Firebase Hosting + Firebase Functions

## Current connected blogs

- `techniquesdemeditation.com`
- `vie-explosive.fr`
- `developpementpersonnel.org`

Alias still accepted:

- `devperso.org`

## Email sender policy

For DOI and newsletter-related emails:

- from email: `fluance@actu.fluance.io`
- from name: `Cedric de Fluance`
- reply-to email: `support@fluance.io`
- reply-to name: `Support de Fluance`

For contact transactional emails:

- from email: `support@actu.fluance.io`
- from name: `Support de Fluance`
- internal destination: `support@fluance.io`

## Firestore collections of interest

- `newsletterConfirmations`
- `journal_evenements_leads`
- `journal_formulaires_contact`
- `journal_alertes_ops`
- `digest_ops_history`

## Important implementation details

- keep `site_id` values stable:
  - `techniquesdemeditation`
  - `vie-explosive`
  - `devperso`
- keep current blog `redirect_url` values in phase 1
- final gift access after DOI is controlled by Fluance confirmation flow
- central privacy policy URL is `https://fluance.io/mentions-legales/`
- operational monitoring now includes:
  - `sendBlogLeadsMonthlyDigest` at `08:00 Europe/Zurich` on the 1st of each month (30-day summary, always sent)
  - `sendBlogLeadsIssueReport` daily at `08:00 Europe/Zurich` (sent only when critical issues occurred in the last 24h)
  - `sendBlogLeadOpsAlerts` every `15 minutes`
  - `refreshMailjetLeadProperties` weekly (Mailjet lead properties created out of the request path)
  - deduplicated alert documents in `journal_alertes_ops`
  - digest and issue report history in `digest_ops_history` (with `type`: `issue_report` or `monthly_digest`, and `sent` flag)

## Runtime sizing (do not remove)

`captureLead` and `sendContactEmail` are deployed with `memory: '512MiB'`,
`maxInstances: 20` and `minInstances: 0`, declared once in
`functions/runtimeConfig.js` (consumed by `blogLeadHub.js` and checked against
the deployed config by `npm run verify:functions`).
Reasons, measured in November 2026:

- 256 MiB (the GCP default) was exceeded on cold start (`Memory limit of 256
  MiB exceeded`, up to 268 MiB used), which can kill an in-flight request
  without leaving any event in `journal_evenements_leads`.
- the instance cap of 20 was previously set out of band on the deployed
  service and got lost on redeploy; it is now explicit in code to keep a cost
  ceiling during traffic spikes.
- `minInstances` stays at 0: 30-day measurement was 355 invocations, 118 cold
  starts, median boot 5.0 s, for a cost around 0.005 CHF/month; one warm
  instance would cost ~4.5 CHF/month.

CI: the `functions` job in `.github/workflows/ci.yml` (lint + tests) is a
required check on `main`; the same lint + tests also run locally on `pre-push`
when the push touches `functions/`. Functions are still deployed manually, so
the post-deploy runtime check is the guard against config drift.

## Future improvements already anticipated

- lightweight preference center
- stronger observability dashboards
- more refined DOI reminders by blog
- possible migration of `fluance.io` from GitHub Pages to Cloudflare Pages later
