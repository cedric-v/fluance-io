/**
 * Script pour supprimer toutes les données de test d'un utilisateur spécifique
 * Usage: node scripts/delete-user-test-data.js [email]
 * 
 * Ce script supprime :
 * 1. Les réservations (bookings)
 * 2. Les pass (userPasses)
 * 3. Les tokens d'annulation (cancellationTokens)
 * 4. Les entrées de liste d'attente (waitlist)
 * 5. Les emails envoyés (mail)
 * 6. Les tokens d'inscription (registrationTokens)
 * 7. Les utilisateurs (users)
 * 
 * Exemple: node scripts/delete-user-test-data.js cedricjourney@gmail.com
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
  console.error('\n💡 Solution :');
  console.error('   1. Téléchargez le service account depuis Firebase Console');
  console.error('   2. Enregistrez-le dans functions/serviceAccountKey.json');
  console.error('   OU définissez GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}

const db = admin.firestore();

// Normaliser l'email
function normalizeEmail(email) {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Supprime les réservations de l'utilisateur
 */
async function deleteBookings(email) {
  console.log('📋 Suppression des réservations...');
  
  const normalizedEmail = normalizeEmail(email);
  let deletedCount = 0;
  const courseUpdates = {}; // { courseId: countToDecrement }
  
  try {
    const bookingsSnapshot = await db.collection('bookings')
        .where('email', '==', normalizedEmail)
        .get();
    
    console.log(`   Trouvé ${bookingsSnapshot.size} réservation(s)`);
    
    for (const doc of bookingsSnapshot.docs) {
      const booking = doc.data();
      
      // Compter les participants à décrémenter pour les cours confirmés
      if (['confirmed', 'pending_cash'].includes(booking.status) && booking.courseId) {
        if (!courseUpdates[booking.courseId]) {
          courseUpdates[booking.courseId] = 0;
        }
        courseUpdates[booking.courseId]++;
      }
      
      await doc.ref.delete();
      deletedCount++;
      console.log(`   ✅ Supprimé: ${booking.courseName || 'N/A'} - ${booking.courseDate || 'N/A'} (${booking.status})`);
    }
    
    // Mettre à jour les compteurs de participants
    for (const [courseId, countToDecrement] of Object.entries(courseUpdates)) {
      try {
        const courseRef = db.collection('courses').doc(courseId);
        const courseDoc = await courseRef.get();
        
        if (courseDoc.exists) {
          const course = courseDoc.data();
          const currentCount = course.participantCount || 0;
          const newCount = Math.max(0, currentCount - countToDecrement);
          
          await courseRef.update({ participantCount: newCount });
          console.log(`   📊 Cours ${courseId}: ${currentCount} → ${newCount} participants`);
        }
      } catch (error) {
        console.error(`   ❌ Erreur mise à jour cours ${courseId}:`, error.message);
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des réservations:', error.message);
    return 0;
  }
}

/**
 * Supprime les pass de l'utilisateur
 */
async function deleteUserPasses(email) {
  console.log('🎫 Suppression des pass...');
  
  const normalizedEmail = normalizeEmail(email);
  let deletedCount = 0;
  
  try {
    const passesSnapshot = await db.collection('userPasses')
        .where('email', '==', normalizedEmail)
        .get();
    
    console.log(`   Trouvé ${passesSnapshot.size} pass`);
    
    for (const doc of passesSnapshot.docs) {
      await doc.ref.delete();
      deletedCount++;
      const pass = doc.data();
      console.log(`   ✅ Supprimé: ${pass.passType || 'N/A'} - ${pass.passId || doc.id}`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des pass:', error.message);
    return 0;
  }
}

/**
 * Supprime les tokens d'annulation
 */
async function deleteCancellationTokens(email) {
  console.log('🔑 Suppression des tokens d\'annulation...');
  
  const normalizedEmail = normalizeEmail(email);
  let deletedCount = 0;
  
  try {
    const tokensSnapshot = await db.collection('cancellationTokens')
        .where('email', '==', normalizedEmail)
        .get();
    
    console.log(`   Trouvé ${tokensSnapshot.size} token(s)`);
    
    for (const doc of tokensSnapshot.docs) {
      await doc.ref.delete();
      deletedCount++;
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des tokens:', error.message);
    return 0;
  }
}

/**
 * Supprime les entrées de liste d'attente
 */
async function deleteWaitlist(email) {
  console.log('⏳ Suppression de la liste d\'attente...');
  
  const normalizedEmail = normalizeEmail(email);
  let deletedCount = 0;
  
  try {
    const waitlistSnapshot = await db.collection('waitlist')
        .where('email', '==', normalizedEmail)
        .get();
    
    console.log(`   Trouvé ${waitlistSnapshot.size} entrée(s)`);
    
    for (const doc of waitlistSnapshot.docs) {
      await doc.ref.delete();
      deletedCount++;
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la liste d\'attente:', error.message);
    return 0;
  }
}

/**
 * Supprime les emails envoyés
 */
async function deleteMail(email) {
  console.log('📧 Suppression des emails...');
  
  const normalizedEmail = normalizeEmail(email);
  let deletedCount = 0;
  
  try {
    const mailSnapshot = await db.collection('mail')
        .where('to', '==', normalizedEmail)
        .get();
    
    console.log(`   Trouvé ${mailSnapshot.size} email(s)`);
    
    for (const doc of mailSnapshot.docs) {
      await doc.ref.delete();
      deletedCount++;
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des emails:', error.message);
    return 0;
  }
}

/**
 * Supprime les tokens d'inscription
 */
async function deleteRegistrationTokens(email) {
  console.log('🎟️  Suppression des tokens d\'inscription...');
  
  const normalizedEmail = normalizeEmail(email);
  let deletedCount = 0;
  
  try {
    const tokensSnapshot = await db.collection('registrationTokens')
        .where('email', '==', normalizedEmail)
        .get();
    
    console.log(`   Trouvé ${tokensSnapshot.size} token(s)`);
    
    for (const doc of tokensSnapshot.docs) {
      await doc.ref.delete();
      deletedCount++;
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des tokens d\'inscription:', error.message);
    return 0;
  }
}

/**
 * Supprime l'utilisateur
 */
async function deleteUser(email) {
  console.log('👤 Suppression de l\'utilisateur...');
  
  const normalizedEmail = normalizeEmail(email);
  let deletedCount = 0;
  
  try {
    const usersSnapshot = await db.collection('users')
        .where('email', '==', normalizedEmail)
        .get();
    
    console.log(`   Trouvé ${usersSnapshot.size} utilisateur(s)`);
    
    for (const doc of usersSnapshot.docs) {
      await doc.ref.delete();
      deletedCount++;
      console.log(`   ✅ Supprimé: ${doc.id}`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de l\'utilisateur:', error.message);
    return 0;
  }
}

/**
 * Fonction principale
 */
async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('❌ Usage: node scripts/delete-user-test-data.js [email]');
    console.error('   Exemple: node scripts/delete-user-test-data.js cedricjourney@gmail.com');
    process.exit(1);
  }
  
  const normalizedEmail = normalizeEmail(email);
  
  console.log(`\n⚠️  ATTENTION : Ce script va supprimer définitivement toutes les données de ${normalizedEmail}\n`);
  console.log('Les données suivantes seront supprimées :');
  console.log('  - Réservations (bookings)');
  console.log('  - Pass (userPasses)');
  console.log('  - Tokens d\'annulation (cancellationTokens)');
  console.log('  - Liste d\'attente (waitlist)');
  console.log('  - Emails envoyés (mail)');
  console.log('  - Tokens d\'inscription (registrationTokens)');
  console.log('  - Utilisateur (users)');
  console.log('');
  
  // Demander confirmation
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
  
  console.log('\n🚀 Démarrage de la suppression...\n');
  
  const results = {
    bookings: await deleteBookings(normalizedEmail),
    userPasses: await deleteUserPasses(normalizedEmail),
    cancellationTokens: await deleteCancellationTokens(normalizedEmail),
    waitlist: await deleteWaitlist(normalizedEmail),
    mail: await deleteMail(normalizedEmail),
    registrationTokens: await deleteRegistrationTokens(normalizedEmail),
    users: await deleteUser(normalizedEmail),
  };
  
  const total = Object.values(results).reduce((sum, count) => sum + count, 0);
  
  console.log('\n📊 Résumé de la suppression:');
  console.log(`   - Réservations: ${results.bookings}`);
  console.log(`   - Pass: ${results.userPasses}`);
  console.log(`   - Tokens d'annulation: ${results.cancellationTokens}`);
  console.log(`   - Liste d'attente: ${results.waitlist}`);
  console.log(`   - Emails: ${results.mail}`);
  console.log(`   - Tokens d'inscription: ${results.registrationTokens}`);
  console.log(`   - Utilisateurs: ${results.users}`);
  console.log(`\n✅ Total: ${total} élément(s) supprimé(s)\n`);
  
  console.log(`✨ Suppression terminée pour ${normalizedEmail} !\n`);
}

// Exécuter le script
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
