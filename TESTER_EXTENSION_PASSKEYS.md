# Tester l'extension Firebase WebAuthn

## Fonction déployée

La fonction s'appelle : **`ext-firebase-web-authn-fu06-api`**

## Structure de l'API

L'extension peut exposer ses méthodes de différentes façons. Il faut tester pour déterminer la structure exacte.

### Option 1 : Fonction unique avec paramètre `action`

L'extension expose une fonction unique `ext-firebase-web-authn-fu06-api` qui accepte un paramètre `action` :

```javascript
const apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
await apiFunction({ action: 'check' });
await apiFunction({ action: 'createUser', email: '...', displayName: '...' });
await apiFunction({ action: 'signIn', email: '...' });
```

### Option 2 : Fonctions callable séparées

L'extension peut exposer des fonctions callable séparées avec des noms comme :
- `ext-firebase-web-authn-fu06-checkExtension`
- `ext-firebase-web-authn-fu06-createUser`
- `ext-firebase-web-authn-fu06-signIn`
- `ext-firebase-web-authn-fu06-linkPasskey`

### Option 3 : Utiliser la bibliothèque browser

L'extension fournit une bibliothèque browser `@firebase-web-authn/browser` qui devrait être utilisée :

```bash
npm install @firebase-web-authn/browser
```

Puis dans le code :
```javascript
import { createUserWithPasskey, signInWithPasskey } from '@firebase-web-authn/browser';
```

## Test dans la console du navigateur

Pour tester rapidement, ouvrez la console du navigateur sur `/connexion-membre/` et essayez :

```javascript
// Test 1 : Vérifier si la fonction existe
const functions = firebase.app().functions('europe-west1');
const apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
apiFunction({ action: 'check' }).then(console.log).catch(console.error);

// Test 2 : Essayer avec différents noms de fonctions
const checkFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-checkExtension');
checkFunction().then(console.log).catch(console.error);
```

## Vérifier la documentation de l'extension

Consultez la [documentation officielle](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn) pour voir comment utiliser l'extension.

## Erreurs possibles

Si vous obtenez une erreur `functions/not-found`, cela signifie que :
- Le nom de la fonction est incorrect
- La structure de l'API est différente de ce qui est attendu

Dans ce cas, consultez la documentation de l'extension ou testez différentes structures.
