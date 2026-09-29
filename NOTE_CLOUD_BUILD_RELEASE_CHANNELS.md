# Note de suivi — Annonces Google Cloud Build & Firebase Hosting

Vérification effectuée le **2026-09-29** pour le projet `fluance-protected-content`.

---

## 1. Cloud Build — Release channels des VMs workers

### L'annonce
Google recommande de tester/configurer les *release channels* des VMs workers de
Cloud Build. À partir du **28/03/2027**, le canal `regular` devient le défaut
(aujourd'hui : version `legacy`).

- `legacy` : Docker 20.10 / Debian 11 — supporté jusqu'au **31/03/2028**
- `regular` : défaut à partir du **28/03/2027** — Docker 29 / Debian 13
- `rapid` : toujours la dernière version
- `stable` : mise à jour ~1×/an (février)

Documentation : https://cloud.google.com/build/docs/release-channels

### Constat sur ce projet
- **Aucune configuration Cloud Build dans le dépôt** : pas de `cloudbuild.yaml`,
  pas de `Dockerfile`, pas de `gcloud builds submit`, pas de trigger, pas de
  worker pool privé.
- Les seuls builds Cloud Build du projet sont **gérés automatiquement par
  Google** : ce sont les builds **Cloud Functions v2 / Firebase Functions**
  déclenchés par `firebase deploy --only functions` (images
  `europe-west1-docker.pkg.dev/serverless-runtimes/...`).
- Vérifié via l'API (`europe-west1`) : 30 builds récents, tous `SUCCESS`, tous
  sur le pool par défaut, **aucun `workerRelease` configuré**, **aucun trigger**,
  **aucun worker pool privé**.

### Conclusion / actions
- **Rien à modifier dans le dépôt.** Le paramètre `workerRelease` n'est pas
  applicable aux builds Cloud Functions managés par Google.
- Ces builds n'ont pas de dépendance au Docker/Debian hôte (buildpacks Node 24
  managés) → risque faible.
- ✅ **À faire avant le 28/03/2027** : refaire un `firebase deploy --only functions`
  de test et vérifier qu'il passe bien sur le canal `regular`.
- (Rappel : `legacy` reste supporté jusqu'en mars 2028.)

### Comment forcer un canal (uniquement pour de futurs builds que l'on créerait)
```yaml
# cloudbuild.yaml
steps:
  # ...
options:
  workerRelease: stable   # regular | rapid | stable | <version>
```
Ou en ligne de commande (pool par défaut) :
```bash
gcloud builds submit --worker-release=stable
```
Ou dans un worker pool privé :
```bash
gcloud builds worker-pools update PRIVATEPOOL_ID --worker-release=stable \
  --region=REGION --project=PROJECT_ID
```

---

## 2. Firebase Hosting — Provisioning on-demand des sites (15/10/2026)

### L'annonce
À partir du **15/10/2026**, les nouveaux projets Firebase ne créeront plus de
site Hosting par défaut : le site sera provisionné à la demande lors du premier
déploiement. Impacte uniquement les **pipelines CI/CD qui créent et déploient
vers de nouveaux projets**.

### Constat sur ce projet
- **Aucune automatisation ne déploie vers Firebase Hosting** : le site est
  déployé sur **Cloudflare Pages** (`.github/workflows/deploy.yml`). Les autres
  workflows déploient des Workers Cloudflare.
- Le projet est **existant** (pas un nouveau projet après le 15/10/2026).
- Les deux sites Hosting sont **déjà provisionnés** (vérifié via l'API) :
  - `fluance-api` (USER_SITE), cible du `hosting.targets.api` de `.firebaserc`
  - `fluance-protected-content` (DEFAULT_SITE)

### Conclusion / actions
- ✅ **Aucune action requise.** Ni création de projet, ni déploiement Hosting
  automatisé dans le CI, et les sites existent déjà.
- Si un jour un pipeline devait déployer vers un **nouveau** projet, ajouter
  d'abord la création explicite du site :
  ```bash
  firebase hosting:sites:create <site-id> --project=<project-id>
  ```
  (ou l'appel REST `projects.sites.create`).
