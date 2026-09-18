# Ma pratique — compagnon de pratique Fluance

> Document de référence de la fonctionnalité **« Ma pratique »** (compagnon de pratique)
> et de sa landing page **« Découvrir Ma pratique »**.
> Principe directeur : **ajouter sans casser**. Le site, les programmes, l'authentification,
> le checkout et l'espace membre existants restent inchangés dans leur fonctionnement.

---

## 1. Objectif

Permettre à un utilisateur **connecté** de venir sur Fluance même sans suivre un programme
précis, de choisir un état/besoin du moment et de lancer une **pratique courte** (5–15 min).

Deux parcours coexistent :

```
Existant :  Accueil → /membre/ → Séance 4 → Pratique          (inchangé)
Nouveau  :  Accueil/landing → /ma-pratique/ → besoin → Pratique
```

Modèle visé : **freemium avec connexion nécessaire**. Le gratuit (7 pratiques) est la porte
d'entrée ; l'accès complet payant est promu depuis l'app et depuis la landing page.

---

## 2. Routes créées

| Route FR | Route EN | Rôle | Indexation |
|---|---|---|---|
| `/ma-pratique/` | `/en/my-practice/` | Mini-app « Ma pratique » (connexion requise) | `noindex, nofollow` |
| `/decouvrir-ma-pratique/` | `/en/discover-my-practice/` | Landing page de promotion | `noindex, follow` (voir §9) |

Fichiers :

- `src/fr/ma-pratique.njk`, `src/en/my-practice.njk`
- `src/fr/decouvrir-ma-pratique.njk`, `src/en/discover-my-practice.njk`

La landing **n'est volontairement pas dans le menu** (header/footer inchangés) et n'est pas
dans le sitemap tant qu'elle est en `noindex`.

---

## 3. Fichiers techniques

| Fichier | Rôle |
|---|---|
| `src/_data/practices.json` | Catalogue : 5 besoins + entrées de pratiques (gratuites et premium). **Aucun contenu dupliqué.** |
| `src/assets/js/practice-companion.mjs` | Logique de l'app : auth, filtrage par droits, recommandation, lecture, analytics, enregistrement du service worker. |
| `src/sw.njk` → `/sw.js` | Service worker **app-shell uniquement** (ne cache jamais les vidéos). |
| `src/ma-pratique.webmanifest` | Manifest PWA dédié (`start_url: /ma-pratique/`). |
| `eleventy.config.mjs` | Filtre `practiceCatalog` (JSON embarqué) + passthrough copy du `.mjs`, du manifest et du SW. |
| `src/_includes/base.njk` | Support du frontmatter `manifest` (override par page). |
| `src/_includes/header.njk` | Mapping de langue pour les 2 nouvelles routes (desktop + mobile). |
| `src/fr/membre.md` | Carte « Ma pratique » en tête de l'espace client. |

---

## 4. Données

### Ce qui existe déjà (réutilisé tel quel)

- **Droits** : `users/{uid}.products[]` (Firestore, écriture serveur uniquement).
- **Contenus premium** : `protectedContent/*` + fonction callable `getProtectedContent`
  (vérifie auth + produit + accès progressif, puis renvoie le HTML/vidéo).
- **Règles Firestore** : lecture client interdite sur `protectedContent` et écriture interdite
  sur `users` — aucun changement.

### Ce qui a été ajouté

`src/_data/practices.json` — **métadonnées uniquement** (pas de vidéo, pas de nouvelle BDD) :

```json
{
  "needs": [
    { "id": "tendu", "icon": "🌿", "label": { "fr": "Tendu", "en": "Tense" } }
  ],
  "practices": [
    {
      "id": "free-ancrage",
      "source": "free",
      "title": { "fr": "Ancrage et apaisement", "en": "Grounding and calming" },
      "embedUrl": "https://iframe.mediadelivery.net/embed/...",
      "durationMin": 5,
      "needs": ["calme", "mental", "tendu"],
      "priority": 20,
      "reason": { "fr": "...", "en": "..." }
    },
    {
      "id": "complet-week-2",
      "source": "protected",
      "contentId": "complet-week-2",
      "durationMin": 10,
      "needs": ["tendu"],
      "priority": 30
    }
  ]
}
```

- `source: "free"` → vidéo **déjà publique** (2 pratiques offertes + 5 jours). Gatée par la
  **connexion** côté app (ce n'est pas du contenu premium).
- `source: "protected"` → référence un `contentId` Firestore. N'est proposée que si
  `getProtectedContent` confirme l'accès (`isAccessible`). Le serveur reste l'autorité.

### Données utilisateur ajoutées (suivi)

Dans `users/{uid}` (écriture serveur uniquement) :

| Champ | Rôle |
|---|---|
| `favorites: string[]` | Favoris (max 30, plus récent en premier) |
| `notificationOptIn: boolean` | Consentement explicite aux rappels email (défaut : `false`) |
| `lastPracticeAt: Timestamp` | Dernière pratique terminée (ciblage des rappels) |
| `lastNeed: string \| null` | Dernier besoin (personnalisation du rappel) |
| `lastPracticeReminderAt: Timestamp` | Dernier rappel envoyé (fréquence max 1/semaine) |
| `practiceReminderCount: number` | Nombre de rappels envoyés |

Sous-collection `users/{uid}/practiceLog/{entryId}` :

| Champ | Rôle |
|---|---|
| `contentId` | Pratique terminée (id du catalogue) |
| `need` | Besoin du moment (`tendu`, `mental`, …) ou `null` |
| `source` | `free` ou `protected` |
| `completedAt` | Horodatage (indexé automatiquement) |

**Vie privée** : le besoin (`need`) est associé au compte pour les statistiques et la
personnalisation des rappels. Il n'est jamais exposé publiquement et reste supprimable sur
simple demande (sous-collection `practiceLog` + champ `favorites`).

---

## 5. Règles d'accès

0. **Valeur avant l'effort (PLG)** : la question, les **choix de besoins** et l'**aperçu des
   recommandations** sont visibles **sans compte**. La **première pratique gratuite se lance
   sans compte** (mémorisé localement : `fluance_free_trial_used`). Toute action
   supplémentaire — lancer une 2e pratique, ajouter un favori, enregistrer l'historique,
   accéder au premium — ouvre le formulaire d'inscription (« Gratuit · accès immédiat »)
   avec un message contextualisé ; l'action interrompue est **reprise automatiquement**
   après l'inscription (lancement, favori ou enregistrement).
1. `practice-companion.mjs` attend l'état d'auth **confirmé** par Firebase (jamais de flash
   « connectez-vous » pendant la restauration de session).
2. Non connecté → écran d'**inscription gratuite ouverte** (formulaire intégré) + lien vers
   la connexion existante (`/connexion-membre/?return=/ma-pratique/`).
3. Connecté → les **7 pratiques gratuites** sont disponibles.
4. En arrière-plan, `loadProtectedContent()` récupère les contenus premium **débloqués**
   (accès progressif respecté) ; ils s'ajoutent aux recommandations. En cas d'erreur ou de
   compte sans produit, le gratuit continue de fonctionner.
5. **Filtrage** : `recommendationsFor(need)` garde les pratiques gratuites + les pratiques
   premium dont le `contentId` est accessible, trie par `priority` puis `durationMin`, et
   affiche 3 résultats maximum.
6. **Lancement** : gratuit → iframe injectée dans la page ; premium →
   `FluanceAuth.displayProtectedContent(contentId, conteneur, { startProgression: false })`.
   Le titre affiché est le titre réel du contenu (récupéré côté serveur), pas le `contentId`.
   **La vidéo n'est chargée qu'au clic.**
7. **Découplage de la date** : le compagnon passe `{ startProgression: false }` à la fois pour
   la liste (`loadProtectedContent`) et pour le lancement d'une pratique premium
   (`displayProtectedContent`). Utiliser Ma pratique ne démarre donc **pas** le décompte du
   Défi 21 jours, même en lançant une pratique `21jours` depuis le compagnon (voir §11).

### Inscription gratuite ouverte (`createFreeAccount`)

- Fonction callable **publique** `createFreeAccount` (`functions/index.js`) protégée par
  **Turnstile** (action `free-signup`, hostname allowlist) + rate limiting IP/email.
- Crée un compte **Firebase Auth** puis un document `users/{uid}` marqué `plan: 'gratuit'`
  (`freeAccount: true`). **Aucun produit payant** n'est ajouté : les flux produit existants
  ne sont pas déclenchés.
- Ajoute le contact à **Mailjet** (liste `10524140`) avec les properties existantes :
  `statut: prospect`, `source_optin` enrichi de `inscription_gratuite`, `date_optin`,
  `est_client: False`, `langue`, `firstname`. Idempotent (ne duplique pas le contact).
- Le client appelle ensuite `FluanceAuth.signIn()` puis bascule sur l'app.
- Événement analytics `free_account_created`.
- **Sécurité** : fail-closed si `TURNSTILE_SECRET_KEY` est absent ; vérification ignorée
  uniquement pour les IP privées (dev local).
- **Déploiement requis** : voir §9.
- **Amélioration possible** : vérification d'email / double opt-in avant accès complet
  (aujourd'hui le compte est actif immédiatement ; le contenu gratuit est déjà public).

### Accès complet des abonnés Ma pratique (Option A)

- Le produit interne de l'abonnement est **`complet`**. Un abonné `complet` accède à **tous**
  les contenus : `complet` + `21jours` + `sos-dos-cervicales`, **sans déblocage progressif**
  (accès immédiat : il paie pour l'accès complet).
- Implémentation serveur (`getProtectedContent`) :
  - **par `contentId`** : si le contenu appartient à `21jours`/`sos-dos-cervicales` et que
    l'utilisateur possède `complet`, l'accès est accordé via un produit synthétique
    `fullAccess` (pas de progression).
  - **listing** : le compagnon demande `includeFullAccess: true` → les contenus `21jours` et
    `sos-dos-cervicales` sont ajoutés à la réponse pour un abonné `complet`.
  - l'espace membre (`/membre/`) n'envoie **pas** `includeFullAccess` : comportement inchangé
    (pas de régression sur l'UI 21 jours / progression).
- Catalogue : entrée **`sos-dos-cervicales`** ajoutée ; les 2 pratiques gratuites qui dupliquent
  `complet-week-1` / `complet-week-3` sont marquées `duplicateOf` et **masquées** pour les
  abonnés qui ont déjà la version premium.
- Les produits `21jours` et `sos-dos-cervicales` restent **vendables à l'unité** pour les
  non-abonnés.

### Suivi, favoris et rappels

Quatre fonctions callables (auth requise, `europe-west1`) :

| Fonction | Rôle |
|---|---|
| `logPractice` | Enregistre une pratique terminée (sous-collection `practiceLog`, maj `lastPracticeAt`/`lastNeed`) |
| `toggleFavorite` | Ajoute/retire un favori (`favorites`, max 30) |
| `setNotificationOptIn` | Active/désactive les rappels email (consentement) |
| `getPracticeStats` | Favoris + historique récent (20) + stats (7 j, 30 j, 365 j, total, top besoins) |

- **Aucune nouvelle dépendance, aucune écriture client** : les règles Firestore refusent
  l'écriture ; la sous-collection `practiceLog` n'est lisible que par son propriétaire.
- **Nature** : ce sont des **e-mails transactionnels** (API Mailjet `/v3.1/send`), pas des
  notifications push. Le web push reste une amélioration future.
- **Rappels** (`sendPracticeReminders`, planifié tous les jours à 9h Europe/Paris) :
  - cible les comptes avec `notificationOptIn == true`, inactifs ≥ 3 jours, et sans rappel
    depuis ≥ 7 jours (fréquence max 1/semaine, garde-fou 300 emails/exécution) ;
  - texte localisé FR/EN, personnalisé avec le dernier besoin.
- **Désinscription ciblée** (ne touche **pas** la mailing list Mailjet globale) :
  - jeton `reminderUnsubTokens/{token}` (64 hex) généré par utilisateur et réutilisé ;
  - endpoint public `unsubscribePracticeReminders` (GET `?token=` ou POST *one-click*) qui met
    uniquement `users/{uid}.notificationOptIn = false` ;
  - en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` ;
  - le lien dans l'e-mail fonctionne **sans connexion** ;
  - réglage également disponible directement **dans l'espace membre** (`/membre/`, carte
    « Rappels de pratique », via `getNotificationPrefs`/`setNotificationOptIn`) et dans
    Ma pratique (« Mon suivi ») ;
  - alternative in-app : `/ma-pratique/?notifications=off` (après connexion) ;
  - **aucune API Mailjet d'unsubscribe n'est appelée** : le contact reste dans la liste
    `10524140` et continue de recevoir les autres e-mails Fluance.
- **Paramètre d'URL** `?need=<id>` : présélectionne un besoin dans le compagnon (utilisé par
  les rappels).

---

## 6. Analytics (GTM / GA existant)

Événements poussés dans `window.dataLayer`, **uniquement si le consentement cookies a été
accepté** (`localStorage.cookieConsent === 'accepted'`). Aucune donnée personnelle.

| Événement | Déclencheur |
|---|---|
| `companion_opened` | App affichée (utilisateur connecté) |
| `need_selected` | Clic sur un besoin |
| `recommendation_displayed` | Recommandations rendues (`need`, `count`, `lang`) |
| `practice_started` | Lancement d'une pratique (`practice`, `source`, `need`, `anonymous`) |
| `practice_completed` | Clic sur « J'ai pratiqué » |
| `practice_favorited` | Ajout d'un favori |
| `practice_unfavorited` | Retrait d'un favori |
| `free_account_created` | Compte gratuit créé depuis la mini-app |
| `signup_wall_reached` | Action bloquée par le mur d'inscription (`reason` : `launch`/`favorite`/`log`) |

Les tags/variables GTM correspondants sont à créer côté GTM (aucune modification de code requise).

---

## 7. PWA

- `src/ma-pratique.webmanifest` : `start_url: /ma-pratique/`, `scope: /`, `display: standalone`.
- `/sw.js` : service worker **minimal** enregistré uniquement depuis la mini-app, avec
  `?v=<hash git>` pour un cache-busting correct.
  - **Ne met jamais en cache** : requêtes cross-origin (Bunny/mediadelivery, Firebase, Stripe,
    GTM, Clarity), `/api/*`, `/.well-known/*`, ni le HTML renvoyé par `getProtectedContent`.
  - Navigation : réseau d'abord, repli cache. Ressources statiques same-origin : cache d'abord.
- Le CSP existant autorise `worker-src` via `default-src 'self'` : **aucun changement CSP**.
- **Installation écran d'accueil** :
  - Android/Chrome : bouton discret affiché uniquement après l'événement `beforeinstallprompt`
    (jamais de bannière intrusive), puis `prompt()` au clic.
  - iOS/Safari : pas d'événement d'installation → indice textuel discret
    « Partager → Sur l'écran d'accueil », masquable.
  - Masqué si l'app tourne déjà en `display-mode: standalone`.
- **Métadonnées iOS** : `apple-mobile-web-app-capable`, `mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` (variable de page
  `appTitle`, défaut « Fluance »).

---

## 8. Ajouter / retirer / modifier une pratique

Tout se fait dans `src/_data/practices.json` — **aucun déploiement de Cloud Function**.

1. **Nouvelle pratique gratuite** : ajouter une entrée `source: "free"` avec `embedUrl`,
   `durationMin`, `needs`, `priority`.
2. **Nouvelle pratique premium** : ajouter une entrée `source: "protected"` avec le
   `contentId` d'un document `protectedContent` existant, puis `durationMin`, `needs`, `priority`.
3. **Retirer une pratique du compagnon** : supprimer l'entrée (le contenu reste accessible
   dans les programmes).
4. **Changer l'association besoin → pratique** : modifier le tableau `needs` de l'entrée.
5. **Ajouter un besoin** : ajouter une entrée dans `needs` (id + icône + libellés fr/en) et
   l'utiliser dans les `needs` des pratiques.

> Les `durationMin` sont indicatifs et volontairement facilement modifiables.

---

## 9. Déploiement, réversibilité et kill-switch

- Le build reste `npm run build` (Eleventy + Tailwind + `_redirects`/`_headers`). Aucune
  nouvelle dépendance npm.
- **Déploiement des Cloud Functions** (nécessaire pour l'inscription gratuite, les nouveaux
  prix et le découplage de la date) :

  ```bash
  firebase deploy --only functions:createFreeAccount,functions:getProtectedContent,functions:createStripeCheckoutSession,functions:logPractice,functions:toggleFavorite,functions:setNotificationOptIn,functions:getNotificationPrefs,functions:getPracticeStats,functions:sendPracticeReminders,functions:unsubscribePracticeReminders
  ```

  Les règles Firestore doivent aussi être déployées (nouvelle sous-collection
  `practiceLog`) :

  ```bash
  firebase deploy --only firestore:rules
  ```

  Le secret `TURNSTILE_SECRET_KEY` doit déjà être configuré (utilisé par les opt-ins). Les
  nouveaux prix Stripe sont créés automatiquement au premier checkout.
- Les URL statiques gardent le cache immuable + `?v=<hash>` (déjà en place).
- **Désactiver la mini-app** sans toucher au reste :
  1. retirer la carte « Ma pratique » dans `src/fr/membre.md` ;
  2. ajouter des redirections dans `src/_data/redirectRules.json`
     (`/ma-pratique/` → `/membre/`, `/en/my-practice/` → `/membre/`) ;
  3. éventuellement retirer les 2 routes et le service worker.
- La landing étant `noindex`, elle n'affecte pas le SEO public tant qu'elle n'est pas promue
  en `index`. Pour l'indexer plus tard : remplacer `robots: noindex, follow` par
  `robots: index, follow` et retirer `eleventyExcludeFromCollections: true`.

---

## 10. Améliorations futures (roadmap)

### Implémenté — statistiques, favoris, historique

- **Favoris** : `users/{uid}.favorites` (max 30), via `toggleFavorite`.
- **Pratiques effectuées par période** : sous-collection `users/{uid}/practiceLog`
  (jour / semaine / mois), via `logPractice` + `getPracticeStats` (7 j, 30 j, 365 j, total).
- **États émotionnels** : le besoin choisi est enregistré avec chaque pratique (`need`),
  utilisé pour les statistiques (`topNeeds`) et la personnalisation des rappels. Donnée liée
  au compte, jamais publique, supprimable sur demande.
- **Régularité** : dérivée de `practiceLog` (`lastPracticeAt`), **sans gamification**.
- UI dans le compagnon : section « Mon suivi » (stats, favoris, historique) + bouton favori
  sur chaque recommandation et dans le lecteur.

### Implémenté — notifications intelligentes

- Fonction planifiée `sendPracticeReminders` (9h Europe/Paris) : inactivité ≥ 3 jours,
  fréquence max 1/semaine, opt-in explicite, personnalisation par dernier besoin, texte FR/EN,
  désinscription en un clic, en-tête `List-Unsubscribe`.
- **Améliorations futures** : web push en complément de l'email ; déclenchement basé sur le
  moment de la journée habituel de l'utilisateur ; A/B testing des objets ; pause automatique
  si aucun retour après plusieurs rappels.
- **Interdit** : notifications agressives, streaks culpabilisants, badges, gamification.

### Priorité 3 — prix et offres

- Les prix **CHF 14.90 / mois** et **CHF 119 / an** sont désormais **branchés** sur la landing :
  les CTA déclenchent `redirectToStripe('complet','ma_pratique_mensuel'|'ma_pratique_annuel')`.
- Les deux prix sont **auto-provisionnés** dans Stripe au premier checkout
  (`functions/services/stripePrices.js`), sous le produit interne `complet` (le webhook existant
  octroie donc bien l'accès). Pour figer un `priceId` existant, définir les secrets
  `STRIPE_PRICE_ID_COMPLET_MA_PRATIQUE_MENSUEL` / `_ANNUEL`.
- Les abonnements historiques (30 / 75 CHF) restent inchangés et coexistent.
- À mesurer : conversion **gratuit → payant** et **rétention à 1, 3 et 6 mois** avant de figer.
- La page `/cours-en-ligne/approche-fluance-complete/` pourra être remplacée plus tard par la
  landing (redirection).
- **Parcours gratuit → payant** : un utilisateur gratuit qui achète reçoit l'email
  « Créez votre compte » (mécanisme `registrationTokens` existant). La fonction `verifyToken`
  **retrouve le compte Auth existant** et fusionne le produit dans `users/{uid}`
  (`set(..., {merge:true})` préserve `plan`/`freeAccount`). Amélioration UX à prévoir :
  détecter le compte existant et envoyer plutôt un email « votre accès est prêt, connectez-vous »
  au lieu d'une nouvelle création de compte.

### Priorité 4 — confort de pratique

- **Favoris** et **historique** : à stocker dans `users/{uid}` via une fonction callable
  (l'écriture client est interdite par les règles Firestore). Événement `practice_favorited`
  déjà prévu.
- **Reprise** de la dernière pratique (localStorage uniquement, sans donnée sensible).
- **Durée réelle** des vidéos (aujourd'hui `durationMin` est indicatif).

### Priorité 5 — engagement

- **Notifications** « Un petit moment pour toi ? » : uniquement après consentement explicite,
  jamais agressives. À n'envisager qu'après validation du cœur du compagnon (rétention).
- Cacher / améliorer la promotion des étapes suivantes (upsell contextuel après une pratique).

### Priorité 6 — au-delà du web

- **PWA installable** : déjà amorcée (manifest + service worker). Vérifier sur iPhone/Safari
  et Android/Chrome, mesurer le taux d'installation.
- **Application native** iOS/Android : **uniquement si l'usage réel le justifie**. Ce n'est pas
  prévu à ce stade.

---

## 11. Points d'attention

- **Ne jamais servir de contenu premium sans passer par `getProtectedContent`.** Le catalogue
  ne fait que filtrer l'affichage ; le serveur reste l'autorité.
- **Ne jamais précacher les vidéos** (Bunny Stream) ni les réponses protégées.
- Le HTML rendu par `getProtectedContent` peut contenir des `<iframe>` et `<script>` : il est
  injecté exactement comme dans l'espace membre (comportement inchangé).
- **Déclenchement de la date du Défi 21 jours découplé** : `getProtectedContent` accepte un
  paramètre `startProgression` (défaut `true`, rétro-compatible). Le compagnon appelle
  `loadProtectedContent(null, { startProgression: false })` (liste) et
  `displayProtectedContent(contentId, container, { startProgression: false })` (lancement d'une
  pratique premium) : utiliser Ma pratique **ne démarre donc pas** le décompte du Défi 21 jours.
  Un utilisateur qui prend l'abonnement Ma pratique puis, plus tard, le Défi 21 jours ne verra
  le décompte démarrer qu'au premier accès réel au Défi (espace membre / contenu `21jours`).
- L'espace membre EN n'est pas localisé (le retour de connexion EN pointe vers `/membre/`) :
  pré-existant, hors périmètre.
