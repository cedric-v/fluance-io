# Résoudre l'erreur Node.js 18 décommissioné pour l'extension Firebase WebAuthn

## Problème

L'extension Firebase WebAuthn essaie d'utiliser Node.js 18 qui est décommissioné. L'erreur indique :

```
Runtime nodejs18 is decommissioned and no longer allowed. 
Please use the latest Node.js runtime for Cloud Functions.
```

**⚠️ IMPORTANT** : Ce problème n'est **PAS** lié à la région. L'extension elle-même (version 10.4.2) est codée pour utiliser Node.js 18 dans son code source. Changer la région ne résoudra pas le problème.

## Solutions

### Solution 1 : Vérifier s'il existe une version plus récente (À essayer en premier)

Vérifiez si une version plus récente de l'extension supporte Node.js 20 :

```bash
# Vérifier les versions disponibles
firebase ext:info gavinsawyer/firebase-web-authn

# Vérifier la dernière version sur extensions.dev
# https://extensions.dev/extensions/gavinsawyer/firebase-web-authn
```

**Note** : Au moment de la rédaction (décembre 2025), la version 10.4.2 utilise encore Node.js 18. Si une version plus récente existe, mettez à jour :

```bash
firebase ext:update firebase-web-authn
```

### Solution 2 : Contacter le développeur de l'extension

Si aucune version plus récente n'existe :

1. Ouvrez une issue sur le dépôt GitHub de l'extension (si disponible)
2. Contactez le développeur via [extensions.dev](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn)
3. Demandez une mise à jour pour supporter Node.js 20

### Solution 3 : Implémenter WebAuthn manuellement (Solution de contournement)

Si l'extension n'est pas mise à jour rapidement, vous pouvez implémenter WebAuthn manuellement avec Cloud Functions en utilisant Node.js 20.

#### Étape 1 : Désinstaller l'extension actuelle

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Allez dans **Extensions**
4. Trouvez l'extension **Firebase WebAuthn**
5. Cliquez sur **Uninstall** ou **Désinstaller**
6. Confirmez la désinstallation

**OU via CLI :**

```bash
firebase ext:uninstall firebase-web-authn
```

#### Étape 2 : Mettre à jour le fichier de configuration

Éditez le fichier `extensions/firebase-web-authn.env` et changez la région :

**Avant :**
```
LOCATION=europe-west6
```

**Après :**
```
LOCATION=us-central1
```

**OU :**
```
LOCATION=europe-west1
```

#### Étape 3 : Réinstaller l'extension

**Via Firebase Console :**

1. Allez dans **Extensions** > **Browse**
2. Recherchez "Firebase WebAuthn" par gavinsawyer
3. Cliquez sur **Install**
4. Lors de la configuration :
   - **Location** : Sélectionnez `us-central1` ou `europe-west1` (pas `europe-west6`)
   - **Relying Party ID** : `fluance.io`
   - **Relying Party Name** : `Fluance`
   - **Relying Party Origins** : 
     ```
     https://fluance.io
     https://www.fluance.io
     https://fluance-protected-content.firebaseapp.com
     ```
   - **Authenticator Attachment** : `any`
   - **Authenticator Attachment for Secondary Passkeys (2FA)** : `platform`
   - **User Verification Requirement** : `preferred`

**OU via CLI :**

```bash
firebase ext:install gavinsawyer/firebase-web-authn
```

Lors des prompts, sélectionnez `us-central1` ou `europe-west1` pour la région.

#### Étape 2 : Créer des Cloud Functions personnalisées

Créez vos propres Cloud Functions pour gérer WebAuthn avec Node.js 20. Voir la section "Implémentation manuelle" ci-dessous.

### Solution 4 : Attendre une mise à jour (Temporaire)

Si vous n'avez pas besoin des passkeys immédiatement, vous pouvez :
1. Désactiver temporairement l'onglet "Clé d'accès" dans l'interface
2. Utiliser uniquement les méthodes d'authentification existantes (email/password, passwordless)
3. Surveiller les mises à jour de l'extension

## Implémentation manuelle de WebAuthn (Solution de contournement)

Si vous devez absolument utiliser les passkeys maintenant, vous pouvez implémenter WebAuthn manuellement avec Cloud Functions en utilisant Node.js 20.

### Étapes

1. **Créer des Cloud Functions personnalisées** dans `functions/index.js` avec Node.js 20
2. **Utiliser une bibliothèque WebAuthn** comme `@simplewebauthn/server` ou `fido2-lib`
3. **Stocker les credentials** dans Firestore
4. **Mettre à jour le code client** pour utiliser vos fonctions personnalisées

**Exemple de structure :**

```javascript
// functions/index.js
const functions = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

exports.webAuthnCheckExtension = functions.https.onCall(async (request) => {
  return { available: true };
});

exports.webAuthnCreateUser = functions.https.onCall(async (request) => {
  // Implémentation de la création d'utilisateur avec passkey
  // Utiliser @simplewebauthn/server ou fido2-lib
});

exports.webAuthnSignIn = functions.https.onCall(async (request) => {
  // Implémentation de la connexion avec passkey
});
```

**Note** : Cette implémentation nécessite une bonne compréhension de WebAuthn et peut prendre plusieurs heures à développer et tester.

### Ressources

- [@simplewebauthn/server](https://github.com/MasterKale/SimpleWebAuthn) - Bibliothèque WebAuthn pour Node.js
- [WebAuthn Guide](https://webauthn.guide/) - Guide complet sur WebAuthn
- [Firebase Functions v2](https://firebase.google.com/docs/functions/v2) - Documentation Firebase Functions avec Node.js 20

## État actuel (Décembre 2025)

- ❌ **L'extension version 10.4.2 utilise Node.js 18** (décommissioné)
- ⏳ **Aucune version avec Node.js 20 disponible** au moment de la rédaction
- 📝 **Le développeur doit mettre à jour l'extension** pour supporter Node.js 20

## Recommandations

1. **✅ Solution immédiate (DÉJÀ FAIT)** : L'onglet "Clé d'accès" est temporairement désactivé dans l'interface
2. **Solution à moyen terme** : Surveiller les mises à jour de l'extension sur [extensions.dev](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn)
3. **Solution à long terme** : Si l'extension n'est pas mise à jour, implémenter WebAuthn manuellement ou chercher une alternative

## État actuel de l'interface

**L'onglet "Clé d'accès" est actuellement masqué** dans `src/fr/connexion-membre.md` avec la classe CSS `hidden`.

Les utilisateurs peuvent toujours utiliser :
- ✅ **Mot de passe** - Fonctionne normalement
- ✅ **Connexion par email** (passwordless) - Fonctionne normalement
- ❌ **Clé d'accès** - Temporairement désactivé

Pour réactiver l'onglet une fois l'extension mise à jour, voir [DESACTIVER_PASSKEYS_TEMPORAIREMENT.md](./DESACTIVER_PASSKEYS_TEMPORAIREMENT.md)

## Notes importantes

- ⚠️ **Ne supprimez pas** l'extension sans sauvegarder la configuration
- ⚠️ **Attendez** 5-10 minutes après l'installation pour que les fonctions soient déployées
- ✅ **Testez** après l'installation sur `/connexion-membre/`
