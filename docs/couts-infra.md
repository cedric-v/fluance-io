# Audit des couts d'infrastructure

Mesures releveés le 2 novembre 2026 (fenetre 30 jours: 2 octobre -> 1 novembre 2026).
Source: API Cloud Monitoring (usage reel), API Cloud Functions/Firestore/Artifact
Registry (etat reel), API Cloud Billing (tarifs catalogue du compte de facturation
`01DC98-7AC31D-661377`, devise CHF).

## Resume

| Plateforme | Plan reel | Consommation mesuree | Palier gratuit | Consequence |
|---|---|---|---|---|
| Firebase / GCP | **Blaze** (facturation activee) | 44 % du palier CPU Cloud Run | 180 000 vCPU-s/mois | 0 CHF aujourd'hui, mais **facturable si depassement** |
| GitHub Actions | gratuit (repo publique) | ~103 min/mois | runners standard publics gratuits | 0 CHF |
| Cloudflare | gratuit | 26 builds Pages/mois, ~17 req/jour Worker | 500 builds/mois, 100 000 req/jour | 0 CHF |

Point de vigilance: le projet Firebase est en **Blaze** (`billingEnabled: true`),
pas en Spark. Les paliers gratuits sont appliques comme remise, mais **tout
depassement est reellement facture**. D'ou l'importance d'une alerte budget
(voir "Garde-fou budget" plus bas).

## Firebase / Google Cloud

### Cloud Run (functions gen2, `europe-west1`, facturation a la requete)

| Ressource | Usage 30 j | Palier gratuit mensuel | Taux |
|---|---|---|---|
| Invocations | 6 417 | 2 000 000 | 0,3 % |
| CPU | **79 994 vCPU-s** | 180 000 vCPU-s | **44 %** |
| RAM | 7 688 GiB-s | 360 000 GiB-s | 2 % |

Les 75 functions n'ont **aucune instance minimale** (`minInstanceCount` non
defini = 0): rien n'est facture a l'arret. `captureLead` et
`sendContactEmail` sont explicitement a `memory: 512MiB`, `maxInstances: 20`,
`minInstances: 0` (voir `functions/runtimeConfig.js`).

Le palier CPU est le seul compteur a surveiller. Repartition des 80 000 vCPU-s:

| Service | vCPU-s / 30 j | Declencheur |
|---|---|---|
| `syncPlanning` | 29 351 | toutes les 30 min (1 437 executions) |
| `sendBlogLeadOpsAlerts` | 20 594 | toutes les 15 min (2 881 executions) |
| `sendCartAbandonmentEmails` | 15 488 | toutes les heures (719 executions) |
| `sendContactEmail` | 4 278 | a la demande |
| `captureLead` | 1 614 | a la demande |

Ces trois fonctions planifiees consomment 82 % du CPU pour 0 lead: ce sont des
demarrages a froid repetes (chaque tick = une instance neuve).

**Le CPU est un cout par invocation, pas par seconde de calcul.** Les trois
fonctions executent 0,3 a 2,3 s de travail reel, mais leur instance reste
allouee le temps du demarrage a froid et de la fenetre de scale-down (7 a 21 s
factures par tick). Le seul levier efficace est donc le nombre d'invocations.

Optimisations appliquees le 2 novembre 2026 (resultat mesure : ~44 000 vCPU-s
par mois, soit 24 % du palier, marge x4):

| Fonction | Cadence avant | Cadence apres | Gain vCPU-s/mois | Impact fonctionnel |
|---|---|---|---|---|
| `syncPlanning` | 30 min | 1 h | -14 700 | sync calendrier 1 h au lieu de 30 min (cours planifies des semaines a l'avance) |
| `sendCartAbandonmentEmails` | 1 h | 2 h | -7 700 | relance 1 dans [2 h, 4 h[, relance 2 dans [20 h, 22 h[ (toujours avant expiration de la session Stripe a 24 h) |
| `sendBlogLeadOpsAlerts` | 15 min | 30 min | -10 300 | fenetre de detection passee de 15 a 30 min (le rapport quotidien de 08:00 reste le filet de securite sur 24 h) |

Note: pour `sendCartAbandonmentEmails`, une cadence de 4 h aurait ete plus
economique (-11 600) mais aurait pousse la relance 2 dans [20 h, 24 h[, c'est-a-dire
a la limite de l'expiration de la session Stripe: le gain ne valait pas le
risque de perdre une relance.

### Firestore

| Ressource | Usage 30 j | Palier gratuit | Taux |
|---|---|---|---|
| Lectures | 2 103 / jour | 50 000 / jour | 4 % |
| Ecritures | 1 196 / jour | 20 000 / jour | 6 % |
| Suppressions | 9 / jour | 20 000 / jour | - |
| Stockage | 13,9 Mo | 1 GiB | 1,4 % |

Les quotas gratuits sont **quotidiens** (reinitialisation a minuit Pacific).
Marge tres confortable.

Points facturables a part (billing necessaire, hors palier gratuit) mais
negligeables au volume actuel:

- **Sauvegardes automatiques actives** (`backupSchedules`, lundi, retention
  98 jours). Facturees au Go stocke: ~14 Mo de donnees -> < 0,01 USD/mois.
  Elles ne sont pas dans le palier gratuit, mais la database est minuscule.
- PITR desactive (`POINT_IN_TIME_RECOVERY_DISABLED`).

### Autres services GCP

| Service | Etat | Cout |
|---|---|---|
| Cloud Scheduler | 14 jobs | Palier gratuit (SKU: 0,003226 CHF/job au-dela de 93) |
| Cloud Build | builds des deploiements de functions | Palier gratuit: 2 500 min/mois (usage ~100 min/mois) |
| Artifact Registry | `gcf-artifacts` 395 Mo, cleanup policy auto (images > 24 h supprimees) | Palier gratuit: 0,5 GiB |
| Eventarc | ~10 000 evenements/mois | 0,000001 CHF evenement -> ~0,01 CHF/mois |
| Cloud Logging | 92 044 entrees/30 j | Palier gratuit: 50 GiB/mois |
| Secret Manager | secrets des functions | Palier gratuit: 6 accès/requete |

Firebase Hosting (`api.fluance.io` -> `fluance-api.web.app`) : palier gratuit
10 Go de stockage + 360 Mo/j de sortie, trafic negligeable.

## GitHub Actions

Le depot est **public**: les minutes de runners standard (`ubuntu-latest`) sont
gratuites, quel que soit le volume.

- 134 runs / 30 j, ~103 min de temps machine cumule (build 60 min, smoke-test
  22 min, Gitleaks 11 min, deploy 8 min, post-deploy 5 min)
- Artifacts: 500 Mo inclus (plan gratuit) - l'artifact `_site` fait 33 Mo avec
  une retention de 1 jour (`retention-days: 1` dans `deploy.yml`)
- Cache: 10 Go par depot inclus

Aucun cout. Piege a eviter: si le depot devenait **prive**, les minutes
seraient comptees (2 000 min/mois incluses sur le plan gratuit, donc toujours
sous le seuil avec 103 min/mois). Le workflow `deploy-functions.yml` ajoute
~5 min par deploiement de functions.

## Cloudflare

| Service | Usage 30 j | Palier gratuit | Taux |
|---|---|---|---|
| Pages (builds) | 26 deploiements (push `main`) | 500 / mois | 5 % |
| Pages (fichiers) | 427 fichiers | 20 000 | 2 % |
| Workers (`fluance-api-proxy`) | ~17 requetes/jour | 100 000 / jour | 0,02 % |
| Observability | sampling 10 %, invocation logs off | 0,5 Go/jour | - |

Les PR declenchent un build GitHub Actions (donc des minutes CI) mais **pas**
un deploiement Pages (`deploy` job conditionne a `github.event_name != 'pull_request'`),
donc ils ne comptent pas dans les 500 builds.

Les quotas Workers (100 000 requetes/jour, 10 ms CPU/requete) ne sont pas
contraints: le Worker ne fait que proxier vers les functions.

## Garde-fou budget

Le projet etant en Blaze, une alerte budget est la seule protection contre un
pic inattendu (bug en boucle, script qui appelle une function en rafale).

L'API `billingbudgets` n'a pas pu etre activee depuis cette session (le projet
OAuth local `764786051850` n'est pas activable par ce compte). A creer depuis
la console:

- Cloud Console > Facturation > Budgets et alertes > Creer un budget
- Portee: projet `fluance-protected-content`
- Seuil: **10 CHF/mois**, alertes a 50 %, 90 % et 100 %

Ou en ligne de commande, apres `gcloud auth login` (compte administrateur du
projet):

    gcloud billing budgets create --billing-account=01DC98-7AC31D-661377 \
      --display-name="Alerte budget Fluance" \
      --budget-amount=10 --currency=CHF \
      --projects=fluance-protected-content \
      --threshold-rules=0.5,0.9,1.0

Seuil 10 CHF: depasse largement la conso reelle (actuellement 0), sert de
filet si une regression introduit une boucle de appels.
