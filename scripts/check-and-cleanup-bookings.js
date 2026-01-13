/**
 * Script pour vérifier et nettoyer les réservations de test
 * Usage: node scripts/check-and-cleanup-bookings.js
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

// Emails de test
const TEST_EMAILS = [
  'cedricjourney+testauth@gmail.com',
  'cedricjourney@gmail.com',
  'c.vonlanthen+testres@gmail.com',
  'cedricjourney+testres@gmail.com',
  'c.vonlanthen+teststage2@gmail.com',
];

function normalizeEmail(email) {
  return email ? email.toLowerCase().trim() : '';
}

function isTestEmail(email) {
  const normalized = normalizeEmail(email);
  return TEST_EMAILS.some(testEmail => normalized === normalizeEmail(testEmail)) ||
         normalized.includes('test') ||
         normalized.includes('example.com');
}

async function checkAndCleanup() {
  console.log('\n🔍 Vérification des réservations...\n');
  
  try {
    // Récupérer toutes les réservations
    const bookingsSnapshot = await db.collection('bookings').get();
    
    console.log(`📋 Total de réservations trouvées: ${bookingsSnapshot.size}\n`);
    
    const testBookings = [];
    const courseUpdates = {}; // { courseId: countToDecrement }
    
    for (const doc of bookingsSnapshot.docs) {
      const booking = doc.data();
      const email = normalizeEmail(booking.email);
      
      if (isTestEmail(email)) {
        testBookings.push({
          id: doc.id,
          email: email,
          courseId: booking.courseId,
          courseName: booking.courseName,
          courseDate: booking.courseDate,
          status: booking.status,
        });
        
        // Compter les participants à décrémenter pour les cours confirmés
        if (['confirmed', 'pending_cash'].includes(booking.status) && booking.courseId) {
          if (!courseUpdates[booking.courseId]) {
            courseUpdates[booking.courseId] = 0;
          }
          courseUpdates[booking.courseId]++;
        }
      }
    }
    
    if (testBookings.length === 0) {
      console.log('✅ Aucune réservation de test trouvée.\n');
      return;
    }
    
    console.log(`⚠️  ${testBookings.length} réservation(s) de test trouvée(s):\n`);
    
    // Grouper par date de cours
    const byDate = {};
    testBookings.forEach(booking => {
      const date = booking.courseDate || 'Date inconnue';
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(booking);
    });
    
    // Afficher par date
    for (const [date, bookings] of Object.entries(byDate)) {
      console.log(`📅 ${date}:`);
      bookings.forEach(booking => {
        console.log(`   - ${booking.email} (${booking.status}) - ${booking.courseName || 'N/A'}`);
      });
      console.log('');
    }
    
    // Demander confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const answer = await new Promise((resolve) => {
      rl.question(`Voulez-vous supprimer ces ${testBookings.length} réservation(s) ? (tapez "OUI" pour confirmer): `, resolve);
    });
    
    rl.close();
    
    if (answer !== 'OUI') {
      console.log('❌ Opération annulée.\n');
      return;
    }
    
    console.log('\n🗑️  Suppression en cours...\n');
    
    // Supprimer les réservations
    let deletedCount = 0;
    for (const booking of testBookings) {
      try {
        await db.collection('bookings').doc(booking.id).delete();
        deletedCount++;
        console.log(`   ✅ Supprimé: ${booking.email} - ${booking.courseDate}`);
      } catch (error) {
        console.error(`   ❌ Erreur lors de la suppression de ${booking.id}:`, error.message);
      }
    }
    
    // Mettre à jour les compteurs de participants
    console.log('\n📊 Mise à jour des compteurs de participants...\n');
    
    for (const [courseId, countToDecrement] of Object.entries(courseUpdates)) {
      try {
        const courseRef = db.collection('courses').doc(courseId);
        const courseDoc = await courseRef.get();
        
        if (courseDoc.exists) {
          const course = courseDoc.data();
          const currentCount = course.participantCount || 0;
          const newCount = Math.max(0, currentCount - countToDecrement);
          
          await courseRef.update({ participantCount: newCount });
          console.log(`   ✅ Cours ${courseId}: ${currentCount} → ${newCount} participants`);
        } else {
          console.log(`   ⚠️  Cours ${courseId} introuvable`);
        }
      } catch (error) {
        console.error(`   ❌ Erreur lors de la mise à jour du cours ${courseId}:`, error.message);
      }
    }
    
    console.log(`\n✅ ${deletedCount} réservation(s) supprimée(s)\n`);
    console.log('✨ Nettoyage terminé !\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkAndCleanup();
