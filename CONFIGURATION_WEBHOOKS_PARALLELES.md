# Guide : Configuration des webhooks Stripe/PayPal en parallèle

Ce guide explique comment configurer les webhooks Stripe et PayPal pour qu'ils fonctionnent en parallèle avec votre ancien système (Ontraport) pendant la période de transition.

## 📋 Situation

Vous avez actuellement :
- **Ancien système** : Webhooks Stripe/PayPal → Ontraport (ou autre backend)
- **Nouveau système** : Webhooks Stripe/PayPal → Firebase Functions

Vous voulez les deux systèmes en parallèle pendant quelques mois.

## 🎯 Solutions possibles

### Option 1 : Plusieurs endpoints webhooks (Recommandé)

Stripe et PayPal permettent de configurer **plusieurs endpoints webhooks** pour le même événement. C'est la solution la plus simple.

#### Avantages
- ✅ Configuration simple
- ✅ Pas de code supplémentaire
- ✅ Les deux systèmes reçoivent les événements indépendamment
- ✅ Facile à désactiver l'ancien endpoint plus tard

#### Inconvénients
- ⚠️ Les deux systèmes traitent tous les paiements (peut créer des doublons si non géré)

### Option 2 : Webhook proxy/routing

Créer un endpoint intermédiaire qui route les webhooks vers les deux systèmes selon des critères.

#### Avantages
- ✅ Contrôle total sur le routage
- ✅ Peut filtrer selon des critères (métadonnées, montant, etc.)

#### Inconvénients
- ⚠️ Nécessite un serveur intermédiaire
- ⚠️ Plus complexe à maintenir

### Option 3 : Utiliser les métadonnées pour identifier le système

Utiliser des métadonnées dans les sessions/commandes pour identifier quel système doit traiter le paiement.

#### Avantages
- ✅ Pas de duplication de traitement
- ✅ Contrôle précis

#### Inconvénients
- ⚠️ Nécessite de modifier le code de création des sessions/commandes
- ⚠️ Les anciens paiements sans métadonnées continueront d'aller vers l'ancien système

## 🚀 Solution recommandée : Option 1 (Plusieurs endpoints)

### Configuration Stripe

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Vous devriez voir votre endpoint existant (ex: `https://espace.fluance.io/webhook` ou similaire)
3. Cliquez sur **Add endpoint** (Ajouter un endpoint)
4. Configurez le nouvel endpoint :
   - **Endpoint URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe`
   - **Description** : `Firebase Functions - Nouveau système`
   - **Events to send** : Sélectionnez les mêmes événements que l'ancien endpoint :
     - `checkout.session.completed`
     - `payment_intent.succeeded`
5. Cliquez sur **Add endpoint**
6. **Copiez le Signing secret** (commence par `whsec_`) et ajoutez-le à Firebase Secrets :
   ```bash
   echo -n "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

**Résultat** : Stripe enverra les événements aux **deux endpoints** :
- Ancien endpoint → Ontraport (ou autre backend)
- Nouvel endpoint → Firebase Functions

### Configuration PayPal

1. Allez sur [PayPal Dashboard](https://developer.paypal.com/dashboard/applications)
2. Sélectionnez votre application
3. Allez dans l'onglet **Webhooks**
4. Vous devriez voir votre webhook existant
5. Cliquez sur **Add webhook** (Ajouter un webhook)
6. Configurez le nouveau webhook :
   - **Webhook URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal`
   - **Event types** : Sélectionnez les mêmes événements que l'ancien webhook :
     - `PAYMENT.CAPTURE.COMPLETED`
     - `CHECKOUT.ORDER.APPROVED`
7. Cliquez sur **Save**

**Résultat** : PayPal enverra les événements aux **deux webhooks** :
- Ancien webhook → Ontraport (ou autre backend)
- Nouveau webhook → Firebase Functions

## 🔍 Identifier la source du paiement

Pour éviter les doublons ou identifier quel système a créé le paiement, vous pouvez utiliser les métadonnées :

### Dans Stripe

Lors de la création d'une session Stripe, ajoutez une métadonnée pour identifier le système :

```javascript
const session = await stripe.checkout.sessions.create({
  // ... autres paramètres
  metadata: {
    product: '21jours', // Identifiant interne
    system: 'firebase', // Identifiant du système
  },
});
```

Dans votre Firebase Function `webhookStripe`, vous pouvez vérifier :

```javascript
const system = session.metadata?.system;
if (system === 'firebase') {
  // Traiter le paiement
} else {
  // Ignorer (c'est pour l'ancien système)
  return res.status(200).json({received: true});
}
```

### Dans PayPal

Utilisez `custom_id` ou `invoice_id` pour identifier le système :

```javascript
const order = await paypal.orders.create({
  // ... autres paramètres
  purchase_units: [{
    custom_id: 'firebase_21jours', // Préfixe pour identifier le système
    // ... autres paramètres
  }]
});
```

Dans votre Firebase Function `webhookPayPal`, vous pouvez vérifier :

```javascript
const customId = resource.custom_id || '';
if (customId.startsWith('firebase_')) {
  // Traiter le paiement
} else {
  // Ignorer (c'est pour l'ancien système)
  return res.status(200).json({received: true});
}
```

## 🛡️ Protection contre les doublons

### Option A : Utiliser les métadonnées (recommandé)

Comme expliqué ci-dessus, utilisez les métadonnées pour identifier quel système doit traiter le paiement.

### Option B : Vérifier dans Firestore

Avant de créer un token, vérifiez si un token existe déjà pour cet email et ce produit :

```javascript
// Dans createTokenAndSendEmail
const existingToken = await db.collection('registrationTokens')
  .where('email', '==', email)
  .where('product', '==', product)
  .where('used', '==', false)
  .limit(1)
  .get();

if (!existingToken.empty) {
  console.log('Token déjà existant pour cet email et produit');
  // Soit retourner le token existant, soit ignorer
  return existingToken.docs[0].id;
}
```

### Option C : Utiliser un ID unique par paiement

Stripe et PayPal fournissent des IDs uniques pour chaque paiement. Stockez-les dans Firestore pour éviter les doublons :

```javascript
// Dans webhookStripe
const paymentId = session.id; // ID unique de la session Stripe

// Vérifier si ce paiement a déjà été traité
const existingPayment = await db.collection('processedPayments')
  .doc(paymentId)
  .get();

if (existingPayment.exists) {
  console.log('Paiement déjà traité');
  return res.status(200).json({received: true});
}

// Marquer comme traité
await db.collection('processedPayments').doc(paymentId).set({
  processedAt: admin.firestore.FieldValue.serverTimestamp(),
  email: customerEmail,
  product: product,
});

// Créer le token
await createTokenAndSendEmail(...);
```

## 📊 Monitoring pendant la transition

### Vérifier que les deux systèmes fonctionnent

1. **Stripe Dashboard** → **Webhooks** → Vérifiez que les deux endpoints reçoivent des événements
2. **PayPal Dashboard** → **Webhooks** → Vérifiez que les deux webhooks reçoivent des événements
3. **Firebase Console** → **Functions** → **Logs** → Vérifiez que `webhookStripe` et `webhookPayPal` sont appelés

### Comparer les résultats

Pendant la période de transition, comparez :
- Nombre de tokens créés dans Firebase vs nombre de comptes créés dans l'ancien système
- Emails envoyés depuis Mailjet vs emails envoyés depuis l'ancien système

## 🔄 Migration progressive

### Phase 1 : Configuration parallèle (maintenant)

- ✅ Configurer les deux endpoints webhooks
- ✅ Les deux systèmes reçoivent tous les paiements
- ✅ Utiliser les métadonnées pour identifier la source

### Phase 2 : Test et validation (1-2 semaines)

- ✅ Tester quelques paiements avec le nouveau système
- ✅ Vérifier que les tokens sont créés correctement
- ✅ Vérifier que les emails sont envoyés

### Phase 3 : Migration progressive (1-2 mois)

- ✅ Commencer à créer les nouvelles sessions/commandes avec `system: 'firebase'`
- ✅ Les anciens boutons continuent d'utiliser l'ancien système
- ✅ Les nouveaux boutons utilisent le nouveau système

### Phase 4 : Désactivation de l'ancien système

- ✅ Une fois tous les paiements migrés vers le nouveau système
- ✅ Désactiver l'ancien endpoint webhook dans Stripe/PayPal
- ✅ Supprimer le code de l'ancien système

## ⚠️ Points d'attention

1. **Doublons** : Si les deux systèmes traitent le même paiement, vous pourriez créer des tokens en double. Utilisez les métadonnées ou vérifiez dans Firestore.

2. **Emails** : Les deux systèmes pourraient envoyer des emails. Utilisez les métadonnées pour éviter cela.

3. **Logs** : Surveillez les logs des deux systèmes pour détecter les problèmes.

4. **Tests** : Testez avec des montants de test avant de passer en production.

## 📝 Checklist de configuration

### Stripe
- [ ] Ancien endpoint webhook toujours actif
- [ ] Nouvel endpoint webhook créé et actif
- [ ] Signing secret copié et ajouté à Firebase Secrets
- [ ] Métadonnées `system: 'firebase'` ajoutées aux nouvelles sessions
- [ ] Code Firebase Function vérifie les métadonnées avant traitement

### PayPal
- [ ] Ancien webhook toujours actif
- [ ] Nouveau webhook créé et actif
- [ ] `custom_id` avec préfixe `firebase_` pour les nouvelles commandes
- [ ] Code Firebase Function vérifie le `custom_id` avant traitement

### Monitoring
- [ ] Logs Firebase Functions activés
- [ ] Dashboard de monitoring configuré
- [ ] Alertes configurées pour les erreurs

## 🆘 Dépannage

### Les deux systèmes créent des tokens

**Solution** : Utilisez les métadonnées pour identifier la source et ne traiter que les paiements du nouveau système.

### Les webhooks ne sont pas reçus

**Vérifications** :
1. Les URLs sont correctes dans Stripe/PayPal Dashboard
2. Les fonctions Firebase sont déployées
3. Les logs Firebase Functions montrent des erreurs

### Erreurs de signature Stripe

**Solution** : Vérifiez que le Signing secret est correctement configuré dans Firebase Secrets.

## 📚 Ressources

- [Stripe Webhooks - Multiple Endpoints](https://stripe.com/docs/webhooks)
- [PayPal Webhooks](https://developer.paypal.com/docs/api-basics/notifications/webhooks/)
- [Firebase Functions Logs](https://firebase.google.com/docs/functions/monitor)

