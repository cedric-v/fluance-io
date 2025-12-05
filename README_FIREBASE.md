# Solution de contenu protégé Firebase pour Fluance

## Architecture

```
┌─────────────────┐
│  Paiement       │
│  (Stripe/PayPal)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Webhook        │
│  Firebase Func  │
└────────┬────────┘
         │
         ├──► Génère token unique
         │
         ├──► Stocke dans Firestore
         │
         └──► Envoie email (Mailjet)
              │
              ▼
         ┌─────────────┐
         │   Client    │
         │   reçoit    │
         │   email     │
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │ Crée compte │
         │ avec token  │
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │ Firebase    │
         │ Auth        │
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │ Accède au   │
         │ contenu     │
         │ protégé     │
         │ (Storage)   │
         └─────────────┘
```

## Fichiers créés

### Firebase Functions
- `functions/index.js` : Toutes les fonctions backend
- `functions/package.json` : Dépendances Node.js
- `functions/.eslintrc.js` : Configuration ESLint

### Configuration Firebase
- `firebase.json` : Configuration du projet Firebase
- `.firebaserc` : ID du projet Firebase
- `firestore.rules` : Règles de sécurité Firestore
- `firestore.indexes.json` : Index Firestore
- `storage.rules` : Règles de sécurité Storage

### Code client
- `src/assets/js/firebase-auth.js` : Authentification et accès au contenu
- `src/fr/creer-compte.md` : Page de création de compte
- `src/fr/connexion-firebase.md` : Page de connexion Firebase
- `src/_includes/protected-content.njk` : Shortcode pour contenu protégé

### Documentation
- `FIREBASE_SETUP.md` : Guide complet de configuration
- `README_FIREBASE.md` : Ce fichier

## Fonctions Firebase disponibles

### `webhookStripe`
Gère les webhooks Stripe pour créer automatiquement des tokens après paiement.

**URL** : `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/webhookStripe`

### `webhookPayPal`
Gère les webhooks PayPal pour créer automatiquement des tokens après paiement.

**URL** : `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/webhookPayPal`

### `createUserToken`
Crée manuellement un token pour un utilisateur (paiement virement, cash, etc.).

**Utilisation** :
```javascript
const createUserToken = firebase.functions().httpsCallable('createUserToken');
await createUserToken({
  email: 'client@example.com',
  product: 'Approche Fluance Complète',
  expirationDays: 30
});
```

**Requiert** : Authentification admin

### `verifyToken`
Vérifie un token et crée le compte Firebase Auth.

**Utilisation** : Appelée automatiquement depuis la page de création de compte.

### `sendNewsletter`
Envoie des emails marketing à une liste de destinataires.

**Utilisation** :
```javascript
const sendNewsletter = firebase.functions().httpsCallable('sendNewsletter');
await sendNewsletter({
  subject: 'Sujet',
  htmlContent: '<h1>Contenu</h1>',
  textContent: 'Contenu texte',
  recipientList: ['email1@example.com', 'email2@example.com']
});
```

**Requiert** : Authentification admin

## Fonctions JavaScript côté client

### `FluanceAuth.signIn(email, password)`
Connecte un utilisateur avec email et mot de passe.

### `FluanceAuth.signOut()`
Déconnecte l'utilisateur actuel.

### `FluanceAuth.verifyTokenAndCreateAccount(token, password)`
Vérifie un token et crée un compte.

### `FluanceAuth.loadProtectedContent(contentId)`
Charge le contenu protégé depuis Firebase Storage.

### `FluanceAuth.displayProtectedContent(contentId, containerElement)`
Affiche le contenu protégé dans un élément HTML.

### `FluanceAuth.getCurrentUser()`
Retourne l'utilisateur actuellement connecté.

### `FluanceAuth.isAuthenticated()`
Vérifie si un utilisateur est connecté.

## Pages créées

### `/creer-compte`
Page de création de compte avec token. Accepte le paramètre `?token=XXX` dans l'URL.

### `/connexion-firebase`
Page de connexion Firebase Auth. Accepte le paramètre `?return=/path` pour rediriger après connexion.

## Utilisation dans les pages

### Méthode 1 : Shortcode Nunjucks

```nunjucks
{% protectedContent "video-1" %}
```

### Méthode 2 : HTML + JavaScript

```html
<div class="protected-content" data-content-id="video-1"></div>
<script src="/assets/js/firebase-auth.js"></script>
```

### Méthode 3 : JavaScript manuel

```html
<div id="my-content"></div>
<script src="/assets/js/firebase-auth.js"></script>
<script>
  window.FluanceAuth.displayProtectedContent('video-1', document.getElementById('my-content'));
</script>
```

## Sécurité

- ✅ Tokens uniques à usage unique
- ✅ Tokens avec expiration automatique
- ✅ Vérification côté serveur et côté client
- ✅ Contenu protégé jamais exposé sur GitHub
- ✅ Règles de sécurité Firestore et Storage
- ✅ Authentification requise pour accéder au contenu

## Prochaines étapes

1. **Configurer Mailjet** : Obtenir les credentials et configurer SPF/DKIM/DMARC
2. **Configurer les webhooks** : Stripe et/ou PayPal
3. **Déployer les règles** : `firebase deploy --only firestore:rules,storage:rules`
4. **Déployer les fonctions** : `firebase deploy --only functions`
5. **Tester** : Créer un token de test et vérifier le flux complet
6. **Uploader le contenu** : Mettre les fichiers HTML dans Firebase Storage

Voir `FIREBASE_SETUP.md` pour les détails complets de configuration.

