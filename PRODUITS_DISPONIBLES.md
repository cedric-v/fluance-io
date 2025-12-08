# Produits disponibles pour le contenu protégé

## Liste des produits

Le système supporte actuellement deux produits :

1. **`"21jours"`** : Produit pour le défi 21 jours - **19 CHF**
2. **`"complet"`** : Produit pour l'approche complète - **30 CHF/mois** ou **75 CHF/trimestre**

## Utilisation

### Dans les tokens d'inscription

Lors de la création d'un token dans Firestore (`registrationTokens`), le champ `product` doit être l'un de ces deux valeurs :

```javascript
{
  email: "client@example.com",
  product: "21jours", // ou "complet"
  // ...
}
```

### Dans le contenu protégé

Lors de l'ajout de contenu dans Firestore (`protectedContent`), le champ `product` doit correspondre :

```javascript
{
  product: "21jours", // ou "complet"
  title: "Titre du contenu",
  content: "<div>...</div>",
  // ...
}
```

**Important** : Un utilisateur ne peut accéder qu'au contenu dont le `product` correspond à son produit d'inscription.

### Exemples

- Un utilisateur avec `product: "21jours"` peut voir uniquement le contenu avec `product: "21jours"`
- Un utilisateur avec `product: "complet"` peut voir uniquement le contenu avec `product: "complet"`

## Détermination automatique du produit (webhooks)

La fonction `determineProductFromAmount()` dans `functions/index.js` détermine automatiquement le produit selon le montant du paiement :

- **`"21jours"`** : Montant autour de **19 CHF** (20-25 CHF avec tolérance de conversion)
- **`"complet"`** : 
  - Montant autour de **30 CHF** (25-35 CHF) pour l'abonnement mensuel
  - Montant autour de **75 CHF** (70-80 CHF) pour l'abonnement trimestriel
  - Montant >= 35 CHF (par défaut)

La fonction gère automatiquement les conversions de devise (EUR, USD) et les variations de montant dues aux frais de transaction.

