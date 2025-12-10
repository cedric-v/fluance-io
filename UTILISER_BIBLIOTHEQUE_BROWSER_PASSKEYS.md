# Utiliser la bibliothèque browser officielle pour les Passkeys

## Problème actuel

L'erreur `functions/unauthenticated` persiste même avec l'authentification anonyme. La fonction Cloud Function rejette les utilisateurs anonymes.

## Solution : Utiliser la bibliothèque browser officielle

L'extension `firebase-web-authn` fournit une bibliothèque browser `@firebase-web-authn/browser` qui gère l'authentification correctement et évite les erreurs `unauthenticated`.

### Installation

```bash
npm install @firebase-web-authn/browser
```

### Utilisation avec le mode compat de Firebase

Comme vous utilisez le mode compat de Firebase (firebase.compat.js), vous devez charger la bibliothèque différemment.

#### Option 1 : Via CDN (recommandé pour le mode compat)

Ajoutez dans `src/_includes/base.njk` ou dans la page qui utilise les passkeys :

```html
<!-- Après le chargement de Firebase -->
<script src="https://unpkg.com/@firebase-web-authn/browser@latest/dist/index.umd.js"></script>
```

Puis dans votre code JavaScript :

```javascript
// La bibliothèque expose des fonctions globales
const { createUserWithPasskey, signInWithPasskey, linkWithPasskey } = window.FirebaseWebAuthn;

// Utiliser avec firebase.auth() et firebase.app().functions()
async function createAccountWithPasskey(email, displayName) {
  try {
    const auth = firebase.auth();
    const functions = firebase.app().functions('europe-west1');
    
    const userCredential = await createUserWithPasskey(auth, functions, displayName || email);
    console.log('Compte créé avec passkey:', userCredential.user);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Erreur:', error);
    return { success: false, error: error.message };
  }
}

async function signInWithPasskey() {
  try {
    const auth = firebase.auth();
    const functions = firebase.app().functions('europe-west1');
    
    const userCredential = await signInWithPasskey(auth, functions);
    console.log('Connexion réussie avec passkey:', userCredential.user);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Erreur:', error);
    return { success: false, error: error.message };
  }
}
```

#### Option 2 : Via npm (nécessite un bundler)

Si vous utilisez un bundler (webpack, rollup, etc.), vous pouvez importer directement :

```javascript
import { createUserWithPasskey, signInWithPasskey } from '@firebase-web-authn/browser';
```

### Intégration dans firebase-auth.js

Remplacez les fonctions `createAccountWithPasskey`, `signInWithPasskey`, et `linkPasskeyToAccount` dans `src/assets/js/firebase-auth.js` pour utiliser la bibliothèque browser.

**Exemple pour `signInWithPasskey`** :

```javascript
async function signInWithPasskey(email) {
  try {
    // Vérifier le support WebAuthn
    if (!isWebAuthnSupported()) {
      return { 
        success: false, 
        error: 'Les passkeys ne sont pas supportés par votre navigateur.' 
      };
    }

    // Utiliser la bibliothèque browser officielle
    if (typeof window.FirebaseWebAuthn === 'undefined') {
      return { 
        success: false, 
        error: 'La bibliothèque WebAuthn n\'est pas chargée. Rechargez la page.' 
      };
    }

    const { signInWithPasskey: signInWithPasskeyLib } = window.FirebaseWebAuthn;
    const auth = firebase.auth();
    const functions = firebase.app().functions('europe-west1');
    
    const userCredential = await signInWithPasskeyLib(auth, functions);
    
    return {
      success: true,
      user: userCredential.user
    };
  } catch (error) {
    console.error('Erreur lors de la connexion avec passkey:', error);
    return {
      success: false,
      error: error.message || 'Une erreur est survenue lors de la connexion avec passkey.'
    };
  }
}
```

### Avantages de la bibliothèque browser

1. ✅ **Gère l'authentification automatiquement** - Plus besoin de s'authentifier anonymement manuellement
2. ✅ **Gère les tokens correctement** - Les tokens sont transmis correctement aux fonctions
3. ✅ **Compatible avec l'extension** - Utilise la même API que l'extension attend
4. ✅ **Moins d'erreurs** - Évite les erreurs `unauthenticated`

### Vérification

1. Chargez la bibliothèque via CDN dans votre page
2. Vérifiez que `window.FirebaseWebAuthn` est disponible dans la console
3. Testez la connexion avec passkey

### Note importante

La bibliothèque browser gère l'authentification anonyme en interne si nécessaire. Vous n'avez plus besoin d'appeler `ensureAuthenticated()` manuellement avant d'utiliser les fonctions de la bibliothèque.
