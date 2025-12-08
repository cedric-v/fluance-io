# Guide : Tester le login et l'accès au contenu protégé

Ce guide vous explique comment tester complètement le système d'authentification et d'accès au contenu protégé.

## 📋 Prérequis

- Firebase Functions déployées
- Secrets Mailjet configurés
- Firestore activé
- Authentication activé (Email/Password)

## 🧪 Étape 1 : Créer un token de test

### Méthode recommandée : Via Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Allez dans **Firestore Database**
4. Cliquez sur **Commencer la collection** / **Start collection** (si c'est la première fois)
5. **Nom de la collection** : `registrationTokens`
6. **Document ID** : Cliquez sur **Générer automatiquement** / **Auto-ID** (génère un ID aléatoire de 20 caractères)
7. Ajoutez ces champs un par un :

| Champ | Type | Valeur |
|-------|------|--------|
| `email` | string | `test@example.com` (ou votre email de test) |
| `product` | string | `complet` ou `21jours` (selon le produit testé) |
| `createdAt` | timestamp | Cliquez sur l'icône horloge et sélectionnez "now" |
| `expiresAt` | timestamp | Cliquez sur l'icône horloge, ajoutez 30 jours |
| `used` | boolean | `false` |

8. Cliquez sur **Enregistrer** / **Save**
9. **Copiez l'ID du document** (ex: `abc123def456...`) - c'est votre token de test

**💡 Astuce** : Pour générer un ID aléatoire de 32 caractères hex (comme les vrais tokens), vous pouvez utiliser un générateur en ligne ou la console JavaScript du navigateur :
```javascript
Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')
```

### Option B : Via Firebase Functions (méthode programmatique)

Créez un script temporaire `test-create-token.js` :

```javascript
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialiser Firebase Admin
const serviceAccount = require('./path/to/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createTestToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 30);

  await db.collection('registrationTokens').doc(token).set({
    email: 'test@example.com',
    product: 'complet', // ou '21jours' selon le produit testé
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: expirationDate,
    used: false
  });

  console.log('✅ Token créé :', token);
  console.log('🔗 URL de création de compte :', `https://fluance.io/creer-compte?token=${token}`);
}

createTestToken().catch(console.error);
```

## 🧪 Étape 2 : Créer un compte avec le token

1. Allez sur : `https://fluance.io/creer-compte?token=VOTRE_TOKEN`
   (Remplacez `VOTRE_TOKEN` par le token créé à l'étape 1)

2. Remplissez le formulaire :
   - **Email** : L'email utilisé dans le token (ex: `test@example.com`)
   - **Mot de passe** : Choisissez un mot de passe (minimum 6 caractères)
   - **Confirmer le mot de passe** : Répétez le mot de passe

3. Cliquez sur **Créer mon compte**

4. ✅ Si tout fonctionne, vous devriez être automatiquement connecté et redirigé

## 🧪 Étape 3 : Se connecter

1. Allez sur : `https://fluance.io/connexion-firebase/`

2. **Option A : Connexion avec mot de passe**
   - Entrez votre email : `test@example.com`
   - Entrez votre mot de passe
   - Cliquez sur **Se connecter**

3. **Option B : Connexion avec lien magique**
   - Cliquez sur l'onglet **Lien magique**
   - Entrez votre email : `test@example.com`
   - Cliquez sur **Envoyer le lien magique**
   - Vérifiez votre boîte email
   - Cliquez sur le lien reçu

4. ✅ Si tout fonctionne, vous devriez être connecté

## 🧪 Étape 4 : Ajouter du contenu protégé dans Firestore

Pour tester l'affichage du contenu protégé, ajoutez un document dans Firestore :

1. Allez dans **Firestore Database**
2. Cliquez sur **Commencer la collection** / **Start collection** (si c'est la première fois)
3. **Nom de la collection** : `protectedContent`
4. **Document ID** : `test-video-1`
5. Ajoutez ces champs un par un :

| Champ | Type | Valeur |
|-------|------|--------|
| `product` | string | `complet` ou `21jours` (doit correspondre exactement au produit de votre token) |
| `title` | string | `Vidéo de test` |
| `content` | string | `<div class="protected-video-content"><h2 class="text-2xl font-bold mb-4">Contenu de test</h2><p class="mb-4">Ceci est un contenu protégé. Si vous voyez ce message, vous êtes bien connecté !</p><p class="mb-4">Vous avez accès au produit : <strong>complet</strong></p><div class="bg-green-50 border border-green-200 rounded-lg p-4"><p class="text-green-800">✅ Authentification réussie !</p></div></div>` |
| `createdAt` | timestamp | Cliquez sur l'icône horloge et sélectionnez "now" |
| `updatedAt` | timestamp | Cliquez sur l'icône horloge et sélectionnez "now" |

6. Cliquez sur **Enregistrer** / **Save**

**⚠️ Important** : Le champ `product` doit **exactement** correspondre au produit de votre token (`"complet"` ou `"21jours"`).

## 🧪 Étape 5 : Tester l'affichage du contenu protégé

### Méthode recommandée : Page de test créée

Une page de test a été créée : `/test-contenu-protege/`

1. Allez sur : `https://fluance.io/test-contenu-protege/` (ou votre URL locale)
2. Si vous n'êtes pas connecté, vous verrez un message vous invitant à vous connecter
3. Si vous êtes connecté, le contenu protégé devrait s'afficher automatiquement

La page affiche également l'état de votre authentification en temps réel.

### Méthode 2 : Via JavaScript directement

Créez une page HTML de test :

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Contenu Protégé</title>
</head>
<body>
  <h1>Test du contenu protégé</h1>
  
  <div id="protected-content" data-content-id="test-video-1"></div>
  
  <script src="/assets/js/firebase-auth.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', async function() {
      const container = document.getElementById('protected-content');
      
      if (window.FluanceAuth && window.FluanceAuth.isAuthenticated()) {
        const result = await window.FluanceAuth.displayProtectedContent('test-video-1', container);
        if (!result.success) {
          container.innerHTML = '<p style="color: red;">Erreur : ' + result.error + '</p>';
        }
      } else {
        container.innerHTML = '<p>Veuillez vous connecter pour voir le contenu protégé.</p>';
      }
    });
  </script>
</body>
</html>
```

## 🧪 Étape 6 : Vérifier dans la console du navigateur

1. Ouvrez la console du navigateur (F12)
2. Vérifiez qu'il n'y a pas d'erreurs Firebase
3. Vérifiez les messages de log :
   - `User authenticated` ou similaire
   - `Loading protected content...`
   - `Content loaded successfully`

## ✅ Checklist de test

- [ ] Token créé dans Firestore (`registrationTokens`)
- [ ] Compte créé via `/creer-compte?token=...`
- [ ] Connexion réussie via `/connexion-firebase/`
- [ ] Contenu protégé ajouté dans Firestore (`protectedContent`)
- [ ] Contenu affiché correctement sur la page
- [ ] Aucune erreur dans la console du navigateur
- [ ] Email de création de compte reçu (si Mailjet configuré)

## 🐛 Dépannage

### Erreur : "Token invalide"
- Vérifiez que le token existe dans Firestore
- Vérifiez que le token n'a pas expiré (`expiresAt`)
- Vérifiez que le token n'a pas déjà été utilisé (`used: false`)

### Erreur : "Non authentifié"
- Vérifiez que vous êtes bien connecté
- Vérifiez la console du navigateur pour les erreurs Firebase
- Vérifiez que `firebase-auth.js` est bien chargé

### Erreur : "Contenu non trouvé"
- Vérifiez que le document existe dans `protectedContent`
- Vérifiez que l'ID du document correspond (`test-video-1`)
- Vérifiez que le champ `product` correspond au produit de l'utilisateur

### Erreur : "Accès non autorisé"
- Vérifiez que le `product` du contenu correspond au `product` de l'utilisateur
- Vérifiez les règles de sécurité Firestore

### Le contenu ne s'affiche pas
- Vérifiez que vous êtes connecté : `window.FluanceAuth.isAuthenticated()`
- Vérifiez la console pour les erreurs
- Vérifiez que le shortcode `{% protectedContent "test-video-1" %}` est bien utilisé

## 📝 Exemple de test complet

1. **Créer un token** : `abc123def456...` (32 caractères hex)
2. **Créer le compte** : `https://fluance.io/creer-compte?token=abc123def456...`
3. **Se connecter** : `https://fluance.io/connexion-firebase/`
4. **Ajouter le contenu** dans Firestore avec l'ID `test-video-1`
5. **Afficher le contenu** sur une page avec `{% protectedContent "test-video-1" %}`

## 🔍 Vérification dans Firebase Console

Pour vérifier que tout fonctionne :

1. **Firestore > registrationTokens** : Le token doit avoir `used: true` et `userId` rempli
2. **Firestore > users** : Un document doit exister avec votre email et produit
3. **Authentication > Users** : Un utilisateur doit exister avec votre email
4. **Functions > Logs** : Vérifiez les logs de `verifyToken` pour voir si tout s'est bien passé

