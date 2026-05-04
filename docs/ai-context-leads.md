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
  - `sendBlogLeadsDailyDigest` at `08:00 Europe/Zurich`
  - `sendBlogLeadOpsAlerts` every `15 minutes`
  - deduplicated alert documents in `journal_alertes_ops`
  - daily digest history in `digest_ops_history`

## Future improvements already anticipated

- lightweight preference center
- stronger observability dashboards
- more refined DOI reminders by blog
- possible migration of `fluance.io` from GitHub Pages to Cloudflare Pages later
