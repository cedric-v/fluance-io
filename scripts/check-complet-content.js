#!/usr/bin/env node

/**
 * Script pour vérifier si les contenus "complet" existent dans Firestore
 */

const fs = require('fs');
const path = require('path');

const functionsPath = path.join(__dirname, '../functions');
const admin = require(path.join(functionsPath, 'node_modules/firebase-admin'));

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../functions/serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ Erreur: serviceAccountKey.json introuvable');
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCompletContent() {
  try {
    console.log('🔍 Vérification des contenus "complet" dans Firestore...\n');
    
    const query = await db.collection('protectedContent')
      .where('product', '==', 'complet')
      .get();
    
    if (query.empty) {
      console.log('❌ Aucun contenu "complet" trouvé dans Firestore');
      console.log('\n💡 Pour importer les contenus, exécutez:');
      console.log('   node scripts/import-complet-content.js');
      return;
    }
    
    console.log(`✅ ${query.size} contenu(s) "complet" trouvé(s):\n`);
    
    const contents = [];
    query.forEach(doc => {
      const data = doc.data();
      contents.push({
        id: doc.id,
        week: data.week,
        title: data.title,
      });
    });
    
    contents.sort((a, b) => (a.week || 0) - (b.week || 0));
    
    contents.forEach(content => {
      const weekLabel = content.week === 0 ? 'Bonus' : `Semaine ${content.week}`;
      console.log(`   ${weekLabel}: ${content.title} (${content.id})`);
    });
    
    console.log('\n✅ Les contenus sont prêts!');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.code === 'failed-precondition') {
      console.error('\n💡 L\'index Firestore pour "week" n\'est pas encore créé.');
      console.error('   Déployez l\'index avec:');
      console.error('   firebase deploy --only firestore:indexes --project fluance-protected-content');
    }
  }
}

checkCompletContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
