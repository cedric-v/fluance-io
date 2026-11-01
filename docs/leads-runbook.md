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
  premiere occurrence (`>= 1` sur `15 min`, fonction `sendBlogLeadOpsAlerts`),
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
- un redeploiement Firebase reecrit ces valeurs depuis le code: les options
  doivent rester dans `blogLeadHub.js` (c'est pour cela que `maxInstances` y est
  explicite, il avait ete perdu au premier redeploiement)

## Cas particulier important

Si un visiteur soumet plusieurs fois le meme opt-in avant confirmation:

- on privilegie la reutilisation d'un token encore valide quand c'est possible
- sinon un nouveau token peut etre genere

## Regle de securite produit

Si un developpeur ajoute un nouveau formulaire:

- il doit choisir entre `capture-lead` et `send-contact-email`
- il ne doit jamais reutiliser `send-contact-email` pour du marketing
- il ne doit jamais reutiliser `capture-lead` pour du support
