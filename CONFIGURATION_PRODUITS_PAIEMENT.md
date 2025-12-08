# Configuration des produits pour Stripe et PayPal

## Comment le produit est déterminé

Le système détermine le produit de deux façons, dans cet ordre de priorité :

### 1. Via les métadonnées (méthode recommandée)

**Stripe** :
- Utilisez le champ `metadata.product` lors de la création de la session de paiement
- Le produit sera : `session.metadata?.product`

**PayPal** :
- Utilisez le champ `custom_id` lors de la création de la commande
- Le produit sera : `resource.custom_id`

### 2. Automatiquement selon le montant (fallback)

Si aucune métadonnée n'est fournie, le système détermine automatiquement le produit selon le montant :

- **19 CHF** (±5 CHF) → `"21jours"`
- **30 CHF** (±5 CHF) → `"complet"` (mensuel)
- **75 CHF** (±5 CHF) → `"complet"` (trimestriel)

## Réponse à votre question

**Le nom du produit est INDÉPENDANT des libellés PayPal/Stripe.**

- Les libellés dans PayPal/Stripe peuvent être : "Défi 21 jours", "Abonnement mensuel", "Abonnement trimestriel", etc.
- Les identifiants internes dans votre système sont : `"21jours"` et `"complet"`

## Méthode recommandée : Utiliser les métadonnées

### Pour Stripe

Lors de la création d'une session de paiement, ajoutez les métadonnées :

```javascript
const session = await stripe.checkout.sessions.create({
  // ... autres paramètres
  metadata: {
    product: '21jours' // ou 'complet'
  }
});
```

### Pour PayPal

Lors de la création d'une commande, utilisez `custom_id` :

```javascript
const order = await paypal.orders.create({
  // ... autres paramètres
  purchase_units: [{
    custom_id: '21jours', // ou 'complet'
    // ... autres paramètres
  }]
});
```

## Avantages d'utiliser les métadonnées

✅ **Précision** : Pas de confusion possible selon le montant
✅ **Flexibilité** : Vous pouvez avoir plusieurs produits au même prix
✅ **Traçabilité** : Le produit est explicitement défini dans le paiement
✅ **Fiabilité** : Pas de dépendance aux conversions de devise ou frais

## Exemple complet

### Scénario : Paiement de 19 CHF pour "21jours"

**Option 1 : Avec métadonnées (recommandé)**
```javascript
// Stripe
metadata: { product: '21jours' }
// → Produit déterminé : "21jours" ✅

// PayPal
custom_id: '21jours'
// → Produit déterminé : "21jours" ✅
```

**Option 2 : Sans métadonnées (fallback)**
```javascript
// Montant : 19 CHF
// → determineProductFromAmount(19, 'chf')
// → Produit déterminé : "21jours" ✅
```

## Configuration dans vos boutons de paiement

### Sur votre site web

Quand vous créez un bouton de paiement, vous pouvez passer le produit :

**Stripe Checkout** :
```html
<form action="/create-checkout-session" method="POST">
  <input type="hidden" name="product" value="21jours">
  <button type="submit">Payer 19 CHF</button>
</form>
```

**PayPal** :
```html
<div id="paypal-button-container" data-product="21jours"></div>
```

Puis dans votre code backend qui crée la session/commande, utilisez cette valeur dans les métadonnées.

## Conclusion

**Vous pouvez utiliser n'importe quel libellé dans PayPal/Stripe** (ex: "Défi 21 jours", "Abonnement complet", etc.), mais **passez toujours `"21jours"` ou `"complet"` dans les métadonnées** pour garantir la bonne identification du produit.

