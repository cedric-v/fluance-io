# Configuration Firebase pour le contenu protégé Fluance

Ce document explique comment configurer et déployer la solution de contenu protégé avec Firebase.

## Vue d'ensemble

La solution comprend :
- **Firebase Authentication** : Authentification des utilisateurs
- **Firestore** : Stockage des tokens et métadonnées utilisateurs
- **Firebase Storage** : Stockage du contenu protégé (code embed vidéos, HTML)
- **Firebase Functions** : Webhooks de paiement, génération de tokens, envoi d'emails
- **Mailjet API** : Envoi d'emails transactionnels et marketing

## Prérequis

1. Un projet Firebase existant (déjà configuré pour les commentaires)
2. Node.js 18+ installé
3. Firebase CLI installé : `npm install -g firebase-tools`
4. Compte Mailjet avec API Key et Secret
5. Comptes Stripe et/ou PayPal configurés avec webhooks

## Installation

### 1. Installer les dépendances Firebase Functions

```bash
cd functions
npm install
```

### 2. Installer les packages optionnels pour les webhooks

Pour Stripe :
```bash
cd functions
npm install stripe
```

Pour PayPal (si nécessaire) :
```bash
cd functions
npm install paypal-rest-sdk
```

### 3. Configuration Firebase Functions

Définir les variables de configuration :

```bash
firebase functions:config:set mailjet.api_key="VOTRE_API_KEY_MAILJET"
firebase functions:config:set mailjet.api_secret="VOTRE_API_SECRET_MAILJET"
firebase functions:config:set stripe.webhook_secret="VOTRE_WEBHOOK_SECRET_STRIPE"
firebase functions:config:set stripe.secret_key="VOTRE_SECRET_KEY_STRIPE"
```

Ou utiliser des variables d'environnement (recommandé pour la production) :

Dans la console Firebase, allez dans Functions > Configuration et ajoutez :
- `MAILJET_API_KEY`
- `MAILJET_API_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`

### 4. Déployer les règles de sécurité

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 5. Déployer les Firebase Functions

```bash
firebase deploy --only functions
```

## Configuration Mailjet

1. Créer un compte sur [Mailjet](https://www.mailjet.com/)
2. Obtenir votre API Key et API Secret dans le dashboard
3. Configurer l'email d'envoi (`support@fluance.io`) :
   - Vérifier le domaine `fluance.io` dans Mailjet
   - Configurer SPF, DKIM et DMARC pour une bonne délivrabilité
   - Ajouter l'enregistrement DNS SPF : `v=spf1 include:spf.mailjet.com ~all`
   - Activer DKIM dans le dashboard Mailjet

## Configuration des webhooks

### Stripe

1. Dans le dashboard Stripe, allez dans **Developers > Webhooks**
2. Cliquez sur **Add endpoint**
3. URL : `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/webhookStripe`
4. Événements à écouter :
   - `checkout.session.completed`
   - `payment_intent.succeeded`
5. Copier le **Signing secret** et l'ajouter à la configuration Firebase

### PayPal

1. Dans le dashboard PayPal, allez dans **My Apps & Credentials**
2. Créer une nouvelle app ou utiliser une existante
3. Configurer les webhooks :
   - URL : `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/webhookPayPal`
   - Événements : `PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`

## Structure Firestore

### Collection `registrationTokens`

Chaque document contient :
```javascript
{
  email: "client@example.com",
  product: "Approche Fluance Complète",
  createdAt: Timestamp,
  expiresAt: Timestamp,
  used: false,
  usedAt: Timestamp (si utilisé),
  userId: "firebase-user-id" (si utilisé)
}
```

### Collection `users`

Chaque document contient :
```javascript
{
  email: "client@example.com",
  product: "Approche Fluance Complète",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection `protectedContent` (optionnel)

Métadonnées sur le contenu protégé :
```javascript
{
  contentId: "video-1",
  product: "Approche Fluance Complète",
  title: "Titre du contenu",
  description: "Description",
  createdAt: Timestamp
}
```

## Structure Firebase Storage

Organiser le contenu protégé comme suit :

```
protected-content/
  ├── Approche Fluance Complète/
  │   ├── video-1.html
  │   ├── video-2.html
  │   └── ...
  ├── Cours en ligne/
  │   ├── cours-1.html
  │   └── ...
  └── Produit standard/
      └── ...
```

Chaque fichier HTML peut contenir :
- Code embed de vidéos (YouTube, Vimeo, etc.)
- Texte formaté
- Autre HTML/CSS/JS nécessaire

## Utilisation

### Créer un token manuellement

Pour les paiements par virement, cash, etc., utiliser la fonction `createUserToken` :

```javascript
// Depuis la console Firebase ou via une interface admin
const createUserToken = firebase.functions().httpsCallable('createUserToken');
const result = await createUserToken({
  email: 'client@example.com',
  product: 'Approche Fluance Complète',
  expirationDays: 30
});
```

**Note** : Cette fonction nécessite une authentification admin. Pour l'activer :

1. Créer un utilisateur admin dans Firebase Auth
2. Ajouter un claim personnalisé `admin: true` :
```bash
firebase auth:users:set-claims USER_ID --claims '{"admin": true}'
```

### Afficher du contenu protégé dans une page

Dans un fichier `.md` ou `.njk` :

```nunjucks
{% protectedContent "video-1" %}
```

Ou manuellement avec JavaScript :

```html
<div class="protected-content" data-content-id="video-1"></div>
<script src="/assets/js/firebase-auth.js"></script>
```

### Envoyer une newsletter

```javascript
const sendNewsletter = firebase.functions().httpsCallable('sendNewsletter');
const result = await sendNewsletter({
  subject: 'Sujet de la newsletter',
  htmlContent: '<h1>Contenu HTML</h1>',
  textContent: 'Contenu texte',
  recipientList: ['email1@example.com', 'email2@example.com']
  // ou
  recipientList: 'users' // nom de la collection Firestore
});
```

## Sécurité

### Règles Firestore

Les règles sont définies dans `firestore.rules` :
- Les tokens ne sont jamais accessibles côté client
- Les utilisateurs ne peuvent lire que leur propre document
- Le contenu protégé nécessite une authentification

### Règles Storage

Les règles sont définies dans `storage.rules` :
- Le contenu protégé nécessite une authentification
- Seules les Firebase Functions peuvent écrire

### Tokens

- Les tokens sont générés avec `crypto.randomBytes(32)` (256 bits)
- Chaque token est unique et à usage unique
- Les tokens expirent après 30 jours par défaut
- Les tokens utilisés sont marqués et ne peuvent être réutilisés

## Tests

### Tester localement avec l'émulateur Firebase

```bash
# Installer les émulateurs
firebase init emulators

# Démarrer les émulateurs
firebase emulators:start

# Dans un autre terminal, tester les fonctions
npm run serve
```

### Tester la création de compte

1. Créer un token manuellement via la console Firebase
2. Visiter `/creer-compte?token=TOKEN`
3. Remplir le formulaire
4. Vérifier que le compte est créé et le token marqué comme utilisé

## Déploiement

### Déployer tout

```bash
firebase deploy
```

### Déployer uniquement les fonctions

```bash
firebase deploy --only functions
```

### Déployer uniquement les règles

```bash
firebase deploy --only firestore:rules,storage:rules
```

## Monitoring

- **Logs** : `firebase functions:log`
- **Dashboard** : Console Firebase > Functions
- **Erreurs** : Console Firebase > Functions > Logs

## Dépannage

### Les emails ne sont pas envoyés

1. Vérifier les credentials Mailjet dans la configuration
2. Vérifier les logs : `firebase functions:log`
3. Vérifier que le domaine est vérifié dans Mailjet
4. Vérifier les règles SPF/DKIM/DMARC

### Les tokens ne fonctionnent pas

1. Vérifier que le token existe dans Firestore
2. Vérifier que le token n'a pas expiré
3. Vérifier que le token n'a pas déjà été utilisé
4. Vérifier les logs de la fonction `verifyToken`

### Le contenu protégé ne s'affiche pas

1. Vérifier que l'utilisateur est authentifié
2. Vérifier que le fichier existe dans Storage au bon chemin
3. Vérifier les règles de sécurité Storage
4. Vérifier la console du navigateur pour les erreurs

## Support

Pour toute question ou problème, consulter :
- [Documentation Firebase](https://firebase.google.com/docs)
- [Documentation Mailjet](https://dev.mailjet.com/)
- [Documentation Stripe](https://stripe.com/docs/webhooks)

