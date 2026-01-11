# Intégration Momoyoga - Inscriptions aux cours en présentiel

## Vue d'ensemble

Cette intégration permet de :
1. Capturer les créations de compte Momoyoga ("s'est inscrit")
2. Capturer les réservations de cours ("a réservé un cours")
3. Gérer le double opt-in via MailJet pour les nouveaux contacts
4. Mettre à jour les propriétés de contact MailJet pour le suivi marketing

## Architecture

```
Momoyoga → Email Gmail → Google Apps Script → Cloud Functions Firebase → MailJet + Firestore
```

## Flux de données

### Scénario 1 : Création de compte puis réservation (quelques minutes après)

```
1. Email "Cédric s'est inscrit"
   → registerMomoyogaAccount
   → Email de bienvenue avec double opt-in
   
2. Email "Cédric a réservé un cours" (quelques minutes après)
   → registerPresentielCourse
   → Détecte confirmation en attente
   → Mise à jour Firestore (cours enregistré)
   → PAS d'email (évite le spam)
```

### Scénario 2 : Création de compte sans réservation

```
1. Email "Cédric s'est inscrit"
   → registerMomoyogaAccount
   → Email de bienvenue avec double opt-in
   → Contact peut recevoir les infos sur les prochains cours
```

### Scénario 3 : Contact déjà confirmé réserve un nouveau cours

```
1. Email "Cédric a réservé un cours"
   → registerPresentielCourse
   → Détecte contact déjà confirmé
   → Mise à jour silencieuse des propriétés
   → PAS d'email
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
 * Ce script extrait les créations de compte et réservations de cours
 * depuis les emails Momoyoga et les envoie aux Cloud Functions Firebase.
 */

// Configuration
const CONFIG = {
  // URLs des Cloud Functions Firebase
  ACCOUNT_FUNCTION_URL: 'https://europe-west1-fluance-protected-content.cloudfunctions.net/registerMomoyogaAccount',
  COURSE_FUNCTION_URL: 'https://europe-west1-fluance-protected-content.cloudfunctions.net/registerPresentielCourse',
  
  // Clé API pour authentifier les requêtes
  API_KEY: 'VOTRE_CLE_SECRETE',  // À remplacer par votre clé personnelle
  
  // ID de la feuille Google Sheets pour les logs (trouvez-le dans l'URL de votre Sheet)
  // Ex: https://docs.google.com/spreadsheets/d/VOTRE_SPREADSHEET_ID/edit
  SPREADSHEET_ID: 'VOTRE_SPREADSHEET_ID',  // À remplacer par l'ID de votre feuille
  
  // Noms des onglets dans la feuille Google Sheets
  ACCOUNTS_SHEET_NAME: 'Comptes',
  COURSES_SHEET_NAME: 'Inscriptions',
  
  // Label Gmail pour classer les emails traités (sera créé automatiquement s'il n'existe pas)
  GMAIL_LABEL: 'Momoyoga/Traité',
  
  // Archiver les emails après traitement (les retire de la boîte de réception)
  ARCHIVE_AFTER_PROCESSING: true,
  
  // Requêtes Gmail pour trouver les emails Momoyoga
  GMAIL_QUERY_ACCOUNT: 'from:momoyoga.com is:unread "s\'est inscrit"',
  GMAIL_QUERY_COURSE: 'from:momoyoga.com is:unread "a réservé un cours"',
};

/**
 * Fonction principale - Traite tous les emails Momoyoga non lus
 * À exécuter via un déclencheur temporel (ex: toutes les 10 minutes)
 */
function processMomoyogaEmails() {
  // Traiter d'abord les créations de compte
  processAccountEmails();
  
  // Puis les réservations de cours
  processCourseEmails();
}

/**
 * Traite les emails de création de compte
 */
function processAccountEmails() {
  const sheet = getOrCreateSheet(CONFIG.ACCOUNTS_SHEET_NAME, [
    'Date', 'Nom', 'Email', 'Statut', 'Type Contact', 'Message'
  ]);
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY_ACCOUNT);
  
  let processed = 0;
  let errors = 0;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    let threadHasUnread = false;
    
    messages.forEach(message => {
      if (message.isUnread()) {
        threadHasUnread = true;
        try {
          const result = processAccountMessage(message, sheet);
          if (result.success) {
            processed++;
          } else {
            errors++;
            Logger.log('ERREUR compte: ' + result.error);
            logError(sheet, message, result.error, 6);
          }
        } catch (error) {
          errors++;
          Logger.log('ERREUR compte: ' + error.message);
          logError(sheet, message, error.message, 6);
        }
        message.markRead();
      }
    });
    
    // Appliquer le label et archiver après traitement du thread
    if (threadHasUnread) {
      markThreadAsProcessed(thread);
    }
  });

  Logger.log(`Comptes traités: ${processed} inscriptions, ${errors} erreurs`);
}

/**
 * Traite les emails de réservation de cours
 */
function processCourseEmails() {
  const sheet = getOrCreateSheet(CONFIG.COURSES_SHEET_NAME, [
    'Date Inscription', 'Nom', 'Email', 'Nom du Cours', 'Date du Cours',
    'Horaire', 'Statut', 'Type Contact', 'Nb Cours Total', 'Message'
  ]);
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY_COURSE);
  
  let processed = 0;
  let errors = 0;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    let threadHasUnread = false;
    
    messages.forEach(message => {
      if (message.isUnread()) {
        threadHasUnread = true;
        try {
          const result = processCourseMessage(message, sheet);
          if (result.success) {
            processed++;
          } else {
            errors++;
            Logger.log('ERREUR cours: ' + result.error);
            logError(sheet, message, result.error, 10);
          }
        } catch (error) {
          errors++;
          Logger.log('ERREUR cours: ' + error.message);
          logError(sheet, message, error.message, 10);
        }
        message.markRead();
      }
    });
    
    // Appliquer le label et archiver après traitement du thread
    if (threadHasUnread) {
      markThreadAsProcessed(thread);
    }
  });

  Logger.log(`Cours traités: ${processed} inscriptions, ${errors} erreurs`);
}

/**
 * Traite un email de création de compte
 */
function processAccountMessage(message, sheet) {
  const body = message.getPlainBody();
  const receivedDate = message.getDate();
  
  // Extraction des données
  const data = extractAccountDataFromEmail(body);
  
  if (!data.email) {
    return { success: false, error: 'Email non trouvé dans le message' };
  }

  // Vérifier si déjà enregistré
  if (isAlreadyInSheet(sheet, data.email, 2)) {
    Logger.log(`Compte déjà enregistré: ${data.email}`);
    return { success: true, alreadyExists: true };
  }

  // Appeler la Cloud Function Firebase
  const cloudResult = callCloudFunction(CONFIG.ACCOUNT_FUNCTION_URL, {
    email: data.email,
    name: data.name,
    apiKey: CONFIG.API_KEY,
  });
  
  // Enregistrer dans Google Sheets
  sheet.appendRow([
    receivedDate,
    data.name,
    data.email,
    cloudResult.success ? 'OK' : 'Erreur',
    cloudResult.isNewContact ? 'Nouveau' : 'Existant',
    cloudResult.message || ''
  ]);

  return cloudResult;
}

/**
 * Traite un email de réservation de cours
 */
function processCourseMessage(message, sheet) {
  const body = message.getPlainBody();
  const receivedDate = message.getDate();
  
  // Extraction des données
  const data = extractCourseDataFromEmail(body);
  
  if (!data.email) {
    return { success: false, error: 'Email non trouvé dans le message' };
  }

  // Vérifier si déjà enregistré (même email + même cours + même date)
  if (isCourseAlreadyRegistered(sheet, data.email, data.courseName, data.courseDate)) {
    Logger.log(`Cours déjà enregistré: ${data.email} - ${data.courseName} - ${data.courseDate}`);
    return { success: true, alreadyExists: true };
  }

  // Appeler la Cloud Function Firebase
  const cloudResult = callCloudFunction(CONFIG.COURSE_FUNCTION_URL, {
    email: data.email,
    name: data.name,
    courseName: data.courseName,
    courseDate: data.courseDate,
    courseTime: data.courseTime,
    apiKey: CONFIG.API_KEY,
  });
  
  // Enregistrer dans Google Sheets
  let typeContact = 'Existant';
  if (cloudResult.isNewContact) {
    typeContact = 'Nouveau';
  } else if (cloudResult.pendingConfirmation) {
    typeContact = 'En attente';
  }

  sheet.appendRow([
    receivedDate,
    data.name,
    data.email,
    data.courseName,
    data.courseDate,
    data.courseTime,
    cloudResult.success ? 'OK' : 'Erreur',
    typeContact,
    cloudResult.nombreCours || 1,
    cloudResult.message || ''
  ]);

  return cloudResult;
}

/**
 * Extrait les données d'un email de création de compte
 * Format: "Nom : Prénom Nom" et "Adresse e-mail : email@example.com"
 */
function extractAccountDataFromEmail(body) {
  // Normaliser les espaces et sauts de ligne
  const normalizedBody = body.replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
  
  // Pattern pour le nom: "Nom : Prénom Nom" (jusqu'à "Adresse" ou fin)
  const nameMatch = normalizedBody.match(/Nom\s*:\s*([^:]+?)(?=\s*Adresse|$)/i);
  
  // Pattern pour l'email: "Adresse e-mail : email@example.com"
  const emailMatch = body.match(/Adresse\s*e-mail\s*:\s*([^\s\n]+)/i);

  const name = nameMatch ? nameMatch[1].trim() : '';
  const email = emailMatch ? emailMatch[1].trim().toLowerCase() : '';
  
  // Log pour debug
  Logger.log('Extraction compte - Nom: "' + name + '", Email: "' + email + '"');

  return { name, email };
}

/**
 * Extrait les données d'un email de réservation de cours
 * Format: "Nom : Prénom Nom (email@example.com)"
 */
function extractCourseDataFromEmail(body) {
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
 * Appelle une Cloud Function Firebase
 */
function callCloudFunction(url, data) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = JSON.parse(response.getContentText());

    if (responseCode === 200 && responseBody.success) {
      return {
        success: true,
        isNewContact: responseBody.isNewContact,
        confirmationEmailSent: responseBody.confirmationEmailSent,
        pendingConfirmation: responseBody.pendingConfirmation,
        alreadyConfirmed: responseBody.alreadyConfirmed,
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
 * Vérifie si un email est déjà dans une feuille
 */
function isAlreadyInSheet(sheet, email, emailColumn) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailColumn - 1] === email) {
      return true;
    }
  }
  return false;
}

/**
 * Vérifie si un cours est déjà enregistré
 */
function isCourseAlreadyRegistered(sheet, email, courseName, courseDate) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email && 
        data[i][3] === courseName && 
        data[i][4] === courseDate) {
      return true;
    }
  }
  return false;
}

/**
 * Récupère ou crée une feuille de calcul
 */
function getOrCreateSheet(sheetName, headers) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#648ED8')
      .setFontColor('white');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Log une erreur dans la feuille
 */
function logError(sheet, message, errorMsg, totalColumns) {
  const row = [message.getDate()];
  for (let i = 1; i < totalColumns - 1; i++) {
    row.push('');
  }
  row[totalColumns - 2] = 'ERREUR';
  row[totalColumns - 1] = errorMsg;
  sheet.appendRow(row);
}

/**
 * Récupère ou crée le label Gmail pour les emails traités
 */
function getOrCreateLabel() {
  let label = GmailApp.getUserLabelByName(CONFIG.GMAIL_LABEL);
  
  if (!label) {
    label = GmailApp.createLabel(CONFIG.GMAIL_LABEL);
    Logger.log('Label créé: ' + CONFIG.GMAIL_LABEL);
  }
  
  return label;
}

/**
 * Applique le label et archive le thread après traitement
 */
function markThreadAsProcessed(thread) {
  const label = getOrCreateLabel();
  
  // Ajouter le label
  thread.addLabel(label);
  
  // Archiver si configuré (retire de la boîte de réception)
  if (CONFIG.ARCHIVE_AFTER_PROCESSING) {
    thread.moveToArchive();
  }
}

/**
 * Fonction de test - Affiche le contenu d'un email de création de compte
 */
function testExtractAccountEmail() {
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY_ACCOUNT + ' newer_than:7d', 0, 1);
  
  if (threads.length === 0) {
    Logger.log('Aucun email de création de compte trouvé');
    return;
  }

  const message = threads[0].getMessages()[0];
  const body = message.getPlainBody();
  
  Logger.log('=== Corps de l\'email ===');
  Logger.log(body);
  Logger.log('=== Données extraites ===');
  Logger.log(extractAccountDataFromEmail(body));
}

/**
 * Fonction de test - Affiche le contenu d'un email de réservation
 */
function testExtractCourseEmail() {
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY_COURSE + ' newer_than:7d', 0, 1);
  
  if (threads.length === 0) {
    Logger.log('Aucun email de réservation trouvé');
    return;
  }

  const message = threads[0].getMessages()[0];
  const body = message.getPlainBody();
  
  Logger.log('=== Corps de l\'email ===');
  Logger.log(body);
  Logger.log('=== Données extraites ===');
  Logger.log(extractCourseDataFromEmail(body));
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

  // Créer un nouveau déclencheur toutes les 10 minutes (recommandé pour compte Gmail gratuit)
  ScriptApp.newTrigger('processMomoyogaEmails')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('Déclencheur configuré: toutes les 10 minutes');
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
3. Le script s'exécutera automatiquement toutes les 10 minutes

## 2. Cloud Functions Firebase

### 2.1 registerMomoyogaAccount

Gère les créations de compte Momoyoga.

**URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/registerMomoyogaAccount`

**Paramètres** :
| Paramètre | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| email | string | ✅ | Email du contact |
| name | string | ❌ | Nom complet |
| apiKey | string | ✅ | Clé API |

**Réponses** :
| Situation | isNewContact | confirmationEmailSent | Message |
|-----------|--------------|----------------------|---------|
| Nouveau contact | true | true | "Welcome email sent" |
| Confirmation en attente | false | false | "Confirmation already pending" |
| Déjà confirmé | false | false | "Contact already confirmed" |

### 2.2 registerPresentielCourse

Gère les réservations de cours.

**URL** : `https://europe-west1-fluance-protected-content.cloudfunctions.net/registerPresentielCourse`

**Paramètres** :
| Paramètre | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| email | string | ✅ | Email du contact |
| name | string | ❌ | Nom complet |
| courseName | string | ❌ | Nom du cours |
| courseDate | string | ❌ | Date (DD/MM/YYYY) |
| courseTime | string | ❌ | Heure (HH:MM) |
| apiKey | string | ✅ | Clé API |

**Réponses** :
| Situation | isNewContact | confirmationEmailSent | pendingConfirmation |
|-----------|--------------|----------------------|---------------------|
| Nouveau contact | true | true | false |
| Confirmation en attente | false | false | true |
| Déjà confirmé | false | false | false |

## 3. Structure des données

### 3.1 Google Sheets - Feuille "Comptes"

| Colonne | Description |
|---------|-------------|
| Date | Date/heure de création du compte |
| Nom | Nom du contact |
| Email | Email du contact |
| Statut | OK ou ERREUR |
| Type Contact | Nouveau ou Existant |
| Message | Message de la Cloud Function |

### 3.2 Google Sheets - Feuille "Inscriptions"

| Colonne | Description |
|---------|-------------|
| Date Inscription | Date/heure de réception de l'email |
| Nom | Nom du participant |
| Email | Email du participant |
| Nom du Cours | Nom du cours réservé |
| Date du Cours | Date du cours (DD/MM/YYYY) |
| Horaire | Heure du cours (HH:MM) |
| Statut | OK ou ERREUR |
| Type Contact | Nouveau, En attente, ou Existant |
| Nb Cours Total | Nombre total de cours pour ce contact |
| Message | Message de la Cloud Function |

### 3.3 Firestore - Collection `momoyogaAccounts`

```javascript
{
  email: "contact@example.com",
  name: "Prénom Nom",
  createdAt: Timestamp,
  source: "momoyoga_account"
}
```

### 3.4 Firestore - Collection `presentielRegistrations`

```javascript
{
  email: "contact@example.com",
  name: "Prénom Nom",
  courseName: "Fluance - Jeudi 20h15",
  courseDate: "23/01/2026",
  courseTime: "20:15",
  registeredAt: Timestamp,
  source: "momoyoga"
}
```

### 3.5 Firestore - Collection `newsletterConfirmations`

```javascript
{
  email: "contact@example.com",
  name: "Prénom Nom",
  createdAt: Timestamp,
  expiresAt: Date (7 jours),
  confirmed: false,
  reminderSent: false,
  sourceOptin: "presentiel_compte" // ou "presentiel"
}
```

### 3.6 MailJet Contact Properties

| Property | Type | Description |
|----------|------|-------------|
| `compte_momoyoga` | Date | Date de création du compte Momoyoga |
| `inscrit_presentiel` | Boolean | `"True"` si a réservé au moins un cours |
| `nombre_cours_presentiel` | Integer | Nombre total de cours réservés |
| `premier_cours_presentiel` | Date | Date du premier cours |
| `dernier_cours_presentiel` | Date | Date du dernier cours |
| `source_optin` | String | Contient "presentiel_compte" et/ou "presentiel" |

## 4. Déploiement

### 4.1 Déployer les Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions:registerMomoyogaAccount,functions:registerPresentielCourse
```

### 4.2 Builder les templates d'email

```bash
npm run build
```

Cela compile :
- `src/emails/bienvenue-presentiel.mjml` → `functions/emails/bienvenue-presentiel.html`
- `src/emails/confirmation-presentiel.mjml` → `functions/emails/confirmation-presentiel.html`

### 4.3 Configurer le secret API (optionnel)

```bash
firebase functions:secrets:set PRESENTIEL_API_KEY
```

## 5. Test

### 5.1 Tester l'extraction des emails

```javascript
// Dans Google Apps Script
testExtractAccountEmail();  // Pour les créations de compte
testExtractCourseEmail();   // Pour les réservations
```

### 5.2 Tester les Cloud Functions

```bash
# Création de compte
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/registerMomoyogaAccount \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "apiKey": "VOTRE_CLE_SECRETE"
  }'

# Réservation de cours
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/registerPresentielCourse \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "courseName": "Fluance - Test",
    "courseDate": "01/01/2026",
    "courseTime": "20:15",
    "apiKey": "VOTRE_CLE_SECRETE"
  }'
```

### 5.3 Vérifier les logs

```bash
firebase functions:log --only registerMomoyogaAccount,registerPresentielCourse
```

## 6. Gestion des inscriptions multiples

### Tableau récapitulatif

| Événement | Confirmation existante | Action | Email envoyé |
|-----------|------------------------|--------|--------------|
| Création compte | Aucune | Double opt-in | ✅ Bienvenue |
| Création compte | En attente | Rien | ❌ |
| Création compte | Confirmée | Mise à jour props | ❌ |
| Réservation cours | Aucune | Double opt-in | ✅ Confirmation |
| Réservation cours | En attente | Mise à jour Firestore | ❌ |
| Réservation cours | Confirmée | Mise à jour props | ❌ |

### Propriétés mises à jour

**À chaque réservation :**
- `nombre_cours_presentiel` : incrémenté
- `dernier_cours_presentiel` : date du nouveau cours

**Une seule fois :**
- `compte_momoyoga` : date de création du compte
- `inscrit_presentiel` : défini à "True" lors de la première réservation
- `premier_cours_presentiel` : date du premier cours

## 7. Segments MailJet

### Contacts Momoyoga (tous)
- `compte_momoyoga` est défini

### Participants aux cours
- `inscrit_presentiel` = `"True"`

### Comptes sans réservation
- `compte_momoyoga` est défini
- `inscrit_presentiel` ≠ `"True"`

### Participants réguliers (5+ cours)
- `inscrit_presentiel` = `"True"`
- `nombre_cours_presentiel` >= 5

### Participants inactifs
- `inscrit_presentiel` = `"True"`
- `dernier_cours_presentiel` < Date ancienne (ex: > 1 mois)

## 8. Dépannage

### L'email n'est pas extrait correctement

Vérifiez le format avec `testExtractAccountEmail()` ou `testExtractCourseEmail()` et ajustez les regex si nécessaire.

### La Cloud Function retourne une erreur

```bash
firebase functions:log --only registerMomoyogaAccount,registerPresentielCourse
```

### Les propriétés MailJet ne sont pas mises à jour

1. Vérifiez que les propriétés existent dans MailJet Dashboard
2. Les propriétés sont créées automatiquement par `ensureMailjetContactProperties`

### Doublons dans Google Sheets

Le script vérifie :
- Pour les comptes : email uniquement
- Pour les cours : email + cours + date
