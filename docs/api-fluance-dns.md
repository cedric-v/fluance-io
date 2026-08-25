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

| Route publique | Fonction backend |
|---|---|
| `GET /api/courses` | `getAvailableCourses` |
| `GET /api/course-status` | `getCourseStatus` |
| `GET /api/pass-status` | `checkUserPass` |
| `POST /api/bookings` | `bookCourse` |
| `GET /api/status` | `apiStatus` |

Les paramètres de requête sont conservés. Le corps JSON et les en-têtes utiles
sont relayés pour les requêtes POST. Les réponses API sont marquées
`Cache-Control: no-store`.

## Fichiers du Worker

- `cloudflare/api-proxy/src/index.js` : proxy et table de routage
- `cloudflare/api-proxy/wrangler.toml` : configuration et routes Cloudflare
- `cloudflare/api-proxy/README.md` : procédure de déploiement et de test

Le Worker est attaché à :

- `fluance.io/api/*`
- `www.fluance.io/api/*`

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
