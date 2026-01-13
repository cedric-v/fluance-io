# Colonnes Google Spreadsheet - Suivi des Réservations

## Colonnes Actuelles (A à O)

| Colonne | Nom | Description | Exemple |
|---------|-----|-------------|---------|
| **A** | Date d'inscription | Date/heure ISO de la réservation | `2026-01-15T10:30:00.000Z` |
| **B** | Prénom | Prénom du participant | `Cédric` |
| **C** | Nom | Nom de famille | `Vonlanthen` |
| **D** | Email | Adresse email | `cedric@example.com` |
| **E** | Téléphone | Numéro de téléphone | `+41 79 123 45 67` |
| **F** | Nom du cours | Titre du cours | `Fluance - Mouvements en conscience` |
| **G** | Date du cours | Date du cours | `22/01/2026` |
| **H** | Heure | Heure du cours | `20:15` |
| **I** | Méthode de paiement | Type de paiement | `Espèces`, `Carte`, `TWINT`, `Cours d'essai gratuit`, `Flow Pass`, `Pass Semestriel` |
| **J** | Statut de paiement | État du paiement | `Payé`, `À régler sur place`, `Pass utilisé`, `Confirmé` |
| **K** | Montant | Montant en CHF | `25 CHF`, `0 CHF` |
| **L** | Statut | Statut de la réservation | `Confirmé`, `Confirmé (espèces)`, `Confirmé (essai gratuit)` |
| **M** | CourseId | ID du cours (Firestore) | `abc123xyz` |
| **N** | BookingId | ID de la réservation | `booking_abc123` |
| **O** | Notes | Notes additionnelles | `Paiement en espèces à régler sur place` |

## Colonnes Supplémentaires Suggérées

### Colonnes Utiles à Ajouter (P à Z et au-delà)

| Colonne | Nom | Description | Utilité | Formule/Calcul |
|---------|-----|-------------|---------|----------------|
| **P** | Lieu | Lieu du cours | Identifier où se déroule le cours | Depuis `course.location` |
| **Q** | Participant payant | Oui/Non | Pour calculer les participants payants | `=SI(I:I="Cours d'essai gratuit";"Non";"Oui")` |
| **K (amélioré)** | Montant en centimes | Montant en centimes (pour calculs) | Faciliter les calculs | `2500` (au lieu de `25 CHF`) |
| **R** | Date de paiement | Date/heure du paiement | Suivre quand le paiement a été effectué | Depuis `paidAt` |
| **S** | Pass Type | Type de pass utilisé | Détail si pass utilisé | `Flow Pass`, `Pass Semestriel`, ou vide |
| **T** | Séances restantes | Séances restantes (si Flow Pass) | Suivre l'utilisation du pass | `7/10` |
| **U** | IP Address | Adresse IP de la réservation | Sécurité/audit | Depuis `userData.ipAddress` |
| **V** | Source | Source de la réservation | D'où vient la réservation | `web`, `mobile`, etc. |
| **W** | Annulé | Oui/Non | Si la réservation a été annulée | `Oui` / `Non` |
| **X** | Date d'annulation | Date d'annulation | Quand a été annulé | Date si annulé |
| **Y** | Raison annulation | Raison de l'annulation | Pourquoi annulé | Texte libre |
| **Z** | Liste d'attente | Oui/Non | Si était en liste d'attente | `Oui` / `Non` |

## Structure Recommandée Complète

### Version Simple (15 colonnes actuelles + 5 utiles)

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | **P** | **Q** | **R** | **S** | **T** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Date inscription | Prénom | Nom | Email | Téléphone | Cours | Date cours | Heure | Paiement | Statut paiement | Montant | Statut | CourseId | BookingId | Notes | **Lieu** | **Payant** | **Date paiement** | **Pass Type** | **Séances restantes** |

### Version Complète (pour analyse avancée)

Ajouter toutes les colonnes P à Z ci-dessus.

## Formules Utiles pour les Nouvelles Colonnes

### Colonne P : Participant Payant
```excel
=SI(I2="Cours d'essai gratuit";"Non";"Oui")
```

### Colonne Q : Montant en Centimes (pour calculs)
```excel
=SI(K2="0 CHF";0;GAUCHE(K2;TROUVE(" ";K2)-1)*100)
```

### Colonne R : Compter Participants Payants par Cours
```excel
=NB.SI.ENS(F:F;F2;Q:Q;"Oui")
```

### Colonne S : Total Revenus par Cours
```excel
=SOMME.SI.ENS(K:K;F:F;F2)
```

## Recommandations

### Priorité 1 (Très Utile)
- ✅ **Colonne P : Lieu** - Essentiel pour identifier où se déroule le cours
- ✅ **Colonne Q : Participant payant** - Facilite le calcul des participants payants

### Priorité 2 (Utile)
- ✅ **Colonne R : Date de paiement** - Suivre quand les paiements sont effectués
- ✅ **Colonne S : Pass Type** - Détail sur le type de pass utilisé

### Priorité 3 (Optionnel)
- ✅ **Colonne T : Séances restantes** - Suivre l'utilisation des Flow Pass
- ✅ **Colonne W : Annulé** - Suivre les annulations

## Pour Ajouter ces Colonnes

1. **Dans votre Google Sheet** :
   - Ajoutez les en-têtes dans la ligne 1
   - Les nouvelles données seront ajoutées automatiquement si vous modifiez le code

2. **Modifier le code** (si vous voulez ces colonnes) :
   - Modifier `functions/services/googleService.js`
   - Ajouter les nouvelles valeurs dans le tableau `row`
   - Mettre à jour la plage `A:O` vers `A:Z` (ou la plage appropriée)

## Exemple de Structure Complète Recommandée

```
A: Date inscription
B: Prénom
C: Nom
D: Email
E: Téléphone
F: Nom du cours
G: Date du cours
H: Heure
I: Méthode de paiement
J: Statut de paiement
K: Montant
L: Statut
M: CourseId
N: BookingId
O: Notes
P: Lieu (NOUVEAU)
Q: Participant payant (Oui/Non) (NOUVEAU)
R: Date de paiement (NOUVEAU)
S: Pass Type (NOUVEAU)
```

Souhaitez-vous que je modifie le code pour ajouter certaines de ces colonnes automatiquement ?
