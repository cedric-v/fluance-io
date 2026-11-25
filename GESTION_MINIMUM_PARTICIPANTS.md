# Gestion du nombre minimum de participants (`[min:X]`)

Annulation automatique d'un cours en présentiel lorsque le nombre minimum
d'inscrits n'est pas atteint **2 heures avant** le début.

---

## 1. Principe

Dans la **description** de l'événement Google Agenda, à côté des tags existants :

```text
Cours de yoga Fluance - niveau tous niveaux

[max:15]
[min:3]
[price:25]

Apportez votre tapis et une bouteille d'eau.
```

| Tag | Effet | Défaut si absent |
|---|---|---|
| `[max:X]` | Nombre maximum de participants | **10** |
| `[min:X]` | Nombre **minimum** d'inscrits pour que le cours ait lieu | **1** (= jamais d'annulation auto) |
| `[price:X]` | Prix en CHF | **25** |

Règles de robustesse (pour ne jamais annuler un cours par erreur de saisie) :

- tag absent, `[min:0]`, `[min:-1]`, `[min:abc]` → **1** → pas d'annulation ;
- `[min:9]` avec `[max:4]` (incohérent) → tag ignoré + avertissement dans les logs ;
- la casse est insensible (`[MIN:2]` fonctionne).

Les tags sont retirés de la description affichée sur le site.

---

## 2. Décision : 2 heures avant le cours

Une fonction planifiée vérifie **toutes les 15 minutes** les cours dont le
début est à moins de 2 heures :

> Nombre d'inscrits (`confirmed` + `pending_cash`) **< `minParticipants`**
> → **le cours est annulé**.

**Exception volontaire : un cours créé moins de 2 heures avant son début n'est
jamais annulé automatiquement.** Il a été programmé à la dernière minute, en
connaissance de cause : le seuil ne pourrait de toute façon plus « laisser une
chance aux inscriptions ». La date de création utilisée est celle de
l'événement Google Agenda (`event.created`, stocké dans `gcalCreatedAt`) —
⚠️ pas `courses.createdAt`, qui est réécrit à chaque synchronisation et vaut
donc l'heure du dernier sync.

Points importants :

- les inscrits sont comptés depuis la collection `bookings`, **pas** depuis
  `courses.participantCount` (ce champ est réinitialisé à 0 à chaque
  synchronisation Google Calendar) ;
- une réservation `pending` (paiement en cours, non abouti) **ne compte pas**
  comme une place occupée ;
- la décision n'est jamais prise après le début du cours ;
- l'annulation est idempotente : un cours déjà annulé n'est plus repris.

### Fréquence du tick (coût)

`*/30 * * * *` (toutes les 30 minutes) est le compromis retenu.

Mesures réelles ([docs/couts-infra.md](docs/couts-infra.md)) : un tick de
fonction planifiée coûte **~7 vCPU-s** (démarrage à froid + fenêtre de
scale-down), pour un palier gratuit de **180 000 vCPU-s/mois** et une
consommation actuelle d'environ 44 000 (24 %).

| Cadence | Ticks/mois | vCPU-s/mois | % du palier | Décision prise |
|---|---|---|---|---|
| 1 h | 720 | ~5 000 | 3 % | jusqu'à **1 h** après T-2h (trop tard) |
| **30 min (retenu)** | 1 440 | **~10 000** | **~6 %** | entre 2 h et 1 h 30 avant |
| 15 min | 2 880 | ~20 000 | ~11 % | entre 2 h et 1 h 45 avant |

Le travail réel par tick est minuscule (une requête Firestore sur une fenêtre de
2 h, aucun email la plupart du temps) : c'est le démarrage à froid qui coûte.
Pour affiner la précision, remplacer `schedule` par une expression cron de
15 minutes dans `functions/index.js`
(`exports.cancelCoursesBelowMinParticipants`).

---

## 3. Ce qui se passe à l'annulation

1. **Le cours est marqué annulé** (`status: 'cancelled'`,
   `cancelledReason: 'min_participants'`, `cancelledAt`,
   `participantCountAtCancellation`) **avant** l'envoi des emails : plus aucune
   inscription n'est possible dès cet instant.
2. **Inscriptions bloquées, côté serveur** :
   - `processBooking` (paiement carte/TWINT/espèces) → `COURSE_CANCELLED` ;
   - `bookCourse` (chemin « utiliser mon pass ») → HTTP 409 `COURSE_CANCELLED` ;
   - `getCourseAvailability` → `available: false`, `isCancelled: true` ;
   - `transferBooking` → refuse de transférer vers un cours annulé ;
   - `confirmBookingPayment` (webhook) → ne confirme pas un paiement arrivé
     après l'annulation : la réservation passe en `cancelled` avec
     `refundRequired: true` (voir le tableau ci-dessous).
3. **Côté page de réservation (UX)** : le cours apparaît **grisé** avec le badge
   « Annulé », sa carte est inerte (aucun clic, aucun formulaire). Une vérification
   de statut est aussi faite à l'ouverture de la modale (`getCourseStatus`) pour
   couvrir le cas d'un cache navigateur périmé : l'utilisateur voit un écran
   « Ce cours est annulé » avec un bouton vers les autres créneaux.
4. **Emails (dans la langue de chaque personne : `booking.locale`, sinon `fr`)**
   - inscrits → email « votre cours est annulé » + lien vers la page de
     réservation (`/presentiel/reserver/` ou `/en/presentiel/reserver/`) ;
   - liste d'attente → email « le cours n'aura pas lieu » + même lien ;
   - organisateur (`ADMIN_EMAIL`) → récapitulatif : nombre d'inscrits, liste des
     inscrits, séances recréditées, **remboursements à traiter**, liste d'attente.
5. **Séances et essais remis à zéro** :
   - Flow Pass → la séance est **recréditée** (`refundPassSession`, idempotent) ;
   - Pass Semestriel (illimité) → l'entrée d'historique du cours est retirée,
     donc le « nombre de séances effectuées » reste juste ;
   - cours d'essai gratuit → il **redevient utilisable** : `checkUserPass`
     ignore les réservations annulées par l'organisation
     (`cancelledByOrganizer: true` / `cancelledReason: 'min_participants'`).
     Une annulation faite par l'utilisateur lui-même reste comptabilisée
     (pas de contournement « je réserve un essai, j'annule, je recommence »).
6. **Suivi / reporting Google Sheet** : les lignes correspondantes de l'onglet
   « Réservations » passent en `L = Annulé`, `W = Oui`, `X = date d'annulation`,
   `Y = « Cours annulé (minimum de N participants non atteint) »`
   (une lecture de la feuille + un seul `batchUpdate`, jamais un appel par
   réservation). C'est cette colonne `W`/`Y` qui permet de filtrer les
   annulations dans Looker Studio. Une erreur Sheets n'empêche ni l'annulation
   ni les emails.
7. **Aucun remboursement automatique** (choix produit assumé) : l'email propose
   de **choisir un autre créneau**, et le remboursement reste une décision
   manuelle. Les cas sont tracés sur la réservation :

   | Situation | Champ écrit | Action |
   |---|---|---|
   | Séance de pass utilisée | `passSessionRefunded: true` | aucune |
   | Achat d'un Flow/Semestriel Pass | — | aucune (le pass reste valable) |
   | Cours d'essai gratuit | `trialReusable: true` | aucune |
   | Espèces à régler sur place | — | aucune (rien n'a été encaissé) |
   | Carte/TWINT encaissé | `refundRequired: true`, `refundAmount` | rembourser dans Stripe |
   | Paiement arrivé après l'annulation | `refundRequired: true` | rembourser dans Stripe |

---

## 4. Garder un cours malgré tout / réactiver un cours annulé

La synchronisation Google Calendar **ne ressuscite pas** un cours annulé
(sinon il redevenait réservable au tick horaire suivant).

**Échappatoire documentée** — pour maintenir un cours annulé automatiquement :

1. dans Google Agenda, **retirer** `[min:X]` de la description (ou mettre
   `[min:0]` / `[min:1]`) ;
2. lancer la synchronisation (elle tourne toutes les heures, ou appeler
   `syncPlanningManual`) ;
3. le cours repasse en `status: 'active'` (`reactivatedAt` est enregistré).

⚠️ Les inscriptions annulées ne sont **pas** réactivées automatiquement
(les séances ont été recréditées, l'argent éventuellement remboursé) : les
personnes doivent se réinscrire — c'est précisément le lien envoyé par email.

---

## 5. Cas limites couverts

| Cas | Comportement |
|---|---|
| `[min:X]` absent / `0` / invalide | aucun minimum → jamais d'annulation |
| `[min:X]` > `[max:Y]` | tag ignoré + warning (sinon tous les cours seraient annulés) |
| Cours créé moins de 2 h avant le début, sous le minimum | **jamais annulé** (programmé à la dernière minute, exception documentée) |
| Cours déjà commencé / passé | jamais touché |
| `gcalCreatedAt` absent (documents antérieurs) | la règle des 2 h s'applique normalement |
| Seuil atteint à la dernière minute | cours maintenu |
| Cours annulé puis `[min:X]` retiré de Google Agenda | réactivé à la sync suivante |
| Inscription `pending` (paiement non abouti) | ne compte pas, et n'est pas « remboursée » |
| Paiement carte arrivé après l'annulation | réservation annulée + `refundRequired`, email admin dédié |
| Inscrit qui avait acheté un Flow Pass avec sa réservation | pas de remboursement (le pass reste valable) |
| Inscrit avec un pass supprimé/expiré | erreur de recrédit loguée, le reste du traitement continue |
| Crash/timeout au milieu des envois d'emails | reprise au tick suivant (`cancellationNotifiedAt` = point de reprise, `cancellationEmailSent` = anti-doublon) |
| Deux exécutions concurrentes | impossible (`maxInstances: 1` + `SCHEDULED_FUNCTION_RUNTIME`) et de toute façon idempotent |
| Credentials Mailjet absents | l'annulation est **abandonnée** et retentée au tick suivant (mieux vaut prévenir les inscrits que les laisser venir à un cours annulé) |
| Cours annulé par un autre moyen (supprimé de Google Agenda) | comportement inchangé (suppression du document) |

---

## 6. Mise en service

1. Déployer les fonctions (le workflow `.github/workflows/deploy-functions.yml`
   détecte automatiquement `cancelCoursesBelowMinParticipants`) et le site
   (`src/assets/js/booking.js`).
2. **Lancer une synchronisation** pour que le tag `[min:X]` déjà présent dans
   Google Agenda soit lu et stocké (`minParticipants`).

   L'URL est publique (comme avant) et n'exige aucune clé :

   ```bash
   curl -s "https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual"
   ```

   Réponse attendue : `{"success":true,"synced":N,"deleted":M,"errors":0}`.

   Sans `curl`, dans un navigateur :
   <https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual>

   Ou en attente passive : la synchronisation horaire fait le même travail
   (au plus 1 h de délai). Vérification ensuite, dans la console Firestore,
   collection `courses` : un cours avec `[min:2]` doit afficher
   `minParticipants: 2`.

   Tant que la synchronisation n'a pas tourné avec le nouveau code, les cours
   n'ont pas de champ `minParticipants` : ils sont traités comme « pas de
   minimum » (aucune annulation).
3. Vérifier l'aperçu :

   ```bash
   curl "https://europe-west1-fluance-protected-content.cloudfunctions.net/cancelCoursesBelowMinParticipantsManual?preview=1"
   ```
   `checked` doit être > 0 dès qu'un cours à moins de 2 h a un `[min:X] > 1`.

## 7. Exploitation / vérification

**Aperçu sans rien modifier** (liste les cours qui seraient annulés, sans clé) :

```bash
curl "https://europe-west1-fluance-protected-content.cloudfunctions.net/cancelCoursesBelowMinParticipantsManual?preview=1"
```

**Exécution immédiate réelle** (rattrapage manuel). La clé API est
**obligatoire** pour cet endpoint destructif (sinon `503 NOT_CONFIGURED`) :

```bash
curl -H "x-api-key: $COURSE_REMINDERS_API_KEY" \
  "https://europe-west1-fluance-protected-content.cloudfunctions.net/cancelCoursesBelowMinParticipantsManual"
```

Les deux modes sont limités à 20 appels/h par IP.

**Logs** : `firebase functions:log --only cancelCoursesBelowMinParticipants`
(``✅ Min participants check: X vérifiés, Y annulés, Z emails, W séances
recréditées, E erreurs``).

**Sur le document du cours annulé** : `status`, `cancelledReason`,
`cancelledAt`, `participantCountAtCancellation`, `minParticipants`,
`cancellationNotifiedAt`, `cancellationStats`.

**Tests** :

```bash
cd functions && npm test
```

- `test/minParticipants.test.js` : décision, emails (FR/EN), chaîne complète
  (cours → réservations → passes → liste d'attente → admin), idempotence,
  reprise, `dryRun`, classification des remboursements ;
- `test/googleService.test.js` : parsing `[min:X]` (absent, invalide, > max,
  casse) et préservation/réactivation de l'annulation à la synchronisation ;
- `test/bookingCancelledGuard.test.js` : refus serveur (réservation, transfert,
  paiement tardif) ;
- `test/passRefund.test.js` : recrédit de séance (idempotent, illimité) et
  éligibilité retrouvée au cours d'essai.

---

## 8. Fichiers concernés

| Fichier | Rôle |
|---|---|
| `functions/services/googleService.js` | parsing `[min:X]`, `applyCancellationPolicy` (anti-résurrection / réactivation), `markBookingsCancelledInSheet` (reporting) |
| `functions/services/minParticipantsService.js` | décision, annulation, emails, recrédits |
| `functions/index.js` | `cancelCoursesBelowMinParticipants` (cron 15 min) + variante manuelle, blocage `bookCourse`, `getAvailableCourses` |
| `functions/services/bookingService.js` | garde-fous `processBooking`, `getCourseAvailability`, `transferBooking`, `confirmBookingPayment` |
| `functions/services/passService.js` | `refundPassSession` (idempotent), éligibilité essai gratuit |
| `functions/services/emailTemplates.js` | rendu des templates MJML |
| `src/emails/cours-annule-min-participants{,-en}.mjml` | email inscrit (FR/EN) |
| `src/emails/liste-attente-cours-annule{,-en}.mjml` | email liste d'attente (FR/EN) |
| `src/assets/js/booking.js` | carte grisée « Annulé », écran d'annulation, `locale` envoyée à l'API |

---

## 9. Désactiver la fonctionnalité

- Globalement : supprimer `[min:X]` des descriptions Google Agenda (les cours
  déjà annulés restent annulés), ou retirer/déplanifier
  `cancelCoursesBelowMinParticipants`.
- Ponctuellement : `[min:0]` sur un cours (le tag ne déclenche rien, et
  réactive le cours s'il était annulé).
