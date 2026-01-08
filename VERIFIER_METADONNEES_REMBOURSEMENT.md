# Vérification des métadonnées pour le remboursement automatique

## Méthode 1 : Via le script Node.js (recommandé)

### Étape 1 : Récupérer la clé Stripe depuis Firebase Secrets

```bash
firebase functions:secrets:access STRIPE_SECRET_KEY
```

Copiez la clé qui s'affiche (commence par `sk_live_` ou `sk_test_`).

### Étape 2 : Exécuter le script

```bash
export STRIPE_SECRET_KEY="sk_..." # Collez la clé récupérée
node scripts/check-stripe-payment-metadata.js pi_3SkiB12Esx6PN6y10OBRM9yS
```

Le script affichera :
- Les métadonnées du Payment Intent
- Les métadonnées de la charge associée
- Les informations du customer
- Un résumé indiquant si le remboursement automatique fonctionnera

## Méthode 2 : Via le Dashboard Stripe

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com/)
2. Allez dans **Payments** → Recherchez le Payment Intent `pi_3SkiB12Esx6PN6y10OBRM9yS`
3. Cliquez sur le Payment Intent
4. Vérifiez la section **Metadata** :
   - Doit contenir `system: firebase`
   - Doit contenir `product: 21jours`
5. Cliquez sur la **Charge** associée
6. Vérifiez aussi les métadonnées de la charge

## Ce qui doit être présent pour que le remboursement automatique fonctionne

✅ **Métadonnées requises :**
- `system: firebase` (sur le Payment Intent OU la charge)
- `product: 21jours` (sur le Payment Intent OU la charge)

✅ **Email requis :**
- Disponible dans `billing_details.email` de la charge
- OU dans `customer.email` si un customer est associé

## Si les métadonnées ne sont pas présentes

Si les métadonnées ne sont pas présentes, le remboursement automatique ne fonctionnera **pas**. Dans ce cas :

1. Retirez manuellement l'accès avec :
   ```bash
   node scripts/remove-product-from-user.js laurence.n43@gmail.com 21jours
   ```

2. Effectuez ensuite le remboursement via Stripe Dashboard

## Test du remboursement automatique

Une fois que tu as vérifié que les métadonnées sont présentes :

1. Effectue le remboursement via Stripe Dashboard
2. Vérifie les logs Firebase Functions :
   ```bash
   firebase functions:log --only webhookStripe
   ```
3. Tu devrais voir un log : `Refund processed and product '21jours' removed for laurence.n43@gmail.com`
4. Vérifie dans Firestore que le produit a été retiré de l'utilisateur

