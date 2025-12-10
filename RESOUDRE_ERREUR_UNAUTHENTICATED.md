# Résoudre l'erreur "Unauthenticated" avec l'extension Firebase WebAuthn

## Problème

L'erreur `functions/unauthenticated` persiste même après avoir activé l'authentification anonyme et ajouté `ensureAuthenticated()` dans le code.

## Causes possibles

### 1. App Check est activé

Si App Check est activé dans Firebase Console, les fonctions Cloud Functions peuvent rejeter les appels qui n'incluent pas de token App Check valide, même si l'utilisateur est authentifié.

**Vérification** :
1. Allez dans Firebase Console > App Check
2. Vérifiez si App Check est configuré
3. Si oui, vérifiez les règles pour les Cloud Functions

**Solution** :
- Soit désactiver App Check temporairement pour tester
- Soit configurer App Check correctement avec reCAPTCHA v3

### 2. La fonction nécessite un format de données différent

L'extension peut nécessiter un format de données spécifique ou des paramètres différents.

**Test** : Essayez d'appeler la fonction sans paramètre `action` :

```javascript
const app = firebase.app();
const functions = app.functions('europe-west1');
const apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');

// Essayer sans paramètre action
apiFunction({}).then(console.log).catch(console.error);
```

### 3. La fonction nécessite un utilisateur non-anonyme

Bien que l'extension utilise l'authentification anonyme, certaines opérations peuvent nécessiter un utilisateur authentifié avec un compte réel.

**Test** : Essayez de vous connecter avec email/password d'abord, puis testez l'extension.

### 4. Problème avec les règles de sécurité de la fonction

La fonction Cloud Function elle-même peut avoir des règles de sécurité qui rejettent les utilisateurs anonymes.

**Vérification** : Consultez les logs de la fonction dans Firebase Console > Functions > ext-firebase-web-authn-fu06-api > Logs

## Solution recommandée : Utiliser la bibliothèque browser

L'extension fournit une bibliothèque browser `@firebase-web-authn/browser` qui gère l'authentification automatiquement.

### Installation

```bash
npm install @firebase-web-authn/browser
```

### Utilisation avec le mode compat

Comme vous utilisez le mode compat de Firebase, vous devrez charger la bibliothèque différemment :

```html
<script src="https://unpkg.com/@firebase-web-authn/browser@latest/dist/index.umd.js"></script>
```

Puis dans votre code :

```javascript
// La bibliothèque expose des fonctions globales
const { createUserWithPasskey, signInWithPasskey } = window.FirebaseWebAuthn;

// Utiliser avec firebase.auth() et firebase.functions()
const userCredential = await createUserWithPasskey(
  firebase.auth(),
  firebase.app().functions('europe-west1'),
  'Display Name'
);
```

## Vérifications à faire

1. ✅ **Authentification anonyme activée** - Vérifié
2. ❓ **App Check activé ?** - À vérifier dans Firebase Console
3. ❓ **Base Firestore `ext-firebase-web-authn` existe** - Vérifié
4. ❓ **Rôles IAM configurés** - À vérifier
5. ❓ **Logs de la fonction** - À consulter dans Firebase Console

## Test dans la console

Testez cette séquence complète dans la console du navigateur :

```javascript
(async function() {
  try {
    // 1. Vérifier l'authentification
    if (!firebase.auth().currentUser) {
      console.log('Authentification anonyme...');
      await firebase.auth().signInAnonymously();
    }
    console.log('✅ Utilisateur:', firebase.auth().currentUser.uid);
    
    // 2. Obtenir le token
    const token = await firebase.auth().currentUser.getIdToken();
    console.log('✅ Token obtenu');
    
    // 3. Tester l'appel
    const app = firebase.app();
    const functions = app.functions('europe-west1');
    const apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
    
    // Essayer sans paramètre action
    console.log('Test 1: Sans paramètre action');
    const result1 = await apiFunction({});
    console.log('✅ Succès:', result1);
    
    // Essayer avec action: 'check'
    console.log('Test 2: Avec action: check');
    const result2 = await apiFunction({ action: 'check' });
    console.log('✅ Succès:', result2);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    console.error('Details:', error.details);
  }
})();
```

## Prochaines étapes

1. Vérifiez App Check dans Firebase Console
2. Consultez les logs de la fonction dans Firebase Console
3. Testez avec la bibliothèque browser si le problème persiste
4. Contactez le développeur de l'extension si nécessaire
