# Guide : Configurer les produits dans Stripe et PayPal

Ce guide vous explique où et comment configurer les produits dans Stripe et PayPal, et comment les relier à vos identifiants internes (`"21jours"` et `"complet"`).

## ⚠️ Note importante : Intégration via Ontraport

Si vos paiements passent par **Ontraport** (`espace.fluance.io`), vous devrez configurer les produits dans Ontraport, qui ensuite redirige vers Stripe/PayPal. Dans ce cas :

1. **Configurez les produits dans Ontraport** avec les bons montants
2. **Configurez les webhooks Stripe/PayPal** pour pointer vers vos Firebase Functions
3. **Passez les métadonnées** (`metadata.product` pour Stripe, `custom_id` pour PayPal) depuis Ontraport lors de la création des sessions/commandes

**Si vous utilisez directement Stripe/PayPal** (sans Ontraport), suivez ce guide complet ci-dessous.

---

## 🟣 Configuration via Ontraport (si applicable)

Si vos boutons de paiement pointent vers `espace.fluance.io` (Ontraport), voici comment configurer :

### Dans Ontraport Dashboard

1. Allez sur votre dashboard Ontraport
2. Créez les produits avec les montants suivants :
   - **"21jours"** : 19 CHF
   - **"complet" mensuel** : 30 CHF/mois
   - **"complet" trimestriel** : 75 CHF/trimestre

### Configuration des webhooks

Dans Ontraport, configurez les webhooks pour qu'ils envoient les métadonnées vers Stripe/PayPal :

- **Stripe** : Passez `metadata.product` avec la valeur `"21jours"` ou `"complet"`
- **PayPal** : Passez `custom_id` avec la valeur `"21jours"` ou `"complet"`

### Vérification

Les webhooks Stripe/PayPal doivent pointer vers vos Firebase Functions :
- Stripe : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe`
- PayPal : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal`

---

## Configuration directe Stripe/PayPal

Si vous utilisez directement Stripe/PayPal (sans Ontraport), suivez les sections ci-dessous.

## 📋 Vue d'ensemble

Vous avez deux endroits où configurer :

1. **Dans les dashboards Stripe/PayPal** : Créer les produits avec leurs libellés (nom, description, prix)
2. **Dans votre code** : Passer les métadonnées (`metadata.product` pour Stripe, `custom_id` pour PayPal) lors de la création des sessions/commandes

## 🔵 Configuration dans Stripe

### Étape 1 : Créer les produits dans Stripe Dashboard

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com/)
2. Allez dans **Products** (Produits) dans le menu de gauche
3. Cliquez sur **+ Add product** (Ajouter un produit)

#### Produit 1 : "21jours"
- **Name** : `Défi 21 jours` (ou le libellé de votre choix)
- **Description** : Description du défi 21 jours
- **Pricing** : 
  - **Price** : `19.00`
  - **Currency** : `CHF`
  - **Billing period** : `One time` (paiement unique)
- Cliquez sur **Save product**

#### Produit 2 : "complet" (mensuel)
- **Name** : `Approche Fluance Complète - Mensuel` (ou le libellé de votre choix)
- **Description** : Description de l'abonnement mensuel
- **Pricing** :
  - **Price** : `30.00`
  - **Currency** : `CHF`
  - **Billing period** : `Recurring` (récurrent)
  - **Recurring interval** : `Monthly` (mensuel)
- Cliquez sur **Save product**

#### Produit 3 : "complet" (trimestriel)
- **Name** : `Approche Fluance Complète - Trimestriel` (ou le libellé de votre choix)
- **Description** : Description de l'abonnement trimestriel
- **Pricing** :
  - **Price** : `75.00`
  - **Currency** : `CHF`
  - **Billing period** : `Recurring` (récurrent)
  - **Recurring interval** : `Every 3 months` (tous les 3 mois)
- Cliquez sur **Save product**

### Étape 2 : Créer une session Checkout avec métadonnées

Quand vous créez une session Checkout dans votre code, ajoutez les métadonnées :

```javascript
// Exemple : Créer une session pour "21jours"
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [
    {
      price: 'price_xxxxx', // ID du prix créé dans Stripe Dashboard
      quantity: 1,
    },
  ],
  mode: 'payment', // ou 'subscription' pour les abonnements
  success_url: 'https://fluance.io/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://fluance.io/cancel',
  metadata: {
    product: '21jours' // ⚠️ IMPORTANT : Identifiant interne
  },
});
```

**Où faire ça ?** Dans votre code backend qui gère les paiements Stripe (probablement une API route ou une fonction serveur).

### Étape 3 : Vérifier dans Stripe Dashboard

1. Allez dans **Developers** > **Webhooks**
2. Configurez votre webhook pour pointer vers : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe`
3. Sélectionnez les événements : `checkout.session.completed` et `payment_intent.succeeded`

## 🟠 Configuration dans PayPal

### Étape 1 : Créer les produits dans PayPal Dashboard

1. Allez sur [PayPal Dashboard](https://www.paypal.com/businessmanage/products)
2. Allez dans **Products** (Produits) dans le menu
3. Cliquez sur **Create product** (Créer un produit)

#### Produit 1 : "21jours"
- **Product name** : `Défi 21 jours` (ou le libellé de votre choix)
- **Description** : Description du défi 21 jours
- **Product type** : `One-time payment` (paiement unique)
- **Price** : `19.00 CHF`
- Cliquez sur **Save**

#### Produit 2 : "complet" (mensuel)
- **Product name** : `Approche Fluance Complète - Mensuel` (ou le libellé de votre choix)
- **Description** : Description de l'abonnement mensuel
- **Product type** : `Subscription` (abonnement)
- **Billing cycle** : `Monthly` (mensuel)
- **Price** : `30.00 CHF`
- Cliquez sur **Save**

#### Produit 3 : "complet" (trimestriel)
- **Product name** : `Approche Fluance Complète - Trimestriel` (ou le libellé de votre choix)
- **Description** : Description de l'abonnement trimestriel
- **Product type** : `Subscription` (abonnement)
- **Billing cycle** : `Every 3 months` (tous les 3 mois)
- **Price** : `75.00 CHF`
- Cliquez sur **Save**

### Étape 2 : Créer une commande avec custom_id

Quand vous créez une commande PayPal dans votre code, utilisez `custom_id` :

```javascript
// Exemple : Créer une commande pour "21jours"
const order = await paypal.orders.create({
  intent: 'CAPTURE',
  purchase_units: [{
    amount: {
      currency_code: 'CHF',
      value: '19.00'
    },
    custom_id: '21jours' // ⚠️ IMPORTANT : Identifiant interne
  }]
});
```

**Où faire ça ?** Dans votre code backend qui gère les paiements PayPal (probablement une API route ou une fonction serveur).

### Étape 3 : Vérifier dans PayPal Dashboard

1. Allez dans **Developers** > **Webhooks**
2. Configurez votre webhook pour pointer vers : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal`
3. Sélectionnez les événements : `PAYMENT.CAPTURE.COMPLETED` et `CHECKOUT.ORDER.APPROVED`

## 🔗 Relier les libellés aux identifiants internes

### Tableau de correspondance

| Identifiant interne | Libellé Stripe | Libellé PayPal | Montant |
|---------------------|----------------|----------------|---------|
| `"21jours"` | Défi 21 jours | Défi 21 jours | 19 CHF |
| `"complet"` | Approche Fluance Complète - Mensuel | Approche Fluance Complète - Mensuel | 30 CHF |
| `"complet"` | Approche Fluance Complète - Trimestriel | Approche Fluance Complète - Trimestriel | 75 CHF |

### Comment ça fonctionne

1. **Dans les dashboards** : Vous créez les produits avec leurs libellés (ce que voit le client)
2. **Dans votre code** : Vous passez l'identifiant interne (`"21jours"` ou `"complet"`) dans les métadonnées
3. **Dans le webhook** : Le système utilise l'identifiant interne pour créer le token avec le bon produit

## 📝 Exemple complet : Bouton de paiement sur votre site

### HTML

```html
<!-- Bouton pour "21jours" -->
<button onclick="createStripeSession('21jours', 'price_xxxxx')">
  Payer 19 CHF - Défi 21 jours
</button>

<!-- Bouton pour "complet" mensuel -->
<button onclick="createStripeSession('complet', 'price_yyyyy')">
  Payer 30 CHF/mois - Approche Complète
</button>
```

### JavaScript (côté client)

```javascript
async function createStripeSession(productId, priceId) {
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product: productId, // "21jours" ou "complet"
      priceId: priceId,    // ID du prix Stripe
    }),
  });
  
  const session = await response.json();
  // Rediriger vers Stripe Checkout
  window.location.href = session.url;
}
```

### Backend (API route)

```javascript
// Exemple : /api/create-checkout-session
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/create-checkout-session', async (req, res) => {
  const { product, priceId } = req.body; // product = "21jours" ou "complet"
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'payment', // ou 'subscription'
    success_url: 'https://fluance.io/success',
    cancel_url: 'https://fluance.io/cancel',
    metadata: {
      product: product // ⚠️ Passe l'identifiant interne
    },
  });
  
  res.json({ url: session.url });
});
```

## ✅ Checklist de configuration

### Stripe
- [ ] Produits créés dans Stripe Dashboard avec les bons prix
- [ ] Webhook configuré vers `webhookStripe`
- [ ] Code backend passe `metadata.product` lors de la création des sessions
- [ ] Test d'un paiement et vérification que le token est créé avec le bon produit

### PayPal
- [ ] Produits créés dans PayPal Dashboard avec les bons prix
- [ ] Webhook configuré vers `webhookPayPal`
- [ ] Code backend passe `custom_id` lors de la création des commandes
- [ ] Test d'un paiement et vérification que le token est créé avec le bon produit

## 🆘 Dépannage

### Le produit n'est pas correctement identifié

1. **Vérifiez les métadonnées** : Assurez-vous que `metadata.product` (Stripe) ou `custom_id` (PayPal) est bien passé
2. **Vérifiez les logs** : Consultez les logs Firebase Functions pour voir quel produit est reçu
3. **Testez avec un montant** : Si les métadonnées ne sont pas passées, le système utilisera `determineProductFromAmount()`

### Le webhook ne reçoit pas les métadonnées

- **Stripe** : Vérifiez que vous passez bien `metadata` dans `checkout.sessions.create()`
- **PayPal** : Vérifiez que vous passez bien `custom_id` dans `purchase_units[0]`

## 📚 Ressources

- [Stripe Checkout Sessions API](https://stripe.com/docs/api/checkout/sessions/create)
- [PayPal Orders API](https://developer.paypal.com/docs/api/orders/v2/)
- [Stripe Metadata](https://stripe.com/docs/api/metadata)
- [PayPal custom_id](https://developer.paypal.com/docs/api/orders/v2/#definition-purchase_unit)

