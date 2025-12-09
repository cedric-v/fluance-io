/**
 * Script de migration des commentaires OwnComments
 * 
 * Migre les commentaires de owncommentsfluance vers fluance-protected-content
 * 
 * Prérequis:
 * 1. Installer les dépendances: npm install firebase-admin
 * 2. Télécharger les service account JSON pour les deux projets Firebase
 * 3. Renommer les fichiers: old-project-service-account.json et new-project-service-account.json
 * 
 * Usage: node migrate-comments.js
 */

const admin = require('firebase-admin');

// Configuration ancien projet (owncommentsfluance)
const oldServiceAccount = require('./old-project-service-account.json');
const oldApp = admin.initializeApp({
  credential: admin.credential.cert(oldServiceAccount),
  projectId: 'owncommentsfluance'
}, 'old');

// Configuration nouveau projet (fluance-protected-content)
const newServiceAccount = require('./new-project-service-account.json');
const newApp = admin.initializeApp({
  credential: admin.credential.cert(newServiceAccount),
  projectId: 'fluance-protected-content'
}, 'new');

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

async function migrateComments(oldPageId, newPageId) {
  console.log(`\nMigration des commentaires...`);
  console.log(`  Ancien: ${oldPageId}`);
  console.log(`  Nouveau: ${newPageId}`);
  
  const oldCommentsRef = oldDb.collection('comments').doc(oldPageId).collection('messages');
  const newCommentsRef = newDb.collection('comments').doc(newPageId).collection('messages');
  
  const snapshot = await oldCommentsRef.get();
  let count = 0;
  
  if (snapshot.empty) {
    console.log(`  ℹ️  Aucun commentaire à migrer`);
    return;
  }
  
  // Firestore limite les batches à 500 opérations
  const batchSize = 500;
  const batches = [];
  let currentBatch = newDb.batch();
  let currentBatchCount = 0;
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const newDocRef = newCommentsRef.doc(doc.id);
    currentBatch.set(newDocRef, data);
    count++;
    currentBatchCount++;
    
    if (currentBatchCount >= batchSize) {
      batches.push(currentBatch);
      currentBatch = newDb.batch();
      currentBatchCount = 0;
    }
  });
  
  // Ajouter le dernier batch s'il contient des opérations
  if (currentBatchCount > 0) {
    batches.push(currentBatch);
  }
  
  // Exécuter tous les batches
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`  ✅ Batch ${i + 1}/${batches.length} committé`);
  }
  
  console.log(`  ✅ ${count} commentaire(s) migré(s) avec succès`);
}

async function main() {
  // Mapping des URLs (ancien pageId → nouveau pageId)
  const urlMappings = [
    // Pages 5 jours
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2F5j-bienvenue',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j1/')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fj2',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j2/')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fjour3',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j3/')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fj4',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j4/')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fj5harmonie',
      new: encodeURIComponent('https://fluance.io/cours-en-ligne/5jours/j5/')
    },
    // Pages 21 jours
    // Note: Le nouveau système utilise contentId pour différencier les jours
    // Format: URL|contentId où contentId = "21jours-jour-X" pour chaque jour
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fmembres',
      new: encodeURIComponent('https://fluance.io/membre/|21jours-jour-0')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fmembres%2F21jours%2F1',
      new: encodeURIComponent('https://fluance.io/membre/|21jours-jour-1')
    },
    {
      old: 'https%3A%2F%2Ffluance.io%2Fpar%2Fmembres%2F21jours%2F3',
      new: encodeURIComponent('https://fluance.io/membre/|21jours-jour-3')
    }
  ];
  
  console.log('🚀 Début de la migration des commentaires...\n');
  
  for (const mapping of urlMappings) {
    await migrateComments(mapping.old, mapping.new);
  }
  
  console.log('\n✅ Migration terminée !');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Erreur lors de la migration:', error);
  process.exit(1);
});

