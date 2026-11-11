# Garde-fous SEO CI

## périmètre

Ce projet suit la doctrine SEO commune décrite dans `../../cedric-foundation/3 CAPITALISATION CONNAISSANCES/Architecture SEO des sites web.md`.

La première tranche est volontairement locale, rapide et bloquante :

- un seul build est produit ;
- l'artefact `_site` audité est exactement celui qui est déployé ;
- l'audit SEO statique bloque le build en cas de régression ;
- le smoke SEO vérifie toutes les URL du sitemap sur l'artefact et en production.

## commandes

```bash
npm run build          # build complet + audit SEO bloquant
npm run build:unverified # build sans audit, réservé à la régénération du manifeste
npm run seo:audit      # auditer le build existant
npm run seo:manifest   # régénérer scripts/seo-routes.json après vérification humaine
npm run seo:smoke -- --base-url http://localhost:8080 --dist _site
```

## contrôles statiques

`scripts/seo-audit.mjs` contrôle toutes les pages HTML du build :

- title et meta description des pages indexables ;
- canonical absolu, sur le bon domaine et correspondant à la route ;
- attribut `html lang` ;
- présence et validité syntaxique du JSON-LD ;
- balises Open Graph essentielles ;
- `hreflang` : cibles existantes, réciprocité et `x-default` ;
- égalité entre les alternates du HTML et ceux du sitemap ;
- sitemap exactement égal à l'ensemble des pages indexables ;
- absence de `noindex` dans le sitemap ;
- liens internes non cassés ;
- `robots.txt` et référence au sitemap ;
- manifeste des routes : canonical, langues, suppression sans redirection.

Les emails, documents pour agents et autres sorties techniques sont explicitement exclus dans `scripts/seo-audit.config.mjs`. Les interfaces transactionnelles ou de compte sont `noindex` et absentes du sitemap.

## CI et déploiement

Le workflow `.github/workflows/deploy.yml` :

1. construit le site une seule fois ;
2. exécute l'audit SEO via `npm run build` ;
3. conserve `_site` comme artifact CI ;
4. lance le smoke SEO sur toutes les URL du sitemap de l'artifact ;
5. déploie exactement cet artifact ;
6. lance le smoke SEO bloquant sur toutes les URL du sitemap en production.

Le smoke production tolère la propagation Cloudflare et réessaie les erreurs HTTP temporaires.

Le workflow `.github/workflows/preview.yml` déploie chaque pull request sur une branche Cloudflare Pages, utilise exactement le build audité et exécute le smoke SEO sur la preview avant de publier son URL dans GitHub Deployments.

## surveillance planifiée

Le workflow `.github/workflows/seo-weekly.yml` exécute chaque semaine :

- le build et l'audit statique ;
- le crawl HTTP de toutes les URL du sitemap en production ;
- les budgets Lighthouse mobiles ;
- la validation Schema.org externe ;
- le contrôle Search Console lorsque les credentials sont configurées.

Search Console utilise le secret `GSC_SERVICE_ACCOUNT_JSON_B64` et la variable `GSC_SITE_URL`. Sans credentials, le contrôle est ignoré proprement.

## reste à planifier

Ces éléments ne bloquent pas le quotidien et sont décrits dans `docs/seo-follow-up.md` :

- crawl Discover hors sitemap ;
- rollback automatisé, uniquement après validation de l'API Cloudflare.

## mise à jour volontaire des routes

Après ajout, suppression ou modification volontaire d'une route :

1. vérifier la redirection si la route est retirée ;
2. lancer le build ;
3. examiner les warnings de l'audit ;
4. exécuter `npm run seo:manifest` ;
5. relancer `npm run build`.

Le manifeste ne doit jamais être régénéré automatiquement pour masquer une régression.
