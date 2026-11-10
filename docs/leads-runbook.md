# Runbook leads/contact

## Que faire si un opt-in ne fonctionne pas

Verifier:

1. que le formulaire pointe vers `https://api.fluance.io/capture-lead`
2. que le `site_id` est correct
3. que le secret Turnstile du site est configure dans Firebase Functions
4. que `MAILJET_API_KEY`, `MAILJET_API_SECRET` et `MAILJET_LIST_ID` sont presents
5. que l'evenement apparait dans `journal_evenements_leads`

Lecture des erreurs:

- depuis le durcissement reseau de `blogLeadHub`, les evenements
  `capture_lead_internal_error` / `send_contact_internal_error` contiennent la
  cause reelle (ex. `fetch failed (ECONNRESET, read)`) : la cause est conservee,
  plus seulement `fetch failed`
- un `ECONNRESET` / `ETIMEDOUT` isole est generalement transitoire (cold start);
  les appels Mailjet et Turnstile sont re-essaies automatiquement (avec delai
  maximal par tentative), et l'envoi d'email limite les re-essais pour eviter
  les doublons
- si l'erreur persiste au-dela des re-essais, verifier cote Mailjet (statut API,
  quota, liste) et les logs Firebase Functions (`captureLead`)
- toute erreur serveur (`capture_lead_internal_error`, `send_contact_internal_error`,
  `doi_reminder_processing_error`) declenche une alerte ops automatique des la
  premiere occurrence (`>= 1` sur `30 min`, fonction `sendBlogLeadOpsAlerts`),
  car elle correspond a un lead potentiellement perdu
- les proprietes Mailjet sont (re)creees hors du chemin de requete par la tache
  `refreshMailjetLeadProperties` (lundi 04:00); en cas d'ajout de propriete,
  incrementer `MAILJET_PROPERTIES_SCHEMA_VERSION` dans `blogLeadHub.js`

## Que faire si un formulaire contact ne fonctionne pas

Verifier:

1. que le formulaire pointe vers `https://api.fluance.io/send-contact-email`
2. que le secret Turnstile du site est configure
3. que l'evenement apparait dans `journal_formulaires_contact`
4. que Mailjet accepte les envois transactionnels depuis `support@actu.fluance.io`

## Relances DOI

Calendrier:

- relance 1: J+1
- relance 2: J+5
- expiration: J+7

La fonction scheduled actuelle:

- `sendOptInReminders`

## Collections Firestore utiles

- `journal_evenements_leads`
- `journal_formulaires_contact`
- `newsletterConfirmations`
- `journal_alertes_ops`
- `digest_ops_history`

## Pilotage quotidien

Emails attendus:

- un rapport quotidien envoye a `support@fluance.io` UNIQUEMENT si des soucis
  critiques ont ete detectes sur les dernieres 24h (aucun e-mail si tout est normal)
- un digest mensuel envoye a `support@fluance.io` le 1er de chaque mois,
  systematiquement, couvrant les 30 derniers jours

Contenu attendu:

- opt-ins par blog
- confirmations DOI par blog
- DOI en attente
- relances DOI
- contacts recus
- erreurs critiques

## Purge des journaux (cleanupOpsJournals)

- tourne chaque nuit a `04:30 Europe/Zurich`, logs contenant le prefixe `🧹`
- nombre de documents purges par collection affiche dans les logs
- timeout: `300 secondes` (defaut 60s) pour rattraper un stock apres une
  interruption; l'execution s'arrete des que tout est purge
- si un jour l'execution approche le timeout ou renvoie `deadline exceeded`:
  reduire la retention ou passer au TTL Firestore natif
  (voir docs/leads-architecture.md, section Retention des journaux)

## Alertes critiques

Emails d'alerte attendus seulement si:

- erreurs serveur repetees sur `captureLead` ou `sendContactEmail`
- echec Mailjet sur DOI, relance DOI ou email contact
- pic d'echecs Turnstile

Si une alerte arrive:

1. verifier `journal_evenements_leads`
2. verifier `journal_formulaires_contact`
3. verifier l'etat Mailjet si l'alerte concerne un envoi
4. verifier les logs Firebase Functions si l'alerte concerne une erreur serveur
   (lien inclus dans le pied de page de chaque e-mail d'alerte)
5. verifier `digest_ops_history` (type `issue_report`) pour l'historique des
   rapports quotidiens, meme ceux sans e-mail (`sent: false`)
6. si aucune alerte n'arrive alors qu'un incident est suspecte, verifier que les
   fonctions planifiees tournent: logs de `sendBlogLeadsIssueReport` et
   `sendBlogLeadOpsAlerts` dans la console Firebase

Note migration (terminee): l'ancienne fonction `sendBlogLeadsDailyDigest`
(digest quotidien systematique) a ete supprimee au profit du rapport
conditionnel `sendBlogLeadsIssueReport` et du digest mensuel.

## Dimensionnement des fonctions (memoire / instances)

Reglages de `captureLead` et `sendContactEmail` (`functions/blogLeadHub.js`),
verifies apres deploiement (API Cloud Functions: `availableMemory`,
`minInstanceCount`, `maxInstanceCount`):

- `memory: '512MiB'` (defaut GCP: 256 MiB)
- `maxInstances: 20` (garde-fou de cout; plafond Cloud Run par defaut: 100)
- `minInstances: 0` (aucune instance chaude)

Pourquoi 512 MiB: en octobre 2026, quatre `Memory limit of 256 MiB exceeded`
(3, 7, 10 et 13/10, pic observe 268 MiB). Un kill memoire peut tuer une
requete en cours sans rien ecrire dans `journal_evenements_leads`: c'est un
angle mort pour le rapport quotidien et le digest mensuel.

### Fonctions planifiees (incident du 3 au 10 novembre 2026)

Toutes les fonctions `onSchedule` sont dimensionnees dans
`functions/runtimeConfig.js` (`SCHEDULED_FUNCTION_RUNTIME`):

- `memory: '512MiB'`
- `minInstances: 0`
- `maxInstances: 1` (Cloud Scheduler declenche une requete a la fois)

Symptome observe: `Memory limit of 256 MiB exceeded with 260 MiB used` suivi de
`The request failed because the instance failed the readiness check`. Le tick
planifie **echoue completement** (rien n'est traite, pas de rejeu: le tick
suivant repart de zero). Compteur des OOM sur 30 jours avant correction:

| Fonction | OOM/jour | Cadence |
|---|---|---|
| `sendBlogLeadOpsAlerts` | ~46 | toutes les 30 min (quasi 100 % des runs) |
| `syncPlanning` | ~23 | horaire |
| `sendCartAbandonmentEmails` | ~12 | toutes les 2 h |
| `sendNewContentEmails` | 1 | quotidienne |
| les 10 autres planifiees | ~1 chacune | quotidienne |

Cause: le runtime Node charge `firebase-admin` + `googleapis` -> ~260 Mi des le
demarrage a froid, soit au-dessus du plafond de 256 Mi (defaut GCP). Le meme
symptome affectait `getAvailableCourses` (18 OOM sur 30 jours) et, de facon
ponctuelle, `getProtectedContent`, `getNotificationPrefs`,
`confirmNewsletterOptIn`, `sendSignInLinkViaMailjet`, `apiStatus` et
`webhookStripe`: ces 6 fonctions sont passees a 512 MiB aussi.

Garde-fous:

- `functions/test/runtimeConfig.test.js` echoue si une fonction planifiee
  n'applique pas `...SCHEDULED_FUNCTION_RUNTIME` (test unitaires CI)
- `npm run verify:functions` compare le runtime REELLEMENT deploye (memoire,
  instances) aux valeurs declarees, pour les 9 fonctions HTTP dimensionnees et
  pour **toutes** les fonctions planifiees (detectees dans le code source)
- toute nouvelle fonction planifiee est automatiquement incluse dans la
  verification (liste derivee du code, pas de liste a tenir a la main)

Diagnostic d'un tick perdu:

    gcloud logging read 'resource.labels.service_name="syncplanning" \
      AND textPayload:"Memory limit"' --freshness=1d

Si un OOM reapparait a 512 MiB, identifier ce qui grossit (chargement de
librairies) avant de monter a `1GiB`.

Pourquoi aucune instance minimale: mesure sur 30 jours (novembre 2026), 355
invocations, 118 cold starts, demarrage median 5,0 s (max 16,1 s), pour un cout
de l'ordre de 0,005 CHF/mois. Une instance minimale a 512 MiB couterait ~4,5
CHF/mois (memoire + CPU au tarif "min-instance", europe-west1). `minInstances`
est le seul reglage qui facture a l'arret: ne pas l'activer sans besoin mesure.

Si la latence de demarrage devient genante (ex. envoi de campagne): preferer un
ping de maintien a chaud (toutes les 10 min pendant la fenetre concernee,
~0,01 CHF/mois) a des instances minimales. Un `POST` vide sur `capture-lead` est
rejete (`400 Email requis`) avant toute ecriture, donc un ping ne pollue ni les
journaux ni les digests.

Diagnostic:

- cold starts: logs Cloud Run, service `capturelead`, texte `Starting new instance`
- kills memoire: meme filtre, texte `Memory limit` (si cela reapparait a
  512 MiB, identifier ce qui grossit avant de monter a `1GiB`)
- un redeploiement Firebase reecrit ces valeurs depuis le code: elles sont
  declarees dans `functions/runtimeConfig.js` (ne pas les remettre en dur
  ailleurs) et controlees par `npm run verify:functions`

## Verification du dimensionnement deploye

Les valeurs de memoire / instances sont declarees une seule fois dans
`functions/runtimeConfig.js` (utilise par `blogLeadHub.js`, `index.js` et par
le script de verification). Apres chaque deploiement de functions:

    npm run verify:functions

Le script lit l'API Cloud Functions v2 et compare `availableMemory`,
`minInstanceCount` et `maxInstanceCount` aux valeurs declarees. Code de sortie
`1` en cas d'ecart. Authentification: Application Default Credentials en local
(`gcloud auth application-default login`), Workload Identity Federation en CI.

La liste des fonctions a verifier est derivee du code source
(`scripts/lib/deployed-functions.mjs`): toute fonction `onSchedule` declaree
dans `functions/` est verifiee automatiquement.

Un redeploiement qui ne declare pas une option la remet au defaut GCP: c'est
ainsi que `maxInstanceCount` etait repasse de 20 a 100 le 1er novembre 2026.

## Deploiement des functions (CI + WIF)

Les functions se deployent desormais depuis la CI
(`.github/workflows/deploy-functions.yml`):

- push sur `main` touchant `functions/`, `src/emails/` ou
  `scripts/build-email-templates.js` -> deploiement automatique
- `workflow_dispatch` -> deploiement manuel (input `functions` pour cibler,
  ex. `functions:captureLead,functions:sendContactEmail`)
- avant deploiement: `npm ci`, lint, tests unitaires, build des templates email
- apres deploiement: `npm run verify:functions` (garde-fou anti-derive)

### Deploiement par lots (incident du 10 novembre 2026)

Le deploiement est decoupe en lots de 15 fonctions (pause de 45 s entre les
lots, 3 tentatives par lot). Pourquoi: le quota GCP `Per project mutation
requests per minute per region` est atteint quand les 75 fonctions sont mises a
jour d'un seul coup. Symptoms: `429 Quota exceeded`, puis mise a jour d'un job
Cloud Scheduler avec une URI vide (`400 URL cannot be empty`) -> le run de CI
echoue alors que le deploiement est fonctionnel.

La liste des fonctions a deployer est derivee du code source
(`node scripts/lib/deployed-functions.mjs --format csv`). Un changement de
`functions/runtimeConfig.js` impose un deploiement complet (il porte le
dimensionnement de toutes les fonctions).

Authentification par **Workload Identity Federation**: aucune cle JSON de
compte de service n'est stockee dans GitHub. Le jeton OIDC GitHub est echange
contre des credentials GCP temporaires.

- pool: `github` (global), provider OIDC `github`, condition
  `assertion.repository == 'cedric-v/fluance-io'`
- compte de service: `github-deployer@fluance-protected-content.iam.gserviceaccount.com`
  (roles: cloudfunctions, run, artifactregistry, cloudbuild, cloudscheduler,
  storage, secretmanager, firebase, serviceusage)
- binding `roles/iam.workloadIdentityUser` sur le `principalSet` du depot
- variables de depot (non secretes): `GCP_PROJECT_ID`,
  `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`
- environnement GitHub `production` (protection rules vide: ajouter une
  approbation si un deploiement doit passer par une validation humaine)

Deploiement manuel depuis le laptop (toujours possible):
`firebase deploy --only functions:captureLead,functions:sendContactEmail`
puis `npm run verify:functions`.

## Rollback

Functions (gen2 = Cloud Run: bascule instantanee, sans rebuild):

    gcloud run revisions list --service capturelead --region europe-west1
    gcloud run services update-traffic capturelead \
      --region europe-west1 --to-revisions=<revision>=100

Meme principe pour `sendcontactemail`. Rappel: le rollback de trafic ne change
pas les options declarees (memoire, instances), seulement la revision servie.

Site: Cloudflare Pages > Deployments > "Rollback to this deployment".

Code: `git revert <sha> && git push` (le deploiement du site repart de `main`),
puis redeployer les functions si le revert les concerne et relancer
`npm run verify:functions`.

## Cas particulier important

Si un visiteur soumet plusieurs fois le meme opt-in avant confirmation:

- on privilegie la reutilisation d'un token encore valide quand c'est possible
- sinon un nouveau token peut etre genere

## Regle de securite produit

Si un developpeur ajoute un nouveau formulaire:

- il doit choisir entre `capture-lead` et `send-contact-email`
- il ne doit jamais reutiliser `send-contact-email` pour du marketing
- il ne doit jamais reutiliser `capture-lead` pour du support
