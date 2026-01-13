# Checklist de Tests - Système de Réservation

## 🚀 Serveur Local

Le serveur est accessible sur : **http://localhost:8080**

---

## 📋 Tests à Effectuer

### 1. Configuration Préalable

#### ✅ Secrets Firebase configurés
- [ ] `GOOGLE_SERVICE_ACCOUNT` - JSON complet du Service Account
- [ ] `GOOGLE_CALENDAR_ID` - ID du calendrier Google
- [ ] `GOOGLE_SHEET_ID` - ID du Google Sheet (optionnel pour tests)
- [ ] `STRIPE_WEBHOOK_SECRET` - Secret du webhook Stripe existant

#### ✅ Partage Google Calendar
- [ ] Calendrier partagé avec l'email du Service Account
- [ ] Permission : "Voir tous les détails de l'événement"

#### ✅ Partage Google Sheet
- [ ] Sheet partagé avec l'email du Service Account
- [ ] Permission : "Éditeur"

#### ✅ Index Firestore déployé
```bash
firebase deploy --only firestore:indexes
```

#### ✅ Cloud Functions déployées
```bash
firebase deploy --only functions
```

---

### 2. Synchronisation Google Calendar → Firestore

#### Test 2.1 : Synchronisation manuelle
```bash
curl https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual
```

**Résultat attendu :**
```json
{
  "success": true,
  "synced": 2,
  "errors": 0
}
```

**Vérifications :**
- [ ] Aucune erreur JSON
- [ ] `synced > 0` (au moins les cours du 22.01.2026)
- [ ] Vérifier dans Firestore Console que la collection `courses` contient des documents

#### Test 2.2 : Vérifier les données synchronisées
Dans Firebase Console > Firestore > Collection `courses` :

- [ ] Chaque cours a un `gcalId` (ID Google Calendar)
- [ ] `title` : "Cours Fluance"
- [ ] `date` : Format "2026-01-22"
- [ ] `time` : Format "20:15" ou "12:15"
- [ ] `location` : "le duplex danse & bien-être..."
- [ ] `maxCapacity` : Extrait de `[max:15]` dans description GCal (ou 10 par défaut)
- [ ] `price` : Extrait de `[price:25]` dans description GCal (ou 25 par défaut)
- [ ] `startTime` : Timestamp Firestore
- [ ] `status` : "active"

---

### 3. Affichage des Cours Disponibles (Frontend)

#### Test 3.1 : Page de réservation
URL : http://localhost:8080/presentiel/reserver/

**Vérifications :**
- [ ] Page se charge sans erreur
- [ ] Pas d'erreur CSP pour Stripe dans la console
- [ ] Section "Chargement des cours disponibles..." s'affiche initialement
- [ ] Les cours apparaissent après chargement (au moins ceux du 22.01.2026)
- [ ] Chaque carte de cours affiche :
  - [ ] Titre du cours
  - [ ] Date formatée (ex: "jeudi 22 janvier")
  - [ ] Heure
  - [ ] Lieu
  - [ ] Prix (ex: "25 CHF")
  - [ ] Nombre de places restantes (ex: "3 places")
  - [ ] Bouton "Réserver" ou "Liste d'attente" selon disponibilité

#### Test 3.2 : API getAvailableCourses
```bash
curl http://localhost:8080/presentiel/reserver/ 2>/dev/null | grep -o "getAvailableCourses" || echo "Test via console navigateur"
```

**Via Console Navigateur (F12) :**
```javascript
fetch('https://europe-west1-fluance-protected-content.cloudfunctions.net/getAvailableCourses')
  .then(r => r.json())
  .then(console.log)
```

**Résultat attendu :**
```json
{
  "success": true,
  "courses": [
    {
      "id": "course_id",
      "title": "Cours Fluance",
      "date": "2026-01-22",
      "time": "20:15",
      "location": "le duplex...",
      "maxCapacity": 15,
      "spotsRemaining": 15,
      "isFull": false,
      "price": 25
    }
  ]
}
```

**Vérifications :**
- [ ] `success: true`
- [ ] `courses` est un tableau
- [ ] Au moins un cours présent (celui du 22.01.2026)
- [ ] Pas d'erreur 500

---

### 4. Vérification par Email (Système de Pass)

#### Test 4.1 : Email sans pass existant
1. Ouvrir la modal de réservation (cliquer sur "Réserver" d'un cours)
2. Entrer un email qui n'a pas de pass : `test-nouveau@example.com`
3. Cliquer sur "Vérifier"

**Résultat attendu :**
- [ ] Message : "Aucun pass actif trouvé"
- [ ] Affichage des options tarifaires (essai, à la carte, Flow Pass, Pass Semestriel)
- [ ] Formulaire de réservation complet visible

#### Test 4.2 : Email avec Flow Pass actif
**Prérequis :** Créer un Flow Pass dans Firestore pour `test-flowpass@example.com`

Dans Firebase Console > Firestore > Collection `userPasses` :
```json
{
  "email": "test-flowpass@example.com",
  "passType": "flow_pass",
  "sessionsTotal": 10,
  "sessionsUsed": 2,
  "sessionsRemaining": 8,
  "status": "active",
  "expiryDate": "2027-01-01T00:00:00Z",
  "purchaseDate": "2026-01-01T00:00:00Z"
}
```

**Test :**
1. Ouvrir la modal de réservation
2. Entrer : `test-flowpass@example.com`
3. Cliquer sur "Vérifier"

**Résultat attendu :**
- [ ] Message : "Flow Pass actif - 8 séances restantes"
- [ ] Bouton "Réserver avec mon Flow Pass" visible
- [ ] Pas de formulaire de paiement
- [ ] Réservation directe possible

#### Test 4.3 : Email avec Pass Semestriel actif
**Prérequis :** Créer un Pass Semestriel dans Firestore

```json
{
  "email": "test-semester@example.com",
  "passType": "semester_pass",
  "sessionsRemaining": -1,
  "status": "active",
  "expiryDate": "2026-07-01T00:00:00Z"
}
```

**Test :**
1. Entrer : `test-semester@example.com`
2. Cliquer sur "Vérifier"

**Résultat attendu :**
- [ ] Message : "Pass Semestriel actif - Accès illimité"
- [ ] Bouton "Réserver" visible
- [ ] Réservation gratuite

#### Test 4.4 : Email avec pass expiré
**Prérequis :** Créer un pass expiré

```json
{
  "email": "test-expired@example.com",
  "passType": "flow_pass",
  "status": "expired",
  "expiryDate": "2025-01-01T00:00:00Z"
}
```

**Résultat attendu :**
- [ ] Traité comme "pas de pass"
- [ ] Options tarifaires affichées

---

### 5. Réservation avec Pass Actif

#### Test 5.1 : Réservation Flow Pass
1. Email : `test-flowpass@example.com`
2. Sélectionner un cours disponible
3. Cliquer sur "Réserver avec mon Flow Pass"

**Résultat attendu :**
- [ ] Réservation confirmée immédiatement (sans paiement)
- [ ] Message : "Réservation confirmée ! Il vous reste X séance(s)"
- [ ] Dans Firestore `bookings` :
  - [ ] `status: "confirmed"`
  - [ ] `usedPass: true`
  - [ ] `passType: "flow_pass"`
- [ ] Dans Firestore `userPasses` :
  - [ ] `sessionsUsed` incrémenté
  - [ ] `sessionsRemaining` décrémenté
- [ ] Email de confirmation envoyé (vérifier collection `mail`)

#### Test 5.2 : Réservation Pass Semestriel
1. Email : `test-semester@example.com`
2. Réserver un cours

**Résultat attendu :**
- [ ] Réservation confirmée
- [ ] Message : "Réservation confirmée avec votre Pass Semestriel !"
- [ ] `sessionsRemaining: -1` (illimité)

#### Test 5.3 : Flow Pass épuisé
**Prérequis :** Pass avec `sessionsRemaining: 0`

**Résultat attendu :**
- [ ] Message : "Votre Flow Pass est épuisé"
- [ ] Options d'achat affichées

---

### 6. Réservation Nouvelle (Sans Pass)

#### Test 6.1 : Cours d'essai gratuit
1. Email : `test-essai@example.com`
2. Sélectionner "Cours d'essai"
3. Remplir le formulaire
4. Soumettre

**Résultat attendu :**
- [ ] Réservation confirmée immédiatement
- [ ] Pas de paiement requis
- [ ] Email de confirmation
- [ ] Dans Firestore `bookings` : `status: "confirmed"`, `amount: 0`

#### Test 6.2 : À la carte (25 CHF) - Paiement espèces
1. Sélectionner "À la carte"
2. Mode de paiement : "Espèces sur place"
3. Soumettre

**Résultat attendu :**
- [ ] Réservation confirmée immédiatement
- [ ] Message : "Réservation confirmée. Paiement à régler sur place."
- [ ] Dans Firestore `bookings` :
  - [ ] `status: "pending_cash"`
  - [ ] `paymentMethod: "cash"`
- [ ] Dans Google Sheet (si configuré) :
  - [ ] Ligne ajoutée avec "Espèces" et "À régler sur place"

#### Test 6.3 : À la carte - Paiement carte/TWINT
1. Sélectionner "À la carte"
2. Mode de paiement : "Carte / TWINT"
3. Soumettre

**Résultat attendu :**
- [ ] PaymentIntent Stripe créé
- [ ] Interface Stripe Elements affichée
- [ ] `clientSecret` retourné
- [ ] Dans Firestore `bookings` :
  - [ ] `status: "pending"`
  - [ ] `stripePaymentIntentId` présent
  - [ ] `stripeClientSecret` présent

#### Test 6.4 : Flow Pass (210 CHF)
1. Sélectionner "Flow Pass"
2. Mode de paiement : "Carte / TWINT"
3. Soumettre

**Résultat attendu :**
- [ ] PaymentIntent créé (21000 centimes)
- [ ] Après paiement réussi (webhook) :
  - [ ] Pass créé dans `userPasses`
  - [ ] Réservation confirmée
  - [ ] Email de confirmation du pass

#### Test 6.5 : Pass Semestriel (340 CHF - récurrent)
1. Sélectionner "Pass Semestriel"
2. Mode de paiement : "Carte / TWINT"
3. Soumettre

**Résultat attendu :**
- [ ] Subscription Stripe créée
- [ ] Après premier paiement (webhook `invoice.paid`) :
  - [ ] Pass créé dans `userPasses`
  - [ ] `isRecurring: true`
  - [ ] `stripeSubscriptionId` présent
  - [ ] Email de confirmation

---

### 7. Liste d'Attente

#### Test 7.1 : Cours complet
**Prérequis :** Créer un cours avec `maxCapacity: 2` et 2 réservations confirmées

1. Essayer de réserver ce cours

**Résultat attendu :**
- [ ] Message : "Cours complet"
- [ ] Option "S'inscrire en liste d'attente"
- [ ] Après inscription :
  - [ ] Dans Firestore `waitlist` :
    - [ ] `status: "waiting"`
    - [ ] `position: 1`
  - [ ] Message : "Vous êtes en position 1 sur la liste d'attente"

#### Test 7.2 : Notification quand une place se libère
**Prérequis :** Une personne en liste d'attente

1. Annuler une réservation confirmée

**Résultat attendu :**
- [ ] Première personne en liste d'attente notifiée
- [ ] Email envoyé (collection `mail`)
- [ ] Dans `waitlist` : `status: "notified"`

---

### 8. Webhook Stripe

#### Test 8.1 : Paiement réussi (réservation)
**Simuler via Stripe Dashboard ou Stripe CLI :**

```bash
stripe trigger payment_intent.succeeded
```

**Avec métadonnées :**
```json
{
  "metadata": {
    "type": "course_booking",
    "bookingId": "BOOKING_ID"
  }
}
```

**Résultat attendu :**
- [ ] Dans Firestore `bookings` : `status: "confirmed"`
- [ ] `paidAt` défini
- [ ] Email de confirmation envoyé
- [ ] Google Sheet mis à jour (si configuré)

#### Test 8.2 : Paiement réussi (Flow Pass)
**Métadonnées :**
```json
{
  "metadata": {
    "passType": "flow_pass",
    "email": "test@example.com"
  }
}
```

**Résultat attendu :**
- [ ] Pass créé dans `userPasses`
- [ ] Email de confirmation du pass

#### Test 8.3 : Paiement échoué
**Simuler :**
```bash
stripe trigger payment_intent.payment_failed
```

**Résultat attendu :**
- [ ] Dans `bookings` : `status: "payment_failed"`
- [ ] `paymentError` défini

#### Test 8.4 : Renouvellement Pass Semestriel
**Simuler :**
```bash
stripe trigger invoice.paid
```

**Avec subscription existante**

**Résultat attendu :**
- [ ] Pass renouvelé (nouvelle `expiryDate`)
- [ ] `updatedAt` mis à jour

---

### 9. Annulation de Réservation

#### Test 9.1 : Annulation avec remboursement
**Prérequis :** Réservation confirmée et payée

```bash
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/cancelCourseBooking \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID",
    "email": "test@example.com",
    "reason": "Test d'annulation"
  }'
```

**Résultat attendu :**
- [ ] Dans `bookings` : `status: "cancelled"`
- [ ] Remboursement Stripe créé (si payé)
- [ ] Place libérée (compteur décrémenté)
- [ ] Si liste d'attente : première personne notifiée

---

### 10. Interface Utilisateur

#### Test 10.1 : Modal de réservation
- [ ] Modal s'ouvre au clic sur "Réserver"
- [ ] Informations du cours affichées (titre, date, heure, lieu)
- [ ] Options tarifaires affichées
- [ ] Formulaire complet visible
- [ ] Bouton de fermeture fonctionne

#### Test 10.2 : Mise à jour temps réel des places
- [ ] Rafraîchissement automatique toutes les 30 secondes
- [ ] Compteur de places mis à jour
- [ ] Bouton passe de "Réserver" à "Liste d'attente" si complet

#### Test 10.3 : Responsive design
- [ ] Page fonctionne sur mobile
- [ ] Modal responsive
- [ ] Formulaire utilisable sur petit écran

---

### 11. Gestion des Erreurs

#### Test 11.1 : Cours introuvable
```bash
curl "https://europe-west1-fluance-protected-content.cloudfunctions.net/getCourseStatus?courseId=INVALID_ID"
```

**Résultat attendu :**
```json
{
  "available": false,
  "error": "COURSE_NOT_FOUND"
}
```

#### Test 11.2 : Email invalide
- [ ] Validation côté client
- [ ] Message d'erreur clair

#### Test 11.3 : Tentative de double réservation
1. Réserver un cours avec un email
2. Réessayer avec le même email

**Résultat attendu :**
- [ ] Message : "Vous avez déjà une réservation pour ce cours"

---

### 12. Intégration Google Sheets

#### Test 12.1 : Ajout automatique
**Prérequis :** `GOOGLE_SHEET_ID` configuré

Après une réservation confirmée :

- [ ] Ligne ajoutée dans le Google Sheet
- [ ] Colonnes remplies :
  - [ ] Date d'inscription
  - [ ] Prénom, Nom, Email, Téléphone
  - [ ] Cours, Date, Heure
  - [ ] Mode de paiement, Statut
  - [ ] Montant
  - [ ] Booking ID

---

## 🔍 Points de Vérification Techniques

### Firestore Collections
- [ ] `courses` - Cours synchronisés
- [ ] `bookings` - Réservations
- [ ] `waitlist` - Liste d'attente
- [ ] `userPasses` - Pass actifs
- [ ] `mail` - Emails à envoyer

### Logs Firebase Functions
```bash
firebase functions:log --limit 50
```

Vérifier :
- [ ] Pas d'erreurs critiques
- [ ] Synchronisation réussie
- [ ] Webhooks reçus

### Performance
- [ ] Chargement des cours < 2 secondes
- [ ] Modal s'ouvre rapidement
- [ ] Pas de lag lors de la réservation

---

## ✅ Critères de Succès

Le système fonctionne correctement si :

1. ✅ Les cours du calendrier Google sont synchronisés dans Firestore
2. ✅ Les cours s'affichent sur la page de réservation
3. ✅ La vérification par email fonctionne (pass existants détectés)
4. ✅ Les réservations avec pass sont gratuites et instantanées
5. ✅ Les réservations sans pass créent un PaymentIntent Stripe
6. ✅ Les paiements espèces sont confirmés immédiatement
7. ✅ Le webhook Stripe confirme les paiements et crée les pass
8. ✅ La liste d'attente fonctionne
9. ✅ Les annulations fonctionnent avec remboursement
10. ✅ Les emails de confirmation sont créés (collection `mail`)

---

## 🐛 Problèmes Connus à Vérifier

- [ ] Erreur CSP Stripe (doit être résolu avec le redémarrage)
- [ ] Erreur 500 sur `getAvailableCourses` (doit être résolu)
- [ ] Synchronisation calendrier (vérifier secret `GOOGLE_SERVICE_ACCOUNT`)

---

## 📝 Notes de Test

**Date des tests :** _______________

**Testeur :** _______________

**Résultats :**
- Tests réussis : ___ / ___
- Tests échoués : ___
- Bloqueurs : ___

**Commentaires :**
_________________________________________________
_________________________________________________
