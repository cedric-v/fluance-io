# Passkeys / WebAuthn — option future (non implémentée)

> **Statut : documenté, non implémenté.** Aucune fonctionnalité passkey n'est active
> sur le site. Ce document garde une trace de la solution envisagée au cas où le
> besoin reviendrait, sans ajouter de complexité aujourd'hui.
>
> Dernière vérification de l'écosystème : **2026-09-30**.

---

## 1. Contexte

L'authentification des membres reposait en partie sur l'extension Firebase
`gavinsawyer/firebase-web-authn`. Elle a été **supprimée le 2026-09-30** :

- la connexion par passkey était déjà **désactivée depuis le 2025-12-10**
  (onglet commenté sur `/connexion-membre/` et `/en/member-login/`) ;
- l'extension était une dépendance externe à maintenir (version, Node.js, IAM,
  service account, CORS) pour un usage quasi nul ;
- l'offre « créer une clé d'accès » après inscription et tout le code associé ont
  aussi été retirés.

Voir le commit `chore(auth): supprimer l'extension Firebase WebAuthn (passkeys)`.

### Méthodes d'authentification actuelles

| Méthode | Où |
|---|---|
| Email + mot de passe | `src/assets/js/firebase-auth.mjs` (`signIn`) |
| Connexion par email (lien magique) | `sendSignInLink` / `handleSignInLink` |
| Réinitialisation du mot de passe | `sendPasswordResetEmail` |

Les passkeys seraient une **méthode additive** : on garde mot de passe et lien
email comme solutions de repli.

---

## 2. Contraintes d'architecture

Toute solution doit préserver l'existant :

- **Firebase Auth est la source d'identité.** Les règles Firestore s'appuient sur
  `request.auth.uid` (`firestore.rules`) et le contenu membre est lié à l'`uid`
  (`users/{uid}`, produits, progression, `practiceLog`, etc.).
- **Ne pas casser le gating produit** : un passkey ne donne pas de droits ; il
  authentifie seulement le même `uid`.
- **Domaine / RP ID** : `rpID = fluance.io`, `origin = https://fluance.io` (couvre
  aussi `www.fluance.io`). En local, utiliser `rpID = localhost` + `origin =
  http://localhost:8080` (WebAuthn n'accepte que `https://` ou `localhost`).
- **Site déployé sur Cloudflare Pages**, API/fonctions sur Cloudflare Worker →
  Firebase Cloud Functions (`functions/index.js`, région `europe-west1`).

---

## 3. Option A — SimpleWebAuthn + Firebase custom tokens (recommandée)

Bibliothèque de référence pour WebAuthn, **MIT**, très activement maintenue :
`@simplewebauthn/server` + `@simplewebauthn/browser`
(dernière version vérifiée : `server 14.0.3`, publiée le 2026-09-25 —
<https://github.com/MasterKale/SimpleWebAuthn>).

Principe : le serveur (Cloud Functions) implémente l'enregistrement et
l'authentification WebAuthn, stocke les clés publiques dans Firestore, puis
**émet un Firebase custom token** pour l'`uid` existant. Aucun vendor, aucune
extension, aucun coût récurrent.

### 3.1 Vue d'ensemble

```
ENREGISTREMENT (utilisateur déjà connecté : email/mdp ou lien)
  client  ──(passkeyRegisterBegin)──▶  Functions : generateRegistrationOptions()
          ◀── options ──────────────
  navigateur startRegistration(options)
  client  ──(passkeyRegisterFinish)─▶  Functions : verifyRegistrationResponse()
                                        puis store passkey dans Firestore

CONNEXION
  client  ──(passkeyAuthBegin)──────▶  Functions : generateAuthenticationOptions()
          ◀── options + challenge ──
  navigateur startAuthentication(options)
  client  ──(passkeyAuthFinish)─────▶  Functions : verifyAuthenticationResponse()
                                        puis admin.auth().createCustomToken(uid)
          ◀── customToken ──────────
  client  firebase.auth().signInWithCustomToken(customToken)
```

Le **challenge** doit être généré et **conservé côté serveur** entre `Begin` et
`Finish` (cookie de session signé, ou doc Firestore à TTL court). Ne jamais faire
confiance à un challenge renvoyé par le client.

### 3.2 Modèle de données (Firestore)

Collection de premier niveau, un doc par credential :

```
passkeys/{credentialID}
  uid            : string   // propriétaire (uid Firebase Auth)
  credentialID   : string   // base64url
  publicKey      : string   // base64url
  counter        : number
  transports     : string[]
  deviceType     : 'singleDevice' | 'multiDevice'
  backedUp       : boolean
  createdAt      : Timestamp
  lastUsedAt     : Timestamp
```

- Listing des passkeys d'un utilisateur : `where('uid', '==', uid)`.
- Pour le mode *découvrable / usernameless* (`allowCredentials: []`), le
  `userHandle` renvoyé par l'authenticator est l'`uid` → on retrouve directement
  le propriétaire, puis `where('uid', '==', uid)`.
- Les règles Firestore refusent déjà tout accès client par défaut ; les Functions
  passent par l'Admin SDK. Aucune règle à assouplir.

### 3.3 Fichiers à toucher

| Fichier | Changement |
|---|---|
| `functions/index.js` (ou un module `functions/passkeys.js`) | 4 callables WebAuthn |
| `functions/package.json` | `@simplewebauthn/server` |
| `src/assets/js/firebase-auth.mjs` | `registerPasskey()`, `signInWithPasskey()` + exports |
| `src/fr/connexion-membre.md`, `src/en/member-login.md` | onglet/CTA passkey + `autocomplete="username webauthn"` |
| `src/fr/creer-compte.md`, `src/en/create-account.md` | offre « ajouter une clé d'accès » post-inscription |
| `firestore.rules` | inchangé (accès client refusé) |

Le client a besoin de `@simplewebauthn/browser`. Comme `firebase-auth.mjs` est un
module statique non bundlé, le charger soit via un import CDN (`esm.sh`,
`jsdelivr`), soit **vendre localement** le fichier (petit) pour éviter une
dépendance CDN tierce.

### 3.4 Esquisse serveur (Cloud Functions)

```js
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const admin = require('firebase-admin');

const RP_ID  = 'fluance.io';
const ORIGIN = 'https://fluance.io'; // + 'http://localhost:8080' en dev

// --- Enregistrement ---------------------------------------------------------
exports.passkeyRegisterBegin = functions.region('europe-west1').https.onCall(async (_data, ctx) => {
  if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
  const uid = ctx.auth.uid;

  const existing = await db.collection('passkeys').where('uid', '==', uid).get();
  const options = await generateRegistrationOptions({
    rpName: 'Fluance',
    rpID: RP_ID,
    userID: new TextEncoder().encode(uid), // userHandle = uid
    userName: ctx.auth.token.email || uid,
    attestationType: 'none',
    excludeCredentials: existing.docs.map((d) => ({
      id: d.id,
      transports: d.get('transports'),
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });

  // Stocker options.challenge côté serveur, TTL court (cookie signé ou Firestore)
  await saveChallenge(uid, options.challenge);
  return options;
});

exports.passkeyRegisterFinish = functions.region('europe-west1').https.onCall(async (data, ctx) => {
  if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
  const uid = ctx.auth.uid;
  const expectedChallenge = await consumeChallenge(uid); // à usage unique

  const { verified, registrationInfo } = await verifyRegistrationResponse({
    response: data.response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });
  if (!verified) throw new functions.https.HttpsError('invalid-argument', 'Passkey refusée.');

  const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
  await db.collection('passkeys').doc(credential.id).set({
    uid,
    credentialID: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports ?? [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsedAt: null,
  });
  return { ok: true };
});

// --- Authentification -------------------------------------------------------
exports.passkeyAuthBegin = functions.region('europe-west1').https.onCall(async (data) => {
  // mode usernameless : allowCredentials vide ; sinon filtrer par email/uid
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: data?.allowCredentials ?? [], // [] => passkey découvrable
  });
  await saveChallenge(data?.sessionId, options.challenge);
  return options;
});

exports.passkeyAuthFinish = functions.region('europe-west1').https.onCall(async (data) => {
  const expectedChallenge = await consumeChallenge(data.sessionId);

  // Retrouver le credential et son propriétaire
  const credDoc = await db.collection('passkeys').doc(data.response.id).get();
  if (!credDoc.exists) throw new functions.https.HttpsError('not-found', 'Passkey inconnue.');
  const cred = credDoc.data();

  const { verified, authenticationInfo } = await verifyAuthenticationResponse({
    response: data.response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: cred.credentialID,
      publicKey: Buffer.from(cred.publicKey, 'base64url'),
      counter: cred.counter,
      transports: cred.transports,
    },
  });
  if (!verified) throw new functions.https.HttpsError('unauthenticated', 'Authentification échouée.');

  await credDoc.ref.update({
    counter: authenticationInfo.newCounter,
    lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Même uid => aucun impact sur Firestore / les produits
  const customToken = await admin.auth().createCustomToken(cred.uid);
  return { customToken };
});
```

### 3.5 Esquisse client (`firebase-auth.mjs`)

```js
import { startRegistration, startAuthentication } from '<browser-lib>';

async function registerPasskey() {
  const begin = await functions.httpsCallable('passkeyRegisterBegin')();
  const response = await startRegistration({ optionsJSON: begin.data });
  await functions.httpsCallable('passkeyRegisterFinish')({ response });
  return { success: true };
}

async function signInWithPasskey() {
  const begin = await functions.httpsCallable('passkeyAuthBegin')({});
  const response = await startAuthentication({ optionsJSON: begin.data });
  const { data } = await functions.httpsCallable('passkeyAuthFinish')({ response });
  await auth.signInWithCustomToken(data.customToken);
  return { success: true };
}
```

UX moderne : `startAuthentication({ optionsJSON, useBrowserAutofill: true })`
combiné à `autocomplete="username webauthn"` sur le champ email permet le
remplissage automatique par le gestionnaire de mots de passe / l'OS.

### 3.6 Points de vigilance

- **Challenge** : toujours généré et vérifié côté serveur, à usage unique, TTL
  court. Sinon faille de rejeu.
- **Ne pas divulguer l'existence d'un email** (mode avec `allowCredentials`) :
  réponse générique identique que le compte existe ou non.
- **Rate limiting** + éventuellement Turnstile sur les callables, comme le reste
  de l'API publique.
- **Custom token & uid** : `createCustomToken(cred.uid)` doit réutiliser l'`uid`
  existant, sinon le compte Firestore est « perdu ». Le token est à usage
  immédiat (`signInWithCustomToken`).
- **`counter`** : le mettre à jour à chaque auth ; certains authenticators le
  laissent à 0, ce n'est pas bloquant.
- **Multi-appareils** : les passkeys *synchronisées* (iCloud/Google) ont
  `deviceType: 'multiDevice'` ; les clés matérielles `'singleDevice'`.
  `authenticatorAttachment` : `platform` (bio/appareil), `cross-platform`
  (clé USB), ou `any` comme l'ancienne extension.
- **Deux usages possibles** : passkey comme **connexion** (passwordless) et/ou
  comme **second facteur**. Recommandé : additive, pas en remplacement du mot de
  passe.
- **Migration de l'ancienne extension** : inutile. Les éventuelles données de
  l'extension sont dans un format différent et concernaient une connexion déjà
  désactivée ; les utilisateurs réenregistreraient simplement un passkey.

### 3.7 Effort & maintenance

- ~250-350 lignes (4 callables + glue client + écrans), **1 à 2 jours** de dev
  avec tests sur appareils réels (iOS, Android, desktop).
- Maintenance : se limite au suivi de `@simplewebauthn/*` (versions majeures
  annoncées). Pas de vendor, pas de service account, pas d'IAM, pas de CORS
  exotique.

---

## 4. Option B — Support natif Firebase Auth (n'existe pas encore)

Au **2026-09-30**, Firebase Auth **ne propose pas** de passkeys/WebAuthn natifs.
Vérifications effectuées :

- `https://firebase.google.com/docs/auth/web/passkeys` → **404**
- `https://cloud.google.com/identity-platform/docs/web/passkeys` → **404**
- Release notes SDK JS (`https://firebase.google.com/support/release-notes/js`) :
  **aucune** mention de `passkey` ni `webauthn`
- `https://cloud.google.com/identity-platform/docs/web/mfa` : aucune mention

Si Google l'ajoute un jour, ce serait probablement plus simple que l'option A
(pas de custom token, gestion des credentials par Firebase), mais il faudrait
**ré-enregistrer** les passkeys (sauf outil d'import fourni par Firebase).

**À surveiller :**

```bash
# Ré-exécuter ces vérifications ; si "passkey"/"webauthn" apparaît -> réévaluer
curl -s -o /dev/null -w "%{http_code}\n" https://firebase.google.com/docs/auth/web/passkeys
curl -s https://firebase.google.com/support/release-notes/js | grep -io "passkey\|webauthn" | sort | uniq -c
curl -s -o /dev/null -w "%{http_code}\n" https://cloud.google.com/identity-platform/docs/web/passkeys
```

Pages de veille : [Firebase Auth](https://firebase.google.com/docs/auth),
[release notes JS](https://firebase.google.com/support/release-notes/js),
[Identity Platform releases](https://cloud.google.com/identity-platform/docs/releases).

---

## 5. Option C — Fournisseurs tiers passkey-first (pour mémoire)

Des SaaS gèrent le WebAuthn à ta place : **Corbado**, **Hanko** (open-source),
**Passage (1Password)**, **Clerk**, **Stytch**, **Supabase**, **Auth0**.

À savoir : pour **conserver Firebase Auth + les règles Firestore**, il faudrait de
toute façon un pont (vérifier le JWT du vendor → `createCustomToken`) → la
complexité ne disparaît pas, elle se déplace, avec en plus une dépendance et un
coût récurrent. Les remplacer vraiment impliquerait de migrer toute
l'identité hors de Firebase (impact règles, gating produits, webhooks). Peu
pertinent ici tant que Firebase reste le socle.

---

## 6. Décision

- **Ne rien implémenter pour l'instant** : le besoin n'est pas démontré (la
  connexion passkey était désactivée depuis ~10 mois) et mot de passe + lien
  email couvrent les usages.
- **Rouvrir le sujet si** : demande utilisateur réelle, ou besoin d'une
  connexion sans friction sur mobile/PWA.
- **Ordre de préférence le jour où on le fait** :
  1. support natif Firebase Auth s'il existe alors (option B, à re-vérifier) ;
  2. sinon **SimpleWebAuthn + custom tokens** (option A) ;
  3. option C seulement si on accepte un vendor et un coût récurrent.

---

## 7. Références

- SimpleWebAuthn — <https://github.com/MasterKale/SimpleWebAuthn>
- MDN WebAuthn — <https://developer.mozilla.org/docs/Web/API/Web_Authentication_API>
- Firebase custom tokens —
  <https://firebase.google.com/docs/auth/admin/create-custom-tokens>
- Ancien commit de suppression : `2587fcb` (extension Firebase WebAuthn retirée).
