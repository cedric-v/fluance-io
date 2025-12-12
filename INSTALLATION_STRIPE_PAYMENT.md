# Installation et configuration des paiements Stripe

## 📋 Vue d'ensemble

Ce guide vous explique comment installer et configurer le système de paiement Stripe pour Fluance, depuis la configuration des secrets jusqu'à l'utilisation des boutons de paiement.

## 🔐 Étape 1 : Configurer les secrets Firebase

### 1.1 Clé secrète Stripe

```bash
# Récupérez votre clé secrète depuis Stripe Dashboard → Developers → API keys
# Mode test : sk_test_xxxxx
# Mode production : sk_live_xxxxx
echo -n "sk_test_xxxxx" | firebase functions:secrets:set STRIPE_SECRET_KEY
```

### 1.2 Signing Secret du webhook

```bash
# Récupérez le Signing Secret depuis Stripe Dashboard → Developers → Webhooks
# Cliquez sur votre endpoint webhook et copiez le secret (commence par whsec_xxxxx)
echo -n "whsec_xxxxx" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

### 1.3 Vérifier les secrets

```bash
firebase functions:secrets:access STRIPE_SECRET_KEY
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET
```

## 📦 Étape 2 : Installer le package Stripe

```bash
cd functions
npm install stripe
```

## 🚀 Étape 3 : Déployer les fonctions

```bash
firebase deploy --only functions:createStripeCheckoutSession,functions:webhookStripe
```

## ✅ Étape 4 : Vérifier que tout fonctionne

### 4.1 Tester la création d'une session

1. Allez sur une page de vente (ex: https://fluance.io/cours-en-ligne/21-jours-mouvement/)
2. Cliquez sur un bouton de paiement
3. Vous devriez être redirigé vers Stripe Checkout

### 4.2 Vérifier les logs

```bash
firebase functions:log --only createStripeCheckoutSession,webhookStripe
```

## 📝 Fichiers modifiés

### Fonctions Firebase
- `functions/index.js` :
  - `createStripeCheckoutSession` : Crée une session Stripe Checkout
  - `webhookStripe` : Mis à jour pour utiliser `STRIPE_WEBHOOK_SECRET`

### Scripts client
- `src/assets/js/payment.js` : Fonctions JavaScript pour créer les sessions
- `src/_includes/base.njk` : Ajout du script `payment.js`

### Pages de vente
- `src/fr/cours-en-ligne/21-jours-mouvement.md` : Boutons mis à jour
- `src/fr/cours-en-ligne/approche-fluance-complete.md` : Boutons mis à jour

## 🔗 Voir aussi

- `CONFIGURER_STRIPE_SECRET_KEY.md` : Guide détaillé pour la clé secrète
- `CONFIGURER_STRIPE_WEBHOOK_SECRET.md` : Guide détaillé pour le Signing Secret
- `STRIPE_PRODUCTS_IDS.md` : Référence des Price IDs
- `CONFIGURATION_WEBHOOKS_COMPLETE.md` : Guide complet des webhooks
