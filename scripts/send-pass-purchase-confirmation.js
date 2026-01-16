/**
 * Script pour envoyer manuellement l'email de confirmation d'achat de pass
 * Usage: node scripts/send-pass-purchase-confirmation.js [email] [passId]
 * 
 * Ce script :
 * 1. Récupère les informations du pass
 * 2. Récupère les informations de la première réservation avec ce pass (si disponible)
 * 3. Envoie l'email de confirmation d'achat de pass
 * 
 * Exemple: node scripts/send-pass-purchase-confirmation.js nicolevonlanthen@hotmail.com x9ci3ZqUGjCaMvLyBd1j
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin
try {
  if (!admin.apps.length) {
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
        credential: admin.credential.cert(serviceAccount),
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

const db = admin.firestore();

async function sendPassPurchaseConfirmation(email, passId) {
  console.log(`📧 Envoi de l'email de confirmation d'achat de pass\n`);
  console.log(`   Email: ${email}`);
  console.log(`   Pass ID: ${passId}\n`);

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Récupérer le pass
    const passDoc = await db.collection('userPasses').doc(passId).get();
    if (!passDoc.exists) {
      console.error(`❌ Pass ${passId} non trouvé.`);
      process.exit(1);
    }

    const pass = passDoc.data();
    console.log(`✅ Pass trouvé:`);
    console.log(`   - Type: ${pass.passName || pass.passType}`);
    console.log(`   - Email: ${pass.email}`);
    console.log(`   - Séances: ${pass.sessionsUsed || 0}/${pass.sessionsTotal || 'N/A'}`);
    console.log(`   - Séances restantes: ${pass.sessionsRemaining || 'N/A'}`);
    console.log(`   - Statut: ${pass.status}\n`);

    // Vérifier que le pass appartient au bon utilisateur
    if (pass.email.toLowerCase().trim() !== normalizedEmail) {
      console.error(`❌ Le pass n'appartient pas à cet utilisateur.`);
      console.error(`   Pass email: ${pass.email}`);
      console.error(`   Email fourni: ${normalizedEmail}`);
      process.exit(1);
    }

    // 2. Récupérer la première réservation avec ce pass (pour afficher les détails du cours)
    let bookingInfo = null;
    const bookings = await db.collection('bookings')
        .where('email', '==', normalizedEmail)
        .where('passId', '==', passId)
        .where('status', '==', 'confirmed')
        .limit(1)
        .get();

    if (!bookings.empty) {
      const booking = bookings.docs[0].data();
      bookingInfo = {
        courseName: booking.courseName || '',
        courseDate: booking.courseDate || '',
        courseTime: booking.courseTime || '',
        courseLocation: booking.courseLocation || '',
      };
      console.log(`✅ Réservation trouvée:`);
      console.log(`   - Cours: ${bookingInfo.courseName}`);
      console.log(`   - Date: ${bookingInfo.courseDate} ${bookingInfo.courseTime}`);
      console.log(`   - Lieu: ${bookingInfo.courseLocation}\n`);
    } else {
      console.log(`ℹ️  Aucune réservation trouvée avec ce pass\n`);
    }

    // 3. Préparer les données pour l'email
    const passService = require('../functions/services/passService');
    const passConfig = passService.PASS_CONFIG[pass.passType];
    
    if (!passConfig) {
      console.error(`❌ Configuration du pass non trouvée pour ${pass.passType}`);
      process.exit(1);
    }

    const firstName = pass.firstName || '';
    const passTypeLabel = pass.passType === 'flow_pass' ? 'Flow Pass' : 'Pass Semestriel';
    const sessions = passConfig.sessions;
    const validityMonths = Math.floor(passConfig.validityDays / 30);
    const isUnlimited = passConfig.sessions === -1;
    const isRecurring = passConfig.isRecurring || false;

    console.log(`📋 Données de l'email:`);
    console.log(`   - Prénom: ${firstName}`);
    console.log(`   - Type de pass: ${passTypeLabel}`);
    console.log(`   - Séances: ${sessions === -1 ? 'Illimité' : sessions}`);
    console.log(`   - Validité: ${validityMonths} mois`);
    console.log(`   - Pass ID: ${passId}\n`);

    // 4. Envoyer l'email
    console.log('📧 Envoi de l\'email de confirmation...');
    try {
      await db.collection('mail').add({
        to: normalizedEmail,
        template: {
          name: 'pass-purchase-confirmation',
          data: {
            firstName: firstName,
            passType: passTypeLabel,
            sessions: sessions,
            validityMonths: validityMonths,
            isUnlimited: isUnlimited,
            isRecurring: isRecurring,
            passId: passId,
          },
        },
      });
      console.log(`✅ Email de confirmation envoyé à ${normalizedEmail}\n`);

      if (bookingInfo) {
        console.log(`ℹ️  Note: L'email de confirmation d'achat de pass a été envoyé.`);
        console.log(`   Si la cliente a également besoin de l'email de confirmation de réservation,`);
        console.log(`   utilisez le script approprié pour envoyer l'email de confirmation de réservation.\n`);
      }

      console.log('═'.repeat(100));
      console.log('\n📊 RÉSUMÉ:\n');
      console.log(`   ✅ Email de confirmation d'achat de pass envoyé`);
      console.log(`   📧 Destinataire: ${normalizedEmail}`);
      console.log(`   🎫 Pass: ${passTypeLabel} (${passId})`);
      if (bookingInfo) {
        console.log(`   📅 Réservation: ${bookingInfo.courseName} - ${bookingInfo.courseDate} ${bookingInfo.courseTime}`);
      }
      console.log('\n' + '═'.repeat(100));

    } catch (emailError) {
      console.error('❌ Erreur lors de l\'envoi de l\'email:', emailError.message);
      console.error('Stack:', emailError.stack);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Exécuter
const email = process.argv[2];
const passId = process.argv[3];

if (!email || !passId) {
  console.log('❌ Usage: node scripts/send-pass-purchase-confirmation.js [email] [passId]\n');
  console.log('Exemple:');
  console.log('  node scripts/send-pass-purchase-confirmation.js nicolevonlanthen@hotmail.com x9ci3ZqUGjCaMvLyBd1j');
  process.exit(1);
}

sendPassPurchaseConfirmation(email, passId)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
