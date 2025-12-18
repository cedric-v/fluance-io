#!/usr/bin/env node

/**
 * Script pour ajouter un produit à un utilisateur existant
 * 
 * Usage: node scripts/add-product-to-user.js <email> <product>
 * Exemple: node scripts/add-product-to-user.js user@example.com complet
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
  console.error(`   Chemin attendu: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

// Initialiser Firebase Admin
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function addProductToUser(email, productName) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Trouver l'utilisateur dans Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
      console.log(`✅ Utilisateur trouvé dans Firebase Auth: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error(`❌ Utilisateur non trouvé dans Firebase Auth: ${normalizedEmail}`);
        console.error('   L\'utilisateur doit d\'abord se connecter au moins une fois.');
        process.exit(1);
      }
      throw error;
    }

    const userId = userRecord.uid;
    
    // Récupérer le document utilisateur dans Firestore
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      console.error(`❌ Document Firestore non trouvé pour ${normalizedEmail}`);
      console.error('   Le document utilisateur n\'existe pas dans Firestore.');
      process.exit(1);
    }

    const userData = userDoc.data();
    console.log(`📄 Document Firestore trouvé`);
    console.log(`   Produits actuels: ${JSON.stringify(userData.products || [])}`);
    
    // Récupérer ou initialiser le tableau products
    // Si products n'existe pas mais product existe, migrer
    let products = userData.products || [];
    if (products.length === 0 && userData.product) {
      console.log(`   Migration depuis ancien format: product = "${userData.product}"`);
      const existingStartDate = userData.registrationDate || userData.createdAt || admin.firestore.Timestamp.now();
      products = [{
        name: userData.product,
        startDate: existingStartDate,
        purchasedAt: userData.createdAt || existingStartDate,
      }];
    }
    
    // Vérifier si le produit existe déjà
    const productExists = products.some(p => p.name === productName);
    
    if (productExists) {
      console.log(`⚠️  Le produit "${productName}" existe déjà pour cet utilisateur.`);
      console.log(`   Produits actuels: ${products.map(p => p.name).join(', ')}`);
      return;
    }

    // Ajouter le nouveau produit au tableau existant
    const now = admin.firestore.Timestamp.now();
    products.push({
      name: productName,
      startDate: now,
      purchasedAt: now,
    });

    console.log(`   Nouveaux produits: ${products.map(p => p.name).join(', ')}`);

    // Mettre à jour le document avec set() et merge pour éviter les problèmes avec FieldValue dans les tableaux
    await userDocRef.set({
      products: products,
      product: productName, // Garder pour compatibilité rétroactive (dernier produit ajouté)
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Produit "${productName}" ajouté avec succès!`);
    console.log(`   Produits actuels: ${products.map(p => p.name).join(', ')}`);
    console.log(`   Date de démarrage: maintenant (déblocage immédiat du bonus)`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/add-product-to-user.js <email> <product>');
  console.error('Exemple: node scripts/add-product-to-user.js user@example.com complet');
  process.exit(1);
}

const email = args[0];
const product = args[1];

// Valider le produit
const validProducts = ['21jours', 'complet'];
if (!validProducts.includes(product)) {
  console.error(`❌ Produit invalide: ${product}`);
  console.error(`   Produits valides: ${validProducts.join(', ')}`);
  process.exit(1);
}

// Exécuter
addProductToUser(email, product)
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
