/**
 * Script pour vérifier les données d'un utilisateur dans Firestore
 * Usage: node scripts/check-user-data.js [email]
 * 
 * Exemple: node scripts/check-user-data.js nicolevonlanthen@hotmail.com
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin avec credentials
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

async function checkUserData(email) {
  const normalizedEmail = email.toLowerCase().trim();
  
  console.log(`🔍 Vérification des données pour: ${normalizedEmail}\n`);
  
  try {
    // 1. Vérifier les pass (userPasses)
    console.log('📋 PASS (userPasses):\n');
    const passesSnapshot = await db.collection('userPasses')
        .where('email', '==', normalizedEmail)
        .get();
    
    if (passesSnapshot.empty) {
      console.log('   ❌ Aucun pass trouvé\n');
    } else {
      console.log(`   ✅ ${passesSnapshot.size} pass trouvé(s):\n`);
      passesSnapshot.docs.forEach((doc, index) => {
        const pass = doc.data();
        console.log(`   ${index + 1}. ${pass.passName || pass.passType}`);
        console.log(`      ID: ${doc.id}`);
        console.log(`      Type: ${pass.passType}`);
        console.log(`      Statut: ${pass.status}`);
        console.log(`      Séances: ${pass.sessionsUsed || 0}/${pass.sessionsTotal || 'N/A'} (restantes: ${pass.sessionsRemaining || 'N/A'})`);
        console.log(`      Acheté le: ${pass.purchaseDate?.toDate ? pass.purchaseDate.toDate() : pass.purchaseDate}`);
        console.log(`      Expire le: ${pass.expiryDate?.toDate ? pass.expiryDate.toDate() : pass.expiryDate}`);
        if (pass.stripePaymentIntentId) {
          console.log(`      Stripe Payment Intent: ${pass.stripePaymentIntentId}`);
        }
        if (pass.stripeSubscriptionId) {
          console.log(`      Stripe Subscription: ${pass.stripeSubscriptionId}`);
        }
        console.log('');
      });
    }
    
    // 2. Vérifier les réservations (bookings)
    console.log('📋 RÉSERVATIONS (bookings):\n');
    const bookingsSnapshot = await db.collection('bookings')
        .where('email', '==', normalizedEmail)
        .limit(20)
        .get();
    
    if (bookingsSnapshot.empty) {
      console.log('   ❌ Aucune réservation trouvée\n');
    } else {
      console.log(`   ✅ ${bookingsSnapshot.size} réservation(s) trouvée(s):\n`);
      bookingsSnapshot.docs.forEach((doc, index) => {
        const booking = doc.data();
        console.log(`   ${index + 1}. ${booking.courseName || 'N/A'} - ${booking.courseDate || 'N/A'}`);
        console.log(`      ID: ${doc.id}`);
        console.log(`      Statut: ${booking.status}`);
        console.log(`      Formule: ${booking.pricingOption || 'N/A'}`);
        console.log(`      Montant: ${booking.amount ? (booking.amount / 100) + ' CHF' : 'Gratuit'}`);
        console.log(`      Mode de paiement: ${booking.paymentMethod || 'N/A'}`);
        console.log(`      Créé le: ${booking.createdAt?.toDate ? booking.createdAt.toDate() : booking.createdAt}`);
        console.log('');
      });
    }
    
    // 3. Vérifier les emails envoyés (collection mail)
    console.log('📧 EMAILS ENVOYÉS (collection mail):\n');
    const mailSnapshot = await db.collection('mail')
        .where('to', '==', normalizedEmail)
        .limit(20)
        .get();
    
    if (mailSnapshot.empty) {
      console.log('   ❌ Aucun email trouvé dans la collection mail\n');
    } else {
      console.log(`   ✅ ${mailSnapshot.size} email(s) trouvé(s):\n`);
      mailSnapshot.docs.forEach((doc, index) => {
        const mail = doc.data();
        const templateName = mail.template?.name || 'N/A';
        console.log(`   ${index + 1}. Template: ${templateName}`);
        console.log(`      ID: ${doc.id}`);
        console.log(`      Créé le: ${mail.createdAt?.toDate ? mail.createdAt.toDate() : mail.createdAt}`);
        if (mail.delivery && mail.delivery.state) {
          console.log(`      État de livraison: ${mail.delivery.state}`);
        }
        console.log('');
      });
    }
    
    // 4. Vérifier les confirmations d'opt-in
    console.log('📧 CONFIRMATIONS OPT-IN (newsletterConfirmations):\n');
    const confirmationsSnapshot = await db.collection('newsletterConfirmations')
        .where('email', '==', normalizedEmail)
        .limit(10)
        .get();
    
    if (confirmationsSnapshot.empty) {
      console.log('   ❌ Aucune confirmation trouvée\n');
    } else {
      console.log(`   ✅ ${confirmationsSnapshot.size} confirmation(s) trouvée(s):\n`);
      confirmationsSnapshot.docs.forEach((doc, index) => {
        const conf = doc.data();
        console.log(`   ${index + 1}. Source: ${conf.sourceOptin || 'N/A'}`);
        console.log(`      Confirmé: ${conf.confirmed ? 'Oui' : 'Non'}`);
        console.log(`      Créé le: ${conf.createdAt?.toDate ? conf.createdAt.toDate() : conf.createdAt}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter
const email = process.argv[2];

if (!email) {
  console.log('❌ Usage: node scripts/check-user-data.js [email]\n');
  console.log('Exemple:');
  console.log('  node scripts/check-user-data.js nicolevonlanthen@hotmail.com');
  process.exit(1);
}

checkUserData(email)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
