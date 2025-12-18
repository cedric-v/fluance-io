# Corriger le texte Stripe Checkout pour l'abonnement trimestriel

## Problème

Sur la page Stripe Checkout de l'abonnement trimestriel, le texte affiché est :
- "Alors75,00 CHF chaque 3 mois à partir de1 janvier 2026"

Au lieu de :
- "Puis 75,00 CHF chaque 3 mois à partir du 1 janvier 2026"

## Solution

Le texte affiché sur Stripe Checkout provient de la **description du produit** configurée dans le **Stripe Dashboard**, pas du code.

### Étapes pour corriger

1. **Connectez-vous au Stripe Dashboard** : https://dashboard.stripe.com/
2. **Allez dans Products** (Produits) dans le menu de gauche
3. **Trouvez le produit** : "Fluance en ligne - trimestriel" (Product ID: `prod_TakbVXK9sDba9F`)
4. **Cliquez sur le produit** pour l'éditer
5. **Modifiez la description** du produit pour qu'elle contienne :
   - "Puis 75,00 CHF chaque 3 mois à partir du [date]"
   - Au lieu de "Alors75,00 CHF chaque 3 mois à partir de[date]"

**Note** : Stripe génère automatiquement le texte de facturation à partir de la description du produit et de la configuration du prix. Assurez-vous que la description est bien formatée avec des espaces appropriés.

### Alternative : Utiliser le script automatique

Un script est disponible pour corriger automatiquement la description :

```bash
# Depuis la racine du projet
node scripts/update-stripe-product-description.js
```

**Prérequis** :
- Avoir `STRIPE_SECRET_KEY` configuré dans votre `.env` ou variables d'environnement
- Avoir le package `stripe` installé : `npm install stripe` (déjà installé dans `functions/`)

Le script va automatiquement :
- Récupérer la description actuelle du produit trimestriel
- Remplacer "Alors" par "Puis "
- Remplacer "à partir de" par "à partir du "
- Mettre à jour le produit dans Stripe

### Alternative manuelle : Utiliser l'API Stripe directement

Si vous préférez modifier via l'API manuellement :

```bash
# Mettre à jour la description du produit trimestriel
curl https://api.stripe.com/v1/products/prod_TakbVXK9sDba9F \
  -u "sk_live_XXXXX:" \
  -d "description=Puis 75,00 CHF chaque 3 mois à partir du [date]"
```

**⚠️ Important** : Remplacez `sk_live_XXXXX` par votre vraie clé API Stripe (clé secrète).

## Vérification

Après modification, testez en créant une nouvelle session Checkout pour l'abonnement trimestriel et vérifiez que le texte est correct.
