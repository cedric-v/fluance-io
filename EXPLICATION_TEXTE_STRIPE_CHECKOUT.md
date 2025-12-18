# Explication : Texte Stripe Checkout - Période d'essai

## 🔍 Problème identifié

Le texte affiché sur Stripe Checkout pour la période d'essai et le premier paiement est **généré automatiquement par Stripe** et ne peut pas être modifié directement.

### Texte actuel (trimestriel)
```
14 jours gratuits
Alors 75,00 CHF chaque 3 mois à partir de 1 janvier 2026
```

### Texte souhaité
```
14 jours gratuits
Puis 75,00 CHF chaque 3 mois à partir du 1 janvier 2026
```

## ⚠️ Limitations de Stripe

1. **Le texte est généré automatiquement** : Stripe génère ce texte en fonction de :
   - La locale (`fr` ou `en`)
   - La configuration du produit/prix
   - La période d'essai (`trial_period_days`)
   - L'intervalle de facturation (mensuel, trimestriel, etc.)

2. **Pas de personnalisation directe** : Il n'existe pas de paramètre dans l'API Stripe Checkout pour modifier ce texte spécifique.

3. **Le nom du produit/prix n'influence pas ce texte** : Même si on modifie le nom du produit ou du prix dans Stripe Dashboard, cela ne change pas le texte généré automatiquement.

## 💡 Solutions possibles

### Solution 1 : Utiliser Stripe Billing Portal (recommandé)

Le Stripe Billing Portal permet de personnaliser davantage l'expérience, mais nécessite une configuration plus complexe et ne s'applique qu'après l'abonnement initial.

### Solution 2 : Accepter le texte généré par Stripe

Le texte "Alors" est généré par Stripe en français et est techniquement correct. C'est une formulation standard utilisée par Stripe pour indiquer la transition entre la période d'essai et le paiement régulier.

### Solution 3 : Utiliser Stripe Elements (solution avancée)

Créer une page de paiement personnalisée avec Stripe Elements au lieu de Stripe Checkout. Cela permet un contrôle total sur le texte affiché, mais nécessite :
- Développement d'une interface de paiement personnalisée
- Gestion de la sécurité et de la conformité PCI
- Plus de maintenance

### Solution 4 : Ajouter une note explicative sur votre site

Ajouter une note sur la page de vente (`approche-fluance-complete.md`) qui explique clairement :
- Les 14 premiers jours sont offerts
- Le premier paiement aura lieu après 14 jours
- Le montant exact et la fréquence

Cela permet de clarifier l'information avant que l'utilisateur n'arrive sur Stripe Checkout.

## 📝 Code actuel

Le code dans `functions/index.js` configure correctement la période d'essai :

```javascript
subscription_data: mode === 'subscription' ? {
  metadata: {
    system: 'firebase',
    product: product,
  },
  // Période d'essai gratuite de 14 jours pour le produit "complet"
  ...(product === 'complet' ? {trial_period_days: 14} : {}),
} : undefined,
```

## ✅ Recommandation

**Accepter le texte généré par Stripe** car :
1. Il est techniquement correct
2. Il est conforme aux standards Stripe
3. Il est clair pour les utilisateurs
4. Modifier cela nécessiterait une refonte importante de l'intégration

Si vous souhaitez absolument changer ce texte, la **Solution 3 (Stripe Elements)** est la seule option viable, mais elle nécessite un développement significatif.

## 🔗 Ressources

- [Stripe Checkout - Free Trials](https://docs.stripe.com/payments/checkout/free-trials)
- [Stripe Elements](https://stripe.com/docs/stripe-js)
- [Stripe Billing Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
