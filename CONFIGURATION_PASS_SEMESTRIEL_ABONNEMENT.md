# Configuration du Pass Semestriel - Abonnement Récurrent

## 📋 Résumé des Modifications

Le Pass Semestriel a été modifié pour utiliser une **Subscription Stripe** au lieu d'un **PaymentIntent**, permettant ainsi les renouvellements automatiques tous les 6 mois.

### Changements Principaux

1. ✅ **Subscription Stripe** : Le Pass Semestriel crée maintenant une Subscription Stripe pour les renouvellements automatiques
2. ✅ **TWINT retiré** : TWINT ne supporte pas les abonnements récurrents, donc retiré pour le Pass Semestriel
3. ✅ **Carte bancaire uniquement** : Pour le Pass Semestriel, seule la carte bancaire est proposée (abonnement récurrent)
4. ✅ **SEPA optionnel** : SEPA peut être activé pour les abonnements (nécessite un Price en EUR)

---

## 🔧 Configuration Requise

### 1. Créer le Produit et Price Stripe

Le Pass Semestriel nécessite un **Price récurrent** dans Stripe.

#### Via Stripe CLI

```bash
# 1. Créer le produit
stripe products create \
  --name="Pass Semestriel Fluance" \
  --description="Accès illimité aux cours en présentiel pendant 6 mois (renouvellement automatique)"

# Notez le Product ID retourné (ex: prod_XXXXX)

# 2. Créer le prix récurrent (tous les 6 mois)
stripe prices create \
  --product=prod_XXXXX \
  --currency=chf \
  --unit-amount=34000 \
  --recurring.interval=month \
  --recurring.interval-count=6

# Notez le Price ID retourné (ex: price_XXXXX)
```

#### Via Stripe Dashboard

1. Allez sur [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Cliquez sur **"+ Add product"**
3. Configurez :
   - **Name** : `Pass Semestriel Fluance`
   - **Description** : `Accès illimité aux cours en présentiel pendant 6 mois (renouvellement automatique)`
   - **Pricing** :
     - **Price** : `340.00`
     - **Currency** : `CHF`
     - **Billing period** : `Recurring`
     - **Recurring interval** : `Every 6 months`
4. Cliquez sur **"Save product"**
5. **Notez le Price ID** (commence par `price_`)

### 2. Configurer le Secret Firebase

```bash
# Configurer le Price ID dans Firebase Secrets
echo -n "price_XXXXX" | firebase functions:secrets:set STRIPE_PRICE_ID_SEMESTER_PASS

# Vérifier que le secret est bien configuré
firebase functions:secrets:access STRIPE_PRICE_ID_SEMESTER_PASS
```

**⚠️ Important** : Remplacez `price_XXXXX` par le vrai Price ID créé dans Stripe.

### 3. Redéployer les Functions

```bash
cd functions
npm run deploy
```

---

## 🔄 Fonctionnement

### Achat d'un Pass Semestriel

1. L'utilisateur sélectionne "Pass Semestriel" sur le formulaire de réservation
2. Le système crée automatiquement :
   - Un **Customer Stripe** (ou récupère l'existant)
   - Une **Subscription Stripe** avec le Price ID configuré
3. L'utilisateur paie via Stripe Elements (carte bancaire uniquement)
4. Le webhook `invoice.paid` crée le Pass Semestriel dans Firestore
5. Le Pass est valable 6 mois

### Renouvellement Automatique

1. Après 6 mois, Stripe génère automatiquement une nouvelle facture
2. Le webhook `invoice.paid` détecte le renouvellement
3. Le Pass Semestriel est automatiquement renouvelé pour 6 mois supplémentaires
4. L'utilisateur n'a rien à faire

---

## 💳 Options de Paiement

### Pass Semestriel (Abonnement)

- ✅ **Carte bancaire** : Seule méthode disponible (abonnement récurrent)
- ❌ **TWINT** : Non disponible (ne supporte pas les abonnements récurrents)
- ⚠️ **SEPA** : Optionnel (nécessite un Price en EUR et activation dans le code)

### Autres Options (Paiements Uniques)

- ✅ **Carte bancaire** : Disponible
- ✅ **TWINT** : Disponible
- ✅ **Espèces sur place** : Disponible

---

## 🔌 Activation de SEPA (Optionnel)

Si vous souhaitez proposer SEPA pour les abonnements :

### 1. Créer un Price en EUR

```bash
# Créer un Price en EUR pour le Pass Semestriel
# Note: 340 CHF ≈ 350 EUR (vérifier le taux de change actuel)
stripe prices create \
  --product=prod_XXXXX \
  --currency=eur \
  --unit-amount=35000 \
  --recurring.interval=month \
  --recurring.interval-count=6
```

### 2. Modifier le Code

Dans `functions/services/bookingService.js`, ligne 361-365, décommenter :

```javascript
const paymentMethodTypes = ['card'];
if (paymentMethod === PAYMENT_METHODS.SEPA) {
  paymentMethodTypes.push('sepa_debit');
}
```

### 3. Gérer la Conversion CHF → EUR

Vous devrez gérer la conversion de devise et proposer les deux options (CHF ou EUR) à l'utilisateur.

**⚠️ Limitations SEPA :**
- Délais de traitement : 5-14 jours ouvrables
- Risques de rétrofacturation (clients peuvent contester pendant 8 semaines)
- Limites de transaction : 10 000 EUR par paiement initialement

---

## 🧪 Tests

### Tester l'Achat d'un Pass Semestriel

1. Aller sur la page de réservation
2. Sélectionner "Pass Semestriel"
3. Vérifier que seule "Carte bancaire" est proposée (pas TWINT)
4. Compléter le formulaire et procéder au paiement
5. Vérifier dans Stripe Dashboard :
   - Un Customer est créé
   - Une Subscription est créée
   - Le premier paiement est traité
6. Vérifier dans Firestore :
   - Un document est créé dans `userPasses` avec `stripeSubscriptionId`

### Tester le Renouvellement

1. Dans Stripe Dashboard, aller sur la Subscription
2. Cliquer sur "..." → "Update subscription" → "Advance invoice"
3. Cela génère immédiatement une nouvelle facture
4. Vérifier que le webhook `invoice.paid` renouvelle le Pass

---

## 📝 Notes Importantes

1. **Migration des Pass Existants** : Les Pass Semestriel achetés avant cette modification (avec PaymentIntent) ne seront **pas** renouvelés automatiquement. Seuls les nouveaux Pass Semestriel utilisent les Subscriptions.

2. **Annulation** : Les utilisateurs peuvent annuler leur abonnement via leur compte Stripe ou en contactant le support. Le webhook `customer.subscription.deleted` gère l'annulation.

3. **Codes Partenaires** : Les codes partenaires fonctionnent toujours avec le Pass Semestriel, mais la remise s'applique uniquement au premier paiement (voir `CODES_PARTENAIRES_ABONNEMENTS.md`).

---

## 🔗 Ressources

- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Payment Methods for Subscriptions](https://stripe.com/docs/billing/subscriptions/payment-methods)
- [Stripe SEPA Direct Debit](https://stripe.com/docs/payments/sepa-debit)
- [Documentation Analyse SEPA/TWINT](./ANALYSE_SEPA_TWINT_ABONNEMENTS.md)
