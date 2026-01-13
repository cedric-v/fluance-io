# Analyse SEPA et TWINT pour les Abonnements

## 📊 Résumé de l'Analyse

### 1. SEPA Direct Debit pour les Abonnements

**✅ Compatible avec Stripe Subscriptions**

**Avantages :**
- Fonctionne avec les abonnements récurrents Stripe
- Méthode de paiement populaire en Europe
- Adapté pour les abonnements semestriels

**Limitations importantes :**
- ⚠️ **Devise : EUR uniquement** (pas CHF)
  - Nécessite une conversion CHF → EUR
  - Fluctuations de taux de change possibles
- ⚠️ **Délais de traitement : 5-14 jours ouvrables**
  - Les paiements ne sont pas instantanés
  - Peut affecter la trésorerie
- ⚠️ **Risques de rétrofacturation**
  - Les clients peuvent contester un prélèvement sans justification pendant **8 semaines**
  - Risque financier si le service a déjà été rendu
- ⚠️ **Limites de transaction**
  - Limite initiale : 10 000 EUR par paiement
  - Limite hebdomadaire : 10 000 EUR (peut augmenter avec le temps)

**Recommandation :**
- ✅ **OUI** pour les clients européens qui préfèrent cette méthode
- ⚠️ **À utiliser avec précaution** en raison des risques de rétrofacturation
- 💡 **Alternative** : Proposer SEPA uniquement pour les montants élevés ou sur demande

---

### 2. TWINT pour les Abonnements

**❌ NON adapté pour les abonnements récurrents**

**Raisons :**
- TWINT est conçu pour les **paiements uniques instantanés**
- TWINT ne supporte **pas les abonnements récurrents automatiques**
- Chaque paiement nécessite une action manuelle du client
- Pas de prélèvement automatique possible avec TWINT

**Recommandation :**
- ❌ **Retirer TWINT** pour le Pass Semestriel (abonnement récurrent)
- ✅ **Conserver TWINT** pour les paiements uniques (cours à la carte, Flow Pass)

---

## 🔧 Modifications Nécessaires

### Problème Actuel

Le Pass Semestriel est actuellement traité comme un **PaymentIntent** (paiement unique) alors qu'il devrait être une **Subscription Stripe** pour permettre les renouvellements automatiques.

**Code actuel** (`functions/services/bookingService.js` ligne 328-358) :
- Crée un `PaymentIntent` pour tous les paiements
- Inclut TWINT dans les méthodes de paiement
- Ne crée pas de Subscription Stripe pour le Pass Semestriel

**Webhook actuel** (`functions/index.js` ligne 1578-1615) :
- Attend une `Subscription` Stripe pour les renouvellements
- Gère `invoice.paid` pour les abonnements

**Incohérence :** Le code crée un PaymentIntent mais le webhook attend une Subscription.

---

## ✅ Solution Proposée

### 1. Créer une Subscription Stripe pour le Pass Semestriel

**Modifications dans `functions/services/bookingService.js` :**

```javascript
// Pour le Pass Semestriel, créer une Subscription au lieu d'un PaymentIntent
if (pricingOption === 'semester_pass' && amount > 0 && stripe) {
  // 1. Créer ou récupérer le customer Stripe
  let customer;
  const customers = await stripe.customers.list({
    email: userData.email.toLowerCase(),
    limit: 1,
  });
  
  if (customers.data.length > 0) {
    customer = customers.data[0];
  } else {
    customer = await stripe.customers.create({
      email: userData.email.toLowerCase(),
      name: `${userData.firstName} ${userData.lastName}`,
      metadata: {
        bookingId: bookingId,
      },
    });
  }

  // 2. Créer le Price ID Stripe pour le Pass Semestriel (à créer dans Stripe Dashboard)
  // Note: Il faut créer un Product et Price récurrent dans Stripe
  const semesterPassPriceId = process.env.STRIPE_PRICE_ID_SEMESTER_PASS || 'price_XXXXX';

  // 3. Créer la Subscription
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{
      price: semesterPassPriceId,
    }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      payment_method_types: ['card'], // Carte uniquement (pas TWINT)
      // SEPA optionnel (décommenter si activé)
      // payment_method_types: ['card', 'sepa_debit'],
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      bookingId: bookingId,
      courseId: courseId,
      email: userData.email,
      type: 'semester_pass',
      partnerCode: partnerCode || '',
    },
  });

  // 4. Stocker les informations de la subscription
  bookingData.stripeSubscriptionId = subscription.id;
  bookingData.stripeCustomerId = customer.id;
  bookingData.stripeClientSecret = subscription.latest_invoice.payment_intent?.client_secret;
  bookingData.stripePaymentIntentId = subscription.latest_invoice.payment_intent?.id;
} else {
  // Pour les autres options (single, flow_pass), créer un PaymentIntent normal
  // ... code existant ...
}
```

### 2. Retirer TWINT pour le Pass Semestriel

**Modifications dans `src/assets/js/booking.js` :**

- Afficher uniquement "Carte bancaire" (et optionnellement SEPA) pour le Pass Semestriel
- Conserver "Carte / TWINT" pour les autres options

### 3. Ajouter SEPA comme option (optionnel)

Si vous souhaitez proposer SEPA pour les abonnements :
- Créer un Price Stripe en **EUR** pour le Pass Semestriel
- Ajouter `'sepa_debit'` dans `payment_method_types` de la Subscription
- Gérer la conversion CHF → EUR (340 CHF ≈ 350 EUR)

---

## 📝 Étapes d'Implémentation

### Étape 1 : Créer le Produit Stripe pour le Pass Semestriel

```bash
# Créer le produit
stripe products create \
  --name="Pass Semestriel Fluance" \
  --description="Accès illimité aux cours en présentiel pendant 6 mois (renouvellement automatique)"

# Créer le prix récurrent (tous les 6 mois)
stripe prices create \
  --product=prod_XXXXX \
  --currency=chf \
  --unit-amount=34000 \
  --recurring.interval=month \
  --recurring.interval-count=6
```

**Notez le Price ID** (ex: `price_XXXXX`) et configurez-le dans Firebase Secrets :
```bash
echo -n "price_XXXXX" | firebase functions:secrets:set STRIPE_PRICE_ID_SEMESTER_PASS
```

### Étape 2 : Modifier le Code Backend

1. Modifier `functions/services/bookingService.js` pour créer une Subscription pour le Pass Semestriel
2. Retirer TWINT des méthodes de paiement pour les abonnements

### Étape 3 : Modifier le Code Frontend

1. Modifier `src/assets/js/booking.js` pour afficher les bonnes options de paiement selon le type de pass
2. Retirer TWINT pour le Pass Semestriel

### Étape 4 : Tester

1. Tester l'achat d'un Pass Semestriel
2. Vérifier que la Subscription est créée dans Stripe
3. Vérifier que le renouvellement fonctionne après 6 mois

---

## ⚠️ Points d'Attention

1. **Conversion de devise SEPA** : Si vous activez SEPA, vous devrez gérer la conversion CHF → EUR
2. **Risques de rétrofacturation SEPA** : Mettre en place une gestion des contestations
3. **Migration des Pass Semestriel existants** : Les Pass Semestriel déjà achetés avec PaymentIntent ne seront pas renouvelés automatiquement

---

## 📚 Ressources

- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe SEPA Direct Debit](https://stripe.com/docs/payments/sepa-debit)
- [Stripe Payment Methods for Subscriptions](https://stripe.com/docs/billing/subscriptions/payment-methods)
