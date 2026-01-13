# Debug : Problème d'ajout au Google Sheet

## Problème
Les réservations ne s'ajoutent pas automatiquement au Google Sheet de suivi.

## Checklist de vérification

### 1. Vérifier le GOOGLE_SHEET_ID

Le Sheet ID est extrait de l'URL :
```
https://docs.google.com/spreadsheets/d/1bAbNzo_bkywtfhGWlSLh3yTZaMDrRa8_GRCRN1g23d4/edit
                                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                      C'est cette partie !
```

**Vérifier dans Firebase :**
```bash
firebase functions:secrets:access GOOGLE_SHEET_ID
```

**Doit retourner :** `1bAbNzo_bkywtfhGWlSLh3yTZaMDrRa8_GRCRN1g23d4`

Si ce n'est pas configuré ou incorrect :
```bash
firebase functions:secrets:set GOOGLE_SHEET_ID
# Entrer : 1bAbNzo_bkywtfhGWlSLh3yTZaMDrRa8_GRCRN1g23d4
```

### 2. Vérifier le nom de la feuille

Le code cherche une feuille nommée **"Réservations"** (avec accent).

**Vérifier dans votre Google Sheet :**
- Ouvrez le Sheet
- Vérifiez le nom de l'onglet en bas
- Il doit s'appeler exactement **"Réservations"** (sensible à la casse et aux accents)

**Si le nom est différent :**
- Option A : Renommer l'onglet en "Réservations"
- Option B : Modifier le code dans `functions/services/googleService.js` ligne 312

### 3. Vérifier les permissions du Service Account

Le Service Account doit avoir accès en **écriture** au Google Sheet.

**Étapes :**
1. Récupérer l'email du Service Account :
   ```bash
   firebase functions:secrets:access GOOGLE_SERVICE_ACCOUNT | jq -r '.client_email'
   ```
   Ou ouvrir le fichier JSON du Service Account et chercher `client_email`

2. Partager le Google Sheet avec cet email :
   - Ouvrez le Google Sheet
   - Cliquez sur "Partager" (en haut à droite)
   - Ajoutez l'email du Service Account
   - Donnez-lui les permissions **"Éditeur"** (pas seulement "Lecteur")
   - Cliquez sur "Envoyer"

### 4. Vérifier les logs Firebase Functions

**Voir les logs en temps réel :**
```bash
firebase functions:log --only bookCourse
```

**Ou voir tous les logs récents :**
```bash
firebase functions:log
```

**Chercher :**
- ✅ `📊 Added booking to sheet:` = Succès
- ❌ `❌ Error appending to sheet:` = Erreur
- ❌ `Error updating sheet:` = Erreur silencieuse
- ❌ `GoogleService not available` = Service non initialisé

### 5. Vérifier que googleService est initialisé

**Vérifier dans les logs :**
```bash
firebase functions:log | grep -i "GoogleService"
```

**Doit voir :**
- `✅ GoogleService initialized successfully`

**Si vous voyez des erreurs :**
- `❌ Error initializing GoogleService:` = Problème avec GOOGLE_SERVICE_ACCOUNT
- Vérifier que le JSON du Service Account est complet et valide

### 6. Tester manuellement

Créer une fonction de test pour vérifier la connexion :

```javascript
// Dans functions/index.js (temporaire pour test)
exports.testGoogleSheet = onCall(
  {
    region: 'europe-west1',
    secrets: ['GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT'],
  },
  async (request) => {
    if (!googleService) {
      return {error: 'GoogleService not available'};
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      return {error: 'GOOGLE_SHEET_ID not configured'};
    }

    try {
      await googleService.initialize();
      
      // Tester l'ajout d'une ligne de test
      await googleService.appendUserToSheet(
        sheetId,
        'test-course-id',
        {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          phone: '123456789',
        },
        {
          courseName: 'Test Course',
          courseDate: new Date().toLocaleDateString('fr-CH'),
          courseTime: '10:00',
          paymentMethod: 'Test',
          paymentStatus: 'Test',
          amount: '0 CHF',
          status: 'Test',
          bookingId: 'test-booking-id',
          notes: 'Ligne de test - peut être supprimée',
        }
      );

      return {success: true, message: 'Test line added successfully'};
    } catch (error) {
      return {error: error.message, stack: error.stack};
    }
  }
);
```

**Appeler depuis le frontend :**
```javascript
const testFunction = firebase.functions().httpsCallable('testGoogleSheet');
testFunction().then(result => {
  console.log('Test result:', result.data);
});
```

### 7. Vérifier la structure du Sheet

Le code ajoute 15 colonnes (A à O) :

| Colonne | Contenu |
|---------|---------|
| A | Date d'inscription |
| B | Prénom |
| C | Nom |
| D | Email |
| E | Téléphone |
| F | Nom du cours |
| G | Date du cours |
| H | Heure |
| I | Méthode de paiement |
| J | Statut de paiement |
| K | Montant |
| L | Statut |
| M | CourseId |
| N | BookingId |
| O | Notes |

**Vérifier que la feuille "Réservations" existe et a au moins ces colonnes.**

## Solutions selon l'erreur

### Erreur : "The caller does not have permission"
**Solution :** Le Service Account n'a pas les permissions. Voir étape 3.

### Erreur : "Unable to parse range"
**Solution :** Le nom de la feuille est incorrect. Voir étape 2.

### Erreur : "GOOGLE_SHEET_ID not configured"
**Solution :** Configurer le secret. Voir étape 1.

### Erreur : "GoogleService not available"
**Solution :** Problème avec GOOGLE_SERVICE_ACCOUNT. Vérifier le JSON.

### Aucune erreur mais rien ne s'ajoute
**Causes possibles :**
1. Le code n'atteint pas la partie qui ajoute au Sheet
2. L'erreur est silencieusement catchée
3. Vérifier les logs pour voir si `appendUserToSheet` est appelé

## Commandes utiles

```bash
# Voir tous les secrets configurés
firebase functions:secrets:access

# Voir un secret spécifique
firebase functions:secrets:access GOOGLE_SHEET_ID

# Voir les logs en temps réel
firebase functions:log --only bookCourse

# Voir les logs avec filtres
firebase functions:log | grep -i "sheet\|google"
```

## Prochaines étapes

1. Vérifier le GOOGLE_SHEET_ID
2. Vérifier le nom de la feuille "Réservations"
3. Vérifier les permissions du Service Account
4. Consulter les logs Firebase
5. Tester manuellement avec la fonction de test

Une fois le problème identifié, je peux vous aider à le corriger !
