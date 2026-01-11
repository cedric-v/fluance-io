# Intégration Momoyoga - Inscriptions aux cours en présentiel

## Vue d'ensemble

Cette intégration permet de :
1. Extraire automatiquement les inscriptions depuis les emails de notification Momoyoga
2. Enregistrer les inscriptions dans Google Sheets et Firestore
3. Gérer le double opt-in via MailJet pour les nouveaux contacts
4. Mettre à jour les propriétés de contact MailJet pour le suivi marketing

## Architecture

```
Momoyoga → Email Gmail → Google Apps Script → Cloud Function Firebase → MailJet + Firestore
```

## 1. Configuration Google Apps Script

### 1.1 Créer le script

1. Accédez à [Google Apps Script](https://script.google.com/)
2. Créez un nouveau projet
3. Nommez-le "Fluance - Momoyoga Integration"

### 1.2 Code complet

```javascript
/**
 * Fluance - Intégration Momoyoga
 * 
 * Ce script extrait les inscriptions aux cours depuis les emails Momoyoga
 * et les envoie à la Cloud Function Firebase pour traitement.
 */

// Configuration
const CONFIG = {
  // URL de la Cloud Function Firebase
  CLOUD_FUNCTION_URL: 'https://europe-west1-fluance-protected-content.cloudfunctions.net/registerPresentielCourse',
  
  // Clé API pour authentifier les requêtes (doit correspondre à celle dans Firebase)
  API_KEY: 'fluance-presentiel-2024',
  
  // Nom de la feuille Google Sheets pour le log
  SHEET_NAME: 'Inscriptions',
  
  // Requête Gmail pour trouver les emails Momoyoga
  GMAIL_QUERY: 'from:momoyoga.com is:unread "a réservé un cours"',
};

/**
 * Fonction principale - Traite les emails Momoyoga non lus
 * À exécuter via un déclencheur temporel (ex: toutes les 5 minutes)
 */
function processMomoyogaEmails() {
  const sheet = getOrCreateSheet();
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY);
  
  let processed = 0;
  let errors = 0;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      if (message.isUnread()) {
        try {
          const result = processMessage(message, sheet);
          if (result.success) {
            processed++;
          } else {
            errors++;
            logError(sheet, message, result.error);
          }
        } catch (error) {
          errors++;
          logError(sheet, message, error.message);
        }
        message.markRead();
      }
    });
  });

  Logger.log(`Traitement terminé: ${processed} inscriptions, ${errors} erreurs`);
}

/**
 * Traite un email individuel
 */
function processMessage(message, sheet) {
  const body = message.getPlainBody();
  const receivedDate = message.getDate();
  
  // Extraction des données
  const data = extractDataFromEmail(body);
  
  if (!data.email) {
    return { success: false, error: 'Email non trouvé dans le message' };
  }

  // Vérifier si déjà enregistré (même email + même cours + même date)
  if (isAlreadyRegistered(sheet, data.email, data.courseName, data.courseDate)) {
    Logger.log(`Inscription déjà enregistrée: ${data.email} - ${data.courseName} - ${data.courseDate}`);
    return { success: true, alreadyExists: true };
  }

  // Appeler la Cloud Function Firebase
  const cloudResult = callCloudFunction(data);
  
  // Enregistrer dans Google Sheets
  sheet.appendRow([
    receivedDate,           // Date de l'inscription (email reçu)
    data.name,              // Nom
    data.email,             // Email
    data.courseName,        // Nom du cours
    data.courseDate,        // Date du cours
    data.courseTime,        // Horaire
    cloudResult.success ? 'OK' : 'Erreur',
    cloudResult.isNewContact ? 'Nouveau' : 'Existant',
    cloudResult.nombreCours || 1,
    cloudResult.message || ''
  ]);

  return cloudResult;
}

/**
 * Extrait les données de l'email Momoyoga
 */
function extractDataFromEmail(body) {
  // Pattern pour nom et email: "Nom : Prénom Nom (email@example.com)"
  const nameEmailMatch = body.match(/Nom\s*:\s*(.*?)\s*\((.*?)\)/);
  
  // Pattern pour le cours: "Cours : Nom du cours"
  const coursMatch = body.match(/Cours\s*:\s*(.*?)(?:\n|$)/);
  
  // Pattern pour la date: "Date : DD/MM/YYYY"
  const dateMatch = body.match(/Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
  
  // Pattern pour l'horaire: "Horaire : HH:MM" ou "Heure : HH:MM"
  const timeMatch = body.match(/(?:Horaire|Heure)\s*:\s*(\d{2}:\d{2})/);

  return {
    name: nameEmailMatch ? nameEmailMatch[1].trim() : '',
    email: nameEmailMatch ? nameEmailMatch[2].trim().toLowerCase() : '',
    courseName: coursMatch ? coursMatch[1].trim() : 'Cours Fluance',
    courseDate: dateMatch ? dateMatch[1] : '',
    courseTime: timeMatch ? timeMatch[1] : '',
  };
}

/**
 * Appelle la Cloud Function Firebase
 */
function callCloudFunction(data) {
  const payload = {
    email: data.email,
    name: data.name,
    courseName: data.courseName,
    courseDate: data.courseDate,
    courseTime: data.courseTime,
    apiKey: CONFIG.API_KEY,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.CLOUD_FUNCTION_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = JSON.parse(response.getContentText());

    if (responseCode === 200 && responseBody.success) {
      return {
        success: true,
        isNewContact: responseBody.isNewContact,
        confirmationEmailSent: responseBody.confirmationEmailSent,
        nombreCours: responseBody.nombreCours,
        message: responseBody.message,
      };
    } else {
      return {
        success: false,
        error: responseBody.error || `HTTP ${responseCode}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Vérifie si l'inscription existe déjà
 */
function isAlreadyRegistered(sheet, email, courseName, courseDate) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) { // Skip header
    if (data[i][2] === email && 
        data[i][3] === courseName && 
        data[i][4] === courseDate) {
      return true;
    }
  }
  return false;
}

/**
 * Récupère ou crée la feuille de calcul
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    // Créer les en-têtes
    sheet.appendRow([
      'Date Inscription',
      'Nom',
      'Email',
      'Nom du Cours',
      'Date du Cours',
      'Horaire',
      'Statut',
      'Type Contact',
      'Nb Cours Total',
      'Message'
    ]);
    // Formater les en-têtes
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#648ED8').setFontColor('white');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Log une erreur dans la feuille
 */
function logError(sheet, message, errorMsg) {
  sheet.appendRow([
    message.getDate(),
    '',
    '',
    '',
    '',
    '',
    'ERREUR',
    '',
    '',
    errorMsg
  ]);
}

/**
 * Fonction de test - Traite un seul email pour tester
 */
function testProcessSingleEmail() {
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY + ' newer_than:1d', 0, 1);
  
  if (threads.length === 0) {
    Logger.log('Aucun email Momoyoga non lu trouvé');
    return;
  }

  const message = threads[0].getMessages()[0];
  const body = message.getPlainBody();
  
  Logger.log('=== Corps de l\'email ===');
  Logger.log(body);
  Logger.log('=== Données extraites ===');
  Logger.log(extractDataFromEmail(body));
}

/**
 * Configure un déclencheur pour exécuter le script automatiquement
 */
function setupTrigger() {
  // Supprimer les anciens déclencheurs
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processMomoyogaEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Créer un nouveau déclencheur toutes les 5 minutes
  ScriptApp.newTrigger('processMomoyogaEmails')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Déclencheur configuré: toutes les 5 minutes');
}

/**
 * Supprime tous les déclencheurs
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  Logger.log('Tous les déclencheurs ont été supprimés');
}
```

### 1.3 Configuration du déclencheur

1. Dans Google Apps Script, exécutez la fonction `setupTrigger()`
2. Autorisez les permissions demandées
3. Le script s'exécutera automatiquement toutes les 5 minutes

## 2. Structure des données

### 2.1 Google Sheets

| Colonne | Description |
|---------|-------------|
| Date Inscription | Date/heure de réception de l'email |
| Nom | Nom du participant |
| Email | Email du participant |
| Nom du Cours | Nom du cours réservé |
| Date du Cours | Date du cours (DD/MM/YYYY) |
| Horaire | Heure du cours (HH:MM) |
| Statut | OK ou ERREUR |
| Type Contact | Nouveau ou Existant |
| Nb Cours Total | Nombre total de cours pour ce contact |
| Message | Message de la Cloud Function |

### 2.2 Firestore - Collection `presentielRegistrations`

```javascript
{
  email: "participant@example.com",
  name: "Prénom Nom",
  courseName: "Fluance - Jeudi 20h15",
  courseDate: "23/01/2026",
  courseTime: "20:15",
  registeredAt: Timestamp,
  source: "momoyoga"
}
```

### 2.3 Firestore - Collection `newsletterConfirmations`

Pour les nouveaux contacts en attente de confirmation :

```javascript
{
  email: "participant@example.com",
  name: "Prénom Nom",
  createdAt: Timestamp,
  expiresAt: Date (7 jours),
  confirmed: false,
  reminderSent: false,
  sourceOptin: "presentiel",
  courseName: "Fluance - Jeudi 20h15",
  courseDate: "23/01/2026"
}
```

### 2.4 MailJet Contact Properties

| Property | Type | Description |
|----------|------|-------------|
| `inscrit_presentiel` | Boolean | `"True"` si inscrit aux cours en présentiel |
| `nombre_cours_presentiel` | Integer | Nombre total de cours réservés |
| `premier_cours_presentiel` | Date | Date du premier cours |
| `dernier_cours_presentiel` | Date | Date du dernier cours |
| `source_optin` | String | Contient "presentiel" (peut être multiple) |

## 3. Flux de données

### 3.1 Nouveau contact (première inscription)

```
1. Email Momoyoga reçu
2. Google Apps Script extrait les données
3. Appel Cloud Function registerPresentielCourse
4. Création contact MailJet + ajout à la liste
5. Création token de confirmation dans Firestore
6. Envoi email de confirmation (double opt-in)
7. Enregistrement dans presentielRegistrations
8. Log dans Google Sheets
```

### 3.2 Contact existant (inscription suivante)

```
1. Email Momoyoga reçu
2. Google Apps Script extrait les données
3. Appel Cloud Function registerPresentielCourse
4. Vérification : contact déjà confirmé
5. Mise à jour des propriétés MailJet (nombre_cours, dernier_cours)
6. Enregistrement dans presentielRegistrations
7. Log dans Google Sheets
8. PAS d'email envoyé (déjà confirmé)
```

## 4. Déploiement

### 4.1 Déployer la Cloud Function

```bash
cd functions
npm install
firebase deploy --only functions:registerPresentielCourse
```

### 4.2 Builder le template d'email

```bash
npm run build
```

Cela compile `src/emails/confirmation-presentiel.mjml` vers `functions/emails/confirmation-presentiel.html`.

### 4.3 Configurer le secret API (optionnel)

Pour plus de sécurité, vous pouvez définir un secret Firebase :

```bash
firebase functions:secrets:set PRESENTIEL_API_KEY
```

Puis modifier le code pour utiliser `process.env.PRESENTIEL_API_KEY`.

## 5. Test

### 5.1 Tester l'extraction des données

Dans Google Apps Script, exécutez `testProcessSingleEmail()` pour :
1. Voir le corps d'un email Momoyoga
2. Vérifier les données extraites

### 5.2 Tester la Cloud Function

```bash
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/registerPresentielCourse \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "courseName": "Fluance - Test",
    "courseDate": "01/01/2026",
    "courseTime": "20:15",
    "apiKey": "fluance-presentiel-2024"
  }'
```

### 5.3 Vérifier les logs

```bash
firebase functions:log --only registerPresentielCourse
```

## 6. Gestion des inscriptions multiples

### Communication cohérente

| Situation | Action |
|-----------|--------|
| Première inscription | Email de bienvenue avec double opt-in |
| Inscriptions suivantes (non confirmé) | Pas d'email (attente de confirmation) |
| Inscriptions suivantes (confirmé) | Pas d'email (mise à jour silencieuse des propriétés) |

### Propriétés mises à jour à chaque inscription

- `nombre_cours_presentiel` : incrémenté
- `dernier_cours_presentiel` : mis à jour avec la date du nouveau cours

### Propriétés définies une seule fois

- `inscrit_presentiel` : défini à "True" lors de la première inscription
- `premier_cours_presentiel` : date du premier cours uniquement

## 7. Segments MailJet

### Participants aux cours en présentiel
- `inscrit_presentiel` = `"True"`

### Participants réguliers (5+ cours)
- `inscrit_presentiel` = `"True"`
- `nombre_cours_presentiel` >= 5

### Participants récents
- `inscrit_presentiel` = `"True"`
- `dernier_cours_presentiel` >= Date récente

### Participants inactifs
- `inscrit_presentiel` = `"True"`
- `dernier_cours_presentiel` < Date ancienne (ex: > 1 mois)

## 8. Dépannage

### L'email n'est pas extrait correctement

Vérifiez le format de l'email Momoyoga avec `testProcessSingleEmail()` et ajustez les regex si nécessaire.

### La Cloud Function retourne une erreur

Vérifiez les logs Firebase :
```bash
firebase functions:log --only registerPresentielCourse
```

### Les propriétés MailJet ne sont pas mises à jour

1. Vérifiez que les propriétés existent dans MailJet Dashboard
2. Exécutez `ensureMailjetContactProperties` manuellement si nécessaire

### Doublons dans Google Sheets

Le script vérifie les doublons basés sur email + cours + date. Si vous voyez des doublons, vérifiez que ces trois champs sont correctement extraits.
