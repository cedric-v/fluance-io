# API publique Fluance sur Cloudflare

## Architecture actuelle

Le site public est servi par le projet **Cloudflare Pages** `fluance-io`.

La façade API publique est un **Cloudflare Worker séparé** :

```text
fluance.io/api/*
        ↓
Worker fluance-api-proxy
        ↓
Firebase Cloud Functions HTTP
        ↓
Firestore / services métier
```

Le Worker ne contient pas la logique de réservation. Il fournit une URL stable
pour les agents, les intégrations et les clients navigateur, tandis que les
Firebase Cloud Functions restent le backend de référence.

## Routes exposées

| Route publique | Fonction backend | Authentification |
|---|---|---|
| `GET /api/courses` | `getAvailableCourses` | publique |
| `GET /api/course-status` | `getCourseStatus` | publique |
| `GET /api/status` | `apiStatus` | publique |
| `GET /api/pass-status` | `checkUserPass` | clé API `pass:read` |
| `POST /api/bookings` | `bookCourse` | clé API `booking:write` |
| `POST /api/send-contact-email` | `sendContactEmail` | clé API `contact:write` |
| `POST /api/mcp` | (Worker) serveur MCP distant | publique (lecture seule) |
| `POST /api/a2a` | (Worker) endpoint A2A | publique (lecture seule) |

Les paramètres de requête sont conservés. Le corps JSON et les en-têtes utiles
sont relayés pour les requêtes POST. Les réponses API sont marquées
`Cache-Control: no-store`.

Les routes protégées attendent la clé dans `X-API-Key` (ou
`Authorization: Bearer flu_...`). Les clés sont configurées hors dépôt via le
secret Worker `FLUANCE_API_KEYS` (voir `cloudflare/api-proxy/README.md`). Le
Worker ne transmet jamais `X-API-Key` aux Cloud Functions.

## Ressources de découverte

Le Worker sert également `/.well-known/*` : `api-catalog`,
`agent-card.json` (A2A), `mcp/server-card.json`, `agent-skills/*` et
`webmcp-context.json`. Ces ressources sont générées par
`scripts/generate-api-proxy-discovery.mjs`.

## Fichiers du Worker

- `cloudflare/api-proxy/src/index.js` : point d’entrée du Worker (CORS, proxy, gestion d’erreurs)
- `cloudflare/api-proxy/src/routes.js` : **table de routage** — source de vérité REST + routes agents dynamiques
- `cloudflare/api-proxy/src/auth.js` : vérification des clés API et des scopes (`X-API-Key` / `Authorization: Bearer`)
- `cloudflare/api-proxy/src/mcp.js`, `cloudflare/api-proxy/src/a2a.js` : endpoints agents (MCP Streamable HTTP, A2A JSON-RPC)
- `cloudflare/api-proxy/src/backend.js`, `http.js`, `jsonrpc.js` : helpers (origine backend, réponses HTTP, JSON-RPC)
- `cloudflare/api-proxy/wrangler.toml` : configuration et routes Cloudflare
- `cloudflare/api-proxy/README.md` : procédure de déploiement, de configuration des clés et de test
- `cloudflare/api-proxy/test/` : tests unitaires (`npm run test:worker`)

Le Worker est attaché à :

- `fluance.io/api/*` et `www.fluance.io/api/*`
- `fluance.io/.well-known/*` et `www.fluance.io/.well-known/*`

Les autres URLs continuent d’être servies par Cloudflare Pages.

## Déploiement

Le Worker est déployé séparément du site Pages, car le dépôt utilise déjà le
dossier racine `functions/` pour les Firebase Cloud Functions.

Déploiement local, avec Wrangler authentifié :

```bash
npx wrangler deploy --config cloudflare/api-proxy/wrangler.toml
```

Déploiement CI : lancer manuellement le workflow GitHub Actions **Deploy API
proxy Worker**.

Le secret GitHub `CF_WORKER_API_TOKEN` doit disposer au minimum des permissions
suivantes :

- **Account → Workers Scripts → Edit** ;
- **Zone → Workers Routes → Edit** ;
- **Zone → Zone → Read**, limité à `fluance.io`.

Le site statique et le Worker utilisent le compte Cloudflare indiqué par
`CF_ACCOUNT_ID`.

## Vérification

```bash
curl -i https://fluance.io/api/status
curl -i https://fluance.io/api/courses
curl -i -X OPTIONS https://fluance.io/api/bookings \
  -H 'Origin: https://fluance.io' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Résultats attendus :

- HTTP 200 et JSON pour `/api/status` ;
- HTTP 200 et la liste des cours pour `/api/courses` ;
- HTTP 204 pour la requête `OPTIONS` ;
- `Cache-Control: no-store` sur les réponses dynamiques.

## Limites et sécurité

- Le Worker ne remplace pas les contrôles de sécurité des Functions.
- Les réservations doivent continuer à être validées et limitées côté Firebase.
- Il ne faut pas mettre en cache `/api/bookings`, `/api/pass-status` ou
  `/api/course-status`.
- Les webhooks, fonctions d’administration et fonctions de synchronisation
  Google Calendar ne doivent pas être ajoutés à cette façade publique.
- `firebase.json` et Firebase Hosting ne servent pas au routage du domaine
  public `fluance.io`.
- Une clé API ne remplace pas l’authentification Firebase : `POST /api/bookings`
  avec `usePass: true` exige en plus un ID token Firebase côté Function.
