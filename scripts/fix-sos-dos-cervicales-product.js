#!/usr/bin/env node

/**
 * Script pour corriger le champ product du document SOS dos & cervicales
 * Le document a actuellement product: "cervicales" au lieu de "sos-dos-cervicales"
 * 
 * Usage:
 *   node scripts/fix-sos-dos-cervicales-product.js
 */

const fs = require('fs');
const path = require('path');

// Utiliser firebase-admin depuis functions/node_modules
const functionsPath = path.join(__dirname, '../functions');
const admin = require(path.join(functionsPath, 'node_modules/firebase-admin'));

// ⚠️ IMPORTANT: Configurez le chemin vers votre fichier serviceAccountKey.json
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../functions/serviceAccountKey.json');

// Vérifier que le fichier serviceAccount existe
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ Erreur: serviceAccountKey.json introuvable');
  process.exit(1);
}

// Initialiser Firebase Admin
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

const db = getFirestore();

async function fixProduct() {
  try {
    console.log('📝 Correction du champ product pour SOS dos & cervicales...\n');

    const docId = 'sos-dos-cervicales';
    const docRef = db.collection('protectedContent').doc(docId);

    // Vérifier le document actuel
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.error(`❌ Le document ${docId} n'existe pas`);
      return;
    }

    const currentData = doc.data();
    console.log(`📋 État actuel:`);
    console.log(`   - product: "${currentData.product}"`);
    console.log(`   - title: ${currentData.title}\n`);

    if (currentData.product === 'sos-dos-cervicales') {
      console.log('✅ Le champ product est déjà correct');
      return;
    }

    // Corriger le champ product
    console.log('🔧 Correction du champ product...');
    await docRef.update({
      product: 'sos-dos-cervicales',
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('✅ Champ product corrigé avec succès\n');

    // Vérifier que la requête fonctionne maintenant
    console.log('🧪 Test de la requête...');
    const query = db.collection('protectedContent')
      .where('product', '==', 'sos-dos-cervicales')
      .orderBy('createdAt', 'desc');
    
    const snapshot = await query.get();
    console.log(`✅ Requête réussie: ${snapshot.size} document(s) trouvé(s)`);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`   - ${doc.id}: ${data.title || 'sans titre'}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixProduct()
    .then(() => {
      console.log('\n✅ Correction terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
