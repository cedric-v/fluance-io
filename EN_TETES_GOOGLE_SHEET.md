# En-têtes Google Sheet - À Copier-Coller

## Format Tabulation (Recommandé pour Google Sheets)

Copiez cette ligne et collez-la dans la ligne 1 de votre Google Sheet :

```
Date d'inscription	Prénom	Nom	Email	Téléphone	Nom du cours	Date du cours	Heure	Méthode de paiement	Statut de paiement	Montant	Statut	CourseId	BookingId	Notes	Lieu	Participant payant	Date de paiement	Pass Type	Séances restantes	IP Address	Source	Annulé	Date d'annulation	Raison annulation	Liste d'attente
```

## Format Virgule (Alternative)

Si le format tabulation ne fonctionne pas, utilisez celui-ci :

```
Date d'inscription,Prénom,Nom,Email,Téléphone,Nom du cours,Date du cours,Heure,Méthode de paiement,Statut de paiement,Montant,Statut,CourseId,BookingId,Notes,Lieu,Participant payant,Date de paiement,Pass Type,Séances restantes,IP Address,Source,Annulé,Date d'annulation,Raison annulation,Liste d'attente
```

## Liste Détaillée (26 Colonnes)

| Colonne | En-tête | Description |
|---------|---------|-------------|
| A | Date d'inscription | Date/heure ISO de la réservation |
| B | Prénom | Prénom du participant |
| C | Nom | Nom de famille |
| D | Email | Adresse email |
| E | Téléphone | Numéro de téléphone |
| F | Nom du cours | Titre du cours |
| G | Date du cours | Date du cours |
| H | Heure | Heure du cours |
| I | Méthode de paiement | Type de paiement |
| J | Statut de paiement | État du paiement |
| K | Montant | Montant en CHF |
| L | Statut | Statut de la réservation |
| M | CourseId | ID du cours (Firestore) |
| N | BookingId | ID de la réservation |
| O | Notes | Notes additionnelles |
| **P** | **Lieu** | **Lieu du cours** |
| **Q** | **Participant payant** | **Oui/Non** |
| **R** | **Date de paiement** | **Date/heure du paiement** |
| **S** | **Pass Type** | **Type de pass utilisé** |
| **T** | **Séances restantes** | **Séances restantes (Flow Pass)** |
| **U** | **IP Address** | **Adresse IP** |
| **V** | **Source** | **Source de la réservation** |
| **W** | **Annulé** | **Oui/Non** |
| **X** | **Date d'annulation** | **Date d'annulation** |
| **Y** | **Raison annulation** | **Raison de l'annulation** |
| **Z** | **Liste d'attente** | **Oui/Non** |

## Instructions

1. **Ouvrez votre Google Sheet** : https://docs.google.com/spreadsheets/d/1bAbNzo_bkywtfhGWlSLh3yTZaMDrRa8_GRCRN1g23d4/edit

2. **Sélectionnez la ligne 1** (ou créez une nouvelle ligne d'en-tête)

3. **Copiez la ligne du format tabulation** ci-dessus

4. **Collez dans la cellule A1** - Google Sheets devrait automatiquement répartir les colonnes

5. **Vérifiez** que vous avez bien 26 colonnes (A à Z)

## Formatage Recommandé

Une fois les en-têtes collés, vous pouvez :
- **Geler la ligne 1** : Affichage > Figer > 1 ligne
- **Mettre en gras** : Sélectionner la ligne 1 et cliquer sur **B**
- **Couleur de fond** : Mettre un fond gris clair pour distinguer les en-têtes

## Notes

- Les colonnes **A à O** sont déjà remplies automatiquement par le système
- Les colonnes **P à Z** seront remplies automatiquement après le prochain déploiement
- La colonne **Q (Participant payant)** peut aussi être calculée avec une formule si vous préférez
