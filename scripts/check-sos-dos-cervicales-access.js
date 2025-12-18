#!/usr/bin/env node

/**
 * Script pour vérifier l'accès SOS dos & cervicales pour un utilisateur
 * 
 * Usage:
 *   node scripts/check-sos-dos-cervicales-access.js <email>
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
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const userEmail = process.argv[2] || 'user@example.com';

async function checkAccess() {
  try {
    console.log(`📋 Vérification de l'accès pour: ${userEmail}\n`);

    // 1. Vérifier que le contenu existe
    console.log('1️⃣ Vérification du contenu dans Firestore...');
    const contentDoc = await db.collection('protectedContent').doc('sos-dos-cervicales').get();
    
    if (!contentDoc.exists) {
      console.error('❌ Le document sos-dos-cervicales n\'existe pas dans Firestore');
      return;
    }
    
    const contentData = contentDoc.data();
    console.log('✅ Contenu trouvé:');
    console.log(`   - product: ${contentData.product}`);
    console.log(`   - title: ${contentData.title}`);
    console.log(`   - content length: ${(contentData.content || '').length} caractères`);
    console.log(`   - commentText: ${contentData.commentText || 'non défini'}`);
    console.log(`   - createdAt: ${contentData.createdAt ? 'défini' : 'non défini'}`);
    console.log(`   - updatedAt: ${contentData.updatedAt ? 'défini' : 'non défini'}\n`);

    // 2. Trouver l'utilisateur par email
    console.log('2️⃣ Recherche de l\'utilisateur...');
    const usersSnapshot = await db.collection('users').where('email', '==', userEmail.toLowerCase().trim()).get();
    
    if (usersSnapshot.empty) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${userEmail}`);
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    console.log(`✅ Utilisateur trouvé: ${userDoc.id}`);
    console.log(`   - email: ${userData.email}`);
    
    // 3. Vérifier les produits de l'utilisateur
    console.log('\n3️⃣ Vérification des produits de l\'utilisateur...');
    const userProducts = userData.products || [];
    
    if (userProducts.length === 0 && userData.product) {
      // Ancien format
      console.log(`   - Ancien format: product = ${userData.product}`);
      if (userData.product === 'sos-dos-cervicales') {
        console.log('✅ L\'utilisateur a accès à SOS dos & cervicales (ancien format)');
      } else {
        console.log(`❌ L'utilisateur n'a pas accès à SOS dos & cervicales (a: ${userData.product})`);
      }
    } else {
      console.log(`   - Nouveau format: ${userProducts.length} produit(s)`);
      userProducts.forEach((p, i) => {
        console.log(`     [${i}] name: ${p.name}, startDate: ${p.startDate ? 'défini' : 'non défini'}`);
      });
      
      const hasSos = userProducts.some(p => p.name === 'sos-dos-cervicales');
      if (hasSos) {
        console.log('✅ L\'utilisateur a accès à SOS dos & cervicales');
      } else {
        console.log('❌ L\'utilisateur n\'a pas accès à SOS dos & cervicales');
        console.log('   Produits possédés:', userProducts.map(p => p.name).join(', '));
      }
    }

    // 4. Tester la requête comme le fait loadProtectedContent
    console.log('\n4️⃣ Test de la requête Firestore...');
    try {
      const query = db.collection('protectedContent')
        .where('product', '==', 'sos-dos-cervicales')
        .orderBy('createdAt', 'desc');
      
      const snapshot = await query.get();
      console.log(`✅ Requête réussie: ${snapshot.size} document(s) trouvé(s)`);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${doc.id}: ${data.title || 'sans titre'}`);
      });
    } catch (queryError) {
      console.error('❌ Erreur lors de la requête:', queryError.message);
      if (queryError.code === 'failed-precondition') {
        console.error('   → L\'index Firestore est peut-être en cours de construction');
        console.error('   → Ou le champ createdAt n\'existe pas');
        
        // Essayer sans orderBy
        console.log('\n   Tentative sans orderBy...');
        const simpleQuery = db.collection('protectedContent')
          .where('product', '==', 'sos-dos-cervicales');
        const simpleSnapshot = await simpleQuery.get();
        console.log(`   ✅ Requête simple réussie: ${simpleSnapshot.size} document(s)`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkAccess()
    .then(() => {
      console.log('\n✅ Vérification terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
