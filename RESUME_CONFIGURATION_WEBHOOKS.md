# Résumé : Configuration des webhooks en parallèle

## 🎯 Solution : Plusieurs endpoints webhooks

Stripe et PayPal permettent de configurer **plusieurs endpoints** pour les mêmes événements. C'est la solution la plus simple pour avoir les deux systèmes en parallèle.

## 📋 Étapes rapides

### 1. Stripe Dashboard

1. Allez sur [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Cliquez sur **Add endpoint**
3. URL : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe`
4. Événements : `checkout.session.completed`, `payment_intent.succeeded`
5. **Copiez le Signing secret** et ajoutez-le à Firebase :
   ```bash
   echo -n "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

### 2. PayPal Dashboard

1. Allez sur [PayPal Dashboard > Webhooks](https://developer.paypal.com/dashboard/applications)
2. Cliquez sur **Add webhook**
3. URL : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal`
4. Événements : `PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`

### 3. Utiliser les métadonnées

**Stripe** : Ajoutez `metadata.system = 'firebase'` lors de la création des sessions
**PayPal** : Utilisez `custom_id = 'firebase_21jours'` ou `'firebase_complet'` pour les nouvelles commandes

## ✅ Protection contre les doublons

Les fonctions Firebase vérifient automatiquement :
- **Stripe** : Si `metadata.system !== 'firebase'`, le paiement est ignoré
- **PayPal** : Si `custom_id` ne commence pas par `firebase_`, le paiement est ignoré

## 📚 Documentation complète

Voir `CONFIGURATION_WEBHOOKS_PARALLELES.md` pour les détails complets.

