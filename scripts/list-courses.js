/**
 * Script pour lister tous les cours dans Firestore
 * Usage: node scripts/list-courses.js [nombre]
 * 
 * Exemple: node scripts/list-courses.js 50
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

async function listCourses(limit = 50) {
  console.log(`📋 Liste des cours (${limit} derniers):\n`);
  
  try {
    const coursesSnapshot = await db.collection('courses')
        .orderBy('startTime', 'desc')
        .limit(limit)
        .get();
    
    if (coursesSnapshot.empty) {
      console.log('❌ Aucun cours trouvé dans Firestore.\n');
      return;
    }
    
    console.log(`✅ ${coursesSnapshot.size} cours trouvé(s):\n`);
    
    coursesSnapshot.docs.forEach((doc, index) => {
      const course = doc.data();
      const dateStr = course.date || 'N/A';
      const timeStr = course.time || 'N/A';
      const titleStr = course.title || 'Sans titre';
      const statusStr = course.status || 'N/A';
      const participants = course.participantCount || 0;
      const maxCapacity = course.maxCapacity || 'N/A';
      
      // Vérifier si le cours est passé
      const now = new Date();
      const courseDate = course.startTime?.toDate ? course.startTime.toDate() : null;
      const isPast = courseDate && courseDate < now;
      const pastIndicator = isPast ? ' ⏰ PASSÉ' : '';
      
      console.log(`${index + 1}. ${dateStr} à ${timeStr} - ${titleStr}${pastIndicator}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Statut: ${statusStr} | Participants: ${participants}/${maxCapacity}`);
      if (course.gcalId) {
        console.log(`   Google Calendar ID: ${course.gcalId}`);
      }
      console.log('');
    });
    
    console.log('💡 Pour supprimer un cours, utilisez:');
    console.log('   node scripts/delete-course.js [ID_du_document]');
    console.log('   ou');
    console.log('   node scripts/delete-course.js [YYYY-MM-DD]');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter
const limit = parseInt(process.argv[2]) || 50;

listCourses(limit)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
