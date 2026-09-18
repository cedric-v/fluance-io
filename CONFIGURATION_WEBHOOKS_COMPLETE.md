# Guide complet : Configuration des webhooks Stripe et PayPal

Ce guide vous explique comment configurer les webhooks Stripe et PayPal pour un processus complet de A à Z, depuis l'achat jusqu'à l'accès à l'espace membre, en passant par l'ajout du contact dans Mailjet avec les bonnes propriétés.

## 📋 Vue d'ensemble du processus

```
1. Client clique sur bouton d'achat
   ↓
2. Redirection vers Stripe/PayPal Checkout
   ↓
3. Client paie
   ↓
4. Webhook reçoit la notification de paiement réussi
   ↓
5. Webhook crée un token de registration dans Firestore
   ↓
6. Webhook envoie un email avec le lien de création de compte
   ↓
7. Webhook met à jour/ajoute le contact dans Mailjet avec les propriétés
   ↓
8. Client clique sur le lien dans l'email
   ↓
9. Client crée son compte Firebase
   ↓
10. Client accède à l'espace membre avec le contenu du produit acheté
```

## 🎯 Produits à configurer

### Produit 1 : "21jours" (Défi 21 jours)
- **Montant** : 19 CHF (paiement unique)
- **Identifiant interne** : `21jours`
- **Page de vente** : https://fluance.io/cours-en-ligne/21-jours-mouvement/

### Produit 2 : "complet" (Approche Fluance Complète)
- **Montant mensuel** : 30 CHF/mois
- **Montant trimestriel** : 75 CHF/trimestre
- **Identifiant interne** : `complet`
- **Page de vente** : https://fluance.io/decouvrir-ma-pratique/

---

## 🔵 Configuration Stripe

### Étape 1 : Créer les produits dans Stripe Dashboard

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com/)
2. Allez dans **Products** (Produits) dans le menu de gauche
3. Cliquez sur **+ Add product** (Ajouter un produit)

#### Produit 1 : "21jours"
- **Name** : `Fluance : 21 jours pour remettre du mouvement`
- **Description** : `Parcours de 21 mini-séries de pratiques Fluance, simples et libératrices`
- **Product ID** : `prod_TakXdTP0UcMy9J`
- **Price ID** : `price_1SdZ2X2Esx6PN6y1wnkrLfSu`
- **Pricing** :
  - **Price** : `19.00`
  - **Currency** : `CHF`
  - **Billing period** : `One time` (paiement unique)

#### Produit 2 : "complet" (mensuel)
- **Name** : `Fluance en ligne - mensuel`
- **Description** : `Accès hebdomadaire à une nouvelle mini-série de pratiques + la communauté`
- **Product ID** : `prod_TakZyjf0f1F5Ej`
- **Price ID** : `price_1SdZ4p2Esx6PN6y1bzRGQSC5`
- **Pricing** :
  - **Price** : `30.00`
  - **Currency** : `CHF`
  - **Billing period** : `Recurring` (récurrent)
  - **Recurring interval** : `Monthly` (mensuel)

#### Produit 3 : "complet" (trimestriel)
- **Name** : `Fluance en ligne - trimestriel`
- **Description** : `Accès hebdomadaire à une nouvelle mini-série de pratiques + la communauté`
- **Product ID** : `prod_TakbVXK9sDba9F`
- **Price ID** : `price_1SdZ6E2Esx6PN6y11qme0Rde`
- **Pricing** :
  - **Price** : `75.00`
  - **Currency** : `CHF`
  - **Billing period** : `Recurring` (récurrent)
  - **Recurring interval** : `Every 3 months` (tous les 3 mois)

### Étape 2 : Configurer le webhook Stripe

1. Dans Stripe Dashboard, allez dans **Developers** → **Webhooks**
2. Cliquez sur **+ Add endpoint** (Ajouter un endpoint)
3. **Endpoint URL** : 
   ```
   https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe
   ```
4. **Description** : `Webhook Firebase pour les paiements Fluance`
5. **Events to send** : Sélectionnez ces événements :
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `customer.subscription.deleted` (pour les annulations d'abonnement)
   - ✅ `invoice.payment_failed` (pour les échecs de paiement)
6. Cliquez sur **Add endpoint**
7. **📝 Notez le Signing secret** (commence par `whsec_xxxxx`) - vous en aurez besoin pour sécuriser le webhook

### Étape 3 : Créer une session Checkout avec métadonnées

⚠️ **IMPORTANT** : Lors de la création d'une session Checkout Stripe, vous DEVEZ passer ces métadonnées :

```javascript
// Exemple pour "21jours"
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [
    {
      price: 'price_1SdZ2X2Esx6PN6y1wnkrLfSu', // Price ID pour "21jours"
      quantity: 1,
    },
  ],
  mode: 'payment', // Paiement unique
  success_url: 'https://fluance.io/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://fluance.io/cancel',
  metadata: {
    system: 'firebase',        // ⚠️ OBLIGATOIRE : Identifie le système
    product: '21jours'         // ⚠️ OBLIGATOIRE : '21jours' ou 'complet'
  },
});

// Exemple pour "complet" mensuel
const sessionMensuel = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [
    {
      price: 'price_1SdZ4p2Esx6PN6y1bzRGQSC5', // Price ID pour "complet" mensuel
      quantity: 1,
    },
  ],
  mode: 'subscription', // Abonnement récurrent
  success_url: 'https://fluance.io/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://fluance.io/cancel',
  metadata: {
    system: 'firebase',
    product: 'complet'
  },
});

// Exemple pour "complet" trimestriel
const sessionTrimestriel = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [
    {
      price: 'price_1SdZ6E2Esx6PN6y11qme0Rde', // Price ID pour "complet" trimestriel
      quantity: 1,
    },
  ],
  mode: 'subscription', // Abonnement récurrent
  success_url: 'https://fluance.io/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://fluance.io/cancel',
  metadata: {
    system: 'firebase',
    product: 'complet'
  },
});
```

**Métadonnées requises :**
- `metadata.system = 'firebase'` : Identifie que ce paiement est pour le système Firebase
- `metadata.product = '21jours'` ou `'complet'` : Identifie le produit acheté

**⚠️ Sans ces métadonnées, le webhook ignorera le paiement !**

### Étape 4 : Vérifier les logs du webhook

1. Dans Stripe Dashboard, allez dans **Developers** → **Webhooks**
2. Cliquez sur votre endpoint
3. Allez dans l'onglet **Logs** pour voir les événements reçus
4. Vérifiez que les événements sont bien envoyés et reçus

---

## 🟠 Configuration PayPal

### Étape 1 : Créer les produits dans PayPal Dashboard

1. Allez sur [PayPal Dashboard](https://www.paypal.com/businessmanage/products)
2. Allez dans **Products** (Produits) dans le menu
3. Cliquez sur **Create product** (Créer un produit)

#### Produit 1 : "21jours"
- **Product name** : `Défi 21 jours`
- **Description** : `Parcours de 21 mini-séries de pratiques simples et libératrices`
- **Product type** : `One-time payment` (paiement unique)
- **Price** : `19.00 CHF`
- Cliquez sur **Save**
- **📝 Notez le Product ID** (commence par `PROD-xxxxx`)

#### Produit 2 : "complet" (mensuel)
- **Product name** : `Approche Fluance Complète - Mensuel`
- **Description** : `Accès hebdomadaire à une nouvelle mini-série de pratiques`
- **Product type** : `Subscription` (abonnement)
- **Billing cycle** : `Monthly` (mensuel)
- **Price** : `30.00 CHF`
- Cliquez sur **Save**
- **📝 Notez le Product ID** (commence par `PROD-xxxxx`)

#### Produit 3 : "complet" (trimestriel)
- **Product name** : `Approche Fluance Complète - Trimestriel`
- **Description** : `Accès hebdomadaire à une nouvelle mini-série de pratiques`
- **Product type** : `Subscription` (abonnement)
- **Billing cycle** : `Every 3 months` (tous les 3 mois)
- **Price** : `75.00 CHF`
- Cliquez sur **Save**
- **📝 Notez le Product ID** (commence par `PROD-xxxxx`)

### Étape 2 : Configurer le webhook PayPal

1. Dans PayPal Dashboard, allez dans **Developers** → **Webhooks**
2. Cliquez sur **Create webhook** (Créer un webhook)
3. **Webhook URL** :
   ```
   https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal
   ```
4. **Event types** : Sélectionnez ces événements :
   - ✅ `PAYMENT.CAPTURE.COMPLETED`
   - ✅ `CHECKOUT.ORDER.APPROVED`
   - ✅ `BILLING.SUBSCRIPTION.CANCELLED` (pour les annulations d'abonnement)
   - ✅ `BILLING.SUBSCRIPTION.SUSPENDED` (pour les suspensions d'abonnement)
   - ✅ `BILLING.SUBSCRIPTION.PAYMENT.FAILED` (pour les échecs de paiement)
   - ✅ `PAYMENT.SALE.DENIED` (pour les paiements refusés)
5. Cliquez sur **Save**
6. **📝 Notez le Webhook ID** pour référence

### Étape 3 : Créer une commande avec custom_id

⚠️ **IMPORTANT** : Lors de la création d'une commande PayPal, vous DEVEZ passer `custom_id` :

```javascript
const order = await paypal.orders.create({
  intent: 'CAPTURE',
  purchase_units: [{
    amount: {
      currency_code: 'CHF',
      value: '19.00'
    },
    custom_id: 'firebase_21jours'  // ⚠️ OBLIGATOIRE : Format 'firebase_21jours' ou 'firebase_complet'
  }]
});
```

**Format du custom_id :**
- Pour "21jours" : `firebase_21jours`
- Pour "complet" : `firebase_complet`

**⚠️ Sans ce custom_id au format correct, le webhook ignorera le paiement !**

### Étape 4 : Vérifier les logs du webhook

1. Dans PayPal Dashboard, allez dans **Developers** → **Webhooks**
2. Cliquez sur votre webhook
3. Allez dans l'onglet **Event notifications** pour voir les événements reçus
4. Vérifiez que les événements sont bien envoyés et reçus

---

## 📧 Configuration Mailjet

### Vérifier que les contact properties existent

Les webhooks mettent automatiquement à jour les propriétés suivantes dans Mailjet :

| Property | Type | Description |
|----------|------|-------------|
| `statut` | String | `"client"` |
| `produits_achetes` | String | Liste séparée par virgules : `"21jours"` ou `"complet"` ou `"21jours,complet"` |
| `date_premier_achat` | DateTime | Date du premier achat (format ISO) |
| `date_dernier_achat` | DateTime | Date du dernier achat (format ISO) |
| `valeur_client` | Decimal | Montant total dépensé en CHF |
| `nombre_achats` | Integer | Nombre total de commandes |
| `est_client` | Boolean | `"True"` |
| `firstname` | String | Prénom du client (si disponible) |

**Vérification :**
1. Allez sur [Mailjet Dashboard](https://app.mailjet.com/contacts)
2. Allez dans **Contacts** → **Contact Properties**
3. Vérifiez que toutes ces propriétés existent
4. Si une propriété manque, créez-la avec le type approprié

### Liste Mailjet

Le webhook ajoute automatiquement le contact à la liste **10524140** (liste principale Fluance).

---

## 🔄 Processus complet détaillé

### 1. Client clique sur le bouton d'achat

**Page "21jours"** : https://fluance.io/cours-en-ligne/21-jours-mouvement/
- Bouton : "Démarrer le challenge de 21 jours pour 19 CHF / équivalent €"
- Actuellement : Lien vers `https://espace.fluance.io/par/21jours/bdc` (Ontraport)

**Page "complet"** : https://fluance.io/decouvrir-ma-pratique/
- Bouton mensuel : "S'abonner mensuellement"
- Bouton trimestriel : "S'abonner trimestriellement"
- Actuellement : Liens vers Ontraport

**⚠️ Action requise** : Modifier ces boutons pour qu'ils créent des sessions Stripe/PayPal avec les bonnes métadonnées.

### 2. Création de la session Checkout (Stripe) ou commande (PayPal)

**Stripe :**
```javascript
// Exemple pour "21jours"
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{ price: 'price_xxxxx', quantity: 1 }],
  mode: 'payment',
  success_url: 'https://fluance.io/success',
  cancel_url: 'https://fluance.io/cancel',
  metadata: {
    system: 'firebase',    // ⚠️ OBLIGATOIRE
    product: '21jours'     // ⚠️ OBLIGATOIRE
  },
});
```

**PayPal :**
```javascript
// Exemple pour "21jours"
const order = await paypal.orders.create({
  intent: 'CAPTURE',
  purchase_units: [{
    amount: { currency_code: 'CHF', value: '19.00' },
    custom_id: 'firebase_21jours'  // ⚠️ OBLIGATOIRE
  }]
});
```

### 3. Client paie sur Stripe/PayPal

Le client est redirigé vers Stripe Checkout ou PayPal et effectue le paiement.

### 4. Webhook reçoit la notification

**Stripe - Paiement réussi :**
- Événement : `checkout.session.completed` ou `payment_intent.succeeded`
- Le webhook vérifie :
  1. ✅ `metadata.system === 'firebase'`
  2. ✅ `metadata.product === '21jours'` ou `'complet'`
  3. ✅ Email du client présent

**Stripe - Annulation d'abonnement :**
- Événement : `customer.subscription.deleted`
- Le webhook vérifie :
  1. ✅ `metadata.system === 'firebase'`
  2. ✅ `metadata.product === 'complet'` (seul les abonnements peuvent être annulés)
  3. ✅ Email du client présent
- **Action** : Retire le produit "complet" du tableau `products` dans Firestore

**Stripe - Échec de paiement :**
- Événement : `invoice.payment_failed`
- **Action** : Log de l'événement (l'accès n'est pas retiré immédiatement, seulement si l'abonnement est finalement annulé)

**PayPal - Paiement réussi :**
- Événement : `PAYMENT.CAPTURE.COMPLETED` ou `CHECKOUT.ORDER.APPROVED`
- Le webhook vérifie :
  1. ✅ `custom_id` commence par `'firebase_'`
  2. ✅ `custom_id` contient `'21jours'` ou `'complet'`
  3. ✅ Email du client présent

**PayPal - Annulation d'abonnement :**
- Événement : `BILLING.SUBSCRIPTION.CANCELLED` ou `BILLING.SUBSCRIPTION.SUSPENDED`
- Le webhook vérifie :
  1. ✅ `custom_id` commence par `'firebase_'`
  2. ✅ `custom_id` contient `'complet'` (seul les abonnements peuvent être annulés)
  3. ✅ Email du client présent
- **Action** : Retire le produit "complet" du tableau `products` dans Firestore

**PayPal - Échec de paiement :**
- Événement : `BILLING.SUBSCRIPTION.PAYMENT.FAILED` ou `PAYMENT.SALE.DENIED`
- **Action** : Log de l'événement (l'accès n'est pas retiré immédiatement, seulement si l'abonnement est finalement annulé)

### 5. Webhook crée un token de registration

Le webhook :
1. Génère un token unique
2. Stocke le token dans Firestore (`registrationTokens` collection) avec :
   - `email` : Email du client
   - `product` : `'21jours'` ou `'complet'`
   - `createdAt` : Date de création
   - `expiresAt` : Date d'expiration (30 jours)
   - `used` : `false`

### 6. Webhook envoie un email avec le lien de création de compte

Le webhook envoie un email via Mailjet avec :
- **Sujet** : "Créez votre compte Fluance"
- **Contenu** : Lien vers `/creer-compte?token=xxxxx`
- **Lien valable** : 30 jours, usage unique

### 7. Webhook met à jour/ajoute le contact dans Mailjet

Le webhook :
1. Récupère les propriétés actuelles du contact (s'il existe)
2. Met à jour les propriétés :
   - `statut` : `"client"`
   - `produits_achetes` : Ajoute le produit à la liste (séparée par virgules)
   - `date_dernier_achat` : Date actuelle (format ISO)
   - `date_premier_achat` : Date actuelle si premier achat
   - `valeur_client` : Montant total (somme de tous les achats)
   - `nombre_achats` : Incrémente de 1
   - `est_client` : `"True"`
3. Ajoute le contact à la liste **10524140** (si pas déjà dedans)

### 8. Client clique sur le lien dans l'email

Le client reçoit l'email et clique sur le lien `/creer-compte?token=xxxxx`.

### 9. Client crée son compte Firebase

Sur la page `/creer-compte` :
1. Le token est vérifié dans Firestore
2. Le client crée son compte Firebase Auth (email + mot de passe)
3. Un document utilisateur est créé dans Firestore (`users` collection) avec :
   - `email` : Email du client
   - `products` : Tableau avec le produit acheté
     ```json
     [{
       "name": "21jours",
       "startDate": Timestamp,
       "purchasedAt": Timestamp
     }]
     ```
4. Le token est marqué comme `used: true`

### 10. Client accède à l'espace membre

Le client peut maintenant :
1. Se connecter sur `/connexion-membre`
2. Accéder à l'espace membre `/membre`
3. Voir le contenu du produit acheté (21jours ou complet)
4. Le contenu se débloque progressivement selon la logique de drip

---

## ✅ Checklist de configuration complète

### Stripe
- [ ] Produits créés dans Stripe Dashboard :
  - [ ] "Défi 21 jours" (19 CHF, one-time)
  - [ ] "Approche Fluance Complète - Mensuel" (30 CHF, monthly)
  - [ ] "Approche Fluance Complète - Trimestriel" (75 CHF, every 3 months)
- [ ] Webhook configuré vers `webhookStripe`
- [ ] Événements sélectionnés : `checkout.session.completed`, `payment_intent.succeeded`
- [ ] Code backend passe `metadata.system = 'firebase'` et `metadata.product = '21jours'` ou `'complet'`
- [ ] Test d'un paiement et vérification des logs

### PayPal
- [ ] Produits créés dans PayPal Dashboard :
  - [ ] "Défi 21 jours" (19 CHF, one-time)
  - [ ] "Approche Fluance Complète - Mensuel" (30 CHF, monthly)
  - [ ] "Approche Fluance Complète - Trimestriel" (75 CHF, every 3 months)
- [ ] Webhook configuré vers `webhookPayPal`
- [ ] Événements sélectionnés : `PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`
- [ ] Code backend passe `custom_id = 'firebase_21jours'` ou `'firebase_complet'`
- [ ] Test d'un paiement et vérification des logs

### Mailjet
- [ ] Contact properties créées :
  - [ ] `statut` (String)
  - [ ] `produits_achetes` (String)
  - [ ] `date_premier_achat` (DateTime)
  - [ ] `date_dernier_achat` (DateTime)
  - [ ] `valeur_client` (Decimal)
  - [ ] `nombre_achats` (Integer)
  - [ ] `est_client` (Boolean)
  - [ ] `firstname` (String)
- [ ] Liste **10524140** existe et est active

### Firebase
- [ ] Secrets configurés :
  - [ ] `MAILJET_API_KEY`
  - [ ] `MAILJET_API_SECRET`
- [ ] Fonctions déployées :
  - [ ] `webhookStripe`
  - [ ] `webhookPayPal`
- [ ] Collections Firestore :
  - [ ] `registrationTokens` (règles de sécurité configurées)
  - [ ] `users` (règles de sécurité configurées)

### Pages de vente
- [ ] Boutons de paiement modifiés pour créer des sessions Stripe/PayPal
- [ ] Métadonnées correctes passées (`metadata.system`, `metadata.product` pour Stripe, `custom_id` pour PayPal)

---

## 🧪 Test du processus complet

### Test 1 : Achat "21jours" via Stripe

1. Cliquez sur le bouton d'achat "21jours"
2. Complétez le paiement sur Stripe Checkout
3. Vérifiez dans Stripe Dashboard → Webhooks → Logs que l'événement est reçu
4. Vérifiez dans Firebase Console → Functions → Logs que le webhook a traité l'événement
5. Vérifiez que l'email a été envoyé (vérifiez votre boîte mail)
6. Vérifiez dans Mailjet Dashboard → Contacts que le contact a été ajouté avec les bonnes propriétés
7. Cliquez sur le lien dans l'email
8. Créez votre compte Firebase
9. Connectez-vous et vérifiez l'accès à l'espace membre avec le contenu "21jours"

### Test 2 : Achat "complet" via PayPal

1. Cliquez sur le bouton d'achat "complet"
2. Complétez le paiement sur PayPal
3. Vérifiez dans PayPal Dashboard → Webhooks → Event notifications que l'événement est reçu
4. Vérifiez dans Firebase Console → Functions → Logs que le webhook a traité l'événement
5. Vérifiez que l'email a été envoyé
6. Vérifiez dans Mailjet Dashboard → Contacts que le contact a été mis à jour avec les bonnes propriétés
7. Cliquez sur le lien dans l'email
8. Créez votre compte Firebase (ou connectez-vous si déjà créé)
9. Connectez-vous et vérifiez l'accès à l'espace membre avec le contenu "complet"

---

## 🆘 Dépannage

### Le webhook n'est pas appelé

1. **Vérifiez l'URL du webhook** dans Stripe/PayPal Dashboard
2. **Vérifiez que les événements sont bien sélectionnés**
3. **Vérifiez les logs** dans Stripe/PayPal Dashboard → Webhooks → Logs
4. **Vérifiez les logs Firebase** : `firebase functions:log --only webhookStripe,webhookPayPal`

### Le webhook ignore le paiement

**Stripe :**
- Vérifiez que `metadata.system === 'firebase'`
- Vérifiez que `metadata.product === '21jours'` ou `'complet'`
- Vérifiez les logs Firebase pour voir le message d'erreur

**PayPal :**
- Vérifiez que `custom_id` commence par `'firebase_'`
- Vérifiez que `custom_id` contient `'21jours'` ou `'complet'`
- Vérifiez les logs Firebase pour voir le message d'erreur

### L'email n'est pas envoyé

1. **Vérifiez les secrets Mailjet** : `firebase functions:secrets:access MAILJET_API_KEY`
2. **Vérifiez les logs Firebase** pour voir les erreurs Mailjet
3. **Vérifiez votre boîte spam**
4. **Vérifiez dans Mailjet Dashboard** → Email → History que l'email a été envoyé

### Le contact n'est pas ajouté dans Mailjet

1. **Vérifiez que les contact properties existent** dans Mailjet Dashboard
2. **Vérifiez les logs Firebase** pour voir les erreurs Mailjet
3. **Vérifiez que la liste 10524140 existe** dans Mailjet Dashboard

### Le token n'est pas créé

1. **Vérifiez les logs Firebase** pour voir les erreurs
2. **Vérifiez dans Firestore** → `registrationTokens` que le token a été créé
3. **Vérifiez que les règles de sécurité Firestore** permettent l'écriture par les fonctions

### Le client ne peut pas créer son compte

1. **Vérifiez que le token existe** dans Firestore → `registrationTokens`
2. **Vérifiez que le token n'est pas expiré** (`expiresAt` > maintenant)
3. **Vérifiez que le token n'a pas déjà été utilisé** (`used === false`)
4. **Vérifiez les logs Firebase** pour voir les erreurs

---

## 📚 Ressources

- [Stripe Checkout Sessions API](https://stripe.com/docs/api/checkout/sessions/create)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [PayPal Orders API](https://developer.paypal.com/docs/api/orders/v2/)
- [PayPal Webhooks](https://developer.paypal.com/docs/api-basics/notifications/webhooks/)
- [Mailjet Contact Properties](https://documentation.mailjet.com/hc/en-us/articles/360043176353-Creating-and-Managing-Contact-Properties)
- [Firebase Functions](https://firebase.google.com/docs/functions)

## 📋 Référence rapide

Pour les identifiants Stripe exacts (Product IDs et Price IDs), voir le fichier **`STRIPE_PRODUCTS_IDS.md`**.

---

## 📝 Notes importantes

1. **Métadonnées obligatoires** : Sans les métadonnées correctes (`metadata.system` et `metadata.product` pour Stripe, `custom_id` pour PayPal), le webhook ignorera le paiement.

2. **Sécurité** : Les webhooks devraient vérifier les signatures Stripe/PayPal en production. Actuellement, cette vérification est commentée dans le code.

3. **Montants** : Les montants sont convertis en CHF si nécessaire (EUR → CHF, USD → CHF) avec des taux approximatifs.

4. **Produits multiples** : Si un client achète plusieurs produits, ils sont ajoutés à la liste `produits_achetes` séparée par des virgules.

5. **Premier achat** : Si c'est le premier achat, `date_premier_achat` est définie. Sinon, seule `date_dernier_achat` est mise à jour.

6. **Token d'expiration** : Les tokens de registration expirent après 30 jours et ne peuvent être utilisés qu'une seule fois.

7. **Annulation d'abonnement** : 
   - Lorsqu'un abonnement "complet" est annulé (Stripe : `customer.subscription.deleted`, PayPal : `BILLING.SUBSCRIPTION.CANCELLED`), le produit "complet" est automatiquement retiré du tableau `products` dans Firestore.
   - L'utilisateur perd immédiatement l'accès au contenu "complet" dans l'espace membre.
   - Les métadonnées doivent être présentes dans la subscription pour identifier le système et le produit.

8. **Échecs de paiement** :
   - Les échecs de paiement (Stripe : `invoice.payment_failed`, PayPal : `BILLING.SUBSCRIPTION.PAYMENT.FAILED`) sont loggés mais n'entraînent pas immédiatement la perte d'accès.
   - L'accès sera retiré seulement si l'abonnement est finalement annulé après plusieurs tentatives échouées.
   - TODO: Envoyer un email de notification au client en cas d'échec de paiement.
