# Gestion des échecs de paiement - Bonnes pratiques européennes

## 📋 Vue d'ensemble

Ce système gère automatiquement les échecs de paiement pour les abonnements, avec :
- ✅ Relances progressives par email
- ✅ Options de paiement alternatives (Stripe, PayPal)
- ✅ Délai de grâce de 7 jours avant suspension
- ✅ 3 tentatives avant suspension définitive
- ✅ Conformité aux bonnes pratiques européennes (RGPD, délais raisonnables)

## 🔵 Gestion des échecs de paiement

### 1. Premier paiement échoué

**Quand** : Un client tente de s'abonner mais le paiement échoue

**Action** :
1. Email automatique avec 2 options :
   - Réessayer avec la carte (lien Stripe Checkout)
   - Payer via PayPal (lien sur demande)
2. Le lien de paiement reste valable 7 jours
3. Pas de retrait d'accès (le client n'a pas encore accès)

**Template email** : `echec-paiement-premier-abonnement.mjml`

### 2. Renouvellement échoué

**Quand** : Un paiement de renouvellement d'abonnement échoue

**Action** :
1. **Tentative 1-2** : Email avec lien de mise à jour de carte
   - Lien vers Stripe Customer Portal
   - Option alternative PayPal
   - Accès conservé pendant 7 jours
2. **Tentative 3** : Dernier avertissement
   - Email avec avertissement de suspension imminente
   - Accès conservé pendant 3 jours supplémentaires
3. **Après 3 tentatives** : Suspension
   - Abonnement suspendu dans Stripe
   - Accès retiré après délai de grâce (3 jours)
   - Email de suspension avec lien de réactivation

**Template email** : `echec-paiement-renouvellement.mjml`

### 3. Suspension définitive

**Quand** : Après 3 tentatives échouées + délai de grâce

**Action** :
1. Retrait automatique de l'accès au produit
2. Email de suspension avec lien de réactivation
3. Le client peut réactiver à tout moment en mettant à jour son paiement

**Template email** : `suspension-abonnement.mjml`

## 📊 Structure Firestore

### Collection `paymentFailures`

Chaque échec de paiement est enregistré dans cette collection :

```javascript
paymentFailures/
  └── {subscriptionId}_{email}/
      ├── email: "user@example.com"
      ├── subscriptionId: "sub_xxxxx"
      ├── invoiceId: "in_xxxxx"
      ├── product: "complet"
      ├── amount: 30.00
      ├── currency: "CHF"
      ├── attemptCount: 1-3
      ├── firstFailureAt: Timestamp
      ├── lastFailureAt: Timestamp
      ├── isFirstPayment: boolean
      ├── failureReasons: [
      │   {
      │     invoiceId: "in_xxxxx",
      │     reason: "Card declined",
      │     amount: 30.00,
      │     currency: "CHF",
      │     failedAt: Timestamp
      │   }
      │ ]
      ├── emailsSent: [
      │   {
      │     template: "echec-paiement-renouvellement",
      │     sentAt: Timestamp,
      │     attemptNumber: 1
      │   }
      │ ]
      ├── status: "active" | "pending_suspension" | "suspended" | "resolved"
      ├── suspendAt: Timestamp (si status = "pending_suspension")
      └── suspendedAt: Timestamp (si status = "suspended")
```

## ⚙️ Configuration

### Webhooks Stripe

Assurez-vous que ces événements sont configurés dans Stripe Dashboard :
- ✅ `invoice.payment_failed` (échec de paiement)

### Fonction scheduled

La fonction `processPendingSuspensions` s'exécute **quotidiennement à 10h** (Europe/Paris) pour :
- Vérifier les suspensions en attente
- Retirer l'accès après le délai de grâce
- Envoyer les emails de suspension

## 📧 Templates d'email

### 1. `echec-paiement-premier-abonnement.mjml`

**Variables** :
- `firstName` : Prénom du client
- `productName` : Nom du produit
- `failureReason` : Raison de l'échec
- `stripePaymentLink` : Lien Stripe Checkout pour réessayer
- `paypalRequestLink` : Lien pour demander un paiement PayPal
- `amount` : Montant avec devise
- `reference` : Référence de paiement

### 2. `echec-paiement-renouvellement.mjml`

**Variables** :
- `firstName` : Prénom du client
- `productName` : Nom du produit
- `failureReason` : Raison de l'échec
- `attemptNumber` : Numéro de tentative (1-3)
- `maxAttempts` : Nombre maximum de tentatives (3)
- `warningMessage` : Message d'avertissement
- `updatePaymentLink` : Lien Stripe Customer Portal
- `paypalRequestLink` : Lien pour demander un paiement PayPal

### 3. `suspension-abonnement.mjml`

**Variables** :
- `firstName` : Prénom du client
- `productName` : Nom du produit
- `reactivateLink` : Lien pour réactiver l'abonnement

## 🔒 Conformité européenne

### Bonnes pratiques respectées

1. **Délai de grâce raisonnable** : 7 jours pour régulariser
2. **Plusieurs tentatives** : 3 tentatives avant suspension
3. **Communication claire** : Emails explicites avec options
4. **Options alternatives** : Stripe et PayPal
5. **Réactivation facile** : Lien direct pour réactiver
6. **Respect du RGPD** : Pas de spam, consentement respecté

### Délais

- **Tentative 1-2** : Accès conservé 7 jours
- **Tentative 3** : Accès conservé 3 jours supplémentaires
- **Après suspension** : Accès retiré, mais réactivation possible à tout moment

## 🧪 Test

Pour tester la gestion des échecs de paiement :

1. **Créer un abonnement de test** avec une carte qui sera refusée
2. **Vérifier les logs Firebase** :
   ```bash
   firebase functions:log --only webhookStripe
   ```
3. **Vérifier Firestore** : Collection `paymentFailures` doit contenir l'échec
4. **Vérifier l'email** : Le client doit recevoir l'email de relance
5. **Vérifier la suspension** : Après 3 tentatives, l'accès doit être retiré

## 📝 Notes importantes

1. **Stripe Customer Portal** : Nécessite que le Customer Portal soit configuré dans Stripe Dashboard
2. **PayPal** : Les liens PayPal sont générés sur demande (email au support)

## 🔗 Voir aussi

- `GESTION_ANNULATIONS_ABONNEMENTS.md` : Gestion des annulations
- `CONFIGURATION_WEBHOOKS_COMPLETE.md` : Configuration des webhooks
- `STRIPE_PRODUCTS_IDS.md` : Référence des produits Stripe

