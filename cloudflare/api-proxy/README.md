# Fluance API proxy Worker

Ce Worker fournit la façade publique stable `https://fluance.io/api/*`, les
points d’entrée agents (`/api/mcp`, `/api/a2a`) et sert les ressources de
découverte `/.well-known/*`. Le site statique reste déployé sur Cloudflare
Pages ; la logique métier reste dans les Firebase Cloud Functions.

## Routes REST

| Route publique | Fonction Firebase | Auth |
|---|---|---|
| `GET /api/courses` | `getAvailableCourses` | publique |
| `GET /api/course-status` | `getCourseStatus` | publique |
| `GET /api/status` | `apiStatus` | publique |
| `GET /api/pass-status` | `checkUserPass` | clé API `pass:read` |
| `POST /api/bookings` | `bookCourse` | clé API `booking:write` |
| `POST /api/send-contact-email` | `sendContactEmail` | clé API `contact:write` |

Les paramètres de requête, les en-têtes utiles et le corps JSON sont relayés.
Les réponses dynamiques sont marquées `Cache-Control: no-store`. Le Worker ne
transmet jamais `X-API-Key` à l’origine.

## Routes agents

| Route | Description |
|---|---|
| `POST /api/mcp` | Serveur MCP distant (Streamable HTTP, réponses JSON), outils en **lecture seule**. |
| `POST /api/a2a` | Endpoint A2A (JSON-RPC `message/send`), réponses texte. |

`GET`/`DELETE` sur `/api/mcp` renvoient `405` (serveur sans SSE). Les
notifications MCP renvoient `202`.

## Configuration des clés API

Les routes protégées utilisent un secret Worker `FLUANCE_API_KEYS`. Il n’est
jamais versionné.

```bash
# JSON (recommandé) : noms + scopes
npx wrangler secret put FLUANCE_API_KEYS --config cloudflare/api-proxy/wrangler.toml
# coller par exemple :
# [{"key":"flu_xxx","name":"gpt-action","scopes":["pass:read"]}]
```

Formats acceptés :

- JSON array : `[{"key":"flu_x","name":"n","scopes":["booking:write"]}]`
- JSON object : `{"flu_x":{"name":"n","scopes":["*"]}}`
- CSV : `flu_x,flu_y` (scope `*` implicite)

Scopes disponibles : `pass:read`, `booking:write`, `contact:write`, ou `*`.
Une clé doit commencer par `flu_`.

Si `FLUANCE_API_KEYS` n’est pas configuré, les routes protégées répondent
`503 API_AUTH_NOT_CONFIGURED` ; elles restent donc inutilisables tant que le
secret n’est pas posé. C’est volontaire : on échoue fermé.

## Ressources de découverte

- `/.well-known/api-catalog`
- `/.well-known/agent-card.json` (A2A)
- `/.well-known/mcp/server-card.json`
- `/.well-known/agent-skills/index.json` + `SKILL.md`
- `/.well-known/webmcp-context.json`

Elles sont générées depuis `src/.well-known` par :

```bash
node scripts/generate-api-proxy-discovery.mjs          # écrit
node scripts/generate-api-proxy-discovery.mjs --check  # échoue si obsolète
```

Le générateur recalcule aussi les digests SHA-256 des agent skills.

## Tests et validation

```bash
npm --prefix cloudflare/api-proxy test     # tests unitaires du Worker
node scripts/validate-api-contract.mjs     # routes ↔ OpenAPI ↔ discovery
```

`validate:api` est aussi exécuté par `npm run build` (prebuild) et par le
workflow de déploiement du Worker.

## Déploiement

Le déploiement se fait volontairement séparément du site Pages, car le dépôt
utilise déjà le dossier racine `functions/` pour Firebase Cloud Functions.

### 1. Créer le token Cloudflare

Dans le dashboard Cloudflare :

1. Sélectionner le compte **CedricV**.
2. Aller dans **My Profile → API Tokens**.
3. **Create Token → Create Custom Token**, nom : `fluance-github-api-worker-deploy`.
4. Permissions minimales :
   - **Account → Workers Scripts → Edit** ;
   - **Zone → Workers Routes → Edit** ;
   - **Zone → Zone → Read**.
5. Limiter **Account Resources** au compte Fluance et **Zone Resources** à
   `fluance.io`.
6. Copier le token immédiatement.

Ce token est différent de `CF_API_TOKEN` (déploiement Pages). Ne pas
l’enregistrer dans le fichier `.env` : le stockage de référence est le secret
GitHub Actions `CF_WORKER_API_TOKEN`.

### 2. Ajouter le token à GitHub

**Settings → Secrets and variables → Actions → New repository secret** :
`CF_WORKER_API_TOKEN`, puis vérifier que `CF_ACCOUNT_ID` existe aussi.

### 3. Déployer

GitHub → **Actions** → **Deploy API proxy Worker** → **Run workflow** sur
`main`. Wrangler déploie `fluance-api-proxy` sur `fluance.io/api/*` et
`fluance.io/.well-known/*` (ainsi que `www`). Les autres routes restent sur
Pages.

Déploiement local (optionnel) :

```bash
node scripts/generate-api-proxy-discovery.mjs
npx wrangler deploy --config cloudflare/api-proxy/wrangler.toml
```

## Limites du forfait Workers Free

- 100 Workers par compte ;
- 100 000 requêtes dynamiques par jour ;
- 10 ms de CPU par invocation ;
- 50 sous-requêtes par invocation.

Les fichiers statiques Pages restent gratuits et illimités ; les requêtes
passant par ce Worker sont dynamiques. Un seul Worker suffit pour `/api/*` et
`/.well-known/*`.

Références : https://developers.cloudflare.com/workers/platform/limits/ et
https://developers.cloudflare.com/workers/platform/pricing/

## Vérification

```bash
curl -i https://fluance.io/api/status
curl -i https://fluance.io/api/courses
curl -i https://fluance.io/.well-known/api-catalog
curl -i https://fluance.io/.well-known/agent-card.json
curl -i https://fluance.io/.well-known/mcp/server-card.json
curl -i -X POST https://fluance.io/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
curl -i -X OPTIONS https://fluance.io/api/bookings
```

Résultat attendu : `200` pour les lectures et `204` pour `OPTIONS`. Sans clé
configurée, `POST /api/bookings` renvoie `503`.
