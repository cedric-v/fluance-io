# Architecture leads/contact Fluance

Date de reference: 2026-05-01

## Objet

Ce document decrit l'architecture cible pour:

- les opt-ins des blogs relies a Fluance
- les formulaires de contact des blogs
- la journalisation associee

## Perimetre

Blogs relies:

- `techniquesdemeditation.com`
- `vie-explosive.fr`
- `developpementpersonnel.org`

Alias technique encore pris en charge:

- `devperso.org`

## Topologie

- front public `fluance.io`: GitHub Pages
- API centralisee: `api.fluance.io`
- entree de domaine API: Firebase Hosting
- execution backend: Firebase Functions HTTP
- stockage marketing: Mailjet
- stockage applicatif / preuves / journaux: Firestore

## Endpoints

- `POST https://api.fluance.io/capture-lead`
- `POST https://api.fluance.io/send-contact-email`

Compatibilite conservee:

- `POST https://api.fluance.io/api/capture-lead`
- `POST https://api.fluance.io/api/send-contact-email`

## Flux opt-in

1. Le blog envoie un `POST` vers `capture-lead`
2. Verification Turnstile par site
3. Creation ou mise a jour du contact dans Mailjet
4. Ajout a la liste Mailjet unique Fluance
5. Mise a jour des proprietes Mailjet en statut `en_attente`
6. Creation ou reutilisation d'un token DOI dans Firestore
7. Envoi de l'email de confirmation via Mailjet
8. Journalisation de l'evenement dans Firestore

## Flux confirmation DOI

1. Le visiteur clique le lien dans l'email
2. Le lien ouvre `https://fluance.io/confirm?...`
3. La page appelle `confirmNewsletterOptIn`
4. Le token est verifie
5. Les proprietes Mailjet passent en statut `confirme` / `consenti`
6. La page redirige vers la ressource finale du blog source

## Flux formulaire contact

1. Le blog envoie un `POST` vers `send-contact-email`
2. Verification Turnstile par site
3. Envoi d'un email interne vers `support@fluance.io`
4. `reply-to` positionne sur l'expediteur
5. Journalisation complete dans Firestore

Important:

- un formulaire de contact ne doit jamais inscrire un contact dans la liste marketing

## Resilience reseau (Mailjet / Turnstile)

Les appels sortants du hub (`functions/blogLeadHub.js`) sont tolerants aux
incidents reseau transitoires (typiquement un `ECONNRESET` au demarrage a froid
d'une instance):

- tous les appels Mailjet passent par `mailjetFetch`, et la verification
  Turnstile par `fetchWithRetry`: re-essais exponentiels avec jitter sur les
  erreurs reseau (`ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`,
  `EAI_AGAIN`, `EPIPE`, `UND_ERR_*`) et sur les reponses `429/5xx`
- chaque tentative a un delai maximal (`AbortSignal.timeout`, 10 s par defaut):
  une connexion qui ne repond jamais declenche un re-essai au lieu de consommer
  le timeout complet de la fonction et de perdre le lead
- l'envoi d'email (`POST /v3.1/send`, non idempotent) passe par
  `mailjetSendFetch`: il ne re-essaie que les erreurs de connexion survenues
  avant traitement (jamais les `5xx` ni les timeouts, ambigus, pour limiter le
  risque de doublon)
- `ensureMailjetContact` tolere un `400 already exists` a la creation du contact,
  cas normal si un re-essai suit une reponse perdue
- `captureLead` tourne avec `timeoutSeconds: 120` (au lieu de 60 s par defaut)
  pour laisser le `catch` journaliser l'evenement meme apres plusieurs re-essais
- les erreurs journalisees dans `journal_evenements_leads` conservent la cause
  reelle via `describeFetchError` (ex. `fetch failed (ECONNRESET, read)` et non
  un simple `fetch failed`), et sont attribuees au site resolu (meme sans
  `site_id` dans le formulaire)

### Proprietes Mailjet hors du chemin de requete

Les proprietes Mailjet sont statiques. Pour eviter la rafale de 21 appels
`contactmetadata` a chaque cold start:

- `ensureMailjetProperties` lit d'abord un marqueur Firestore
  (`config/mailjetLeadProperties`, champ `schemaVersion`) et ne travaille que si
  le schema change; il est aussi memoise par instance
- la creation des proprietes utilise un budget court (timeout 5 s, 2 re-essais)
  et s'arrete au premier echec reseau pour ne pas epuiser le timeout de la
  fonction; le marqueur n'est ecrit qu'en cas de succes complet
- la tache planifiee `refreshMailjetLeadProperties` (lundi `04:00`
  `Europe/Zurich`) force la (re)creation des proprietes hors du chemin de requete
- apres ajout d'une propriete, incrementer `MAILJET_PROPERTIES_SCHEMA_VERSION`
  dans `blogLeadHub.js`

## Pilotage operationnel

Deux mecanismes d'exploitation existent en plus des journaux Firestore:

- digest mensuel `sendBlogLeadsMonthlyDigest`
- rapport quotidien des soucis `sendBlogLeadsIssueReport`
- alertes critiques `sendBlogLeadOpsAlerts`
- rafraichissement des proprietes Mailjet `refreshMailjetLeadProperties`
- purge des journaux `cleanupOpsJournals`

Digest mensuel:

- horaire: `08:00 Europe/Zurich` le 1er de chaque mois
- fenetre: 30 derniers jours
- destination: `support@fluance.io`
- envoye systematiquement, meme sans incident
- resume par blog:
  - opt-ins captures
  - confirmations DOI
  - DOI en attente
  - relances DOI envoyees
  - formulaires contact recus
  - echecs Turnstile
  - erreurs critiques
- avertissements de fraicheur (rapports quotidiens manquants, site a zero opt-in)
- liens utiles: logs Firebase Console et runbook

Rapport quotidien des soucis:

- horaire: `08:00 Europe/Zurich`
- fenetre: dernieres 24h
- destination: `support@fluance.io`
- envoi conditionnel: aucun e-mail si aucune erreur critique detectee
  (echecs Mailjet, erreurs internes) sur les dernieres 24h
- trace ecrite dans `digest_ops_history` meme sans e-mail (champ `sent`)

Alertes critiques (temps reel):

- cadence: toutes les `15 minutes`
- destination: `support@fluance.io`
- dedoublonnage Firestore dans `journal_alertes_ops` (fenetre alignee sur des
  buckets de `15 min` pour un identifiant d'alerte stable)
- seuils:
  - `>= 1` erreur serveur sur `15 min` (une perte de lead est un signal fort,
    meme isolee)
  - `> 10` echecs Turnstile sur `1 h` pour un blog
  - tout echec Mailjet critique sur DOI, relance DOI ou email contact

Collections Firestore associees:

- `journal_evenements_leads`
- `journal_formulaires_contact`
- `newsletterConfirmations`
- `journal_alertes_ops`
- `digest_ops_history`

Le code est separe en deux:

- `functions/blogOpsReporting.js`: fonctions pures (construction des resumes,
  classification des evenements, formatage des e-mails) — sans dependance Firebase
- `functions/index.js`: fonctions planifiees, acces Firestore et envoi Mailjet

Tests: `functions/test/blogOpsReporting.test.js` (`npm test` dans `functions/`).

### Retention des journaux

Les collections de journalisation sont purgees automatiquement:

- fonction planifiee `cleanupOpsJournals` (quotidienne, 04:30 Europe/Zurich)
- `journal_evenements_leads`: suppression au-dela de `90 jours` (champ `createdAt`)
- `journal_formulaires_contact`: suppression au-dela de `180 jours` (champ `createdAt`)
- `journal_alertes_ops`: suppression au-dela de `180 jours` (champ `sent_at`)
- `digest_ops_history`: conservation `365 jours` (champ `sent_at`)

La fonction tourne avec un timeout de `300 secondes` (defaut: 60s) pour pouvoir
rattraper un stock de documents apres une interruption prolongee; l'execution
s'arrete des que les collections sont propres (facturee au temps reel uniquement).
Point de controle: si un jour les logs montrent une execution proche du timeout
ou une erreur `deadline exceeded`, reduire la retention ou passer les purges
en TTL Firestore natif (voir ci-dessus).

Variante possible: un TTL Firestore natif sur ces memes champs
(console GCP ou `gcloud firestore fields ttls update <champ> --collection-group=<collection> --enable-ttl`),
auquel cas la fonction de purge peut etre retiree.

## Expéditeurs Mailjet

DOI / relances DOI / emails newsletter lies aux opt-ins:

- From: `fluance@actu.fluance.io`
- Name: `Cedric de Fluance`
- Reply-To: `support@fluance.io` (les reponses du visiteur arrivent au support,
  pas dans la boite de l'alias d'expedition)

Transactionnel contact:

- From: `support@actu.fluance.io`
- Name: `Support de Fluance`
- Reply-To: l'adresse du visiteur (repondre au mail renvoie au visiteur)
- To interne: `support@fluance.io`

## Invariants a ne pas casser

- tous les opt-ins passent par double opt-in
- tous les contacts blogs vont vers `support@fluance.io`
- une seule liste Mailjet est utilisee
- la segmentation se fait par proprietes, pas par multiplication de listes
- les formulaires contact ne creent pas de contact marketing
- les blogs gardent leurs `redirect_url` actuels en phase 1
