# Exemple complet : Intégration d'un bouton de paiement

Cet exemple montre comment remplacer un lien Ontraport par un bouton Stripe/PayPal.

## Avant (avec Ontraport)

```html
<a href="https://espace.fluance.io/par/21jours/bdc" class="btn-primary">
  Démarrer le challenge de 21 jours pour 19 CHF
</a>
```

## Après (avec Stripe/PayPal)

### Option 1 : Bouton Stripe uniquement

```html
<button 
  onclick="window.FluancePayment.redirectToStripe('21jours', null, 'fr')" 
  class="btn-primary">
  Démarrer le challenge de 21 jours pour 19 CHF
</button>
```

### Option 2 : Choix entre Stripe et PayPal

```html
<div class="flex flex-col gap-4">
  <button 
    onclick="window.FluancePayment.redirectToStripe('21jours', null, 'fr')" 
    class="btn-primary">
    Payer avec Stripe - 19 CHF
  </button>
  <button 
    onclick="window.FluancePayment.redirectToPayPal('21jours', null, 'fr')" 
    class="btn-secondary">
    Payer avec PayPal - 19 CHF
  </button>
</div>
```

## Exemple pour l'abonnement mensuel

```html
<button 
  onclick="window.FluancePayment.redirectToStripe('complet', 'mensuel', 'fr')" 
  class="btn-primary">
  S'abonner mensuellement - 30 CHF/mois
</button>
```

## Exemple pour l'abonnement trimestriel

```html
<button 
  onclick="window.FluancePayment.redirectToStripe('complet', 'trimestriel', 'fr')" 
  class="btn-primary">
  S'abonner trimestriellement - 75 CHF/trimestre
</button>
```

## Code backend nécessaire (Firebase Function)

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const products = require('../src/_data/products.json');

exports.createStripeSession = functions.region('europe-west1').https.onCall(async (data, context) => {
  const { productId, variant, locale } = data;
  
  // Charger la configuration du produit
  let productConfig;
  if (productId === '21jours') {
    productConfig = products['21jours'];
  } else if (productId === 'complet') {
    productConfig = products.complet[variant]; // 'mensuel' ou 'trimestriel'
  } else {
    throw new functions.https.HttpsError('invalid-argument', 'Produit invalide');
  }
  
  // Créer la session Stripe
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
    },
    locale: locale === 'fr' ? 'fr' : 'en',
  });
  
  return { url: session.url };
});
```

## Résumé des paramètres

| Produit | productId | variant | Montant |
|---------|-----------|---------|---------|
| Défi 21 jours | `"21jours"` | `null` | 19 CHF |
| Abonnement mensuel | `"complet"` | `"mensuel"` | 30 CHF |
| Abonnement trimestriel | `"complet"` | `"trimestriel"` | 75 CHF |

