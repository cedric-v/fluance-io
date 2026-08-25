# Fluance API proxy Worker

Ce Worker fournit la façade publique stable `https://fluance.io/api/*` pour
les agents et les intégrations. Le site statique reste déployé sur Cloudflare
Pages ; la logique métier reste dans les Firebase Cloud Functions.

## Routes

| Route publique | Fonction Firebase |
|---|---|
| `GET /api/courses` | `getAvailableCourses` |
| `GET /api/course-status` | `getCourseStatus` |
| `GET /api/pass-status` | `checkUserPass` |
| `POST /api/bookings` | `bookCourse` |
| `GET /api/status` | `apiStatus` |

Les paramètres de requête, les en-têtes utiles et le corps JSON sont relayés.
Les réponses dynamiques sont marquées `Cache-Control: no-store`.

## Déploiement

Le déploiement se fait volontairement séparément du site Pages, car le dépôt
utilise déjà le dossier racine `functions/` pour Firebase Cloud Functions.

### 1. Créer le token Cloudflare

Dans le dashboard Cloudflare :

1. Sélectionner le compte **CedricV**.
2. Aller dans **My Profile → API Tokens** (ou **Account → API Tokens** selon la version du dashboard).
3. Cliquer sur **Create Token**, puis choisir **Create Custom Token**.
4. Donner un nom explicite, par exemple `fluance-github-api-worker-deploy`.
5. Ajouter ces permissions minimales :
   - **Account → Workers Scripts → Edit** ;
   - **Account → Workers Routes → Edit** ;
   - **Zone → Zone → Read**.
6. Limiter **Account Resources** au compte Cloudflare de Fluance.
7. Limiter **Zone Resources** à la zone `fluance.io`.
8. Créer le token et le copier immédiatement : Cloudflare ne l’affiche
   généralement qu’une seule fois.

Ce token est différent de `CF_API_TOKEN`, qui sert uniquement au déploiement
Cloudflare Pages. Ne jamais l’ajouter à `.env`, au dépôt Git ou aux logs.

### 2. Ajouter le token à GitHub

Dans le dépôt GitHub :

1. Ouvrir **Settings → Secrets and variables → Actions**.
2. Dans **Repository secrets**, cliquer sur **New repository secret**.
3. Nom : `CF_WORKER_API_TOKEN`.
4. Valeur : coller le token Cloudflare sans espace ni guillemets.
5. Vérifier que le secret `CF_ACCOUNT_ID` existe également.

L’Account ID est visible sur la page d’accueil du compte Cloudflare ou dans
l’URL/API du dashboard. Il correspond à l’ID utilisé par `wrangler`.

### 3. Déployer

Dans GitHub :

1. Aller dans **Actions**.
2. Sélectionner **Deploy API proxy Worker**.
3. Cliquer sur **Run workflow** sur la branche `main`.
4. Contrôler les logs : Wrangler doit indiquer le déploiement de
   `fluance-api-proxy` et les routes `fluance.io/api/*`.

Le Worker est attaché aux routes `fluance.io/api/*` et
`www.fluance.io/api/*`. Le déploiement ne modifie pas les autres routes du
projet Pages.

### Déploiement local (optionnel)

Avec Wrangler authentifié et un compte autorisé :

```bash
npx wrangler deploy --config cloudflare/api-proxy/wrangler.toml
```

### Limites du forfait Workers Free

Les limites Cloudflare actuelles à surveiller sont notamment :

- 100 Workers par compte ;
- 100 000 requêtes dynamiques par jour ;
- 10 ms de CPU par invocation ;
- 50 sous-requêtes par invocation.

Les requêtes vers les fichiers statiques Pages restent gratuites et illimitées,
mais les requêtes passant par ce Worker sont des requêtes dynamiques. Un seul
Worker suffit pour toutes les routes `/api/*`.

Références Cloudflare :

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/

## Vérification

Après le déploiement :

```bash
curl -i https://fluance.io/api/status
curl -i https://fluance.io/api/courses
curl -i -X OPTIONS https://fluance.io/api/bookings
```

Le résultat attendu est HTTP 200 pour les deux premières commandes et HTTP
204 pour la requête OPTIONS.
