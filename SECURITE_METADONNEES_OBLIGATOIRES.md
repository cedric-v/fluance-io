# Sécurité : Métadonnées obligatoires pour les paiements

## ⚠️ Politique de sécurité

**Les métadonnées sont OBLIGATOIRES** pour tous les paiements Fluance. Il n'y a **aucun fallback** basé sur le montant.

## 🎯 Raison

Comme d'autres produits sont vendus via les mêmes comptes Stripe/PayPal, le système ne doit traiter **que** les paiements explicitement identifiés comme étant pour Fluance via les métadonnées.

## ✅ Comportement actuel

### Stripe

Les webhooks Stripe **ignorent** les paiements qui n'ont pas :
- `metadata.system === 'firebase'`
- `metadata.product === '21jours'` ou `'complet'`

**Si ces métadonnées ne sont pas présentes ou incorrectes, le paiement est ignoré** (pas de traitement, pas de token créé).

### PayPal

Les webhooks PayPal **ignorent** les paiements qui n'ont pas :
- `custom_id` commençant par `'firebase_'`
- `custom_id` se terminant par `'21jours'` ou `'complet'`

**Si le custom_id n'est pas au bon format, le paiement est ignoré** (pas de traitement, pas de token créé).

## 📋 Format requis des métadonnées

### Stripe

```javascript
metadata: {
  system: 'firebase',  // ⚠️ OBLIGATOIRE
  product: '21jours'   // ⚠️ OBLIGATOIRE : '21jours' ou 'complet'
}
```

### PayPal

```javascript
custom_id: 'firebase_21jours'  // ⚠️ OBLIGATOIRE : Format 'firebase_21jours' ou 'firebase_complet'
```

## 🔒 Protection

Cette politique protège contre :
- ✅ Accès non autorisé aux cours Fluance
- ✅ Traitement de paiements pour d'autres produits
- ✅ Erreurs de détermination du produit basées sur le montant
- ✅ Confusion entre différents systèmes de paiement

## 📝 Implication pour le développement

Lors de la création des sessions Stripe ou commandes PayPal, **vous DEVEZ** :

1. **Toujours** inclure les métadonnées requises
2. **Vérifier** que les métadonnées sont correctement passées
3. **Tester** que les webhooks reçoivent bien les métadonnées

## 🧪 Test

Pour tester que les métadonnées sont bien reçues :

1. Créez une session Stripe avec les métadonnées
2. Effectuez un paiement de test
3. Vérifiez les logs Firebase Functions :
   - Si les métadonnées sont correctes : `Token created and email sent...`
   - Si les métadonnées sont absentes/incorrectes : `Paiement Stripe ignoré - système: ...`

## ⚠️ Attention

**Ne jamais** :
- ❌ Créer des sessions/commandes sans métadonnées
- ❌ Utiliser des valeurs incorrectes dans les métadonnées
- ❌ Supprimer le code de vérification des métadonnées

**Toujours** :
- ✅ Vérifier que `metadata.system === 'firebase'` (Stripe)
- ✅ Vérifier que `custom_id.startsWith('firebase_')` (PayPal)
- ✅ Vérifier que le produit est valide (`'21jours'` ou `'complet'`)

