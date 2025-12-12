# Configuration de la clé secrète Stripe

## 🔐 Où stocker la clé secrète Stripe ?

La clé secrète Stripe (`STRIPE_SECRET_KEY`) doit être stockée dans **Firebase Secrets** (comme les autres secrets), pas dans le code GitHub.

## 📋 Étapes de configuration

### Étape 1 : Récupérer la clé secrète depuis Stripe

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com/)
2. Allez dans **Developers** → **API keys**
3. Dans la section **Secret key**, copiez la clé secrète (commence par `sk_test_` en mode test ou `sk_live_` en production)

### Étape 2 : Créer le secret Firebase

```bash
# Remplacez sk_test_xxxxx par votre vraie clé secrète Stripe
echo -n "sk_test_xxxxx" | firebase functions:secrets:set STRIPE_SECRET_KEY
```

**⚠️ Important** : Utilisez `echo -n` pour éviter d'ajouter un saut de ligne à la fin.

### Étape 3 : Vérifier que le secret est créé

```bash
firebase functions:secrets:access STRIPE_SECRET_KEY
```

Cela devrait afficher votre clé secrète (sans le saut de ligne).

### Étape 4 : Installer le package Stripe

Pour que la fonction `createStripeCheckoutSession` fonctionne, vous devez installer le package Stripe :

```bash
cd functions
npm install stripe
```

### Étape 5 : Déployer les fonctions

```bash
firebase deploy --only functions:createStripeCheckoutSession
```

## 🔒 Sécurité

- ✅ La clé est **chiffrée** au repos dans Firebase
- ✅ La clé n'est **jamais** dans le code GitHub
- ✅ La clé est accessible uniquement à la fonction `createStripeCheckoutSession`
- ✅ Utilisez la clé de **test** (`sk_test_`) pour le développement
- ✅ Utilisez la clé de **production** (`sk_live_`) uniquement en production

## 📝 Notes importantes

1. **Clés de test vs production** : 
   - En développement, utilisez `sk_test_xxxxx`
   - En production, utilisez `sk_live_xxxxx`
   - Vous pouvez avoir les deux secrets configurés et basculer entre eux

2. **Package Stripe** : Le package `stripe` doit être installé dans `functions/` pour que la fonction fonctionne.

3. **Métadonnées** : La fonction `createStripeCheckoutSession` ajoute automatiquement les métadonnées requises (`system: 'firebase'` et `product`).

## 🆘 Dépannage

### Le secret n'est pas trouvé

- Vérifiez que le secret existe : `firebase functions:secrets:access STRIPE_SECRET_KEY`
- Vérifiez l'orthographe exacte : `STRIPE_SECRET_KEY` (en majuscules)
- Assurez-vous que le secret est créé dans le bon projet Firebase

### Erreur "Stripe package not installed"

- Installez le package : `cd functions && npm install stripe`
- Redéployez les fonctions : `firebase deploy --only functions:createStripeCheckoutSession`

### Erreur lors de la création de la session

- Vérifiez que la clé secrète est correcte
- Vérifiez que les Price IDs sont corrects dans `functions/index.js`
- Vérifiez les logs : `firebase functions:log --only createStripeCheckoutSession`

## 🔗 Voir aussi

- `MIGRATION_SECRETS_FIREBASE.md` : Guide complet sur les secrets Firebase
- `STRIPE_PRODUCTS_IDS.md` : Référence des Price IDs Stripe
- `CONFIGURATION_WEBHOOKS_COMPLETE.md` : Guide complet de configuration des webhooks
