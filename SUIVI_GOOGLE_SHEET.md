# Suivi des Réservations dans Google Spreadsheet

## Vue d'ensemble

Toutes les réservations sont automatiquement ajoutées au Google Sheet "Réservations" pour le suivi et la gestion.

## Structure du Google Sheet

### Feuille : "Réservations"

| Colonne | Description | Exemple |
|---------|-------------|---------|
| A | Date d'inscription | 2026-01-15T10:30:00.000Z |
| B | Prénom | Cédric |
| C | Nom | Vonlanthen |
| D | Email | cedric@example.com |
| E | Téléphone | +41 79 123 45 67 |
| F | Nom du cours | Fluance - Mouvements en conscience |
| G | Date du cours | 22/01/2026 |
| H | Heure | 20:15 |
| I | Méthode de paiement | Espèces, Carte, TWINT, Cours d'essai gratuit, Flow Pass, Pass Semestriel |
| J | Statut de paiement | Payé, À régler sur place, Pass utilisé, Confirmé |
| K | Montant | 25 CHF, 0 CHF |
| L | Statut | Confirmé, Confirmé (espèces), Confirmé (essai gratuit) |
| M | CourseId | ID du cours dans Firestore |
| N | BookingId | ID de la réservation |
| O | Notes | Paiement en espèces à régler sur place, Cours d'essai gratuit - première séance |

## Types de Réservations Trackées

### 1. Cours d'essai gratuit
- **Méthode de paiement** : `Cours d'essai gratuit`
- **Statut de paiement** : `Confirmé`
- **Montant** : `0 CHF`
- **Statut** : `Confirmé (essai gratuit)`
- **Notes** : `Cours d'essai gratuit - première séance`

### 2. Paiement espèces
- **Méthode de paiement** : `Espèces`
- **Statut de paiement** : `À régler sur place`
- **Montant** : `25 CHF` (ou prix du cours)
- **Statut** : `Confirmé (espèces)`
- **Notes** : `Paiement en espèces à régler sur place`

### 3. Paiement en ligne (Stripe)
- **Méthode de paiement** : `card`, `twint`, ou `sepa_debit`
- **Statut de paiement** : `Payé`
- **Montant** : `25 CHF` (formaté depuis centimes)
- **Statut** : `Confirmé`

### 4. Flow Pass utilisé
- **Méthode de paiement** : `Flow Pass`
- **Statut de paiement** : `Pass utilisé`
- **Montant** : `0 CHF`
- **Statut** : `Confirmé`

### 5. Pass Semestriel utilisé
- **Méthode de paiement** : `Pass Semestriel`
- **Statut de paiement** : `Pass utilisé`
- **Montant** : `0 CHF`
- **Statut** : `Confirmé`

## Formules Utiles pour le Suivi

### Compter le total de participants (pour suivi du cours)

**Tous les participants comptent**, y compris ceux de l'offre d'essai gratuit, car ils participent au cours.

**Formule Google Sheets** (pour un cours spécifique) :
```excel
=COUNTIF(F:F, "Fluance - Mouvements en conscience")
```

**Formule pour tous les cours** :
```excel
=COUNTA(F:F)-1
```
*(Soustraire 1 pour exclure l'en-tête)*

### Compter les participants payants (pour sous-location)

**Les participants payants incluent** :
- ✅ Paiements directs (espèces, carte, TWINT, SEPA)
- ✅ Pass utilisés (Flow Pass, Pass Semestriel) - ce sont des clients payants qui ont acheté un pass

**Les participants payants excluent** :
- ❌ Cours d'essai gratuit uniquement

**Formule Google Sheets** (pour un cours spécifique) :
```excel
=COUNTIFS(F:F, "Fluance - Mouvements en conscience", I:I, "<>Cours d'essai gratuit")
```

**Formule pour tous les cours** :
```excel
=COUNTIF(I:I, "<>Cours d'essai gratuit")-1
```
*(Soustraire 1 pour exclure l'en-tête)*

**Formule alternative** (en comptant les méthodes de paiement) :
```excel
=COUNTIFS(I:I, "<>Cours d'essai gratuit", I:I, "<>", I:I, "<>")
```

### Identifier qui doit payer en espèces

Pour savoir qui doit payer en espèces, filtrez les lignes où :
- **Méthode de paiement** = `Espèces`
- **Statut de paiement** = `À régler sur place`

**Formule Google Sheets** :
```excel
=FILTER(A:O, I:I="Espèces", J:J="À régler sur place")
```

### Compter les participants payants par cours (détaillé)

Pour chaque cours, compter uniquement les participants payants (paiements directs + pass) :
```excel
=COUNTIFS(F:F, "Fluance - Mouvements en conscience", I:I, "<>Cours d'essai gratuit")
```

### Compter uniquement les paiements directs (hors pass)

Pour compter uniquement les participants qui paient directement (espèces, carte, TWINT, SEPA), excluant les pass :
```excel
=COUNTIFS(F:F, "Fluance - Mouvements en conscience", I:I, "<>Cours d'essai gratuit", I:I, "<>Flow Pass", I:I, "<>Pass Semestriel")
```

### Compter les participants de l'offre d'essai

Pour compter uniquement les participants de l'offre d'essai gratuit :
```excel
=COUNTIFS(F:F, "Fluance - Mouvements en conscience", I:I, "Cours d'essai gratuit")
```

## Quand les Réservations sont Ajoutées

### Immédiatement ajoutées au Sheet :
1. ✅ **Cours d'essai gratuit** : Dès la réservation
2. ✅ **Paiement espèces** : Dès la réservation
3. ✅ **Pass utilisé** : Dès la réservation avec pass

### Ajoutées après paiement confirmé :
4. ✅ **Paiement Stripe** : Après confirmation du paiement via webhook

## Vérification

Pour vérifier que tout fonctionne :

1. **Vérifier que toutes les réservations sont présentes** :
   - Comparez le nombre de lignes dans le Sheet avec le nombre de réservations dans Firestore
   - Collection `bookings` dans Firestore

2. **Vérifier les paiements espèces** :
   - Filtrez `Méthode de paiement = Espèces`
   - Vérifiez que `Statut de paiement = À régler sur place`

3. **Vérifier les participants payants** :
   - Utilisez la formule ci-dessus pour compter (inclut les pass utilisés)
   - Comparez avec le nombre attendu
   - **Rappel** : Les pass (Flow Pass, Pass Semestriel) comptent comme participants payants car ce sont des clients payants

## Problèmes Potentiels

### Si une réservation n'apparaît pas dans le Sheet :

1. **Vérifier les logs Firebase** :
   ```bash
   firebase functions:log --only bookCourse
   ```

2. **Vérifier que `GOOGLE_SHEET_ID` est configuré** :
   ```bash
   firebase functions:secrets:access GOOGLE_SHEET_ID
   ```

3. **Vérifier les permissions du Service Account** :
   - Le Service Account doit avoir accès en écriture au Google Sheet
   - Vérifier dans Google Sheets > Partager > Ajouter le Service Account

### Si le format des montants est incorrect :

- Les paiements Stripe sont en centimes dans Firestore, mais formatés en CHF dans le Sheet (division par 100)
- Les paiements espèces utilisent directement le prix du cours (déjà en CHF)
- Si vous voyez des montants incorrects, vérifiez le format dans `functions/services/bookingService.js`

## Résumé des Catégories

### Participants payants (pour calcul sous-location)
- ✅ Paiements espèces
- ✅ Paiements en ligne (carte, TWINT, SEPA)
- ✅ Flow Pass utilisé
- ✅ Pass Semestriel utilisé

### Participants non payants
- ❌ Cours d'essai gratuit uniquement

### Tous les participants (pour suivi du cours)
- ✅ Tous les types ci-dessus (y compris essai gratuit)

## Améliorations Possibles

Si vous avez besoin d'informations supplémentaires dans le Sheet :

1. **Ajouter une colonne "Participant payant"** (Oui/Non) - avec logique : Oui si méthode ≠ "Cours d'essai gratuit"
2. **Ajouter une colonne "Montant en centimes"** pour faciliter les calculs
3. **Ajouter une colonne "Date de paiement"** pour les paiements Stripe
4. **Ajouter une colonne "Méthode de paiement détaillée"** (card, twint, sepa_debit) avec libellés lisibles

Dites-moi si vous souhaitez que j'ajoute ces colonnes supplémentaires.
