# Guide de Déploiement - Système de Réservation

## 📦 Création des Produits Stripe (Optionnel)

> **Note** : Le système de réservation fonctionne avec des montants en dur dans le code. Les produits Stripe sont optionnels mais recommandés pour l'organisation dans votre dashboard.

### Prérequis

```bash
# Installer Stripe CLI si pas déjà fait
brew install stripe/stripe-cli/stripe

# Se connecter à Stripe
stripe login
```

### Créer les produits

```bash
# 1. Cours à la carte (25 CHF)
stripe products create \
  --name="Cours Fluance - À la carte" \
  --description="Séance unique de cours en présentiel" \
  --default-price-data.currency=chf \
  --default-price-data.unit-amount=2500

# Notez le Product ID retourné (ex: prod_xxxxx)
# Notez le Price ID retourné (ex: price_xxxxx)

# 2. Flow Pass (10 séances - 210 CHF)
stripe products create \
  --name="Flow Pass - 10 séances" \
  --description="10 séances de cours en présentiel, valable 12 mois" \
  --default-price-data.currency=chf \
  --default-price-data.unit-amount=21000

# Notez le Product ID et Price ID

# 3. Pass Semestriel (340 CHF - récurrent tous les 6 mois)
# Étape 1 : Créer le produit
stripe products create \
  --name="Pass Semestriel Fluance" \
  --description="Accès illimité aux cours en présentiel pendant 6 mois (renouvellement automatique)"

# Notez le Product ID retourné (ex: prod_xxxxx)

# Étape 2 : Créer le prix récurrent (remplacez prod_xxxxx par le Product ID)
stripe prices create \
  --product=prod_xxxxx \
  --currency=chf \
  --unit-amount=34000 \
  --recurring.interval=month \
  --recurring.interval-count=6

# Notez le Price ID retourné
```

### Alternative : Via le Dashboard Stripe

1. Allez sur [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Cliquez sur **"+ Add product"**
3. Créez les 3 produits avec les prix ci-dessus

## 🔐 Configuration des Secrets Firebase

```bash
# 1. Service Account Google (contenu complet du fichier JSON)
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT
# Collez TOUT le contenu du fichier JSON téléchargé (de { à })

# 2. ID du calendrier Google
firebase functions:secrets:set GOOGLE_CALENDAR_ID
# Format: xxx@group.calendar.google.com

# 3. ID du Google Sheet
firebase functions:secrets:set GOOGLE_SHEET_ID
# Format: VOTRE_SPREADSHEET_ID (ex: 1bAbNzo_bkywtfhGWlSLh3yTZaMDrRa8_GRCRN1g23d4)

# 4. Webhook Stripe pour les réservations
firebase functions:secrets:set STRIPE_BOOKING_WEBHOOK_SECRET
# Format: whsec_xxx (voir section Webhook ci-dessous)
```

## 🔗 Configuration du Webhook Stripe

### 1. Créer l'endpoint dans Stripe Dashboard

1. Allez sur [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Cliquez sur **"+ Add endpoint"**
3. Configurez :
   - **Endpoint URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/stripeBookingWebhook`
   - **Description** : "Webhook pour les réservations de cours"
   - **Events to send** :
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.dispute.created` (optionnel)
4. Cliquez sur **"Add endpoint"**
5. **Copiez le "Signing secret"** (commence par `whsec_`)

### 2. Configurer le secret dans Firebase

```bash
firebase functions:secrets:set STRIPE_BOOKING_WEBHOOK_SECRET
# Collez le signing secret (whsec_xxx)
```

## 🚀 Déploiement

### 1. Installer les dépendances

```bash
cd functions
npm install
```

### 2. Déployer les Cloud Functions

```bash
# Depuis la racine du projet
firebase deploy --only functions:syncPlanning,functions:syncPlanningManual,functions:getCourseStatus,functions:getAvailableCourses,functions:bookCourse,functions:stripeBookingWebhook,functions:cancelCourseBooking,functions:getUserBookings,functions:sendTrialFollowUps,functions:sendTrialFollowUpsManual
```

### 3. Déployer le site (GitHub Pages)

```bash
# Build le site
npm run build

# Commit et push vers GitHub
git add .
git commit -m "feat: système de réservation de cours"
git push origin main

# GitHub Actions déploiera automatiquement
```

## ✅ Vérification Post-Déploiement

### 1. Tester la synchronisation Google Calendar

```bash
# Synchronisation manuelle
curl https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual
```

Réponse attendue :
```json
{
  "success": true,
  "synced": 5,
  "errors": 0
}
```

### 2. Tester la récupération des cours

```bash
curl https://europe-west1-fluance-protected-content.cloudfunctions.net/getAvailableCourses
```

### 3. Tester le statut d'un cours

```bash
# Remplacez COURSE_ID par un ID réel
curl "https://europe-west1-fluance-protected-content.cloudfunctions.net/getCourseStatus?courseId=COURSE_ID"
```

### 4. Vérifier le Webhook Stripe

Dans le Stripe Dashboard > Webhooks, vérifiez que les événements de test sont reçus.

## 🧪 Tests Locaux

### Démarrer le serveur local

```bash
# Depuis la racine du projet
npm start
```

Le site sera accessible sur : `http://localhost:8080`

### Tester une réservation (paiement espèces)

```bash
curl -X POST http://localhost:5001/fluance-protected-content/europe-west1/bookCourse \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "COURSE_ID",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+41791234567",
    "paymentMethod": "cash",
    "pricingOption": "single"
  }'
```

> **Note** : Pour les tests locaux avec Firebase Emulators, utilisez le port `5001` au lieu de l'URL de production.

## 📋 Checklist de Déploiement

- [ ] Produits Stripe créés (optionnel)
- [ ] Secrets Firebase configurés :
  - [ ] `GOOGLE_SERVICE_ACCOUNT`
  - [ ] `GOOGLE_CALENDAR_ID`
  - [ ] `GOOGLE_SHEET_ID`
  - [ ] `STRIPE_BOOKING_WEBHOOK_SECRET`
- [ ] Calendrier Google partagé avec le Service Account
- [ ] Google Sheet partagé avec le Service Account
- [ ] Webhook Stripe configuré et testé
- [ ] Cloud Functions déployées
- [ ] Site déployé sur GitHub Pages
- [ ] Tests de synchronisation réussis
- [ ] Tests de réservation réussis

## 🔧 Configuration Frontend

### Ajouter la clé publique Stripe

Dans `src/assets/js/booking.js`, ligne 19 :

```javascript
const CONFIG = {
  API_BASE_URL: 'https://europe-west1-fluance-protected-content.cloudfunctions.net',
  STRIPE_PUBLISHABLE_KEY: 'pk_live_xxxxx', // ← Ajoutez votre clé publique Stripe
  // ...
};
```

Trouvez votre clé publique dans [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/apikeys)

## 🐛 Dépannage

### Erreur "GoogleService not available"

- Vérifiez que `GOOGLE_SERVICE_ACCOUNT` est bien configuré
- Vérifiez que le fichier JSON est complet (de `{` à `}`)

### Erreur "Unauthorized" lors de la synchronisation

- Vérifiez que le calendrier est partagé avec l'email du Service Account
- Vérifiez que la permission est "Voir tous les détails de l'événement"

### Erreur lors de l'écriture dans Google Sheet

- Vérifiez que le Sheet est partagé avec l'email du Service Account
- Vérifiez que la permission est "Éditeur"

### Webhook Stripe ne fonctionne pas

- Vérifiez l'URL du webhook dans Stripe Dashboard
- Vérifiez que `STRIPE_BOOKING_WEBHOOK_SECRET` est correct
- Testez avec `stripe listen --forward-to http://localhost:5001/...` en local
