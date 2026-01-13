# Codes Partenaires pour Abonnements Récurrents

## Problématique

Le **Pass Semestriel** est un abonnement récurrent qui se renouvelle automatiquement tous les 6 mois. La question se pose : **le code partenaire doit-il s'appliquer uniquement sur le premier paiement ou sur tous les renouvellements ?**

## État Actuel du Système

Actuellement, le code partenaire est appliqué uniquement lors de la création du `PaymentIntent` dans `processBooking`. Pour les abonnements récurrents, cela signifie que :

- ✅ La remise est appliquée sur le **premier paiement**
- ❌ La remise **n'est PAS appliquée** sur les renouvellements automatiques (tous les 6 mois)

## Options et Recommandations

### Option 1 : Remise uniquement sur le premier paiement ⭐ **RECOMMANDÉ**

**Avantages :**
- ✅ Simple à implémenter (déjà en place)
- ✅ Contrôle précis sur la durée de la remise
- ✅ Évite les remises permanentes non désirées
- ✅ Facile à gérer et comprendre pour les clients

**Inconvénients :**
- ❌ Le client paie le prix plein après le premier paiement

**Cas d'usage :**
- Remise d'introduction pour nouveaux clients
- Promotion limitée dans le temps
- Partenariats avec remise unique

**Implémentation actuelle :**
✅ Déjà implémenté - Le code partenaire réduit le montant du premier PaymentIntent

---

### Option 2 : Remise sur tous les renouvellements (permanente)

**Avantages :**
- ✅ Remise permanente pour le client
- ✅ Fidélisation à long terme

**Inconvénients :**
- ❌ Perte de revenus à long terme
- ❌ Plus complexe à implémenter
- ❌ Difficile à annuler si le partenariat prend fin
- ❌ Risque de remises non désirées sur plusieurs années

**Cas d'usage :**
- Partenariats stratégiques à long terme
- Remises pour groupes/organisations
- Accords commerciaux spécifiques

**Implémentation requise :**
- Utiliser des **Stripe Coupons** au lieu de calculer manuellement la remise
- Créer le coupon dans Stripe avec `duration: 'forever'` ou `duration: 'repeating'`
- Appliquer le coupon lors de la création de la Subscription Stripe
- Le coupon s'appliquera automatiquement sur tous les renouvellements

---

### Option 3 : Remise limitée dans le temps (ex: 1 an)

**Avantages :**
- ✅ Équilibre entre remise et revenus
- ✅ Contrôle sur la durée de la remise
- ✅ Peut être utilisé pour des campagnes promotionnelles

**Inconvénients :**
- ❌ Plus complexe à gérer
- ❌ Nécessite un suivi de la date d'expiration

**Cas d'usage :**
- Promotions saisonnières
- Remises pour nouveaux clients (première année)
- Partenariats avec durée limitée

**Implémentation requise :**
- Utiliser des **Stripe Coupons** avec `duration: 'repeating'` et `duration_in_months: 12`
- Le coupon s'appliquera automatiquement pendant la période définie

---

## Recommandation : Option 1 (Remise uniquement sur le premier paiement)

### Pourquoi cette option est recommandée :

1. **Simplicité** : Déjà implémentée, pas de changement nécessaire
2. **Contrôle** : Vous gardez le contrôle sur les remises à long terme
3. **Flexibilité** : Facile d'ajuster la stratégie selon les besoins
4. **Sécurité financière** : Évite les remises permanentes non désirées
5. **Clarté pour le client** : Le client comprend que c'est une remise d'introduction

### Communication avec le client :

Lors de l'application du code, afficher clairement :
> "Remise de 10% appliquée sur votre premier paiement. Les renouvellements seront au prix standard (340 CHF)."

---

## Implémentation Alternative : Stripe Coupons (si Option 2 ou 3)

Si vous souhaitez implémenter une remise permanente ou limitée dans le temps, voici comment procéder :

### 1. Créer un Coupon Stripe

```bash
# Remise permanente de 10%
stripe coupons create \
  --id=PARTNER10 \
  --percent-off=10 \
  --duration=forever

# OU remise limitée à 1 an (12 mois)
stripe coupons create \
  --id=PARTNER10_1YEAR \
  --percent-off=10 \
  --duration=repeating \
  --duration-in-months=12
```

### 2. Modifier le code pour créer une Subscription au lieu d'un PaymentIntent

**Dans `functions/services/bookingService.js`**, pour `semester_pass` :

```javascript
// Au lieu de créer un PaymentIntent
if (pricingOption === 'semester_pass') {
  // Créer une Subscription Stripe avec le coupon
  const subscription = await stripe.subscriptions.create({
    customer: customerId, // Créer ou récupérer le customer
    items: [{
      price: 'price_xxxxx', // Price ID du Pass Semestriel
    }],
    coupon: partnerCode, // Le code partenaire devient un coupon Stripe
    metadata: {
      bookingId: bookingId,
      email: userData.email,
      partnerCode: partnerCode,
    },
  });
  
  // Stocker le subscriptionId dans bookingData
  bookingData.stripeSubscriptionId = subscription.id;
}
```

### 3. Gérer les renouvellements dans le webhook

Le webhook `invoice.paid` gérera automatiquement les renouvellements avec la remise appliquée par Stripe.

---

## Comparaison des Options

| Critère | Option 1 (Premier paiement) | Option 2 (Permanent) | Option 3 (Limité) |
|---------|----------------------------|---------------------|-------------------|
| **Complexité** | ✅ Simple | ⚠️ Moyenne | ⚠️ Moyenne |
| **Revenus long terme** | ✅ Élevés | ❌ Réduits | ⚠️ Moyens |
| **Fidélisation** | ⚠️ Moyenne | ✅ Élevée | ✅ Élevée |
| **Contrôle** | ✅ Total | ❌ Limité | ⚠️ Partiel |
| **Implémentation** | ✅ Déjà fait | ❌ À faire | ❌ À faire |

---

## Recommandation Finale

**Pour la plupart des cas d'usage, l'Option 1 (remise uniquement sur le premier paiement) est recommandée** car :

1. Elle est déjà implémentée et fonctionnelle
2. Elle offre le meilleur équilibre entre avantages client et revenus
3. Elle est simple à gérer et à comprendre
4. Elle permet de tester différentes stratégies sans engagement long terme

**Si vous avez besoin d'une remise permanente** (Option 2) pour des partenariats stratégiques spécifiques, vous pouvez :
- Créer des coupons Stripe manuellement pour ces cas particuliers
- Utiliser l'API Stripe pour créer des subscriptions avec coupons
- Documenter ces cas exceptionnels

---

## Questions à se poser avant de choisir

1. **Quel est l'objectif du code partenaire ?**
   - Acquisition de nouveaux clients → Option 1
   - Fidélisation long terme → Option 2 ou 3

2. **Quelle est la durée du partenariat ?**
   - Court terme → Option 1
   - Long terme → Option 2 ou 3

3. **Quel est l'impact financier acceptable ?**
   - Impact limité → Option 1
   - Impact acceptable sur plusieurs années → Option 2 ou 3

4. **Avez-vous besoin de flexibilité ?**
   - Oui → Option 1
   - Non, partenariat stable → Option 2 ou 3

---

## Conclusion

Le système actuel (Option 1) est **approprié pour la plupart des cas d'usage**. Si vous avez besoin de remises permanentes pour des partenariats spécifiques, vous pouvez implémenter l'Option 2 en utilisant les Stripe Coupons, mais cela nécessitera des modifications du code pour créer des Subscriptions au lieu de PaymentIntents.
