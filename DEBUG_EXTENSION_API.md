# Déboguer l'API de l'extension Firebase WebAuthn

## Problèmes courants

### Erreur 401 (Unauthorized)

**Symptôme** : `POST https://europe-west1-fluance-protected-content.cloudfunctions.net/ext-firebase-web-authn-fu06-api 401 (Unauthorized)`

**Cause** : L'extension nécessite une authentification pour appeler ses fonctions. Même pour créer un compte ou se connecter, l'utilisateur doit être authentifié anonymement.

**Solution** :
1. Vérifiez que l'authentification anonyme est activée dans Firebase Console > Authentication > Sign-in method
2. Le code doit s'authentifier anonymement avant d'appeler les fonctions de l'extension (déjà implémenté dans `firebase-auth.js`)

### Erreur 404 (Not Found)

L'erreur 404 indique que la fonction `webAuthn-checkExtension` n'existe pas. L'extension expose `ext-firebase-web-authn-fu06-api` mais la structure de l'API n'est pas claire.

## Test dans la console du navigateur

Ouvrez la console du navigateur (F12) sur `/connexion-membre/` et testez :

### Test 1 : Vérifier si la fonction existe comme callable

**Important** : Dans le mode compat de Firebase, utilisez `firebase.app().functions('region')` et non `firebase.functions('region')`.

**Note** : Pour tester dans la console, utilisez une fonction async ou des `.then()` au lieu de `await` en haut niveau.

```javascript
// Test avec .then() (fonctionne directement dans la console)
// ⚠️ IMPORTANT : L'extension nécessite une authentification (anonyme si pas déjà connecté)
(function() {
  // S'assurer qu'un utilisateur est authentifié
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    firebase.auth().signInAnonymously().then(() => {
      testExtension();
    }).catch(err => {
      console.error('Erreur authentification anonyme:', err);
    });
  } else {
    testExtension();
  }
  
  function testExtension() {
    // S'assurer que Firebase Functions est chargé
    if (!firebase.functions) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';
      document.head.appendChild(script);
      script.onload = () => {
        const app = firebase.app();
        const functions = app.functions('europe-west1');
        const apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
        apiFunction({ action: 'check' }).then(console.log).catch(console.error);
      };
    } else {
      const app = firebase.app();
      const functions = app.functions('europe-west1');
      const apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
      apiFunction({ action: 'check' }).then(console.log).catch(console.error);
    }
  }
})();
```

**OU avec async/await dans une fonction** :

```javascript
(async function() {
  // S'assurer qu'un utilisateur est authentifié
  if (!firebase.auth().currentUser) {
    await firebase.auth().signInAnonymously();
  }
  
  if (!firebase.functions) {
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
  }
  const app = firebase.app();
  const functions = app.functions('europe-west1');
  const apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
  const result = await apiFunction({ action: 'check' });
  console.log(result);
})().catch(console.error);
```

### Test 2 : Essayer différents noms de fonctions

```javascript
// ⚠️ IMPORTANT : S'authentifier anonymement d'abord si pas déjà connecté
if (!firebase.auth().currentUser) {
  firebase.auth().signInAnonymously().then(() => {
    testFunctions();
  }).catch(console.error);
} else {
  testFunctions();
}

function testFunctions() {
  const app = firebase.app();
  const functions = app.functions('europe-west1');

  // Essayer avec le nom complet
  const func1 = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
  func1({ action: 'check' }).then(console.log).catch(console.error);

  // Essayer avec des noms alternatifs
  const func2 = functions.httpsCallable('ext-firebase-web-authn-fu06-checkExtension');
  func2({}).then(console.log).catch(console.error);
}
```

### Test 3 : Utiliser le rewrite HTTP

L'extension peut être accessible via le rewrite `/firebase-web-authn-api` :

```javascript
fetch('/firebase-web-authn-api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'check' })
}).then(r => r.json()).then(console.log).catch(console.error);
```

## Solution recommandée : Utiliser la bibliothèque browser

L'extension fournit une bibliothèque browser `@firebase-web-authn/browser` qui devrait être utilisée :

### Installation

```bash
npm install @firebase-web-authn/browser
```

### Utilisation

```javascript
import { 
  createUserWithPasskey, 
  signInWithPasskey,
  linkWithPasskey 
} from '@firebase-web-authn/browser';

// Créer un compte
const userCredential = await createUserWithPasskey(firebase.auth(), firebase.functions(), 'Display Name');

// Se connecter
const userCredential = await signInWithPasskey(firebase.auth(), firebase.functions());

// Lier un passkey
await linkWithPasskey(firebase.auth(), firebase.functions(), 'Display Name');
```

## Structure de l'API

D'après la documentation, l'extension expose une fonction unique `ext-firebase-web-authn-fu06-api` qui gère toutes les opérations WebAuthn. Cette fonction peut être appelée :

1. **Via httpsCallable** (si elle est callable)
2. **Via le rewrite HTTP** `/firebase-web-authn-api`
3. **Via la bibliothèque browser** (recommandé)

## Prochaine étape

Testez dans la console du navigateur pour déterminer quelle méthode fonctionne, puis mettez à jour le code en conséquence.
