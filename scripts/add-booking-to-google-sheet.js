/**
 * Script pour ajouter manuellement une réservation au Google Spreadsheet
 * Usage: node scripts/add-booking-to-google-sheet.js [bookingId]
 * 
 * Ce script :
 * 1. Récupère les informations de la réservation depuis Firestore
 * 2. Récupère les informations du cours
 * 3. Récupère les informations du pass si applicable
 * 4. Ajoute l'entrée au Google Spreadsheet
 * 
 * Exemple: node scripts/add-booking-to-google-sheet.js BZC7QSqOTD9s5PELpNzb
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin
try {
  if (!admin.getApps().length) {
    const possiblePaths = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.join(__dirname, '../functions/serviceAccountKey.json'),
      path.join(__dirname, '../new-project-service-account.json'),
    ];
    
    let serviceAccountPath = null;
    for (const possiblePath of possiblePaths) {
      if (possiblePath && fs.existsSync(possiblePath)) {
        serviceAccountPath = possiblePath;
        break;
      }
    }
    
    if (serviceAccountPath) {
      console.log(`📁 Utilisation du service account : ${serviceAccountPath}`);
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.cert(serviceAccount),
        projectId: 'fluance-protected-content',
      });
    } else {
      admin.initializeApp({
        projectId: 'fluance-protected-content',
      });
    }
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = getFirestore();

async function addBookingToGoogleSheet(bookingId) {
  console.log(`📊 Ajout de la réservation ${bookingId} au Google Spreadsheet\n`);

  try {
    // 1. Récupérer la réservation
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      console.error(`❌ Réservation ${bookingId} non trouvée.`);
      process.exit(1);
    }

    const booking = bookingDoc.data();
    console.log(`✅ Réservation trouvée:`);
    console.log(`   - Email: ${booking.email}`);
    console.log(`   - Cours: ${booking.courseName} - ${booking.courseDate} ${booking.courseTime}`);
    console.log(`   - Statut: ${booking.status}`);
    console.log(`   - Mode de paiement: ${booking.paymentMethod}\n`);

    // 2. Récupérer les informations du cours
    const courseDoc = await db.collection('courses').doc(booking.courseId).get();
    if (!courseDoc.exists) {
      console.error(`❌ Cours ${booking.courseId} non trouvé.`);
      process.exit(1);
    }

    const course = courseDoc.data();
    console.log(`✅ Cours trouvé: ${course.title}\n`);

    // 3. Récupérer les informations du pass si applicable
    let passInfo = null;
    if (booking.passId) {
      const passDoc = await db.collection('userPasses').doc(booking.passId).get();
      if (passDoc.exists) {
        passInfo = passDoc.data();
        console.log(`✅ Pass trouvé: ${passInfo.passName || passInfo.passType}`);
        console.log(`   - Séances: ${passInfo.sessionsUsed || 0}/${passInfo.sessionsTotal || 'N/A'}`);
        console.log(`   - Séances restantes: ${passInfo.sessionsRemaining || 'N/A'}\n`);
      }
    }

    // 4. Charger le GoogleService avec le service account
    const GoogleService = require('../functions/services/googleService').GoogleService;
    const serviceAccountPath = path.join(__dirname, '../functions/serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      console.error(`❌ Service account non trouvé: ${serviceAccountPath}`);
      process.exit(1);
    }
    
    // Charger le service account et le mettre dans process.env pour GoogleService
    const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
    process.env.GOOGLE_SERVICE_ACCOUNT = serviceAccountContent;
    
    const googleService = new GoogleService();
    await googleService.initialize();

    // 5. Préparer les données pour le Google Sheet
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      console.error('❌ GOOGLE_SHEET_ID non configuré dans les variables d\'environnement.');
      console.log('   Définissez-le avec: export GOOGLE_SHEET_ID="votre_sheet_id"');
      process.exit(1);
    }

    // Déterminer le paymentMethod et paymentStatus
    let paymentMethod = booking.paymentMethod || '';
    let paymentStatus = 'Confirmé';
    let amount = booking.amount ? `${(booking.amount / 100).toFixed(2)} CHF` : '0 CHF';
    let passType = '';
    let sessionsRemaining = '';

    if (booking.paymentMethod === 'pass' && passInfo) {
      paymentMethod = passInfo.passType === 'semester_pass' ? 'Pass Semestriel' : 'Flow Pass';
      paymentStatus = 'Pass utilisé';
      amount = '0 CHF';
      passType = paymentMethod;
      if (passInfo.passType === 'semester_pass') {
        sessionsRemaining = 'Illimité';
      } else {
        sessionsRemaining = `${passInfo.sessionsRemaining || 0}/${passInfo.sessionsTotal || 10}`;
      }
    } else if (booking.paymentMethod === 'Cours d\'essai gratuit') {
      paymentStatus = 'Confirmé';
      amount = '0 CHF';
    } else if (booking.status === 'confirmed' && booking.amount > 0) {
      paymentStatus = 'Payé';
    }

    const userData = {
      firstName: booking.firstName || '',
      lastName: booking.lastName || '',
      email: booking.email || '',
      phone: booking.phone || '',
      ipAddress: booking.ipAddress || '',
    };

    const bookingData = {
      courseName: booking.courseName || course.title || '',
      courseDate: booking.courseDate || course.date || '',
      courseTime: booking.courseTime || course.time || '',
      location: booking.courseLocation || course.location || '',
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      amount: amount,
      status: booking.status === 'confirmed' ? 'Confirmé' : booking.status,
      bookingId: bookingId,
      notes: booking.notes || '',
      passType: passType,
      sessionsRemaining: sessionsRemaining,
      paidAt: booking.paidAt || booking.createdAt || new Date(),
      source: 'web',
      isCancelled: booking.status === 'cancelled' || false,
      isWaitlisted: booking.status === 'waitlisted' || false,
    };

    console.log('📋 Données préparées pour le Google Sheet:');
    console.log(`   - Prénom: ${userData.firstName}`);
    console.log(`   - Nom: ${userData.lastName}`);
    console.log(`   - Email: ${userData.email}`);
    console.log(`   - Méthode de paiement: ${bookingData.paymentMethod}`);
    console.log(`   - Statut de paiement: ${bookingData.paymentStatus}`);
    console.log(`   - Montant: ${bookingData.amount}\n`);

    // 6. Ajouter au Google Sheet
    console.log('📊 Ajout au Google Spreadsheet...');
    await googleService.appendUserToSheet(
        sheetId,
        booking.courseId,
        userData,
        bookingData,
    );

    console.log('\n' + '═'.repeat(100));
    console.log('\n✅ RÉSUMÉ:\n');
    console.log(`   ✅ Réservation ${bookingId} ajoutée au Google Spreadsheet`);
    console.log(`   📧 Email: ${userData.email}`);
    console.log(`   📅 Cours: ${bookingData.courseName} - ${bookingData.courseDate} ${bookingData.courseTime}`);
    console.log(`   💳 Paiement: ${bookingData.paymentMethod} - ${bookingData.paymentStatus}`);
    console.log(`   💰 Montant: ${bookingData.amount}`);
    console.log('\n' + '═'.repeat(100));

  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Exécuter
const bookingId = process.argv[2];

if (!bookingId) {
  console.log('❌ Usage: node scripts/add-booking-to-google-sheet.js [bookingId]\n');
  console.log('Exemple:');
  console.log('  node scripts/add-booking-to-google-sheet.js BZC7QSqOTD9s5PELpNzb');
  console.log('\n⚠️  Assurez-vous que GOOGLE_SHEET_ID est défini dans les variables d\'environnement.');
  process.exit(1);
}

addBookingToGoogleSheet(bookingId)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
