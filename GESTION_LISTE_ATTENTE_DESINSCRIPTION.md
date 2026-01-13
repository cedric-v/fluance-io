# Gestion de la Liste d'Attente et Désinscription

## Vue d'ensemble

Ce document décrit les fonctionnalités de gestion de la liste d'attente et de désinscription/transfert de réservations.

## 1. Liste d'Attente

### Fonctionnement

Quand un cours est complet, les utilisateurs qui tentent de réserver sont automatiquement ajoutés à la liste d'attente (collection `waitlist` dans Firestore).

### Fonctionnalités disponibles

#### 1.1 Ajout automatique à la liste d'attente

- **Quand** : Lorsqu'un utilisateur tente de réserver un cours complet
- **Où** : Dans `processBooking()` et `bookCourse()`
- **Résultat** : L'utilisateur reçoit un message indiquant qu'il a été ajouté à la liste d'attente

#### 1.2 Notification quand une place se libère

- **Quand** : Lorsqu'une réservation est annulée et qu'une place se libère
- **Fonction** : `notifyFirstInWaitlist()`
- **Action** : 
  - Envoie un email au premier de la liste d'attente
  - Met à jour le statut de l'entrée à `notified`
- **Template email** : `waitlist-spot-available.mjml`

#### 1.3 Voir sa position dans la liste d'attente

**Endpoint** : `getWaitlistPosition`

**URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/getWaitlistPosition`

**Méthode** : GET ou POST

**Paramètres** :
- `email` (requis) : Email de l'utilisateur
- `courseId` (requis) : ID du cours

**Réponse** :
```json
{
  "success": true,
  "position": 2,
  "totalWaiting": 5,
  "waitlistId": "abc123"
}
```

**Erreurs possibles** :
- `NOT_IN_WAITLIST` : L'utilisateur n'est pas dans la liste d'attente
- `NO_WAITLIST` : Aucune liste d'attente pour ce cours

#### 1.4 Se retirer de la liste d'attente

**Endpoint** : `removeFromWaitlist`

**URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/removeFromWaitlist`

**Méthode** : POST

**Paramètres** :
- `waitlistId` (requis) : ID de l'entrée dans la liste d'attente
- `email` (requis) : Email de l'utilisateur (vérification)

**Réponse** :
```json
{
  "success": true,
  "message": "Vous avez été retiré de la liste d'attente"
}
```

**Erreurs possibles** :
- `WAITLIST_NOT_FOUND` : L'entrée n'existe pas
- `EMAIL_MISMATCH` : L'email ne correspond pas
- `ALREADY_PROCESSED` : L'entrée a déjà été traitée (notifiée ou retirée)

## 2. Désinscription et Transfert

### 2.1 Annulation simple (sans remboursement)

**Endpoint** : `cancelCourseBooking` (existant, modifié)

**URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/cancelCourseBooking`

**Méthode** : POST

**Paramètres** :
- `bookingId` (requis) : ID de la réservation
- `email` (requis) : Email de l'utilisateur (vérification)
- `reason` (optionnel) : Raison de l'annulation

**Comportement** :
- ✅ Annule la réservation (statut → `cancelled`)
- ✅ Décrémente le compteur de participants du cours
- ✅ Notifie la première personne en liste d'attente
- ❌ **Ne rembourse PAS automatiquement** (contrairement à avant)
- ❌ Ne crée pas de remboursement Stripe

**Réponse** :
```json
{
  "success": true,
  "bookingId": "abc123",
  "message": "Réservation annulée avec succès"
}
```

### 2.2 Transfert vers un autre cours (sans remboursement)

**Endpoint** : `transferCourseBooking`

**URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/transferCourseBooking`

**Méthode** : POST

**Paramètres** :
- `bookingId` (requis) : ID de la réservation à transférer
- `newCourseId` (requis) : ID du nouveau cours
- `email` (requis) : Email de l'utilisateur (vérification)

**Comportement** :
- ✅ Vérifie que le nouveau cours existe et a des places disponibles
- ✅ Vérifie que l'utilisateur n'est pas déjà inscrit au nouveau cours
- ✅ Annule l'ancienne réservation (statut → `cancelled`, avec `transferredTo`)
- ✅ Crée une nouvelle réservation avec le même statut de paiement
- ✅ Conserve le même `paymentMethod`, `amount`, `stripePaymentIntentId`
- ✅ Met à jour les compteurs des deux cours
- ✅ Notifie la première personne en liste d'attente de l'ancien cours
- ❌ **Ne rembourse PAS** (le paiement reste valide pour le nouveau cours)

**Réponse** :
```json
{
  "success": true,
  "bookingId": "old123",
  "newBookingId": "new456",
  "message": "Réservation transférée avec succès"
}
```

**Erreurs possibles** :
- `BOOKING_NOT_FOUND` : La réservation n'existe pas
- `EMAIL_MISMATCH` : L'email ne correspond pas
- `BOOKING_ALREADY_CANCELLED` : La réservation est déjà annulée
- `NEW_COURSE_NOT_FOUND` : Le nouveau cours n'existe pas
- `COURSE_FULL` : Le nouveau cours est complet
- `ALREADY_BOOKED` : L'utilisateur est déjà inscrit au nouveau cours

## 3. Structure des Données

### Collection `waitlist`

```javascript
{
  bookingId: "abc123",           // ID de la réservation (si créée)
  courseId: "course456",         // ID du cours
  email: "user@example.com",     // Email de l'utilisateur
  firstName: "Jean",
  lastName: "Dupont",
  phone: "+41 79 123 45 67",
  status: "waiting",             // "waiting", "notified", "removed"
  position: 1,                   // Position dans la liste (optionnel)
  createdAt: Timestamp,
  notifiedAt: Timestamp,         // Si notifié
  removedAt: Timestamp,          // Si retiré
  passId: "pass789"              // Si réservation avec pass
}
```

### Statuts de réservation après annulation/transfert

```javascript
{
  status: "cancelled",
  cancelledAt: Timestamp,
  cancellationReason: "Transféré vers un autre cours",
  transferredTo: "newCourseId",  // Si transféré
  transferredFrom: "oldBookingId" // Dans la nouvelle réservation
}
```

## 4. Cas d'Usage

### Cas 1 : Utilisateur veut se désinscrire

1. Appeler `cancelCourseBooking` avec `bookingId` et `email`
2. La réservation est annulée
3. Une place se libère → le premier de la liste d'attente est notifié
4. **Pas de remboursement automatique**

### Cas 2 : Utilisateur veut changer de cours

1. Appeler `transferCourseBooking` avec `bookingId`, `newCourseId` et `email`
2. L'ancienne réservation est annulée
3. Une nouvelle réservation est créée pour le nouveau cours
4. Le paiement reste valide (pas de remboursement)
5. Une place se libère dans l'ancien cours → notification liste d'attente

### Cas 3 : Utilisateur veut voir sa position dans la liste d'attente

1. Appeler `getWaitlistPosition` avec `email` et `courseId`
2. Recevoir la position et le nombre total de personnes en attente

### Cas 4 : Utilisateur veut se retirer de la liste d'attente

1. Appeler `removeFromWaitlist` avec `waitlistId` et `email`
2. L'entrée est marquée comme `removed`

## 5. Notes Importantes

### Remboursements

- **Aucun remboursement automatique** n'est effectué lors de l'annulation ou du transfert
- Si un remboursement est nécessaire, il doit être fait manuellement via Stripe Dashboard
- Les paiements en espèces ne sont pas concernés (pas de remboursement possible)

### Pass utilisés

- Si une réservation avec un pass est annulée, la séance du pass n'est **pas** automatiquement restituée
- Si un transfert est effectué, le pass reste utilisé pour le nouveau cours

### Liste d'attente

- Les utilisateurs sont notifiés par email quand une place se libère
- Le lien dans l'email permet de réserver directement
- Si l'utilisateur ne réserve pas, la place sera proposée à la personne suivante

## 6. Intégration Frontend

### Exemple : Voir sa position dans la liste d'attente

```javascript
async function checkWaitlistPosition(email, courseId) {
  const response = await fetch(
    `https://europe-west1-fluance-protected-content.cloudfunctions.net/getWaitlistPosition?email=${email}&courseId=${courseId}`
  );
  const data = await response.json();
  
  if (data.success) {
    console.log(`Vous êtes en position ${data.position} sur ${data.totalWaiting}`);
  }
}
```

### Exemple : Se retirer de la liste d'attente

```javascript
async function removeFromWaitlist(waitlistId, email) {
  const response = await fetch(
    'https://europe-west1-fluance-protected-content.cloudfunctions.net/removeFromWaitlist',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitlistId, email })
    }
  );
  const data = await response.json();
  
  if (data.success) {
    console.log('Vous avez été retiré de la liste d\'attente');
  }
}
```

### Exemple : Transférer vers un autre cours

```javascript
async function transferBooking(bookingId, newCourseId, email) {
  const response = await fetch(
    'https://europe-west1-fluance-protected-content.cloudfunctions.net/transferCourseBooking',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, newCourseId, email })
    }
  );
  const data = await response.json();
  
  if (data.success) {
    console.log('Réservation transférée avec succès');
  }
}
```

## 7. Tests

Pour tester ces fonctionnalités :

1. **Liste d'attente** :
   - Réserver un cours complet → vérifier l'ajout à la liste
   - Annuler une réservation → vérifier la notification du premier
   - Vérifier sa position avec `getWaitlistPosition`
   - Se retirer avec `removeFromWaitlist`

2. **Désinscription** :
   - Annuler une réservation avec `cancelCourseBooking`
   - Vérifier que le compteur du cours est décrémenté
   - Vérifier qu'aucun remboursement Stripe n'est créé

3. **Transfert** :
   - Transférer une réservation avec `transferCourseBooking`
   - Vérifier que l'ancienne réservation est annulée
   - Vérifier que la nouvelle réservation est créée avec le même statut de paiement
   - Vérifier que les compteurs sont corrects
