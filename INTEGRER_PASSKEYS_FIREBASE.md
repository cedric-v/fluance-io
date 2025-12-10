# Intégrer les Passkeys (WebAuthn) avec Firebase Auth

## Vue d'ensemble

Les passkeys permettent une authentification sans mot de passe, sécurisée et simple pour les utilisateurs. En décembre 2025, Firebase Auth ne supporte pas nativement les passkeys, mais l'extension **Firebase WebAuthn** permet de les intégrer facilement.

## Solution recommandée : Extension Firebase WebAuthn

### Avantages
- ✅ Infrastructure simple à maintenir
- ✅ Intégration transparente avec Firebase Auth existant
- ✅ Support multi-appareils (passkeys synchronisés)
- ✅ Compatible avec les méthodes d'authentification existantes (email/password, passwordless)
- ✅ Pas besoin de gérer manuellement les clés WebAuthn

### Installation

#### 1. Installer l'extension via Firebase Console

```bash
# Via Firebase CLI
firebase ext:install gavinsawyer/firebase-web-authn

# Ou via la console Firebase :
# 1. Allez dans Extensions > Browse
# 2. Recherchez "WebAuthn"
# 3. Cliquez sur "Install"
```

#### 2. Configuration de l'extension

L'extension nécessite :
- **Relying Party ID** : Votre domaine (ex: `fluance.io`)
- **Relying Party Name** : Nom de votre application (ex: "Fluance")
- **Relying Party Origins** : Origines autorisées (ex: `https://fluance.io`, `https://www.fluance.io`)
- **Authenticator Attachment** : `any` (recommandé pour la flexibilité)
- **Authenticator Attachment for Secondary Passkeys (2FA)** : `platform` (pour iOS/Android)
- **User Verification Requirement** : `preferred` (équilibre sécurité/flexibilité)

#### 3. Mise à jour du code client

Ajouter le support des passkeys dans `firebase-auth.js` :

```javascript
// Ajouter après les imports Firebase
import { initializeWebAuthn } from '@gavinsawyer/firebase-web-authn/browser';

// Initialiser WebAuthn après l'initialisation de Firebase Auth
function initWebAuthn() {
  if (typeof window.PublicKeyCredential !== 'undefined') {
    // WebAuthn est supporté
    initializeWebAuthn({
      functionsRegion: 'us-central1', // Région de vos Cloud Functions
      // L'extension gère automatiquement la configuration
    });
  } else {
    console.warn('WebAuthn/Passkeys non supporté par ce navigateur');
  }
}

// Appeler après initAuth()
initWebAuthn();
```

#### 4. Fonctions d'authentification avec passkeys

```javascript
/**
 * Créer un compte avec passkey
 */
async function createAccountWithPasskey(email) {
  try {
    const { createUserWithPasskey } = await import('@gavinsawyer/firebase-web-authn/browser');
    
    const result = await createUserWithPasskey({
      email: email,
      displayName: email.split('@')[0] // Optionnel
    });
    
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Erreur création compte avec passkey:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Connexion avec passkey
 */
async function signInWithPasskey(email) {
  try {
    const { signInWithPasskey } = await import('@gavinsawyer/firebase-web-authn/browser');
    
    const result = await signInWithPasskey({ email: email });
    
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Erreur connexion avec passkey:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lier un passkey à un compte existant
 */
async function linkPasskeyToAccount() {
  try {
    const { linkPasskey } = await import('@gavinsawyer/firebase-web-authn/browser');
    
    await linkPasskey();
    
    return { success: true };
  } catch (error) {
    console.error('Erreur liaison passkey:', error);
    return { success: false, error: error.message };
  }
}
```

#### 5. Mise à jour de l'interface utilisateur

Ajouter un bouton "Connexion avec passkey" dans les formulaires de connexion :

```html
<!-- Dans connexion-membre.md -->
<button 
  id="passkey-login-btn" 
  type="button"
  class="btn-secondary"
  onclick="handlePasskeyLogin()"
>
  🔐 Connexion avec passkey
</button>
```

```javascript
async function handlePasskeyLogin() {
  const email = document.getElementById('email').value.trim();
  
  if (!email) {
    showError('Veuillez entrer votre email pour utiliser un passkey');
    return;
  }
  
  const result = await window.FluanceAuth.signInWithPasskey(email);
  
  if (result.success) {
    // Redirection automatique
    const returnUrl = new URLSearchParams(window.location.search).get('return') || '/membre/';
    window.location.href = returnUrl;
  } else {
    // Si le passkey n'existe pas, proposer de créer un compte
    if (result.error.includes('not found') || result.error.includes('not registered')) {
      const create = confirm('Aucun passkey trouvé. Voulez-vous en créer un ?');
      if (create) {
        const createResult = await window.FluanceAuth.createAccountWithPasskey(email);
        if (createResult.success) {
          window.location.href = returnUrl || '/membre/';
        }
      }
    } else {
      showError(result.error);
    }
  }
}
```

### Workflow utilisateur

1. **Première connexion** :
   - L'utilisateur entre son email
   - Clique sur "Connexion avec passkey"
   - Le navigateur propose de créer un passkey (biométrie, PIN, etc.)
   - Le compte est créé automatiquement

2. **Connexions suivantes** :
   - L'utilisateur entre son email
   - Clique sur "Connexion avec passkey"
   - Le navigateur demande l'authentification (biométrie, PIN, etc.)
   - Connexion automatique

3. **Multi-appareils** :
   - Les passkeys peuvent être synchronisés via iCloud Keychain (iOS/Mac) ou Google Password Manager
   - L'utilisateur peut utiliser le même passkey sur plusieurs appareils

## Alternative : Implémentation WebAuthn personnalisée

Si vous préférez ne pas utiliser d'extension, voici une approche plus simple mais nécessitant plus de code :

### Avantages
- ✅ Pas de dépendance externe
- ✅ Contrôle total sur l'implémentation

### Inconvénients
- ❌ Plus de code à maintenir
- ❌ Gestion manuelle des clés WebAuthn
- ❌ Stockage des credentials dans Firestore

### Implémentation simplifiée

```javascript
// Fonction pour créer un passkey
async function createPasskey(email) {
  try {
    // 1. Créer le compte Firebase d'abord (ou récupérer l'utilisateur existant)
    let user = auth.currentUser;
    if (!user) {
      // Créer un compte temporaire ou utiliser passwordless
      // ...
    }
    
    // 2. Créer la credential WebAuthn
    const publicKeyCredentialCreationOptions = {
      challenge: Uint8Array.from(randomStringFromServer, c => c.charCodeAt(0)),
      rp: {
        name: "Fluance",
        id: window.location.hostname,
      },
      user: {
        id: Uint8Array.from(user.uid, c => c.charCodeAt(0)),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [{alg: -7, type: "public-key"}],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required"
      },
      timeout: 60000,
      attestation: "direct"
    };
    
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });
    
    // 3. Stocker l'ID de la credential dans Firestore
    await db.collection('users').doc(user.uid).collection('passkeys').add({
      credentialId: arrayBufferToBase64(credential.rawId),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Erreur création passkey:', error);
    return { success: false, error: error.message };
  }
}
```

## Recommandation finale

**Utilisez l'extension Firebase WebAuthn** car :
1. ✅ Maintenance minimale
2. ✅ Intégration transparente avec Firebase Auth
3. ✅ Support multi-appareils automatique
4. ✅ Sécurité gérée par l'extension
5. ✅ Compatible avec vos méthodes d'authentification existantes

L'extension s'intègre parfaitement avec votre infrastructure actuelle et ne nécessite que quelques lignes de code supplémentaires.

## Ressources

- [Extension Firebase WebAuthn](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn)
- [Documentation WebAuthn MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [Firebase Extensions Hub](https://extensions.dev/)

## Notes importantes

- Les passkeys nécessitent HTTPS (déjà en place pour votre site)
- Support navigateur : Chrome, Safari, Edge, Firefox (versions récentes)
- Les passkeys peuvent être utilisés en complément des méthodes existantes (email/password, passwordless)
- L'utilisateur peut avoir plusieurs méthodes d'authentification pour le même compte
