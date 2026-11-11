# SEO — suivi et prochaine session

Ce document sépare les contrôles déjà bloquants du travail volontaire et planifiable.

## état par projet

| Projet | Tranches 1–2 | État local observé | Priorité suivante |
|---|---|---|---|
| `fluance-io` | Audit statique, manifeste, smoke artifact/preview/production, Lighthouse/Schema.org/GSC hebdomadaire | 132 HTML, 26 pages indexables, 26 URL sitemap, audit sans erreur | Configurer les credentials GSC puis rollback |
| `../cedric-v` | Audit statique, manifeste, smoke artifact/preview/production, Lighthouse/Schema.org/GSC hebdomadaire | 302 HTML, 194 pages indexables, 194 URL sitemap, audit sans erreur | Configurer les credentials GSC puis rollback |
| `../techniquesdemeditation.com` | Audit statique, manifeste, smoke, CI PR/push, Lighthouse/Schema.org/GSC hebdomadaire | 391 HTML, 361 pages indexables, 361 URL sitemap, audit sans erreur | Nettoyer les liens legacy et migrer le déploiement vers un artefact CI |
| `../vie-explosive` | Audit statique, manifeste, smoke, CI PR/push, Lighthouse/Schema.org/GSC hebdomadaire | 518 HTML, 297 pages indexables, 297 URL sitemap, audit sans erreur | Nettoyer les liens legacy et migrer le déploiement vers un artefact CI |
| `../devperso.org` | Audit statique, manifeste, smoke, CI PR/push, Lighthouse/Schema.org/GSC hebdomadaire | 160 HTML, 127 pages indexables, 127 URL sitemap, audit sans erreur | Corriger les H1/descriptions et migrer le déploiement vers un artefact CI |

Les chiffres proviennent de builds locaux frais. Ils ne constituent pas un audit Search Console de la production.

## backlog `fluance-io`

### P1 — surveillance réelle

- le contrôle `seo:gsc` est implémenté dans le workflow hebdomadaire ;
- ajouter le secret `GSC_SERVICE_ACCOUNT_JSON_B64` et la variable `GSC_SITE_URL` ;
- compléter le suivi avec les exclusions et actions manuelles, pas seulement les inspections.

### P2 — performance et données structurées

- Lighthouse CI mobile hebdomadaire, budgets en mode `warn` et rapports conservés sept jours : implémenté ;
- validation Schema.org externe planifiée : implémentée ;
- suivre de terrain CrUX/Search Console pour `INP`, à ne pas déduire d'un test Lighthouse local.

### P3 — infrastructure

- crawl Discover hors sitemap si le volume augmente ;
- rollback automatisé après test réel de restauration via l'API Cloudflare.

## backlog `../cedric-v`

### P1 — surveillance réelle

- le contrôle `seo:gsc` est implémenté dans le workflow hebdomadaire ;
- ajouter les credentials Search Console ;
- conserver le manifeste des 194 routes à jour lors des publications de nouveaux articles ;
- conserver le smoke SEO sur chaque preview.

### P2 — performance et données structurées

- Lighthouse CI mobile hebdomadaire : implémenté ;
- validation Schema.org externe : implémentée ;
- crawl du sitemap : implémenté dans le smoke hebdomadaire.

### P3 — infrastructure

- remplacer le délai fixe de propagation Cloudflare par une notification de déploiement ;
- rollback automatisé après validation de l'API Cloudflare ;
- rechercher à centraliser progressivement les scripts SEO dans un dépôt d'outillage partagé.

## évaluation des trois autres sites

### `../techniquesdemeditation.com`

**Pertinence : élevée.** Site Eleventy statique, monolingue, 361 URL dans le sitemap. Les titles, descriptions, canonicals, Open Graph, JSON-LD et `robots.txt` sont présents sur les pages du sitemap. Les `hreflang` et `x-default` ne sont pas nécessaires.

**État après implémentation :**

- l'audit statique, le manifeste, le smoke et la CI sont actifs ;
- les catégories automatiques de tags sont `noindex` afin d'éviter des pages minces qui se concurrencent ;
- les anciens chemins HTML sont documentés par des redirections 301 ;
- les médias `/wp-content/uploads/...` sont hors du crawl des routes HTML ;
- les liens internes ont été remplacés par leurs destinations finales ; les redirections sont conservées uniquement pour préserver les entrées externes.

**Reste à faire :**

1. migrer le déploiement Wrangler manuel vers un artefact CI unique et une preview ;
2. analyser les descriptions dupliquées ;
3. automatiser le rollback après validation de l'API Cloudflare.

### `../vie-explosive`

**Pertinence : élevée.** Site Eleventy statique, monolingue, environ 297 URL dans le sitemap. Les métadonnées principales des pages du sitemap sont valides.

**État après implémentation :**

- l'audit statique, le manifeste, le smoke et la CI sont actifs ;
- la pagination `/page/2/` à `/page/42/`, les programmes `/jour-1/` à `/jour-7/`, les pages `/sp-*`, `/inscription-validee/`, `/questions/` et `/top13/` sont `noindex` ;
- les chemins historiques conservent leurs redirections pour les entrées externes ;
- les liens internes ont été remplacés par leurs destinations finales.

**Reste à faire :**

1. migrer le déploiement Wrangler manuel vers un artefact CI unique et une preview ;
2. analyser les H1 multiples et descriptions génériques encore signalés ;
3. automatiser le rollback après validation de l'API Cloudflare.

### `../devperso.org`

**Pertinence : élevée.** Site Eleventy statique, monolingue, 127 URL dans le sitemap. Les métadonnées principales des pages du sitemap sont valides.

**État après implémentation :**

- les dossiers `_drafts` ne sont plus compilés ;
- `/egocentrisme/` est rétabli dans le sitemap ;
- `/telechargez-votre-cadeau-de-bienvenue/` est `noindex` ;
- les liens historiques mal formés ont été réparés ou rendus non navigables ;
- les H1 multiples ont été hiérarchisés sous le H1 du layout ;
- les pages qui utilisaient la description générique ont reçu une description propre ;
- l'audit statique, le manifeste, le smoke et la CI sont actifs.

**Reste à faire :**

1. améliorer éditorialement les descriptions générées à partir des premiers paragraphes ;
2. migrer le déploiement Wrangler manuel vers un artefact CI unique et une preview ;
3. automatiser le rollback après validation de l'API Cloudflare.

## ordre recommandé pour la prochaine session

1. configurer les credentials Search Console des cinq propriétés ;
2. migrer `../techniquesdemeditation.com`, `../vie-explosive` et `../devperso.org` vers un déploiement GitHub Actions avec artifact unique et preview ;
3. améliorer les descriptions génériques restantes sur Vie Explosive et Techniques de Méditation ;
4. mettre en place le crawl Discover hors sitemap si le volume le justifie ;
5. créer un outillage SEO partagé pour éviter les copies divergentes ;
6. automatiser le rollback après validation de l'API Cloudflare.
