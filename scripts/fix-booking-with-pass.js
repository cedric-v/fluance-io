/**
 * Script pour corriger une réservation en utilisant un Flow Pass au lieu d'un paiement direct
 * Usage: node scripts/fix-booking-with-pass.js [bookingId] [passId]
 * 
 * Ce script :
 * 1. Vérifie que la réservation et le pass existent
 * 2. Utilise une séance du Flow Pass
 * 3. Met à jour la réservation pour utiliser le pass
 * 4. Note: Le remboursement Stripe doit être fait manuellement
 * 
 * Exemple: node scripts/fix-booking-with-pass.js BZC7QSqOTD9s5PELpNzb x9ci3ZqUGjCaMvLyBd1j
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

async function fixBookingWithPass(bookingId, passId) {
  console.log(`🔍 Correction de la réservation ${bookingId} avec le pass ${passId}\n`);

  try {
    // 1. Vérifier que la réservation existe
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      console.error(`❌ Réservation ${bookingId} non trouvée.`);
      process.exit(1);
    }

    const booking = bookingDoc.data();
    console.log(`✅ Réservation trouvée:`);
    console.log(`   - Email: ${booking.email}`);
    console.log(`   - Cours: ${booking.courseName} - ${booking.courseDate} ${booking.courseTime}`);
    console.log(`   - Montant payé: ${booking.amount ? (booking.amount / 100) + ' CHF' : 'Gratuit'}`);
    console.log(`   - Statut actuel: ${booking.status}`);
    console.log(`   - Pass ID actuel: ${booking.passId || 'Aucun'}\n`);

    // 2. Vérifier que le pass existe
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

    // Vérifier que le pass appartient au même utilisateur
    if (pass.email.toLowerCase().trim() !== booking.email.toLowerCase().trim()) {
      console.error(`❌ Le pass n'appartient pas au même utilisateur que la réservation.`);
      console.error(`   Réservation email: ${booking.email}`);
      console.error(`   Pass email: ${pass.email}`);
      process.exit(1);
    }

    // Vérifier que le pass est actif
    if (pass.status !== 'active') {
      console.error(`❌ Le pass n'est pas actif (statut: ${pass.status}).`);
      process.exit(1);
    }

    // Vérifier qu'il reste des séances
    if (pass.passType === 'flow_pass' && pass.sessionsRemaining <= 0) {
      console.error(`❌ Le Flow Pass n'a plus de séances restantes.`);
      process.exit(1);
    }

    // 3. Utiliser une séance du pass
    console.log('🔄 Utilisation d\'une séance du Flow Pass...');
    const passService = require('../functions/services/passService');
    let sessionResult = null;
    
    if (pass.passType !== 'semester_pass' || pass.sessionsRemaining !== -1) {
      sessionResult = await passService.usePassSession(db, passId, booking.courseId);
      console.log(`✅ Séance utilisée. Séances restantes: ${sessionResult.sessionsRemaining}\n`);
    } else {
      console.log(`✅ Pass Semestriel (illimité) - pas de décompte nécessaire\n`);
    }

    // 4. Mettre à jour la réservation
    console.log('🔄 Mise à jour de la réservation...');
    const updatedBookingData = {
      paymentMethod: 'pass',
      pricingOption: pass.passType,
      passId: passId,
      amount: 0, // Plus de paiement
      originalAmount: 0,
      discountAmount: 0,
      discountPercent: 0,
      partnerCode: null, // Retirer le code partenaire
      notes: pass.passType === 'semester_pass' ?
        'Pass Semestriel' :
        `Flow Pass (séance ${
          pass.sessionsTotal - (sessionResult?.sessionsRemaining || 0)
        }/${pass.sessionsTotal})`,
      updatedAt: new Date(),
      // Garder le stripePaymentIntentId pour référence (mais ne plus l'utiliser)
      // Note: Le remboursement Stripe doit être fait manuellement
    };

    await db.collection('bookings').doc(bookingId).update(updatedBookingData);
    console.log(`✅ Réservation mise à jour avec succès.\n`);

    console.log('═'.repeat(100));
    console.log('\n📊 RÉSUMÉ DE LA CORRECTION:\n');
    console.log(`   ✅ Réservation ${bookingId} mise à jour`);
    console.log(`   ✅ Flow Pass ${passId} utilisé (1 séance décomptée)`);
    console.log(`   ✅ Séances restantes: ${sessionResult?.sessionsRemaining || 'Illimité'}`);
    console.log(`\n⚠️  IMPORTANT:`);
    console.log(`   - Le paiement Stripe (${booking.stripePaymentIntentId || 'N/A'}) doit être remboursé manuellement dans Stripe.`);
    console.log(`   - Montant à rembourser: ${booking.amount ? (booking.amount / 100) + ' CHF' : 'N/A'}`);
    console.log(`   - Payment Intent ID: ${booking.stripePaymentIntentId || 'N/A'}`);
    console.log('\n' + '═'.repeat(100));

  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Exécuter
const bookingId = process.argv[2];
const passId = process.argv[3];

if (!bookingId || !passId) {
  console.log('❌ Usage: node scripts/fix-booking-with-pass.js [bookingId] [passId]\n');
  console.log('Exemple:');
  console.log('  node scripts/fix-booking-with-pass.js BZC7QSqOTD9s5PELpNzb x9ci3ZqUGjCaMvLyBd1j');
  process.exit(1);
}

fixBookingWithPass(bookingId, passId)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
