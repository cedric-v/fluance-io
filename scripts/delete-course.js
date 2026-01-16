/**
 * Script pour supprimer un cours spécifique de Firestore
 * Usage: node scripts/delete-course.js [courseId ou date]
 * 
 * Exemples:
 *   node scripts/delete-course.js 2026-02-05
 *   node scripts/delete-course.js abc123def456
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

async function deleteCourse(identifier) {
  console.log(`🔍 Recherche du cours avec l'identifiant: ${identifier}\n`);
  
  try {
    let courseDoc = null;
    let courseId = null;
    
    // Si c'est un ID de document (longue chaîne alphanumérique)
    if (identifier.length > 20 && !identifier.includes('-')) {
      // Probablement un ID de document Firestore
      courseId = identifier;
      const docRef = db.collection('courses').doc(courseId);
      courseDoc = await docRef.get();
      
      if (!courseDoc.exists) {
        console.log(`❌ Aucun cours trouvé avec l'ID: ${courseId}`);
        return;
      }
    } else {
      // Chercher par date (inclure aussi les cours passés)
      const coursesSnapshot = await db.collection('courses')
          .where('date', '==', identifier)
          .get();
      
      if (coursesSnapshot.empty) {
        // Essayer de chercher par titre (inclure tous les cours, même passés)
        const allCourses = await db.collection('courses')
            .limit(100)
            .get();
        
        const matchingCourses = [];
        for (const doc of allCourses.docs) {
          const course = doc.data();
          if (course.title && course.title.toLowerCase().includes(identifier.toLowerCase())) {
            matchingCourses.push({ id: doc.id, ...course });
          }
        }
        
        if (matchingCourses.length === 0) {
          // Afficher les cours récents pour aider à identifier
          console.log(`❌ Aucun cours trouvé avec la date ou le titre: ${identifier}\n`);
          console.log('📋 Cours disponibles (30 derniers):\n');
          
          const recentCourses = await db.collection('courses')
              .orderBy('startTime', 'desc')
              .limit(30)
              .get();
          
          if (recentCourses.empty) {
            console.log('   Aucun cours dans Firestore.');
          } else {
            recentCourses.docs.forEach((doc, index) => {
              const course = doc.data();
              const dateStr = course.date || 'N/A';
              const timeStr = course.time || 'N/A';
              const titleStr = course.title || 'Sans titre';
              console.log(`   ${index + 1}. ${dateStr} à ${timeStr} - ${titleStr} (ID: ${doc.id})`);
            });
          }
          
          console.log('\n💡 Conseils:');
          console.log('   - Utilisez le format de date: YYYY-MM-DD (ex: 2026-01-16)');
          console.log('   - Ou utilisez l\'ID du document Firestore depuis la liste ci-dessus');
          return;
        }
        
        if (matchingCourses.length > 1) {
          console.log(`⚠️  Plusieurs cours trouvés (${matchingCourses.length}):\n`);
          matchingCourses.forEach((course, index) => {
            console.log(`   ${index + 1}. ${course.title} - ${course.date} à ${course.time} (ID: ${course.id})`);
          });
          console.log('\n💡 Utilisez l\'ID du document pour supprimer un cours spécifique.');
          return;
        }
        
        courseId = matchingCourses[0].id;
        courseDoc = await db.collection('courses').doc(courseId).get();
      } else if (coursesSnapshot.size > 1) {
        console.log(`⚠️  Plusieurs cours trouvés pour la date ${identifier}:\n`);
        coursesSnapshot.docs.forEach((doc, index) => {
          const course = doc.data();
          console.log(`   ${index + 1}. ${course.title || 'Sans titre'} - ${course.date} à ${course.time || 'N/A'} (ID: ${doc.id})`);
        });
        console.log('\n💡 Utilisez l\'ID du document pour supprimer un cours spécifique.');
        return;
      } else {
        courseId = coursesSnapshot.docs[0].id;
        courseDoc = coursesSnapshot.docs[0];
      }
    }
    
    if (!courseDoc || !courseDoc.exists) {
      console.log(`❌ Cours introuvable`);
      return;
    }
    
    const course = courseDoc.data();
    
    console.log(`📋 Cours trouvé:`);
    console.log(`   ID: ${courseId}`);
    console.log(`   Titre: ${course.title || 'N/A'}`);
    console.log(`   Date: ${course.date || 'N/A'}`);
    console.log(`   Heure: ${course.time || 'N/A'}`);
    console.log(`   Participants: ${course.participantCount || 0}/${course.maxCapacity || 'N/A'}`);
    console.log(`   Statut: ${course.status || 'N/A'}\n`);
    
    // Vérifier s'il y a des réservations
    const bookingsSnapshot = await db.collection('bookings')
        .where('courseId', '==', courseId)
        .where('status', 'in', ['confirmed', 'pending', 'pending_cash'])
        .get();
    
    if (!bookingsSnapshot.empty) {
      console.log(`⚠️  ATTENTION: Ce cours a ${bookingsSnapshot.size} réservation(s) active(s):\n`);
      bookingsSnapshot.docs.forEach((doc) => {
        const booking = doc.data();
        console.log(`   - ${booking.firstName} ${booking.lastName} (${booking.email}) - ${booking.status}`);
      });
      console.log('\n💡 Les réservations ne seront PAS supprimées automatiquement.');
      console.log('   Vous devrez les gérer séparément si nécessaire.\n');
    }
    
    // Demander confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const answer = await new Promise((resolve) => {
      rl.question(`Voulez-vous supprimer ce cours ? (tapez "OUI" pour confirmer): `, resolve);
    });
    
    rl.close();
    
    if (answer !== 'OUI') {
      console.log('❌ Opération annulée.\n');
      return;
    }
    
    // Supprimer le cours
    await db.collection('courses').doc(courseId).delete();
    console.log(`\n✅ Cours supprimé avec succès: ${courseId}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter
const identifier = process.argv[2];

if (!identifier) {
  console.log('❌ Usage: node scripts/delete-course.js [courseId ou date]\n');
  console.log('Exemples:');
  console.log('  node scripts/delete-course.js 2026-02-05');
  console.log('  node scripts/delete-course.js abc123def456');
  process.exit(1);
}

deleteCourse(identifier)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
