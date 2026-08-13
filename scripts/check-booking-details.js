/**
 * Script pour vérifier les détails complets d'une réservation et son pass associé
 * Usage: node scripts/check-booking-details.js [bookingId]
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

async function checkBookingDetails(bookingId) {
  console.log(`🔍 Vérification de la réservation: ${bookingId}\n`);

  try {
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    
    if (!bookingDoc.exists) {
      console.log('❌ Réservation non trouvée.\n');
      process.exit(1);
    }

    const booking = bookingDoc.data();
    
    console.log('═'.repeat(100));
    console.log('📋 DÉTAILS DE LA RÉSERVATION:\n');
    console.log(`   Booking ID: ${bookingId}`);
    console.log(`   Email: ${booking.email}`);
    console.log(`   Nom: ${booking.firstName} ${booking.lastName}`);
    console.log(`   Téléphone: ${booking.phone || 'N/A'}`);
    console.log(`   Cours: ${booking.courseName || 'N/A'}`);
    console.log(`   Date: ${booking.courseDate || 'N/A'}`);
    console.log(`   Heure: ${booking.courseTime || 'N/A'}`);
    console.log(`   Statut: ${booking.status || 'N/A'}`);
    console.log(`   Formule: ${booking.pricingOption || 'N/A'}`);
    console.log(`   Mode de paiement: ${booking.paymentMethod || 'N/A'}`);
    console.log(`   Montant: ${booking.amount ? (booking.amount / 100) + ' CHF' : 'Gratuit'}`);
    
    if (booking.originalAmount) {
      console.log(`   Montant original: ${(booking.originalAmount / 100)} CHF`);
    }
    if (booking.discountAmount) {
      console.log(`   Remise: ${(booking.discountAmount / 100)} CHF (${booking.discountPercent || 0}%)`);
    }
    if (booking.partnerCode) {
      console.log(`   Code partenaire: ${booking.partnerCode}`);
    }
    
    console.log(`   Pass ID: ${booking.passId || 'Aucun (paiement direct)'}`);
    console.log(`   Stripe Payment Intent: ${booking.stripePaymentIntentId || 'N/A'}`);
    console.log(`   Créé le: ${booking.createdAt?.toDate ? booking.createdAt.toDate().toLocaleString('fr-FR') : 'N/A'}`);
    console.log(`   Payé le: ${booking.paidAt?.toDate ? booking.paidAt.toDate().toLocaleString('fr-FR') : 'N/A'}`);
    
    console.log('\n' + '═'.repeat(100));
    
    // Vérifier si un pass existe pour cet utilisateur
    if (booking.email) {
      console.log('\n🔍 Vérification des pass disponibles pour cet utilisateur...\n');
      const passesSnapshot = await db.collection('userPasses')
          .where('email', '==', booking.email.toLowerCase().trim())
          .where('status', '==', 'active')
          .get();
      
      if (passesSnapshot.empty) {
        console.log('   ❌ Aucun pass actif trouvé pour cet utilisateur.\n');
      } else {
        console.log(`   ✅ ${passesSnapshot.size} pass actif(s) trouvé(s):\n`);
        passesSnapshot.docs.forEach((doc, index) => {
          const pass = doc.data();
          const isUsed = booking.passId === doc.id;
          const icon = isUsed ? '✅' : '  ';
          
          console.log(`   ${icon} Pass ${index + 1}:`);
          console.log(`      - ID: ${doc.id}`);
          console.log(`      - Type: ${pass.passName || pass.passType}`);
          console.log(`      - Séances: ${pass.sessionsUsed || 0}/${pass.sessionsTotal || 'N/A'}`);
          console.log(`      - Séances restantes: ${pass.sessionsRemaining || 'N/A'}`);
          console.log(`      - Statut: ${pass.status}`);
          if (isUsed) {
            console.log(`      ✅ UTILISÉ POUR CETTE RÉSERVATION`);
          } else {
            console.log(`      ⚠️  NON UTILISÉ (la réservation a été payée directement)`);
          }
        });
      }
    }
    
    // Analyse
    console.log('\n' + '═'.repeat(100));
    console.log('\n📊 ANALYSE:\n');
    
    if (booking.passId) {
      console.log('✅ La réservation utilise un pass.');
      console.log(`   Pass ID: ${booking.passId}`);
    } else if (booking.pricingOption === 'flow_pass' && booking.amount > 0) {
      console.log('⚠️  PROBLÈME DÉTECTÉ:');
      console.log('   - La formule est "flow_pass"');
      console.log('   - Mais la réservation a été payée directement (pas de passId)');
      console.log('   - Montant payé: ' + (booking.amount / 100) + ' CHF');
      console.log('   - Cela suggère que le Flow Pass n\'a pas été utilisé pour cette réservation.');
    } else {
      console.log('ℹ️  Réservation payée directement (pas de pass utilisé).');
    }
    
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
  console.log('❌ Usage: node scripts/check-booking-details.js [bookingId]\n');
  console.log('Exemple:');
  console.log('  node scripts/check-booking-details.js BZC7QSqOTD9s5PELpNzb');
  process.exit(1);
}

checkBookingDetails(bookingId)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
