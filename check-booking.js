/**
 * Script pour vérifier une réservation dans Firestore
 * Usage: node check-booking.js test-user-4@example.com
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');

// Initialiser Firebase Admin
try {
  if (!admin.getApps().length) {
    admin.initializeApp({
      projectId: 'fluance-protected-content',
    });
    console.log('✅ Firebase Admin initialisé');
  } else {
    console.log('✅ Firebase Admin déjà initialisé');
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = getFirestore();

async function checkBooking(email) {
  const normalizedEmail = email.toLowerCase().trim();
  
  console.log(`\n🔍 Recherche de réservations pour: ${normalizedEmail}\n`);
  
  try {
    // Chercher dans les réservations
    const bookingsSnapshot = await db.collection('bookings')
        .where('email', '==', normalizedEmail)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
    
    if (bookingsSnapshot.empty) {
      console.log('❌ Aucune réservation trouvée');
      return;
    }
    
    console.log(`✅ ${bookingsSnapshot.size} réservation(s) trouvée(s)\n`);
    
    for (const doc of bookingsSnapshot.docs) {
      const data = doc.data();
      console.log('📋 Réservation ID:', doc.id);
      console.log('   Statut:', data.status);
      console.log('   Cours:', data.courseName || 'N/A');
      console.log('   Date:', data.courseDate || 'N/A');
      console.log('   Heure:', data.courseTime || 'N/A');
      console.log('   Option tarifaire:', data.pricingOption || 'N/A');
      console.log('   Montant:', data.amount || 0, 'CHF');
      console.log('   Méthode de paiement:', data.paymentMethod || 'N/A');
      console.log('   Créé le:', data.createdAt?.toDate?.() || data.createdAt || 'N/A');
      console.log('---\n');
    }
    
    // Vérifier les confirmations d'opt-in
    console.log('\n📧 Vérification des confirmations d\'opt-in:\n');
    const confirmationsSnapshot = await db.collection('newsletterConfirmations')
        .where('email', '==', normalizedEmail)
        .where('sourceOptin', 'in', ['presentiel', 'presentiel_compte'])
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();
    
    if (confirmationsSnapshot.empty) {
      console.log('⚠️  Aucune confirmation d\'opt-in trouvée (nouveau contact)');
    } else {
      for (const doc of confirmationsSnapshot.docs) {
        const data = doc.data();
        console.log('📧 Confirmation ID:', doc.id);
        console.log('   Confirmé:', data.confirmed ? '✅ Oui' : '❌ Non (en attente)');
        console.log('   Source:', data.sourceOptin);
        console.log('   Booking ID:', data.bookingId || 'N/A');
        console.log('   Créé le:', data.createdAt?.toDate?.() || data.createdAt || 'N/A');
        console.log('---\n');
      }
    }
    
    // Vérifier les emails dans la collection mail
    console.log('\n📬 Vérification des emails en attente d\'envoi:\n');
    const mailSnapshot = await db.collection('mail')
        .where('to', '==', normalizedEmail)
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();
    
    if (mailSnapshot.empty) {
      console.log('⚠️  Aucun email en attente d\'envoi trouvé');
    } else {
      for (const doc of mailSnapshot.docs) {
        const data = doc.data();
        console.log('📬 Email ID:', doc.id);
        console.log('   Template:', data.template?.name || 'N/A');
        console.log('   Statut:', data.delivery?.state || 'En attente');
        console.log('   Créé le:', data.createdAt?.toDate?.() || data.createdAt || 'N/A');
        console.log('---\n');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.code === 'failed-precondition') {
      console.error('\n💡 Il manque peut-être un index Firestore.');
      console.error('   Créez un index composite pour:');
      console.error('   Collection: bookings');
      console.error('   Fields: email (ASC), createdAt (DESC)');
    }
  }
  
  process.exit(0);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node check-booking.js <email>');
  process.exit(1);
}

checkBooking(email);
