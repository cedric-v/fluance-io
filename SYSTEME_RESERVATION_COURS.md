# Système de Réservation de Cours Fluance

Système intégré de réservation avec synchronisation Google Calendar.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│ Google Calendar │ ──── │ Cloud Functions  │ ──── │    Firestore    │
│ (Source vérité) │      │   (Backend)      │      │    (Database)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
              │  Stripe   │ │ Gmail │ │  Google   │
              │ Paiements │ │ Email │ │  Sheets   │
              └───────────┘ └───────┘ └───────────┘
```

## Structure Firestore

### Collection `courses`
```javascript
{
  gcalId: "google_calendar_event_id",
  title: "Fluance - Mouvements en conscience",
  description: "Description du cours",
  location: "le duplex danse & bien-être, Rte de Chantemerle 58d, 1763 Granges-Paccot",
  startTime: Timestamp,
  endTime: Timestamp,
  date: "2026-01-22",
  time: "20:15",
  maxCapacity: 15,        // Extrait de [max:15] dans la description GCal
  minParticipants: 3,     // Extrait de [min:3] (défaut 1 = pas d'annulation auto)
  price: 25,              // Extrait de [price:25] ou défaut 25
  participantCount: 0,
  status: "active",       // active, cancelled, completed
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection `bookings`
```javascript
{
  bookingId: "auto_generated_id",
  courseId: "course_document_id",
  courseName: "Fluance - Mouvements en conscience",
  courseDate: "2026-01-22",
  courseTime: "20:15",
  courseLocation: "le duplex...",
  email: "user@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  phone: "+41791234567",
  paymentMethod: "card",    // card, twint, sepa_debit, cash
  pricingOption: "single",  // trial, single, flow_pass, semester_pass
  amount: 2500,             // En centimes (25.00 CHF)
  currency: "CHF",
  status: "confirmed",      // pending, confirmed, pending_cash, cancelled, waiting
  stripePaymentIntentId: "pi_xxx",
  stripeClientSecret: "pi_xxx_secret_xxx",
  paidAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  notes: ""
}
```

### Collection `waitlist`
```javascript
{
  bookingId: "auto_generated_id",
  courseId: "course_document_id",
  email: "user@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  phone: "+41791234567",
  status: "waiting",        // waiting, notified, converted, expired
  position: 1,
  createdAt: Timestamp,
  notifiedAt: Timestamp
}
```

### Collection `userPasses` (Flow Pass & Pass Semestriel)
```javascript
{
  email: "user@example.com",
  passType: "flow_pass",      // flow_pass ou semester_pass
  passName: "Flow Pass",
  sessionsTotal: 10,          // -1 pour illimité (semester_pass)
  sessionsUsed: 3,
  sessionsRemaining: 7,       // -1 pour illimité
  purchaseDate: Timestamp,
  expiryDate: Timestamp,      // +12 mois (flow_pass) ou +6 mois (semester_pass)
  status: "active",           // active, expired, exhausted, cancelled
  isRecurring: false,         // true pour semester_pass
  price: 21000,               // En centimes
  currency: "CHF",
  stripePaymentIntentId: "pi_xxx",
  stripeSubscriptionId: "sub_xxx",  // Pour semester_pass uniquement
  firstName: "Jean",
  lastName: "Dupont",
  phone: "+41791234567",
  sessionsHistory: [          // Historique des séances utilisées
    {
      courseId: "course_id",
      usedAt: Timestamp,
      sessionNumber: 1
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Cloud Functions

| Fonction | Type | Description |
|----------|------|-------------|
| `syncPlanning` | Scheduled (30min) | Synchronise Google Calendar → Firestore |
| `syncPlanningManual` | HTTP | Synchronisation manuelle (pour tests) |
| `getCourseStatus` | HTTP | Retourne les places disponibles |
| `getAvailableCourses` | HTTP | Liste tous les cours à venir |
| `checkUserPass` | HTTP | Vérifie si l'utilisateur a un pass actif |
| `bookCourse` | HTTP POST | Crée une réservation (avec ou sans pass) |
| `webhookStripe` | HTTP POST | Webhook Stripe unifié (produits en ligne + réservations + pass) |
| `cancelCourseBooking` | HTTP POST | Annule une réservation |
| `getUserBookings` | HTTP | Liste les réservations d'un utilisateur |
| `sendTrialFollowUps` | Scheduled (10h) | Email de suivi le lendemain d'un cours d'essai |
| `sendTrialFollowUpsManual` | HTTP | Déclenchement manuel du suivi cours d'essai |

## Flux de réservation

```
┌─────────────────────────────────────────────────────────────┐
│  1. L'utilisateur entre son email                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  2. checkUserPass vérifie dans Firestore                    │
│     - Pass Semestriel actif ?                               │
│     - Flow Pass avec séances restantes ?                    │
│     - Première visite (cours d'essai) ?                     │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Pass     │    │ Flow Pass│    │ Pas de   │
    │Semestriel│    │ avec     │    │ pass     │
    │ actif    │    │ séances  │    │          │
    └──────────┘    └──────────┘    └──────────┘
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Réserver │    │ Réserver │    │ Choisir  │
    │ GRATUIT  │    │ -1 séance│    │ formule  │
    │ (illimité)│   │          │    │ + payer  │
    └──────────┘    └──────────┘    └──────────┘
```

## Configuration des Secrets Firebase

```bash
# 1. Service Account Google (JSON stringifié)
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT
# Collez le CONTENU COMPLET du fichier JSON téléchargé (fluance-calendar-sync-xxxxx.json)
# ⚠️ Copiez TOUT le contenu du fichier, de { jusqu'à }
# Ce fichier contient aussi l'email (client_email) que vous utiliserez pour partager le calendrier

# 2. ID du calendrier Google
firebase functions:secrets:set GOOGLE_CALENDAR_ID
# Format: xxx@group.calendar.google.com
# Voir section "Comment obtenir le GOOGLE_CALENDAR_ID" ci-dessous

# 3. ID du Google Sheet pour le suivi
firebase functions:secrets:set GOOGLE_SHEET_ID
# Format: VOTRE_SPREADSHEET_ID (ex: 1bAbNzo_bkywtfhGWlSLh3yTZaMDrRa8_GRCRN1g23d4)

# 4. Webhook Stripe pour les réservations
firebase functions:secrets:set STRIPE_BOOKING_WEBHOOK_SECRET
# Format: whsec_xxx
```

## Comment obtenir le GOOGLE_CALENDAR_ID

### Méthode 1 : Via l'interface Google Calendar (Recommandé)

1. **Ouvrez Google Calendar** : https://calendar.google.com
2. **Cliquez sur les 3 points** (⋮) à côté du calendrier que vous voulez utiliser
3. **Sélectionnez "Paramètres et partage"**
4. **Faites défiler jusqu'à "Intégrer le calendrier"**
5. **Copiez l'ID du calendrier** :
   - Il apparaît sous "Identifiant du calendrier"
   - Format : `xxxxxxxxxxxxx@group.calendar.google.com`
   - Ou pour un calendrier personnel : `votre-email@gmail.com`

### Méthode 2 : Via l'URL du calendrier

Si vous avez partagé le calendrier publiquement ou avez un lien :

1. **Ouvrez le calendrier dans Google Calendar**
2. **Cliquez sur les 3 points** (⋮) > "Paramètres et partage"
3. **Activez "Rendre disponible publiquement"** (si nécessaire)
4. **Dans "Intégrer le calendrier"**, l'ID est visible dans l'URL de l'iframe :
   ```
   src="https://calendar.google.com/calendar/embed?src=XXXXX@group.calendar.google.com"
   ```
   L'ID est la partie après `src=`

### Méthode 3 : Via l'API Google Calendar

Si vous avez déjà configuré l'authentification :

```javascript
const {google} = require('googleapis');
const calendar = google.calendar('v3');

// Lister tous vos calendriers
const response = await calendar.calendarList.list();
const calendars = response.data.items;

// Trouver votre calendrier
const myCalendar = calendars.find(cal => cal.summary === 'Nom de votre calendrier');
console.log('Calendar ID:', myCalendar.id);
```

### Types d'IDs de calendrier

| Type | Format | Exemple |
|------|--------|---------|
| **Calendrier personnel** | `votre-email@gmail.com` | `votre-email@gmail.com` |
| **Calendrier partagé/groupe** | `xxx@group.calendar.google.com` | `abc123@group.calendar.google.com` |
| **Calendrier secondaire** | `votre-email#calendrier@group.calendar.google.com` | `votre-email#travail@group.calendar.google.com` |

### Vérifier que l'ID fonctionne

Une fois l'ID obtenu, testez-le avec la fonction de synchronisation manuelle :

```bash
curl https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual
```

Si vous obtenez une erreur `404 Not Found`, vérifiez que :
- Le calendrier est partagé avec le Service Account
- L'ID est correct (copié-collé complet)
- Le Service Account a les permissions "Voir tous les détails de l'événement"

## Configuration Google Calendar

> 💡 **Note importante** : Vous créerez **un seul Service Account** qui sera utilisé pour :
> - Accéder au Google Calendar (lecture des événements)
> - Écrire dans le Google Sheet (suivi des réservations)
> 
> Le même email (`client_email` du fichier JSON) sera donc utilisé pour partager **à la fois** le calendrier ET le Google Sheet.

### Créer un Service Account

1. Accédez à [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un projet ou sélectionnez un projet existant
3. Activez les APIs :
   - Google Calendar API
   - Google Sheets API
4. Créez un Service Account :
   - IAM & Admin > Service Accounts > Create
   - Donnez un nom (ex: "fluance-calendar-sync")
   - Cliquez sur "Create and Continue"
   - Rôle : "Editor" (ou "Viewer" si lecture seule)
   - Cliquez sur "Done"
   - **Téléchargez le fichier JSON** :
     * Cliquez sur le Service Account créé
     * Onglet "Keys" > "Add Key" > "Create new key"
     * Format : JSON
     * Le fichier se télécharge automatiquement (ex: `fluance-calendar-sync-xxxxx.json`)

5. **Trouver l'email du Service Account dans le fichier JSON** :
   
   Le fichier téléchargé a un nom comme : `fluance-calendar-sync-xxxxx-xxxxx.json`
   
   **Ouvrez ce fichier** avec un éditeur de texte (VS Code, TextEdit, etc.)
   
   **Cherchez le champ `"client_email"`** (généralement vers la ligne 5-6) :
   
   ```json
   {
     "type": "service_account",
     "project_id": "mon-projet-fluance",
     "private_key_id": "abc123def456...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "fluance-calendar-sync@mon-projet-fluance.iam.gserviceaccount.com",
     "client_id": "123456789012345678901",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     ...
   }
   ```
   
   **L'email à copier** est la valeur de `"client_email"` :
   - Format : `nom-service-account@nom-projet.iam.gserviceaccount.com`
   - Exemple : `fluance-calendar-sync@mon-projet-fluance.iam.gserviceaccount.com`
   
   ⚠️ **Important** : 
   - C'est cet email que vous devez utiliser pour partager le calendrier, PAS votre email personnel !
   - **Ce même email sera aussi utilisé pour partager le Google Sheet** (voir section "Configuration Google Sheets")

6. **Partagez le calendrier avec cet email** :
   - Dans Google Calendar, paramètres du calendrier
   - Section "Partager avec des personnes"
   - Cliquez sur "Ajouter des personnes"
   - **Collez l'email du Service Account** (celui du fichier JSON)
   - Permission : **"Voir tous les détails de l'événement"** (minimum requis)
   - Cliquez sur "Envoyer"

### Format des événements dans Google Calendar

Dans la **description** de l'événement, ajoutez :
- `[max:15]` - Capacité maximum (défaut: 10)
- `[min:3]` - Nombre **minimum** d'inscrits pour que le cours ait lieu (défaut: 1 = pas de minimum).
  En-dessous du seuil 2 h avant le cours, le cours est annulé automatiquement et
  les inscrits sont prévenus — voir [GESTION_MINIMUM_PARTICIPANTS.md](GESTION_MINIMUM_PARTICIPANTS.md).
- `[price:25]` - Prix en CHF (défaut: 25)

Exemple :
```
Cours de yoga Fluance - niveau tous niveaux

[max:15]
[min:3]
[price:25]

Apportez votre tapis et une bouteille d'eau.
```

## Configuration Google Sheets

### Structure du Google Sheet

Créez un onglet nommé **"Réservations"** avec les colonnes :

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Date Inscription | Prénom | Nom | Email | Téléphone | Cours | Date Cours | Heure | Mode Paiement | Statut Paiement | Montant | Statut | Course ID | Booking ID | Notes |

### Partager avec le Service Account

⚠️ **C'est le même email que pour le Google Calendar !**

Utilisez le même Service Account (même `client_email` du fichier JSON) :

1. Ouvrez le Google Sheet
2. Cliquez sur **"Partager"** (bouton en haut à droite)
3. **Ajoutez l'email du Service Account** :
   - C'est le même email que vous avez utilisé pour partager le calendrier
   - Format : `xxxxx@xxxxx.iam.gserviceaccount.com`
   - Vous le trouvez dans le fichier JSON téléchargé (champ `client_email`)
4. Permission : **"Éditeur"** (nécessaire pour écrire dans le Sheet)
5. Cliquez sur "Envoyer"

## Configuration Stripe

### Créer les produits et prix

```bash
# Dans le dashboard Stripe ou via API

# Cours à la carte
stripe products create --name="Cours Fluance - À la carte" --default-price-data.currency=chf --default-price-data.unit-amount=2500

# Flow Pass
stripe products create --name="Flow Pass - 10 séances" --default-price-data.currency=chf --default-price-data.unit-amount=21000

# Pass Semestriel (récurrent)
stripe products create --name="Pass Semestriel Fluance" 
stripe prices create --product=prod_xxx --currency=chf --unit-amount=34000 --recurring.interval=month --recurring.interval-count=6
```

### Configurer le Webhook

**Le webhook existant `webhookStripe` gère maintenant tout** (produits en ligne + réservations + pass).

1. Dashboard Stripe > Developers > Webhooks > `fluance-io-website`
2. Vérifiez que ces événements sont sélectionnés :
   - `payment_intent.succeeded` ✅ (déjà présent)
   - `payment_intent.payment_failed` ⚠️ **À ajouter**
   - `checkout.session.completed` ✅ (déjà présent)
   - `invoice.paid` ⚠️ **À ajouter** (pour renouvellement Pass Semestriel)
   - `customer.subscription.deleted` ✅ (déjà présent)
3. Le signing secret est déjà configuré : `STRIPE_WEBHOOK_SECRET`

> **Note** : Toute la logique est centralisée dans `webhookStripe`. Le système différencie automatiquement les types de paiements via les métadonnées (`metadata.type`, `metadata.passType`, `metadata.system`).

### Activer TWINT

TWINT est disponible automatiquement avec Stripe en Suisse. Vérifiez que votre compte Stripe est configuré pour la Suisse.

## Déploiement

```bash
# 1. Installer les dépendances
cd functions
npm install

# 2. Déployer les fonctions
firebase deploy --only functions:syncPlanning,functions:syncPlanningManual,functions:getCourseStatus,functions:getAvailableCourses,functions:bookCourse,functions:stripeBookingWebhook,functions:cancelCourseBooking,functions:getUserBookings

# 3. Déployer le site
npm run build
# puis push vers GitHub pour GitHub Pages
```

## Tests

### Tester la synchronisation

```bash
# Synchronisation manuelle
curl https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual
```

### Tester une réservation

```bash
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/bookCourse \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "COURSE_ID",
    "email": "test@example.com",
    "firstName": "Test",
    "paymentMethod": "cash",
    "pricingOption": "single"
  }'
```

### Vérifier le statut d'un cours

```bash
curl "https://europe-west1-fluance-protected-content.cloudfunctions.net/getCourseStatus?courseId=COURSE_ID"
```

## Options tarifaires

| ID | Nom | Prix | Description |
|----|-----|------|-------------|
| `trial` | Cours d'essai | 0 CHF | Première séance offerte |
| `single` | À la carte | 25 CHF | Séance unique |
| `flow_pass` | Flow Pass | 210 CHF | 10 séances (12 mois) |
| `semester_pass` | Pass Semestriel | 340 CHF | Illimité 6 mois (récurrent) |

## Modes de paiement

| Code | Description | Flux |
|------|-------------|------|
| `card` | Carte bancaire | Stripe → Webhook → Confirmation |
| `twint` | TWINT | Stripe → Webhook → Confirmation |
| `sepa_debit` | Prélèvement SEPA | Stripe → Webhook (différé) → Confirmation |
| `cash` | Espèces | Confirmation immédiate → Paiement sur place |

## Notifications Email

Le système utilise l'extension Firebase **Trigger Email**. Templates à créer :

- `booking-confirmation` : Confirmation de réservation
- `waitlist-spot-available` : Place disponible (liste d'attente)

### Configuration extension Trigger Email

1. Firebase Console > Extensions > Trigger Email from Firestore
2. Configurez avec vos credentials SMTP (Mailjet, SendGrid, etc.)
3. Collection : `mail`

## Frontend

### Page de réservation

URL : `/presentiel/reserver/`

Le script `booking.js` :
1. Charge les cours disponibles via `getAvailableCourses`
2. Affiche les places en temps réel
3. Ouvre une modal de réservation au clic
4. Gère le paiement Stripe ou espèces

### Intégration Stripe Elements

Ajoutez votre clé publique Stripe dans `booking.js` :

```javascript
const CONFIG = {
  STRIPE_PUBLISHABLE_KEY: 'pk_live_xxx',
  // ...
};
```
