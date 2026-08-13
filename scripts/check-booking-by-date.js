/**
 * Script pour vérifier une réservation spécifique par date et email
 * Usage: node scripts/check-booking-by-date.js [email] [date] [time]
 * 
 * Exemple: node scripts/check-booking-by-date.js user@example.com 05/02/2026 20:15
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin avec credentials
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

async function checkBookingByDate(email, date, time) {
  const normalizedEmail = email.toLowerCase().trim();
  
  console.log(`🔍 Vérification de la réservation pour:`);
  console.log(`   Email: ${normalizedEmail}`);
  console.log(`   Date: ${date}`);
  console.log(`   Heure: ${time}\n`);

  try {
    // Récupérer toutes les réservations de cet utilisateur
    const bookingsSnapshot = await db.collection('bookings')
        .where('email', '==', normalizedEmail)
        .get();

    if (bookingsSnapshot.empty) {
      console.log('❌ Aucune réservation trouvée pour cet email.\n');
      return;
    }

    console.log(`📋 ${bookingsSnapshot.size} réservation(s) trouvée(s) pour cet email:\n`);

    let foundBooking = null;
    const allBookings = [];

    bookingsSnapshot.docs.forEach((doc) => {
      const booking = doc.data();
      allBookings.push({...booking, id: doc.id});
      
      // Vérifier si la date et l'heure correspondent
      const bookingDate = booking.courseDate || '';
      const bookingTime = booking.courseTime || '';
      
      // Normaliser les formats de date
      const normalizedBookingDate = bookingDate.replace(/\s+/g, '');
      const normalizedSearchDate = date.replace(/\s+/g, '');
      
      if (normalizedBookingDate === normalizedSearchDate && bookingTime === time) {
        foundBooking = {...booking, id: doc.id};
      }
    });

    // Afficher toutes les réservations
    console.log('═'.repeat(100));
    allBookings.forEach((booking, index) => {
      const isMatch = booking.courseDate === date && booking.courseTime === time;
      const matchIcon = isMatch ? '🎯' : '  ';
      
      console.log(`\n${matchIcon} Réservation ${index + 1}:`);
      console.log(`   - Booking ID: ${booking.id}`);
      console.log(`   - Cours: ${booking.courseName || 'N/A'}`);
      console.log(`   - Date: ${booking.courseDate || 'N/A'}`);
      console.log(`   - Heure: ${booking.courseTime || 'N/A'}`);
      console.log(`   - Lieu: ${booking.courseLocation || 'N/A'}`);
      console.log(`   - Statut: ${booking.status || 'N/A'}`);
      console.log(`   - Formule: ${booking.pricingOption || 'N/A'}`);
      console.log(`   - Mode de paiement: ${booking.paymentMethod || 'N/A'}`);
      console.log(`   - Montant: ${booking.amount ? (booking.amount / 100) + ' CHF' : 'Gratuit'}`);
      
      if (booking.passId) {
        console.log(`   - Pass ID utilisé: ${booking.passId}`);
      }
      if (booking.stripePaymentIntentId) {
        console.log(`   - Stripe Payment Intent: ${booking.stripePaymentIntentId}`);
      }
      
      console.log(`   - Créé le: ${booking.createdAt?.toDate ? booking.createdAt.toDate().toLocaleString('fr-FR') : booking.createdAt || 'N/A'}`);
      console.log(`   - Mis à jour le: ${booking.updatedAt?.toDate ? booking.updatedAt.toDate().toLocaleString('fr-FR') : booking.updatedAt || 'N/A'}`);
      
      if (isMatch) {
        console.log(`   ✅ CORRESPOND À LA RECHERCHE`);
      }
    });
    console.log('\n' + '═'.repeat(100));

    if (foundBooking) {
      console.log('\n✅ Réservation trouvée !\n');
      console.log('📊 Détails complets:');
      console.log(JSON.stringify(foundBooking, null, 2));
      
      // Vérifier le pass utilisé
      if (foundBooking.passId) {
        console.log('\n🔍 Vérification du pass utilisé...');
        try {
          const passDoc = await db.collection('userPasses').doc(foundBooking.passId).get();
          if (passDoc.exists) {
            const pass = passDoc.data();
            console.log(`   ✅ Pass trouvé:`);
            console.log(`      - Type: ${pass.passName || pass.passType}`);
            console.log(`      - Séances utilisées: ${pass.sessionsUsed || 0}/${pass.sessionsTotal || 'N/A'}`);
            console.log(`      - Séances restantes: ${pass.sessionsRemaining || 'N/A'}`);
            console.log(`      - Statut: ${pass.status}`);
          } else {
            console.log(`   ⚠️  Pass ID ${foundBooking.passId} non trouvé dans userPasses`);
          }
        } catch (passError) {
          console.error('   ❌ Erreur lors de la vérification du pass:', passError.message);
        }
      }
    } else {
      console.log('\n❌ Aucune réservation trouvée pour cette date et heure exactes.');
      console.log('\n💡 Vérifiez les dates ci-dessus - peut-être un format différent ?');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Exécuter
const email = process.argv[2];
const date = process.argv[3];
const time = process.argv[4];

if (!email || !date || !time) {
  console.log('❌ Usage: node scripts/check-booking-by-date.js [email] [date] [time]\n');
  console.log('Exemple:');
  console.log('  node scripts/check-booking-by-date.js user@example.com 05/02/2026 20:15');
  process.exit(1);
}

checkBookingByDate(email, date, time)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
