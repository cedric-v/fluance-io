# Où ajouter les métadonnées pour Stripe et PayPal

## 📍 Réponse rapide

Les métadonnées doivent être ajoutées dans les **fonctions Firebase qui créent les sessions Stripe et les commandes PayPal**. Ces fonctions n'existent pas encore et doivent être créées.

## 🔧 Où créer ces fonctions

### Option recommandée : Firebase Functions

Créez deux nouvelles fonctions dans le fichier **`functions/index.js`** :

1. `createStripeSession` - Pour créer les sessions Stripe Checkout
2. `createPayPalOrder` - Pour créer les commandes PayPal

## 📝 Code à ajouter dans `functions/index.js`

### 1. Fonction pour créer une session Stripe

Ajoutez cette fonction dans `functions/index.js` :

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const products = require('../src/_data/products.json');

/**
 * Crée une session Stripe Checkout avec les métadonnées nécessaires
 * Région : europe-west1 (Belgique)
 */
exports.createStripeSession = functions.region('europe-west1').runWith({
  secrets: ['STRIPE_SECRET_KEY'],
}).https.onCall(async (data, context) => {
  const { productId, variant, locale } = data;
  
  // Charger la configuration du produit depuis products.json
  let productConfig;
  if (productId === '21jours') {
    productConfig = products['21jours'];
  } else if (productId === 'complet') {
    productConfig = products.complet[variant]; // 'mensuel' ou 'trimestriel'
  } else {
    throw new functions.https.HttpsError('invalid-argument', 'Produit invalide');
  }
  
  // Créer la session Stripe avec les métadonnées
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: productConfig.stripe.priceId,
        quantity: 1,
      },
    ],
    mode: productConfig.stripe.mode, // 'payment' ou 'subscription'
    success_url: `https://fluance.io/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://fluance.io/cancel`,
    metadata: {
      product: productId, // ⚠️ IMPORTANT : "21jours" ou "complet"
      system: 'firebase', // ⚠️ IMPORTANT : Identifie que c'est pour le nouveau système
    },
    locale: locale === 'fr' ? 'fr' : 'en',
  });
  
  return { url: session.url };
});
```

**📍 Où ajouter les métadonnées** : Dans l'objet `metadata` (lignes 93-96)
- `product: productId` - Identifiant du produit
- `system: 'firebase'` - Identifie que c'est pour le nouveau système

### 2. Fonction pour créer une commande PayPal

Ajoutez cette fonction dans `functions/index.js` :

```javascript
const paypal = require('@paypal/checkout-server-sdk');
const products = require('../src/_data/products.json');

/**
 * Crée une commande PayPal avec le custom_id nécessaire
 * Région : europe-west1 (Belgique)
 */
exports.createPayPalOrder = functions.region('europe-west1').runWith({
  secrets: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
}).https.onCall(async (data, context) => {
  const { productId, variant, locale } = data;
  
  // Charger la configuration du produit depuis products.json
  let productConfig;
  if (productId === '21jours') {
    productConfig = products['21jours'];
  } else if (productId === 'complet') {
    productConfig = products.complet[variant]; // 'mensuel' ou 'trimestriel'
  } else {
    throw new functions.https.HttpsError('invalid-argument', 'Produit invalide');
  }
  
  // Configuration PayPal
  const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
  const client = new paypal.core.PayPalHttpClient(environment);
  
  // Créer la commande PayPal avec custom_id
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: productConfig.price.currency,
        value: productConfig.price.amount.toString(),
      },
      custom_id: `firebase_${productId}`, // ⚠️ IMPORTANT : Préfixe 'firebase_' pour identifier le système
    }],
  });
  
  const order = await client.execute(request);
  
  // Trouver l'URL d'approbation
  const approvalUrl = order.result.links.find(link => link.rel === 'approve')?.href;
  
  return { approvalUrl: approvalUrl };
});
```

**📍 Où ajouter le custom_id** : Dans `purchase_units[0].custom_id` (ligne 47)
- `custom_id: 'firebase_21jours'` ou `'firebase_complet'` - Préfixe 'firebase_' pour identifier le système

## 📦 Dépendances à installer

Avant d'utiliser ces fonctions, installez les packages nécessaires :

```bash
cd functions
npm install stripe @paypal/checkout-server-sdk
```

## 🔗 Comment ces fonctions sont appelées

Ces fonctions sont appelées depuis le code JavaScript côté client (`src/assets/js/payment.js`) :

```javascript
// Dans payment.js
const response = await fetch('/api/create-stripe-session', {
  method: 'POST',
  body: JSON.stringify({
    productId: '21jours',
    variant: null,
    locale: 'fr',
  }),
});
```

**Note** : Si vous utilisez Firebase Functions Callable, vous devez utiliser le SDK Firebase au lieu de `fetch` :

```javascript
// Dans payment.js (si vous utilisez Firebase Functions Callable)
const createStripeSession = firebase.functions().httpsCallable('createStripeSession');
const result = await createStripeSession({
  productId: '21jours',
  variant: null,
  locale: 'fr',
});
const url = result.data.url;
```

## ✅ Résumé

| Métadonnée | Où l'ajouter | Format |
|------------|--------------|--------|
| **Stripe** | `functions/index.js` → `createStripeSession` → `metadata` | `{ product: '21jours', system: 'firebase' }` |
| **PayPal** | `functions/index.js` → `createPayPalOrder` → `custom_id` | `'firebase_21jours'` ou `'firebase_complet'` |

## 📚 Exemple complet

Voir `EXEMPLE_INTEGRATION_PAIEMENT.md` pour un exemple complet avec le code complet des fonctions.

## 🆘 Si les fonctions n'existent pas encore

Si vous n'avez pas encore créé ces fonctions, vous devez :

1. **Créer les fonctions** dans `functions/index.js` (voir code ci-dessus)
2. **Installer les dépendances** : `npm install stripe @paypal/checkout-server-sdk`
3. **Déployer les fonctions** : `firebase deploy --only functions`
4. **Mettre à jour `payment.js`** pour appeler ces fonctions

Une fois ces fonctions créées et déployées, les métadonnées seront automatiquement ajoutées lors de la création des sessions/commandes.

