# Résoudre l'erreur Node.js 18 décommissioné pour l'extension Firebase WebAuthn

## ✅ Problème résolu

**La version 10.4.4 de l'extension Firebase WebAuthn supporte maintenant Node.js 20** et ne contient plus de références à Node.js 18.

Si vous rencontrez encore cette erreur, c'est que vous utilisez une ancienne version de l'extension.

## Solution : Mettre à jour l'extension vers la version 10.4.4 ou plus récente

### Étape 1 : Vérifier la version actuelle

Vérifiez la version dans `firebase.json` :

```json
{
  "extensions": {
    "firebase-web-authn": "gavinsawyer/firebase-web-authn@10.4.4"
  }
}
```

### Étape 2 : Mettre à jour l'extension

**Via Firebase CLI :**

```bash
# Mettre à jour l'extension
firebase ext:update firebase-web-authn
```

**OU via Firebase Console :**

1. Allez dans Firebase Console > Extensions
2. Trouvez l'extension **Firebase WebAuthn**
3. Cliquez sur **Update** ou **Mettre à jour**
4. Sélectionnez la version **10.4.4** ou plus récente

### Étape 3 : Vérifier l'installation

Après la mise à jour, vérifiez que les Cloud Functions utilisent Node.js 20 :

1. Allez dans Firebase Console > Functions > Functions
2. Cliquez sur une fonction `ext-firebase-web-authn-*`
3. Vérifiez que le runtime est **Node.js 20** ou plus récent

## Historique du problème

L'extension Firebase WebAuthn (versions 10.4.2 et antérieures) utilisait Node.js 18 qui est décommissioné. L'erreur indiquait :

```
Runtime nodejs18 is decommissioned and no longer allowed. 
Please use the latest Node.js runtime for Cloud Functions.
```

**Note** : Ce problème n'était **PAS** lié à la région. L'extension elle-même était codée pour utiliser Node.js 18 dans son code source.

## Vérifier les versions disponibles

Pour vérifier les versions disponibles :

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

**Note** : Le problème n'était pas lié à la région. Maintenant que l'extension supporte Node.js 20, toutes les régions fonctionnent, y compris `europe-west6` (Zurich). Vous pouvez utiliser la région de votre choix.

#### Étape 3 : Réinstaller l'extension

**Via Firebase Console :**

1. Allez dans **Extensions** > **Browse**
2. Recherchez "Firebase WebAuthn" par gavinsawyer
3. Cliquez sur **Install**
4. Lors de la configuration :
   - **Location** : Sélectionnez la région de votre choix (toutes fonctionnent avec Node.js 20)
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

Lors des prompts, sélectionnez la région de votre choix (toutes fonctionnent avec Node.js 20).

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

- ✅ **L'extension version 10.4.4+ supporte Node.js 20** - Problème résolu !
- ✅ **L'onglet "Clé d'accès" est réactivé** dans l'interface
- ✅ **Toutes les fonctionnalités passkeys sont disponibles**

## Recommandations

1. **✅ Mettre à jour l'extension** vers la version 10.4.4 ou plus récente
2. **✅ Vérifier l'installation** dans Firebase Console > Functions
3. **✅ Tester les passkeys** sur `/connexion-membre/`

## État actuel de l'interface

**L'onglet "Clé d'accès" est maintenant activé** dans `src/fr/connexion-membre.md`.

Les utilisateurs peuvent utiliser :
- ✅ **Mot de passe** - Fonctionne normalement
- ✅ **Connexion par email** (passwordless) - Fonctionne normalement
- ✅ **Clé d'accès** - Disponible avec l'extension 10.4.4+

## Notes importantes

- ⚠️ **Ne supprimez pas** l'extension sans sauvegarder la configuration
- ⚠️ **Attendez** 5-10 minutes après l'installation pour que les fonctions soient déployées
- ✅ **Testez** après l'installation sur `/connexion-membre/`
