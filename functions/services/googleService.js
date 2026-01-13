/**
 * Google Service - Authentification et API pour Calendar et Sheets
 *
 * Ce service gère :
 * - L'authentification via Service Account
 * - La synchronisation Google Calendar -> Firestore
 * - L'écriture dans Google Sheets pour le suivi
 */

const {google} = require('googleapis');
const admin = require('firebase-admin');

// Configuration des IDs (à définir via les secrets Firebase)
// firebase functions:secrets:set GOOGLE_CALENDAR_ID
// firebase functions:secrets:set GOOGLE_SHEET_ID

/**
 * Classe GoogleService pour gérer les interactions avec les APIs Google
 */
class GoogleService {
  constructor() {
    this.auth = null;
    this.calendar = null;
    this.sheets = null;
  }

  /**
   * Initialise l'authentification avec le Service Account
   * Le fichier service-account.json doit être configuré via les secrets Firebase
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.auth) return;

    try {
      // Charger les credentials depuis les secrets Firebase
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT;

      if (!serviceAccountJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT secret not configured');
      }

      // Nettoyer et parser le JSON
      let credentials;
      try {
        // Nettoyer le JSON (retirer BOM, espaces, retours à la ligne)
        let cleaned = serviceAccountJson.trim();
        // Retirer BOM UTF-8 si présent
        if (cleaned.charCodeAt(0) === 0xFEFF) {
          cleaned = cleaned.slice(1);
        }
        // Retirer les caractères invisibles en début
        cleaned = cleaned.replace(/^\s+/, '');

        // Essayer de parser
        credentials = JSON.parse(cleaned);
      } catch (parseError) {
        // Diagnostic détaillé
        const firstChars = serviceAccountJson.substring(0, 100);
        const lastChars = serviceAccountJson.substring(Math.max(0, serviceAccountJson.length - 100));
        const length = serviceAccountJson.length;
        const startsWithBrace = serviceAccountJson.trim().startsWith('{');
        const endsWithBrace = serviceAccountJson.trim().endsWith('}');

        console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT JSON');
        console.error('Length:', length);
        console.error('Starts with {:', startsWithBrace);
        console.error('Ends with }:', endsWithBrace);
        console.error('First 100 chars:', JSON.stringify(firstChars));
        console.error('Last 100 chars:', JSON.stringify(lastChars));
        console.error('Parse error:', parseError.message);

        // Messages d'aide selon le problème
        let helpMessage = 'Make sure you copied the ENTIRE JSON file content (from { to }).';
        if (!startsWithBrace) {
          helpMessage += ' The JSON should start with {. Check for hidden characters or BOM.';
        }
        if (!endsWithBrace) {
          helpMessage += ' The JSON should end with }. The content might be truncated.';
        }
        if (length < 100) {
          helpMessage += ' The content seems too short. Make sure you copied the complete file.';
        }

        throw new Error(
            `Invalid JSON in GOOGLE_SERVICE_ACCOUNT: ${parseError.message}. ${helpMessage}`,
        );
      }

      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/spreadsheets',
        ],
      });

      const authClient = await this.auth.getClient();

      this.calendar = google.calendar({version: 'v3', auth: authClient});
      this.sheets = google.sheets({version: 'v4', auth: authClient});

      console.log('✅ GoogleService initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing GoogleService:', error.message);
      throw error;
    }
  }

  /**
   * Récupère les événements du calendrier Google et les synchronise avec Firestore
   * @param {Object} db - Instance Firestore
   * @param {string} calendarId - ID du calendrier Google (depuis les secrets)
   * @returns {Promise<{synced: number, errors: number}>}
   */
  async syncCalendarToFirestore(db, calendarId) {
    await this.initialize();

    const now = new Date();
    const timeMin = now.toISOString();
    // Synchroniser les 3 prochains mois
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`📅 Syncing calendar events from ${timeMin} to ${timeMax}`);

    try {
      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      console.log(`📋 Found ${events.length} events to sync`);

      let synced = 0;
      let errors = 0;

      for (const event of events) {
        try {
          const courseData = this.parseCalendarEvent(event);

          if (courseData) {
            // Utiliser l'ID Google Calendar comme ID du document
            const docId = event.id;

            await db.collection('courses').doc(docId).set(courseData, {merge: true});
            synced++;
            console.log(`✅ Synced: ${courseData.title} on ${courseData.date}`);
          }
        } catch (error) {
          errors++;
          console.error(`❌ Error syncing event ${event.id}:`, error.message);
        }
      }

      // Nettoyer les anciens cours (passés depuis plus de 7 jours)
      const cleanupDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const cleanupTimestamp = admin.firestore.Timestamp.fromDate(cleanupDate);
      const oldCourses = await db.collection('courses')
          .where('startTime', '<', cleanupTimestamp)
          .get();

      for (const doc of oldCourses.docs) {
        await doc.ref.delete();
        console.log(`🗑️ Deleted old course: ${doc.id}`);
      }

      return {synced, errors};
    } catch (error) {
      console.error('❌ Error fetching calendar events:', error.message);
      throw error;
    }
  }

  /**
   * Parse un événement Google Calendar pour extraire les données du cours
   * Cherche [max:XX] dans la description pour la capacité
   * @param {Object} event - Événement Google Calendar
   * @returns {Object|null} - Données du cours ou null si invalide
   */
  parseCalendarEvent(event) {
    if (!event.start || !event.summary) {
      return null;
    }

    const startDateTime = event.start.dateTime || event.start.date;
    const endDateTime = event.end?.dateTime || event.end?.date;
    const timeZone = event.start.timeZone || 'Europe/Zurich'; // Fuseau horaire du calendrier

    // Extraire la capacité max depuis la description [max:XX]
    let maxCapacity = 10; // Valeur par défaut
    const description = event.description || '';
    const maxMatch = description.match(/\[max:(\d+)\]/i);
    if (maxMatch) {
      maxCapacity = parseInt(maxMatch[1], 10);
    }

    // Extraire le prix si spécifié [price:XX]
    let price = 25; // Prix par défaut (à la carte)
    const priceMatch = description.match(/\[price:(\d+)\]/i);
    if (priceMatch) {
      price = parseInt(priceMatch[1], 10);
    }

    // Nettoyer la description (retirer les balises)
    const cleanDescription = description
        .replace(/\[max:\d+\]/gi, '')
        .replace(/\[price:\d+\]/gi, '')
        .trim();

    // Convertir la date/heure en tenant compte du fuseau horaire
    // Google Calendar envoie les dates en ISO avec timezone
    // On crée un objet Date qui représente le moment exact dans le fuseau horaire spécifié
    let startTime;
    let endTime = null;

    try {
      // Parser la date ISO (qui contient déjà le timezone)
      startTime = new Date(startDateTime);
      if (isNaN(startTime.getTime())) {
        console.error(`Invalid start date: ${startDateTime}`);
        return null;
      }

      if (endDateTime) {
        endTime = new Date(endDateTime);
        if (isNaN(endTime.getTime())) {
          endTime = null;
        }
      }

      // Formater la date et l'heure en utilisant le fuseau horaire du calendrier
      // On utilise Intl.DateTimeFormat pour formater dans le bon fuseau horaire
      const dateFormatter = new Intl.DateTimeFormat('fr-CH', {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const timeFormatter = new Intl.DateTimeFormat('fr-CH', {
        timeZone: timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      // Formater la date (DD/MM/YYYY) et l'heure (HH:MM) dans le fuseau horaire du calendrier
      const dateParts = dateFormatter.formatToParts(startTime);
      const timeParts = timeFormatter.formatToParts(startTime);

      // Extraire la date au format DD/MM/YYYY (format utilisé dans le reste du code)
      const yearPart = dateParts.find((p) => p.type === 'year');
      const monthPart = dateParts.find((p) => p.type === 'month');
      const dayPart = dateParts.find((p) => p.type === 'day');
      const hourPart = timeParts.find((p) => p.type === 'hour');
      const minutePart = timeParts.find((p) => p.type === 'minute');

      if (!yearPart || !monthPart || !dayPart || !hourPart || !minutePart) {
        console.error('Error parsing date/time parts from formatter');
        return null;
      }

      const formattedDate = `${dayPart.value}/${monthPart.value}/${yearPart.value}`;
      const formattedTime = `${hourPart.value}:${minutePart.value}`;

      // Convertir en Firestore Timestamp pour le stockage
      const startTimestamp = admin.firestore.Timestamp.fromDate(startTime);
      const endTimestamp = endTime ? admin.firestore.Timestamp.fromDate(endTime) : null;

      return {
        gcalId: event.id,
        title: event.summary,
        description: cleanDescription,
        location: event.location || 'le duplex danse & bien-être, Rte de Chantemerle 58d, 1763 Granges-Paccot',
        startTime: startTimestamp,
        endTime: endTimestamp,
        date: formattedDate,
        time: formattedTime,
        maxCapacity: maxCapacity,
        price: price,
        participants: [], // Liste des IDs de réservations confirmées
        participantCount: 0,
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (error) {
      console.error(`Error parsing calendar event date/time: ${error.message}`, {
        startDateTime,
        endDateTime,
        timeZone,
      });
      return null;
    }
  }

  /**
   * Ajoute une réservation dans le Google Sheet de suivi
   * @param {string} sheetId - ID de la Google Sheet
   * @param {string} courseId - ID du cours
   * @param {Object} userData - Données de l'utilisateur
   * @param {Object} bookingData - Données de la réservation
   * @returns {Promise<void>}
   */
  async appendUserToSheet(sheetId, courseId, userData, bookingData) {
    await this.initialize();

    const sheetName = 'Réservations';

    // Préparer la ligne à ajouter
    const row = [
      new Date().toISOString(), // Date d'inscription
      userData.firstName || '',
      userData.lastName || '',
      userData.email || '',
      userData.phone || '',
      bookingData.courseName || '',
      bookingData.courseDate || '',
      bookingData.courseTime || '',
      bookingData.paymentMethod || '',
      bookingData.paymentStatus || '',
      bookingData.amount || '',
      bookingData.status || '',
      courseId,
      bookingData.bookingId || '',
      bookingData.notes || '',
    ];

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:O`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [row],
        },
      });

      console.log(`📊 Added booking to sheet: ${userData.email} for ${bookingData.courseName}`);
    } catch (error) {
      console.error('❌ Error appending to sheet:', error.message);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une réservation dans le Google Sheet
   * @param {string} sheetId - ID de la Google Sheet
   * @param {string} bookingId - ID de la réservation
   * @param {string} newStatus - Nouveau statut
   * @returns {Promise<void>}
   */
  async updateBookingStatusInSheet(sheetId, bookingId, newStatus) {
    await this.initialize();

    const sheetName = 'Réservations';

    try {
      // Lire toutes les données pour trouver la ligne
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:O`,
      });

      const rows = response.data.values || [];
      let rowIndex = -1;

      // Trouver la ligne avec le bookingId (colonne N = index 13)
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][13] === bookingId) {
          rowIndex = i + 1; // +1 car les lignes commencent à 1
          break;
        }
      }

      if (rowIndex > 0) {
        // Mettre à jour la colonne L (statut = index 11)
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetName}!L${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[newStatus]],
          },
        });

        console.log(`📊 Updated booking status in sheet: ${bookingId} -> ${newStatus}`);
      }
    } catch (error) {
      console.error('❌ Error updating sheet:', error.message);
      // Ne pas throw pour ne pas bloquer le processus principal
    }
  }

  /**
   * Ajoute une note à un événement Google Calendar (optionnel)
   * @param {string} calendarId - ID du calendrier
   * @param {string} eventId - ID de l'événement
   * @param {string} note - Note à ajouter
   * @returns {Promise<void>}
   */
  async addNoteToCalendarEvent(calendarId, eventId, note) {
    await this.initialize();

    try {
      // Note: Cette opération nécessite un scope d'écriture sur le calendrier
      // Pour l'instant, on log simplement
      const timestamp = new Date().toLocaleString('fr-CH');
      console.log(`📝 Note for event ${eventId} [${timestamp}]: ${note}`);
    } catch (error) {
      console.error('❌ Error adding note to calendar:', error.message);
    }
  }
}

// Instance singleton
const googleService = new GoogleService();

module.exports = {
  GoogleService,
  googleService,
};
