#!/usr/bin/env node

/**
 * Script pour créer un utilisateur et lui donner accès à un produit avec une date de démarrage spécifique
 * 
 * Usage: node scripts/create-user-with-product.js <email> <product> <startDate> <password>
 * Exemple: node scripts/create-user-with-product.js user@example.com complet "2025-10-03" "MotDePasse123!"
 * Format date: YYYY-MM-DD
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
const auth = admin.auth();

async function createUserWithProduct(email, productName, startDateString, password) {
  try {
    console.log(`🔍 Traitement pour: ${email}`);
    
    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Parser la date
    const dateParts = startDateString.split('-');
    if (dateParts.length !== 3) {
      throw new Error('Format de date invalide. Utilisez YYYY-MM-DD');
    }
    const startDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    if (isNaN(startDate.getTime())) {
      throw new Error('Date invalide');
    }
    console.log(`📅 Date de démarrage: ${startDate.toLocaleDateString('fr-FR')}`);
    
    // Vérifier si l'utilisateur existe déjà
    let userRecord;
    let userId;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
      userId = userRecord.uid;
      console.log(`✅ Utilisateur existe déjà dans Firebase Auth: ${userId}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Créer l'utilisateur
        if (!password) {
          console.error('❌ Mot de passe requis pour créer un nouvel utilisateur');
          console.error('   Usage: node scripts/create-user-with-product.js <email> <product> <startDate> <password>');
          process.exit(1);
        }
        console.log(`👤 Création du compte utilisateur...`);
        userRecord = await auth.createUser({
          email: normalizedEmail,
          password: password,
          emailVerified: false,
        });
        userId = userRecord.uid;
        console.log(`✅ Compte créé: ${userId}`);
      } else {
        throw error;
      }
    }
    
    // Vérifier ou créer le document Firestore
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    let products = [];
    if (userDoc.exists) {
      const userData = userDoc.data();
      products = userData.products || [];
      if (products.length === 0 && userData.product) {
        // Migration depuis ancien format
        const existingStartDate = userData.registrationDate || userData.createdAt || admin.firestore.Timestamp.now();
        products = [{
          name: userData.product,
          startDate: existingStartDate,
          purchasedAt: userData.createdAt || existingStartDate,
        }];
      }
      console.log(`📄 Document Firestore existe déjà`);
    } else {
      console.log(`📄 Création du document Firestore...`);
    }
    
    // Vérifier si le produit existe déjà
    const productExists = products.some(p => p.name === productName);
    if (productExists) {
      console.log(`⚠️  Le produit "${productName}" existe déjà. Mise à jour de la date de démarrage...`);
      // Mettre à jour la date de démarrage
      const productIndex = products.findIndex(p => p.name === productName);
      products[productIndex].startDate = admin.firestore.Timestamp.fromDate(startDate);
      // Date de démarrage fixée explicitement → défi démarré
      products[productIndex].started = true;
    } else {
      // Ajouter le nouveau produit avec la date spécifiée
      const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
      const purchasedTimestamp = admin.firestore.Timestamp.now();
      
      products.push({
        name: productName,
        startDate: startTimestamp,
        purchasedAt: purchasedTimestamp,
        started: true,
      });
    }

    // Mettre à jour ou créer le document
    const updateData = {
      email: normalizedEmail,
      products: products,
      product: productName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (!userDoc.exists) {
      updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      if (productName === '21jours') {
        updateData.registrationDate = admin.firestore.Timestamp.fromDate(startDate);
      }
    }

    await userDocRef.set(updateData, { merge: true });

    console.log(`✅ Produit "${productName}" configuré avec succès!`);
    console.log(`   Produits: ${products.map(p => p.name).join(', ')}`);
    console.log(`   Date de démarrage: ${startDate.toLocaleDateString('fr-FR')}`);
    console.log(`\n🔗 Lien espace membre:`);
    console.log(`   https://fluance.io/membre/`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Récupérer les arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Usage: node scripts/create-user-with-product.js <email> <product> <startDate> [password]');
  console.error('Exemple: node scripts/create-user-with-product.js user@example.com complet "2025-10-03" "MotDePasse123!"');
  console.error('Format date: YYYY-MM-DD');
  console.error('Password: optionnel si l\'utilisateur existe déjà');
  process.exit(1);
}

const email = args[0];
const product = args[1];
const startDate = args[2];
const password = args[3] || null;

const validProducts = ['21jours', 'complet'];
if (!validProducts.includes(product)) {
  console.error(`❌ Produit invalide: ${product}`);
  console.error(`   Produits valides: ${validProducts.join(', ')}`);
  process.exit(1);
}

createUserWithProduct(email, product, startDate, password)
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
