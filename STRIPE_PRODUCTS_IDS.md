# Identifiants Stripe - Produits Fluance

## 📋 Référence rapide des Product IDs et Price IDs

### Produit 1 : "21jours" (Défi 21 jours)

- **Nom** : `Fluance : 21 jours pour remettre du mouvement`
- **Description** : `Parcours de 21 mini-séries de pratiques Fluance, simples et libératrices`
- **Product ID** : `prod_TakXdTP0UcMy9J`
- **Price ID** : `price_1SdZ2X2Esx6PN6y1wnkrLfSu`
- **Montant** : 19.00 CHF
- **Type** : Paiement unique (one-time)
- **Identifiant interne** : `21jours`

**Code d'exemple :**
```javascript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{ price: 'price_1SdZ2X2Esx6PN6y1wnkrLfSu', quantity: 1 }],
  mode: 'payment',
  metadata: {
    system: 'firebase',
    product: '21jours'
  },
});
```

---

### Produit 2 : "complet" - Mensuel

- **Nom** : `Fluance en ligne - mensuel`
- **Description** : `Accès hebdomadaire à une nouvelle mini-série de pratiques + la communauté`
- **Product ID** : `prod_TakZyjf0f1F5Ej`
- **Price ID** : `price_1SdZ4p2Esx6PN6y1bzRGQSC5`
- **Montant** : 30.00 CHF/mois
- **Type** : Abonnement récurrent mensuel
- **Identifiant interne** : `complet`

**Code d'exemple :**
```javascript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{ price: 'price_1SdZ4p2Esx6PN6y1bzRGQSC5', quantity: 1 }],
  mode: 'subscription',
  metadata: {
    system: 'firebase',
    product: 'complet'
  },
});
```

---

### Produit 3 : "complet" - Trimestriel

- **Nom** : `Fluance en ligne - trimestriel`
- **Description** : `Accès hebdomadaire à une nouvelle mini-série de pratiques + la communauté`
- **Product ID** : `prod_TakbVXK9sDba9F`
- **Price ID** : `price_1SdZ6E2Esx6PN6y11qme0Rde`
- **Montant** : 75.00 CHF/trimestre
- **Type** : Abonnement récurrent trimestriel (tous les 3 mois)
- **Identifiant interne** : `complet`

**Code d'exemple :**
```javascript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{ price: 'price_1SdZ6E2Esx6PN6y11qme0Rde', quantity: 1 }],
  mode: 'subscription',
  metadata: {
    system: 'firebase',
    product: 'complet'
  },
});
```

---

## 🔗 Tableau de correspondance

| Identifiant interne | Nom Stripe | Product ID | Price ID | Montant | Type |
|---------------------|------------|------------|----------|---------|------|
| `21jours` | Fluance : 21 jours pour remettre du mouvement | `prod_TakXdTP0UcMy9J` | `price_1SdZ2X2Esx6PN6y1wnkrLfSu` | 19.00 CHF | One-time |
| `complet` | Fluance en ligne - mensuel | `prod_TakZyjf0f1F5Ej` | `price_1SdZ4p2Esx6PN6y1bzRGQSC5` | 30.00 CHF/mois | Subscription (monthly) |
| `complet` | Fluance en ligne - trimestriel | `prod_TakbVXK9sDba9F` | `price_1SdZ6E2Esx6PN6y11qme0Rde` | 75.00 CHF/trimestre | Subscription (every 3 months) |
| `complet` (variant `ma_pratique_mensuel`) | Fluance Ma pratique - mensuel | auto (`fluance_complet_ma_pratique_mensuel`) | auto-provisionné | 14.90 CHF/mois | Subscription (monthly) |
| `complet` (variant `ma_pratique_annuel`) | Fluance Ma pratique - annuel | auto (`fluance_complet_ma_pratique_annuel`) | auto-provisionné | 119.00 CHF/an | Subscription (yearly) |

### Offres « Ma pratique » (freemium)

Les deux offres de la landing `/decouvrir-ma-pratique/` utilisent le **même identifiant interne
`complet`** (accès à l'ensemble des pratiques) avec les variants `ma_pratique_mensuel` et
`ma_pratique_annuel`. Les prix sont **créés automatiquement dans Stripe au premier checkout**
via `functions/services/stripePrices.js` (comme les autres produits récents).

Pour figer un `priceId` existant, définir les secrets Firebase :
`STRIPE_PRICE_ID_COMPLET_MA_PRATIQUE_MENSUEL` et `STRIPE_PRICE_ID_COMPLET_MA_PRATIQUE_ANNUEL`.

Les abonnements historiques (30 / 75 CHF) restent actifs et coexistent avec les nouvelles offres.

---

## ⚠️ Métadonnées obligatoires

Lors de la création d'une session Checkout Stripe, vous DEVEZ passer ces métadonnées :

```javascript
metadata: {
  system: 'firebase',    // ⚠️ OBLIGATOIRE : Identifie le système
  product: '21jours'     // ⚠️ OBLIGATOIRE : '21jours' ou 'complet'
}
```

**Sans ces métadonnées, le webhook ignorera le paiement !**

---

## 📝 Notes

- Les **Price IDs** sont utilisés dans `line_items[].price` lors de la création des sessions Checkout
- Les **Product IDs** sont utilisés pour référence dans le dashboard Stripe
- Les deux variantes "complet" (mensuel et trimestriel) utilisent le même identifiant interne `complet`
- Le webhook détermine le produit via `metadata.product`, pas via le Price ID

---

## 🔗 Ressources

- [Stripe Dashboard - Products](https://dashboard.stripe.com/products)
- [Stripe Checkout Sessions API](https://stripe.com/docs/api/checkout/sessions/create)
- Guide complet : `CONFIGURATION_WEBHOOKS_COMPLETE.md`
