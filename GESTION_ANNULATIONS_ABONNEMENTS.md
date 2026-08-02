# Gestion des annulations d'abonnement et échecs de paiement

## 📋 Vue d'ensemble

Les webhooks Stripe et PayPal gèrent les annulations et échecs de paiement :
- ✅ **Stripe** : Annulations `complet` → Retire l'accès dans Firestore ; Pass Semestriel → pass annulé
- ✅ **PayPal** : Annulations `complet` → Retire l'accès dans Firestore
- ✅ **Stripe** : Annulations produits cedricv.com (RDV Clarté, Focus SOS, Site Vitrine) → Log, pas d'espace membre à gérer

## 🔵 Événements Stripe gérés

### 1. Annulation d'abonnement : `customer.subscription.deleted`

**Quand** : Un client annule son abonnement "complet"

**Action** :
1. Vérifie que `metadata.system === 'firebase'`
2. Vérifie que `metadata.product === 'complet'`
3. Retire le produit "complet" du tableau `products` dans Firestore
4. L'utilisateur perd immédiatement l'accès au contenu "complet"

**Configuration requise** :
- Les métadonnées doivent être passées lors de la création de l'abonnement :
  ```javascript
  metadata: {
    system: 'firebase',
    product: 'complet'
  }
  ```

### 2. Échec de paiement : `invoice.payment_failed`

**Quand** : Un paiement d'abonnement échoue

**Action** :
1. Log de l'événement
2. L'accès est conservé (pas de retrait immédiat)
3. L'accès sera retiré seulement si l'abonnement est finalement annulé

**TODO** : Envoyer un email de notification au client pour l'informer de l'échec de paiement

## 🟠 Événements PayPal gérés

### 1. Annulation d'abonnement : `BILLING.SUBSCRIPTION.CANCELLED`

**Quand** : Un client annule son abonnement "complet"

**Action** :
1. Vérifie que `custom_id` commence par `'firebase_'`
2. Vérifie que `custom_id` contient `'complet'`
3. Retire le produit "complet" du tableau `products` dans Firestore
4. L'utilisateur perd immédiatement l'accès au contenu "complet"

### 2. Suspension d'abonnement : `BILLING.SUBSCRIPTION.SUSPENDED`

**Quand** : Un abonnement est suspendu (par exemple, après plusieurs échecs de paiement)

**Action** : Même traitement que l'annulation → Retire l'accès

### 3. Échec de paiement : `BILLING.SUBSCRIPTION.PAYMENT.FAILED`

**Quand** : Un paiement d'abonnement échoue

**Action** :
1. Log de l'événement
2. L'accès est conservé (pas de retrait immédiat)
3. L'accès sera retiré seulement si l'abonnement est finalement annulé ou suspendu

**TODO** : Envoyer un email de notification au client pour l'informer de l'échec de paiement

### 4. Paiement refusé : `PAYMENT.SALE.DENIED`

**Quand** : Un paiement est refusé

**Action** : Même traitement que l'échec de paiement → Log uniquement

## 🟣 Abonnements Stripe (produits en ligne et pass)

### Produits concernés

- **RDV Clarté** (abonnement 69 CHF/mois) — `product: 'rdv-clarte'`, `variant: 'abonnement'`
- **Focus SOS** (3x 100 CHF/mois) — `product: 'focus-sos'`, `variant: '3x'`
- **Site Vitrine** (5x 200 CHF/mois) — `product: 'site-vitrine'`, `variant: '5x'`
- **Programme Complet** (mensuel/trimestriel) — `product: 'complet'`
- **Pass Semestriel** (340 CHF / 6 mois) — `type: 'semester_pass'`

> ⚠️ **Abonnements Mollie encore actifs (transition)** : les abonnements créés avant le
> retour à Stripe (ex: site-vitrine 5x en cours de paiement) continuent d'être prélevés par
> Mollie. Ils sont gérés depuis le dashboard Mollie (https://my.mollie.com/dashboard/) et
> leur comptabilité passe par les webhooks transitoires `webhookMollie`/`processMolliePayment`
> (section « TRANSITION MOLLIE » de `functions/index.js`).

### Fonctionnement

1. Les abonnements sont créés **directement** via Stripe Checkout (`mode: 'subscription'`)
2. Stripe gère seul les prélèvements suivants
3. Le webhook `invoice.paid` gère la comptabilité Bexio et les échéances limitées
4. Les abonnements à durée limitée (Focus SOS 3x, Site Vitrine 5x) sont **automatiquement annulés** après le N-ième paiement (`cancel_at_period_end: true`) — compteur stocké dans Firestore (`subscriptionPayments`)

### Annulation depuis le dashboard Stripe

1. https://dashboard.stripe.com/ → **Subscriptions**
2. Chercher l'abonnement par email ou ID (`sub_xxxxx`)
3. Cliquer sur l'abonnement → **Cancel**

### Annulation par le client via le Customer Portal

Le client peut gérer lui-même son abonnement via le portail Stripe :
https://billing.stripe.com/p/login/4gM3coe0tgPp3Qcd608k800

### Échéances limitées (Focus SOS 3x, Site Vitrine 5x)

Le webhook `invoice.paid` compte les paiements dans la collection Firestore `subscriptionPayments`
(document par `subscriptionId`). Dès que le compteur atteint le maximum (3 ou 5),
l'abonnement est marqué pour annulation automatique — aucune action manuelle requise.

## 🔧 Fonction `removeProductFromUser`

Cette fonction retire un produit du tableau `products` d'un utilisateur dans Firestore :

```javascript
async function removeProductFromUser(email, productName)
```

**Paramètres** :
- `email` : Email de l'utilisateur
- `productName` : Nom du produit à retirer (`'complet'` ou `'21jours'`)

**Action** :
1. Récupère le document utilisateur dans Firestore
2. Filtre le produit du tableau `products`
3. Met à jour le document utilisateur

**Résultat** :
- L'utilisateur perd immédiatement l'accès au produit dans l'espace membre
- Le produit n'apparaît plus dans l'onglet correspondant

## ⚙️ Configuration des webhooks

### Stripe

Dans Stripe Dashboard → Webhooks, ajoutez ces événements :
- ✅ `checkout.session.completed` (paiement réussi — produits et abonnements)
- ✅ `payment_intent.succeeded` (paiement de réservation présentiel)
- ✅ `invoice.paid` (renouvellements + échéances limitées + Pass Semestriel)
- ✅ `customer.subscription.deleted` (annulation)
- ✅ `invoice.payment_failed` (échec de paiement)

### PayPal

Dans PayPal Dashboard → Webhooks, ajoutez ces événements :
- ✅ `BILLING.SUBSCRIPTION.CANCELLED` (annulation)
- ✅ `BILLING.SUBSCRIPTION.SUSPENDED` (suspension)
- ✅ `BILLING.SUBSCRIPTION.PAYMENT.FAILED` (échec de paiement)
- ✅ `PAYMENT.SALE.DENIED` (paiement refusé)

## 📝 Notes importantes

1. **Métadonnées obligatoires** : Pour que les annulations soient traitées, les métadonnées doivent être présentes dans les abonnements Stripe (`metadata.system` et `metadata.product`) et dans les commandes PayPal (`custom_id`).

2. **Produit "21jours"** : Les annulations ne concernent que le produit "complet" (abonnement). Le produit "21jours" est un paiement unique et ne peut pas être annulé.

3. **Échecs de paiement** : Les échecs de paiement ne retirent pas immédiatement l'accès. L'accès sera retiré seulement si l'abonnement est finalement annulé ou suspendu.

4. **Email de notification** : Actuellement, aucun email n'est envoyé en cas d'échec de paiement. C'est une amélioration à prévoir.

5. **RDV Clarté** : Pas d'espace membre. L'annulation via Stripe (dashboard ou Customer Portal) suffit à stopper les prélèvements. Aucune action supplémentaire dans Firestore n'est nécessaire.

6. **Focus SOS / Site Vitrine** : Abonnements à durée limitée (3x / 5x). L'annulation est **automatique** après le dernier paiement (compteur `subscriptionPayments` dans Firestore). Une annulation manuelle n'est nécessaire que pour arrêter avant la fin.

7. **Pass Semestriel** : `customer.subscription.deleted` annule le pass (`status: 'cancelled'`) via `passService.cancelSemesterPass`.

## 🧪 Test

Pour tester les annulations :

1. **Stripe** :
   - Créez un abonnement de test
   - Annulez-le dans Stripe Dashboard
   - Vérifiez dans Firestore que le produit "complet" a été retiré du tableau `products`

2. **PayPal** :
   - Créez un abonnement de test
   - Annulez-le dans PayPal Dashboard
   - Vérifiez dans Firestore que le produit "complet" a été retiré du tableau `products`

3. **Stripe (produits en ligne / abonnements)** :
   - Créez un abonnement de test (ex: complet mensuel)
   - Annulez-le dans Stripe Dashboard
   - Vérifiez dans Firestore que le produit "complet" a été retiré du tableau `products`
4. **Stripe (Pass Semestriel)** :
   - Créez une souscription Pass Semestriel via la réservation présentiel
   - Annulez-la dans Stripe Dashboard
   - Vérifiez dans Firestore que le pass a le statut `cancelled`

## 🔗 Voir aussi

- `CONFIGURATION_WEBHOOKS_COMPLETE.md` : Guide complet de configuration des webhooks
- `STRIPE_PRODUCTS_IDS.md` : Référence des identifiants Stripe
