# Guide : Intégration Stripe et PayPal (sans Ontraport)

Ce guide explique où configurer les libellés Stripe/PayPal dans ce projet et comment intégrer directement les paiements.

## 📍 Où configurer les libellés

### 1. Fichier de configuration des produits

**Fichier** : `src/_data/products.json`

Ce fichier contient tous les produits avec leurs libellés, prix et identifiants Stripe/PayPal.

```json
{
  "21jours": {
    "name": {
      "fr": "Défi 21 jours",
      "en": "21-Day Challenge"
    },
    "price": {
      "amount": 19,
      "currency": "CHF"
    },
    "stripe": {
      "priceId": "price_XXXXX"
    }
  }
}
```

**⚠️ Action requise** : Remplacez `price_XXXXX` et `PROD-XXXXX` par vos vrais identifiants depuis Stripe/PayPal Dashboard.

### 2. Dans Stripe Dashboard

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com/)
2. **Products** → Créez les produits avec ces libellés :
   - **"Défi 21 jours"** : 19 CHF (paiement unique)
   - **"Approche Fluance Complète - Mensuel"** : 30 CHF (abonnement mensuel)
   - **"Approche Fluance Complète - Trimestriel"** : 75 CHF (abonnement trimestriel)
3. **Copiez les Price IDs** (commencent par `price_`) et mettez-les dans `products.json`

### 3. Dans PayPal Dashboard

1. Allez sur [PayPal Dashboard](https://www.paypal.com/businessmanage/products)
2. Créez les produits avec les mêmes libellés
3. **Copiez les Product IDs** (commencent par `PROD-`) et mettez-les dans `products.json`

## 🔧 Structure du projet

```
fluance-io/
├── src/
│   ├── _data/
│   │   └── products.json          ← Configuration des produits (libellés, prix, IDs)
│   ├── assets/js/
│   │   └── payment.js             ← Fonctions JavaScript pour créer les sessions
│   └── [pages avec boutons de paiement]
├── functions/
│   └── index.js                   ← Webhooks Stripe/PayPal (déjà configurés)
└── api/                           ← À créer : routes API pour créer les sessions
    ├── create-stripe-session.js
    └── create-paypal-order.js
```

## 📝 Étapes d'intégration

### Étape 1 : Créer les produits dans Stripe/PayPal

Suivez les instructions dans `CONFIGURER_PRODUITS_STRIPE_PAYPAL.md` pour créer les produits dans les dashboards.

### Étape 2 : Mettre à jour `products.json`

1. Ouvrez `src/_data/products.json`
2. Remplacez les placeholders (`price_XXXXX`, `PROD-XXXXX`) par vos vrais identifiants
3. Ajustez les libellés si nécessaire

### Étape 3 : Créer les routes API (à faire)

Vous devez créer des routes API côté serveur pour créer les sessions Stripe/PayPal. Deux options :

#### Option A : Utiliser Firebase Functions (recommandé)

Créez deux nouvelles fonctions dans `functions/index.js` :

```javascript
// Créer une session Stripe Checkout
exports.createStripeSession = functions.region('europe-west1').https.onCall(async (data, context) => {
  const { productId, variant, locale } = data;
  
  // Charger la configuration du produit depuis products.json
  // Créer la session Stripe avec metadata.product = productId
  // Retourner l'URL de la session
});

// Créer une commande PayPal
exports.createPayPalOrder = functions.region('europe-west1').https.onCall(async (data, context) => {
  const { productId, variant, locale } = data;
  
  // Charger la configuration du produit depuis products.json
  // Créer la commande PayPal avec custom_id = productId
  // Retourner l'URL d'approbation
});
```

#### Option B : Utiliser un serveur Node.js séparé

Créez un serveur Express avec les routes `/api/create-stripe-session` et `/api/create-paypal-order`.

### Étape 4 : Mettre à jour les boutons de paiement

Remplacez les liens Ontraport par des appels aux fonctions JavaScript :

**Avant (Ontraport)** :
```html
<a href="https://espace.fluance.io/par/21jours/bdc" class="btn-primary">
  Démarrer le challenge
</a>
```

**Après (Stripe/PayPal)** :
```html
<button onclick="window.FluancePayment.redirectToStripe('21jours', null, 'fr')" class="btn-primary">
  Démarrer le challenge
</button>
```

## 📋 Fichiers à modifier

### Pages avec boutons de paiement

1. **`src/fr/cours-en-ligne/21-jours-mouvement.md`**
   - Remplacer les 3 liens `https://espace.fluance.io/par/21jours/bdc`
   - Par : `onclick="window.FluancePayment.redirectToStripe('21jours', null, 'fr')"`

2. **`src/fr/decouvrir-ma-pratique.md`**
   - Remplacer le lien mensuel : `https://espace.fluance.io/par/abo/bdc/mens`
   - Par : `onclick="window.FluancePayment.redirectToStripe('complet', 'mensuel', 'fr')"`
   - Remplacer le lien trimestriel : `https://espace.fluance.io/par/abo/bdc/tri`
   - Par : `onclick="window.FluancePayment.redirectToStripe('complet', 'trimestriel', 'fr')"`

3. **`src/en/cours-en-ligne/21-jours-mouvement.md`** (version anglaise)
   - Même chose avec `locale: 'en'`

4. **`src/en/discover-my-practice.md`** (version anglaise)
   - Même chose avec `locale: 'en'`

### Scripts à charger

Ajoutez dans `src/_includes/base.njk` (avant `</body>`) :

```html
<script src="/assets/js/payment.js"></script>
```

### Supprimer les scripts Ontraport

Supprimez tous les scripts Ontraport (`opf.js`) des pages :
- `src/fr/index.md`
- `src/fr/cours-en-ligne/5jours-inscription.md`
- `src/fr/a-propos/*.md`
- etc.

## ✅ Checklist

- [ ] Produits créés dans Stripe Dashboard avec les bons libellés
- [ ] Produits créés dans PayPal Dashboard avec les bons libellés
- [ ] `products.json` mis à jour avec les vrais Price IDs et Product IDs
- [ ] Routes API créées (Firebase Functions ou serveur séparé)
- [ ] `payment.js` chargé dans `base.njk`
- [ ] Boutons de paiement mis à jour dans toutes les pages
- [ ] Scripts Ontraport supprimés
- [ ] Webhooks Stripe/PayPal configurés vers Firebase Functions
- [ ] Test d'un paiement complet

## 🔗 Ressources

- [Stripe Checkout Sessions API](https://stripe.com/docs/api/checkout/sessions/create)
- [PayPal Orders API](https://developer.paypal.com/docs/api/orders/v2/)
- [Firebase Functions Callable](https://firebase.google.com/docs/functions/callable)

## 📝 Exemple complet

Voir `EXEMPLE_INTEGRATION_PAIEMENT.md` pour un exemple complet d'intégration.

