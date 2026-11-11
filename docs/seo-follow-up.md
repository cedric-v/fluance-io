# SEO — suivi et prochaine session

Ce document sépare les contrôles déjà bloquants du travail volontaire et planifiable.

## état par projet

| Projet | Tranche 1 | État local observé | Priorité suivante |
|---|---|---|---|
| `fluance-io` | Audit statique, manifeste, smoke artifact/production | 132 HTML, 26 pages indexables, 26 URL sitemap, audit sans erreur | Search Console puis Lighthouse |
| `../cedric-v` | Audit statique, manifeste, smoke artifact/preview/production | 302 HTML, 194 pages indexables, 194 URL sitemap, audit sans erreur | Search Console puis Lighthouse |
| `../techniquesdemeditation.com` | Non implémentée | 391 HTML, 362 URL sitemap ; métadonnées principales valides | Audit après nettoyage des routes legacy |
| `../vie-explosive` | Non implémentée | 518 HTML, 297 URL sitemap ; métadonnées principales valides | Audit après arbitrage sitemap/pagination |
| `../devperso.org` | Non implémentée | 167 HTML, 126 URL sitemap ; métadonnées principales valides | Audit après exclusion des brouillons et pages utilitaires |

Les chiffres proviennent de builds locaux frais. Ils ne constituent pas un audit Search Console de la production.

## backlog `fluance-io`

### P1 — surveillance réelle

- configurer `GSC_SERVICE_ACCOUNT_JSON_B64` et `GSC_SITE_URL` ;
- implémenter ou reprendre `seo:gsc` pour l'URL Inspection ;
- suivre aussi les exclusions et actions manuelles, pas seulement les inspections.

### P2 — performance et données structurées

- Lighthouse CI mobile hebdomadaire sur trois URL représentatives ;
- conserver les rapports sept jours ;
- commencer en mode `warn` puis passer les régressions structurelles graves en `error` ;
- validation Schema.org externe planifiée ;
- suivi de terrain CrUX/Search Console pour `INP`, à ne pas déduire d'un test Lighthouse local.

### P3 — infrastructure

- preview Cloudflare sur le même artefact ;
- crawl Discover hors sitemap si le volume augmente ;
- rollback automatisé après test réel de restauration via l'API Cloudflare.

## backlog `../cedric-v`

### P1 — surveillance réelle

- configurer Search Console ;
- conserver le manifeste des 194 routes à jour lors des publications de nouveaux articles ;
- ajouter un smoke SEO à toute future branche de preview.

### P2 — performance et données structurées

- Lighthouse CI mobile hebdomadaire sur trois pages représentatives ;
- validation Schema.org externe ;
- crawl mensuel ou hebdomadaire du sitemap selon la fréquence de publication.

### P3 — infrastructure

- remplacer le délai fixe de propagation Cloudflare par une notification de déploiement ;
- rollback automatisé après validation de l'API Cloudflare ;
- rechercher à centraliser progressivement les scripts SEO dans un dépôt d'outillage partagé.

## évaluation des trois autres sites

### `../techniquesdemeditation.com`

**Pertinence : élevée.** Site Eleventy statique, monolingue, environ 362 URL dans le sitemap. Les titles, descriptions, canonicals, Open Graph, JSON-LD et `robots.txt` sont présents sur les pages du sitemap. Les `hreflang` et `x-default` ne sont pas nécessaires.

**Bloquants avant activation d'un audit bloquant :**

- 24 pages de catégories sont indexables mais absentes du sitemap : décider si elles doivent être indexées et ajoutées, ou passer `noindex` ;
- environ 141 liens `<a>` pointent vers des cibles absentes. Une grande partie concerne des images historiques `/wp-content/uploads/...`, mais plusieurs semblent être d'anciens articles renommés ;
- distinguer les médias WordPress legacy des routes HTML et documenter les redirections ;
- le projet n'a actuellement aucun workflow GitHub Actions : le build et le déploiement doivent d'abord adopter un artefact CI unique.

**Parties recommandées :**

1. audit statique rapide, adapté aux exclusions legacy ;
2. manifeste des routes ;
3. smoke test du sitemap sur l'artefact et en production ;
4. Search Console et crawl hebdomadaire ensuite.

### `../vie-explosive`

**Pertinence : élevée.** Site Eleventy statique, monolingue, environ 297 URL dans le sitemap. Les métadonnées principales des pages du sitemap sont valides.

**Bloquants avant activation :**

- les pages de pagination `/page/2/` à `/page/42/`, les pages de programme `/jour-1/` à `/jour-7/`, les pages `/sp-*`, `/inscription-validee/`, `/questions/` et `/top13/` sont indexables mais absentes du sitemap ;
- environ 52 liens `<a>` pointent vers des cibles absentes, dont de nombreux médias `/wp-content/uploads/...` et quelques anciens articles ;
- le projet n'a actuellement aucun workflow GitHub Actions.

**Parties recommandées :**

1. décision explicite sur pagination, programmes et landing pages transactionnelles ;
2. réparation ou redirection des anciens chemins ;
3. audit statique et manifeste ;
4. smoke test du sitemap, puis Lighthouse/Schema.org/GSC.

### `../devperso.org`

**Pertinence : élevée et priorité la plus simple pour la prochaine session.** Site Eleventy statique, monolingue, environ 126 URL dans le sitemap. Les métadonnées principales des pages du sitemap sont valides.

**Bloquants avant activation :**

- des fichiers `_drafts` sont actuellement compilés et indexables : pages `id-*`, `test-sous-page` et `xyz-ics-preview-page` ;
- `/egocentrisme/` et `/telechargez-votre-cadeau-de-bienvenue/` sont indexables mais hors sitemap ;
- environ 8 liens historiques mal formés ou vers des routes disparues sont présents ;
- le projet n'a actuellement aucun workflow GitHub Actions.

**Parties recommandées :**

1. exclure `_drafts` du build et passer les interfaces utiles en `noindex` ;
2. corriger les huit liens ;
3. audit statique et manifeste ;
4. smoke test du sitemap sur l'artefact et en production ;
5. workflow CI avec build unique avant d'activer des contrôles planifiés.

## ordre recommandé pour la prochaine session

1. `../devperso.org` : plus petit périmètre, nettoyage des brouillons puis copie des garde-fous ;
2. `../techniquesdemeditation.com` : arbitrage des catégories et migration des médias/anciens chemins ;
3. `../vie-explosive` : arbitrage pagination/programmes puis correction des liens ;
4. finaliser Search Console et Lighthouse sur `fluance-io` et `../cedric-v` ;
5. créer enfin un outillage SEO partagé pour éviter les copies divergentes.
