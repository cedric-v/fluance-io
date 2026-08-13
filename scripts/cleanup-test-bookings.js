/**
 * Script pour nettoyer les données de test du système de réservation
 * 
 * Ce script supprime :
 * - Les réservations de test (bookings)
 * - Les pass de test (userPasses)
 * - Les entrées en liste d'attente de test (waitlist)
 * - Les tokens de désinscription de test (cancellationTokens)
 * - Les emails en attente de test (mail)
 * 
 * Usage: node scripts/cleanup-test-bookings.js
 * 
 * ⚠️ ATTENTION : Ce script supprime définitivement les données. 
 * Assurez-vous d'avoir une sauvegarde si nécessaire.
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin avec credentials
try {
  if (!admin.getApps().length) {
    // Chercher le service account dans plusieurs emplacements possibles
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
      console.log('✅ Firebase Admin initialisé avec service account');
    } else {
      // Fallback : utiliser Application Default Credentials (si configuré)
      console.log('⚠️  Aucun service account trouvé, tentative avec Application Default Credentials...');
      admin.initializeApp({
        projectId: 'fluance-protected-content',
      });
      console.log('✅ Firebase Admin initialisé (Application Default Credentials)');
    }
  } else {
    console.log('✅ Firebase Admin déjà initialisé');
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  console.error('\n💡 Solution :');
  console.error('   1. Téléchargez le service account depuis Firebase Console');
  console.error('   2. Enregistrez-le dans functions/serviceAccountKey.json');
  console.error('   OU définissez GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}

const db = getFirestore();

// Liste des emails de test à supprimer (ajoutez vos emails de test ici)
const TEST_EMAILS = [
  'test-user-1@example.com',
  'test-user-2@example.com',
  'test-user-3@example.com',
  'test-user-4@example.com',
  'test-user-5@example.com'
  // Ajoutez vos autres emails de test ici
];

// Date limite : supprimer toutes les réservations créées avant aujourd'hui
// (modifiez cette date si nécessaire)
const CUTOFF_DATE = new Date();
CUTOFF_DATE.setHours(0, 0, 0, 0); // Début de la journée d'aujourd'hui

console.log(`\n🧹 Nettoyage des données de test`);
console.log(`📅 Date limite : ${CUTOFF_DATE.toLocaleDateString('fr-FR')}`);
console.log(`📧 Emails de test : ${TEST_EMAILS.length} email(s)\n`);

/**
 * Normalise un email
 */
function normalizeEmail(email) {
  return email ? email.toLowerCase().trim() : '';
}

/**
 * Supprime les réservations de test
 */
async function cleanupBookings() {
  console.log('📋 Nettoyage des réservations (bookings)...');
  
  let deletedCount = 0;
  let participantCountUpdates = {}; // { courseId: countToDecrement }
  
  try {
    // Récupérer toutes les réservations créées avant aujourd'hui
    const bookingsSnapshot = await db.collection('bookings')
        .where('createdAt', '<', CUTOFF_DATE)
        .get();
    
    console.log(`   Trouvé ${bookingsSnapshot.size} réservation(s) potentielle(s) de test`);
    
    for (const doc of bookingsSnapshot.docs) {
      const booking = doc.data();
      const email = normalizeEmail(booking.email);
      
      // Vérifier si c'est une réservation de test
      const isTestBooking = TEST_EMAILS.some(testEmail => 
        email === normalizeEmail(testEmail)
      ) || email.includes('test') || email.includes('example.com');
      
      if (isTestBooking) {
        // Compter les participants à décrémenter pour les cours confirmés
        if (['confirmed', 'pending_cash'].includes(booking.status) && booking.courseId) {
          if (!participantCountUpdates[booking.courseId]) {
            participantCountUpdates[booking.courseId] = 0;
          }
          participantCountUpdates[booking.courseId]++;
        }
        
        // Supprimer la réservation
        await doc.ref.delete();
        deletedCount++;
        console.log(`   ✅ Supprimé: ${booking.courseName || 'N/A'} - ${email} (${booking.status})`);
      }
    }
    
    // Mettre à jour les compteurs de participants
    for (const [courseId, countToDecrement] of Object.entries(participantCountUpdates)) {
      const courseRef = db.collection('courses').doc(courseId);
      const courseDoc = await courseRef.get();
      
      if (courseDoc.exists) {
        const course = courseDoc.data();
        const newCount = Math.max(0, (course.participantCount || 0) - countToDecrement);
        await courseRef.update({ participantCount: newCount });
        console.log(`   📊 Cours ${courseId}: ${course.participantCount || 0} → ${newCount} participants`);
      }
    }
    
    console.log(`   ✅ ${deletedCount} réservation(s) supprimée(s)\n`);
    return deletedCount;
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage des réservations:', error);
    return 0;
  }
}

/**
 * Supprime les pass de test
 */
async function cleanupUserPasses() {
  console.log('🎫 Nettoyage des pass (userPasses)...');
  
  let deletedCount = 0;
  
  try {
    const passesSnapshot = await db.collection('userPasses').get();
    
    console.log(`   Trouvé ${passesSnapshot.size} pass au total`);
    
    for (const doc of passesSnapshot.docs) {
      const pass = doc.data();
      const email = normalizeEmail(pass.email);
      
      // Vérifier si c'est un pass de test
      const isTestPass = TEST_EMAILS.some(testEmail => 
        email === normalizeEmail(testEmail)
      ) || email.includes('test') || email.includes('example.com');
      
      if (isTestPass) {
        await doc.ref.delete();
        deletedCount++;
        console.log(`   ✅ Supprimé: ${pass.passName || 'N/A'} - ${email}`);
      }
    }
    
    console.log(`   ✅ ${deletedCount} pass supprimé(s)\n`);
    return deletedCount;
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage des pass:', error);
    return 0;
  }
}

/**
 * Supprime les entrées en liste d'attente de test
 */
async function cleanupWaitlist() {
  console.log('⏳ Nettoyage de la liste d\'attente (waitlist)...');
  
  let deletedCount = 0;
  
  try {
    const waitlistSnapshot = await db.collection('waitlist').get();
    
    console.log(`   Trouvé ${waitlistSnapshot.size} entrée(s) en liste d'attente`);
    
    for (const doc of waitlistSnapshot.docs) {
      const waitlist = doc.data();
      const email = normalizeEmail(waitlist.email);
      
      // Vérifier si c'est une entrée de test
      const isTestEntry = TEST_EMAILS.some(testEmail => 
        email === normalizeEmail(testEmail)
      ) || email.includes('test') || email.includes('example.com');
      
      if (isTestEntry) {
        await doc.ref.delete();
        deletedCount++;
        console.log(`   ✅ Supprimé: ${email}`);
      }
    }
    
    console.log(`   ✅ ${deletedCount} entrée(s) supprimée(s)\n`);
    return deletedCount;
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage de la liste d\'attente:', error);
    return 0;
  }
}

/**
 * Supprime les tokens de désinscription de test
 */
async function cleanupCancellationTokens() {
  console.log('🔑 Nettoyage des tokens de désinscription (cancellationTokens)...');
  
  let deletedCount = 0;
  
  try {
    // Récupérer tous les tokens liés aux réservations de test
    const tokensSnapshot = await db.collection('cancellationTokens').get();
    
    console.log(`   Trouvé ${tokensSnapshot.size} token(s) au total`);
    
    for (const doc of tokensSnapshot.docs) {
      const token = doc.data();
      const email = normalizeEmail(token.email);
      
      // Vérifier si c'est un token de test
      const isTestToken = TEST_EMAILS.some(testEmail => 
        email === normalizeEmail(testEmail)
      ) || email.includes('test') || email.includes('example.com');
      
      if (isTestToken) {
        await doc.ref.delete();
        deletedCount++;
        console.log(`   ✅ Supprimé: ${email}`);
      }
    }
    
    console.log(`   ✅ ${deletedCount} token(s) supprimé(s)\n`);
    return deletedCount;
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage des tokens:', error);
    return 0;
  }
}

/**
 * Supprime les emails en attente de test
 */
async function cleanupMail() {
  console.log('📧 Nettoyage des emails en attente (mail)...');
  
  let deletedCount = 0;
  
  try {
    // Récupérer tous les emails créés avant aujourd'hui
    const mailSnapshot = await db.collection('mail')
        .where('createdAt', '<', CUTOFF_DATE)
        .get();
    
    console.log(`   Trouvé ${mailSnapshot.size} email(s) potentiel(s) de test`);
    
    for (const doc of mailSnapshot.docs) {
      const mail = doc.data();
      const email = normalizeEmail(mail.to);
      
      // Vérifier si c'est un email de test
      const isTestMail = TEST_EMAILS.some(testEmail => 
        email === normalizeEmail(testEmail)
      ) || email.includes('test') || email.includes('example.com');
      
      if (isTestMail) {
        await doc.ref.delete();
        deletedCount++;
        console.log(`   ✅ Supprimé: ${email}`);
      }
    }
    
    console.log(`   ✅ ${deletedCount} email(s) supprimé(s)\n`);
    return deletedCount;
  } catch (error) {
    console.error('   ❌ Erreur lors du nettoyage des emails:', error);
    return 0;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('⚠️  ATTENTION : Ce script va supprimer définitivement les données de test.\n');
  
  // Demander confirmation (en mode interactif)
  if (process.stdin.isTTY) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('Voulez-vous continuer ? (tapez "OUI" pour confirmer): ', resolve);
    });
    
    rl.close();
    
    if (answer !== 'OUI') {
      console.log('❌ Opération annulée.');
      process.exit(0);
    }
  }
  
  console.log('\n🚀 Démarrage du nettoyage...\n');
  
  const results = {
    bookings: await cleanupBookings(),
    userPasses: await cleanupUserPasses(),
    waitlist: await cleanupWaitlist(),
    cancellationTokens: await cleanupCancellationTokens(),
    mail: await cleanupMail(),
  };
  
  const total = Object.values(results).reduce((sum, count) => sum + count, 0);
  
  console.log('📊 Résumé du nettoyage:');
  console.log(`   - Réservations: ${results.bookings}`);
  console.log(`   - Pass: ${results.userPasses}`);
  console.log(`   - Liste d'attente: ${results.waitlist}`);
  console.log(`   - Tokens: ${results.cancellationTokens}`);
  console.log(`   - Emails: ${results.mail}`);
  console.log(`\n✅ Total: ${total} élément(s) supprimé(s)\n`);
  
  console.log('✨ Nettoyage terminé ! Le système est prêt pour les vraies réservations.\n');
}

// Exécuter le script
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
