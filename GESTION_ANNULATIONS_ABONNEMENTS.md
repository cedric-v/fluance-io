# Gestion des annulations d'abonnement et échecs de paiement

## 📋 Vue d'ensemble

Les webhooks Stripe et PayPal gèrent maintenant automatiquement :
- ✅ Les annulations d'abonnement → Retire l'accès au produit "complet"
- ✅ Les échecs de paiement → Log de l'événement (accès conservé jusqu'à annulation finale)

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

## 🔗 Voir aussi

- `CONFIGURATION_WEBHOOKS_COMPLETE.md` : Guide complet de configuration des webhooks
- `STRIPE_PRODUCTS_IDS.md` : Référence des identifiants Stripe
