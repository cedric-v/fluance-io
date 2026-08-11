# Audit funnels — Blogs + Séquences promotion Fluance

> ## ✅ État d'implémentation (2026-08-11)
> - **Point 1 (fix crash + alerte admin)** : implémenté. `toJsDate()` + migration
>   sécurisée avec persistance + try/catch par utilisateur + alerte admin
>   (`sendAdminAlert`) en cas d'erreurs ou d'échec critique. Les 4 utilisateurs
>   « old format » (l'utilisateur old format, sylvie707, nicolevonlanthen, syl.lambert75) ont
>   été migrés en base (`scripts/fix-old-format-users.js`).
> - **Point 5 (panier abandonné 21jours)** : implémenté. Suivi des sessions Stripe
>   Checkout dans `abandonedCheckouts` (à la création), clôture via webhook
>   (`checkout.session.completed` → `completed`, `checkout.session.expired` →
>   `expired`), relances email à +2h et +20h dans `sendCartAbandonmentEmails`
>   (template MJML `abandon-cart-21jours`).
> - **Série 5 jours multi-cycles** : `computeSerie5joursProperties()` permet de
>   suivre le parcours plusieurs fois (redémarrage si la série précédente est
>   terminée, jamais en chevauchement) — appliqué à l'opt-in 5 jours et à la
>   confirmation DOI.
> - **Lien de reprise signé (ré-engagement)** : endpoint `reengage5jours`
>   (`/reengage-5jours` via `api.fluance.io`) — HMAC signé, vérifie le DOI
>   confirmé, redémarre la série et redirige vers le jour 1 (1 clic) ; sinon
>   redirige vers le formulaire 5 jours avec email pré-rempli. Pré-remplissage
>   ajouté au popup (`newsletter-popup-5jours.njk`). Secret
>   `REENGAGEMENT_SIGNING_SECRET` créé.
> - **Option 2 (segment B)** : pré-remplissage complet (email + prénom, récupéré
>   depuis Mailjet) + **ouverture automatique du popup** à l'arrivée sur la page
>   d'inscription via un lien de ré-engagement (`?email=` présent) → le contact
>   n'a plus qu'à valider le formulaire.
> - **Emails ré-engagement** (préviews) : `scripts/send-reengagement-preview.js`
>   (segment A : 5 jours offerts · segment B : cadeau + confirmation).

---

Date : 2026-08-11
Méthode : lecture des 3 blogs (parent), du hub `capture-lead` (`functions/blogLeadHub.js`),
des séquences (`functions/index.js`), données Firestore (`users`, `contentEmailsSent`,
`newsletterConfirmations`, `journal_evenements_leads`), données Mailjet (contacts/propriétés),
et logs d'exécution Cloud Functions (via Cloud Logging).

---

## A. Funnel des blogs (techniquesdemeditation, vie-explosive, devperso)

### A1. Parcours actuel

1. **Opt-in sur le blog** → `POST api.fluance.io/capture-lead`
   - TDM : modal « cadeau de bienvenue » (fiche pratique) + opt-ins dans les articles
   - vie-explosive : formulaire homepage + 3 formulaires sur la page ressources
     (3 lead magnets différents : 13 clés, routine matinale, piliers santé)
   - devperso : modal + formulaire inline homepage
   - Protection : Turnstile, honeypot, double opt-in
2. **Écriture Mailjet** : contact + propriétés (`site_source`, `blog_source`,
   `formulaire_source`, `url_source`, `lead_magnet_source`, `source_optin=blog_xxx`,
   `statut=en_attente`)
3. **Email de confirmation (DOI)** → le visiteur confirme sur `fluance.io/confirm`
4. **Redirection** vers la page cadeau du blog (`finalGiftUrl`)
5. **Page cadeau** → CTA « 2 pratiques libératrices offertes sur fluance.io »
   → **un second opt-in est demandé sur fluance.io** (nouveau formulaire)

### A2. Volumes réels (depuis mise en service ~mai 2026)

| Source | Leads | dont tests | Leads réels |
|---|---|---|---|
| vie-explosive | 16 | 1 | 15 |
| techniquesdemeditation | 9 | 1 | 8 |
| devperso | 5 | 1 | 4 |
| **Total** | **30** | **3** | **~27** (~9/mois) |

- **Taux de confirmation DOI : 60 %** (21/35 tokens) — TDM 7/11, vie-explosive 11/19, devperso 3/5.

### A3. Problèmes identifiés (funnel blog)

1. **Aucune séquence après opt-in blog.** `source_optin = blog_*` ne matche aucun scénario
   de la séquence marketing (`sendNewContentEmails` ne teste que `2pratiques` et
   `5joursofferts`). Après la confirmation, un lead blog ne reçoit **aucun email**
   (ni welcome, ni contenu, ni promotion). C'est le trou principal.
2. **Dead-end cross-site.** La page cadeau du blog pointe vers fluance.io avec un
   **second opt-in** (2 pratiques) : le lead qui vient de donner son email doit le
   redonner ailleurs → drop massif. Aucun lien direct vers la page 21 jours.
3. **Pages cadeau datées (2022)** : branding/messages anciens (« fiche-instant-meditatif »),
   CTA générique, aucune preuve sociale, aucun tracking de clic.
4. **Volume très faible** : ~27 leads en 3 mois pour 3 blogs = les blogs ne sont pas
   (ou plus) une source de trafic significative ; pas de popups exit-intent récents,
   pas de lead magnets actualisés ni de test de positionnement.
5. **Aucun tracking de bout en bout** : pas d'UTM systématique blog → fluance.io,
   pas de lien entre lead blog et achat éventuel (hors `source_optin`).
6. **Segmentation absente** : les 3 audiences (méditation / dév. personnel / élan de vie)
   reçoivent le même traitement générique.

---

## B. Séquences de promotion Fluance

### B1. Séquences codées (`sendNewContentEmails`, cron quotidien 8h Paris)

| Parcours | Emails prévus |
|---|---|
| Opt-in **2pratiques** | J+2-7 : promo 5 jours · J+4 : relance 5 jours · J+8/15/22 : promos 21 jours · J+25/30/37 : approche complète |
| Opt-in **5jours** | J+6/10/17 : promos 21 jours · J+20/25/32 : approche complète |
| **Clients 21jours** | Email quotidien jour 0→22 (déroulé, 21 vidéos, bonus) + post-parcours J+1/4/8 → approche complète |
| **Clients complet** | Email hebdomadaire semaines 1→14 |
| `sendPromotionalEmails` | Promos « sommeil » et « somatique » (approche hybride) |
| `sendOptInReminders` | Relances DOI (J+1, J+5) — **fonctionne** |
| `sendCartAbandonmentEmails` | Panier abandonné — **ciblé cours présentiels uniquement** (pas le 21jours) |

### B2. État réel : la séquence ne tourne PAS (bug critique)

`sendNewContentEmails` **crash chaque jour à 06:00 UTC** depuis ~janvier 2026 :

```
❌ Error in sendNewContentEmails: TypeError: date.getTime is not a function
    at Timestamp.fromDate (.../timestamp.js:85)
🔄 Migrating user [uid-user-old-format] from old format
```

**Cause** : l'utilisateur `[client-D]` (ancien format : `products: []`,
`product: '21jours'`) passe par le bloc de migration, qui fait
`Timestamp.fromDate(userData.registrationDate)` alors que `registrationDate` est déjà un
`Timestamp` Firestore (pas une `Date`) → exception → la fonction entière avorte
(pas de try/catch par utilisateur).

**Preuves** :
- `contentEmailsSent` : derniers emails 21jours envoyés le **07/01/2026** (Laurence, jour 4).
  Aucun enregistrement `marketing_*` (séquences prospects) n'a jamais été créé.
- Logs Cloud Run : crash identique le 09/08, 10/08, 11/08 (et avant) ; `sendPromotionalEmails`
  tourne mais envoie « 0 email » ; `sendOptInReminders` tourne (relances DOI OK).

**Conséquences** :
- **Aucun client 21jours ne reçoit plus ses emails quotidiens** depuis janvier
  (l'expérience « défi » est privée de son accompagnement email : la cliente récente et les
  autres doivent tout consulter manuellement).
- **Aucune séquence prospect n'a jamais été exécutée** : les ~450 prospects Mailjet
  (2pratiques, 5jours, blogs…) n'ont jamais reçu les promos 5 jours / 21 jours / complet.
  C'est cohérent avec l'analyse précédente : 62,5 % des achats sans source tracée et
  0 achat issu des blogs.
- La séquence sommeil/somatique s'est arrêtée fin février 2026.

### B3. Autres constats

- **Imports massifs** : ~150 contacts `2pratiques` créés les 22-23/12/2025 et ~150
  `5joursofferts` créés les 09-10/04/2026 (imports groupés). Leurs fenêtres de séquence
  (J+X) sont dépassées : même après le fix, ils ne recevront rien sans une logique de
  rattrapage/ré-engagement.
- **Pas de tracking de désinscription** dans les envois (`IsUnsubTracked: false`) :
  risque RGPD/anti-spam (obligation de lien de désinscription sur les emails promo).
- **Pas d'A/B testing** d'objets, **pas de préheader** géré, **pas de segmentation
  par engagement** (les contacts morts restent dans les envois).
- **Pas de panier abandonné pour le checkout 21jours** (le module existant ne couvre
  que les réservations de cours).
- Les templates promotionnels sont de bonne facture (MJML, CTA unique) mais très
  « texte long », sans social proof ni visuel de produit.

---

## C. Recommandations (bonnes pratiques 2026)

### C1. Critique — réparer l'essentiel (bloquant)
1. **Corriger le crash** : convertir `registrationDate`/`createdAt` en `Date` avant
   `Timestamp.fromDate`, ou gérer les deux types (Timestamp → `.toDate()`, Date → direct).
   À corriger partout où le pattern existe (4 occurrences de la migration).
2. **Isoler les erreurs** : try/catch par utilisateur et par contact, pour qu'un seul
   enregistrement corrompu n'arrête plus toute la séquence.
3. **Migrer/nettoyer les utilisateurs old-format** (ex. `l'utilisateur old format`) en backfill
   (products rempli) pour sortir du chemin de migration.
4. **Ajouter une alerte admin** sur échec d'exécution des séquences (comme
   `sendBlogLeadOpsAlerts` pour les blogs) — l'absence d'alerting a laissé courir le
   bug pendant 7 mois.
5. **Backlog des emails manqués** : après le fix, un rattrapage raisonnable pour les
   clients 21jours en cours (reprendre le jour actuel) et un ré-engagement pour les
   prospects des imports.

### C2. Funnel blogs
6. **Brancher les leads blogs sur une séquence dédiée** (`blog_*` → welcome délivrant
   la promesse → contenu de valeur → présentation 5 jours → 21 jours). C'est le levier
   n°1 : 27 leads confirmés attendent ce déclencheur.
7. **Supprimer le second opt-in cross-site** : la page cadeau du blog doit livrer la
   ressource et pointer directement vers la page 21 jours (lien deep) ou vers la page
   5 jours, sans redemander l'email. (Consentement déjà acquis via le DOI blog.)
8. **Rafraîchir les pages cadeau** : design 2026, témoignages, vidéo d'intro Fluance,
   CTA unique mesurable (UTM).
9. **Augmenter le volume** : popups exit-intent, formulaires en fin d'article, lead
   magnets actualisés par blog (quiz, audio, checklist), partage social.
10. **Tracking de bout en bout** : UTM systématiques, GA4 + événement `generate_lead`,
    puis mesure blog → opt-in → confirmation → achat.

### C3. Séquences & emails
11. **Segmentation par engagement** (2026 standard) : ne plus envoyer aux contacts
    inactifs (>X emails non ouverts / bounces), campagne de ré-engagement puis
    suppression → protège la délivrabilité et les stats.
12. **Raccourcir et densifier** : séquence 3-4 emails sur 7-10 jours (objet court,
    préheader, un seul CTA), puis décroissance. Le rythme J+8/15/22 est trop lent pour
    l'attention de 2026.
13. **Personalisation par source** : adapter le ton et le lead-in selon l'origine
    (méditation / dév. personnel / élan de vie / présentiel).
14. **A/B testing d'objets** et de CTA (outil natif Mailjet ou rotation manuelle).
15. **Ajouter la preuve sociale** (témoignages, nombre de participants) dans les
    emails promotionnels 21 jours.
16. **Panier abandonné 21jours** : étendre le module existant aux sessions Stripe
    Checkout du produit (email +2h/+24h avec rappel des 5 minutes/jour).
17. **Tracking de désinscription** (`IsUnsubTracked: true` + lien dans les templates
    promo) : conformité RGPD + anti-spam.
18. **Ré-engagement des imports** : 1 campagne ciblée « vous nous aviez laissé vos
    coordonnées » pour les ~300 contacts des imports déc. 2025 / avril 2026, avec
    choix d'intérêt (méditation, mobilité, énergie).

### C4. Mesure
19. Mettre en place un tableau de bord simple des entonnoirs :
    opt-in → DOI confirmé → ouvertures → clics → visites page 21 jours → achats,
    par source (blog / 2pratiques / 5jours / présentiel). Données disponibles via
    Mailjet (messages) + Firestore (`contentEmailsSent`, `newsletterConfirmations`) +
    GA4.
