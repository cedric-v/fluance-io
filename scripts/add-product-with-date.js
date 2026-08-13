#!/usr/bin/env node

/**
 * Script pour ajouter un produit à un utilisateur avec une date de démarrage spécifique
 * 
 * Usage: node scripts/add-product-with-date.js <email> <product> <startDate>
 * Exemple: node scripts/add-product-with-date.js user@example.com complet "2025-10-03"
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
  credential: admin.cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function addProductToUserWithDate(email, productName, startDateString) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Parser la date
    let startDate;
    if (startDateString) {
      const dateParts = startDateString.split('-');
      if (dateParts.length !== 3) {
        throw new Error('Format de date invalide. Utilisez YYYY-MM-DD');
      }
      startDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      if (isNaN(startDate.getTime())) {
        throw new Error('Date invalide');
      }
      console.log(`📅 Date de démarrage: ${startDate.toLocaleDateString('fr-FR')}`);
    } else {
      startDate = new Date();
      console.log(`📅 Date de démarrage: aujourd'hui (${startDate.toLocaleDateString('fr-FR')})`);
    }
    
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
    let products = userData.products || [];
    if (products.length === 0 && userData.product) {
      console.log(`   Migration depuis ancien format: product = "${userData.product}"`);
      const existingStartDate = userData.registrationDate || userData.createdAt || Timestamp.now();
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

    // Ajouter le nouveau produit avec la date spécifiée
    const startTimestamp = Timestamp.fromDate(startDate);
    const purchasedTimestamp = Timestamp.now();

    products.push({
      name: productName,
      startDate: startTimestamp,
      purchasedAt: purchasedTimestamp,
      // Date de démarrage fixée explicitement → défi déjà commencé (évite que
      // le premier accès réinitialise le décompte 21 jours).
      started: true,
    });

    console.log(`   Nouveaux produits: ${products.map(p => p.name).join(', ')}`);

    // Mettre à jour le document
    await userDocRef.set({
      products: products,
      product: productName, // Garder pour compatibilité rétroactive (dernier produit ajouté)
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Produit "${productName}" ajouté avec succès!`);
    console.log(`   Produits actuels: ${products.map(p => p.name).join(', ')}`);
    console.log(`   Date de démarrage: ${startDate.toLocaleDateString('fr-FR')}`);
    console.log(`   Lien espace membre: https://fluance.io/membre/`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/add-product-with-date.js <email> <product> [startDate]');
  console.error('Exemple: node scripts/add-product-with-date.js user@example.com complet "2025-10-03"');
  console.error('Format date: YYYY-MM-DD (optionnel, défaut: aujourd\'hui)');
  process.exit(1);
}

const email = args[0];
const product = args[1];
const startDate = args[2] || null;

// Valider le produit
const validProducts = ['21jours', 'complet'];
if (!validProducts.includes(product)) {
  console.error(`❌ Produit invalide: ${product}`);
  console.error(`   Produits valides: ${validProducts.join(', ')}`);
  process.exit(1);
}

// Exécuter
addProductToUserWithDate(email, product, startDate)
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
