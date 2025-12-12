# Configuration du Signing Secret Stripe

## 🔐 Où stocker le Signing Secret ?

Le Signing Secret Stripe doit être stocké dans **Firebase Secrets** (comme les autres secrets), pas dans le code GitHub.

## 📋 Étapes de configuration

### Étape 1 : Récupérer le Signing Secret depuis Stripe

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com/)
2. Allez dans **Developers** → **Webhooks**
3. Cliquez sur votre endpoint webhook
4. Dans la section **Signing secret**, copiez le secret (commence par `whsec_xxxxx`)

### Étape 2 : Créer le secret Firebase

```bash
# Remplacez whsec_xxxxx par votre vrai Signing Secret
echo -n "whsec_xxxxx" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

**⚠️ Important** : Utilisez `echo -n` pour éviter d'ajouter un saut de ligne à la fin.

### Étape 3 : Vérifier que le secret est créé

```bash
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET
```

Cela devrait afficher votre Signing Secret (sans le saut de ligne).

### Étape 4 : Mettre à jour le webhook Stripe

Le webhook `webhookStripe` a été mis à jour pour utiliser ce secret. Il suffit de redéployer :

```bash
firebase deploy --only functions:webhookStripe
```

## 🔒 Sécurité

- ✅ Le secret est **chiffré** au repos dans Firebase
- ✅ Le secret n'est **jamais** dans le code GitHub
- ✅ Le secret est accessible uniquement à la fonction `webhookStripe`
- ✅ La vérification de signature est automatique si le package Stripe est installé

## 📝 Note sur le package Stripe

Pour activer la vérification complète de la signature, installez le package Stripe dans `functions/` :

```bash
cd functions
npm install stripe
```

Le code vérifie automatiquement si le package est installé et utilise la vérification de signature si disponible.

## 🆘 Dépannage

### Le secret n'est pas trouvé

- Vérifiez que le secret existe : `firebase functions:secrets:access STRIPE_WEBHOOK_SECRET`
- Vérifiez l'orthographe exacte : `STRIPE_WEBHOOK_SECRET` (en majuscules)
- Assurez-vous que le secret est créé dans le bon projet Firebase

### La vérification de signature échoue

- Vérifiez que le Signing Secret est correct (copié depuis Stripe Dashboard)
- Vérifiez que vous utilisez `echo -n` (sans saut de ligne)
- Vérifiez que l'URL du webhook dans Stripe correspond à votre fonction Firebase

## 🔗 Voir aussi

- `MIGRATION_SECRETS_FIREBASE.md` : Guide complet sur les secrets Firebase
- `CONFIGURATION_WEBHOOKS_COMPLETE.md` : Guide complet de configuration des webhooks
