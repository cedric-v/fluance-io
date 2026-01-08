#!/usr/bin/env node

/**
 * Script pour retirer un produit d'un utilisateur dans Firestore
 * 
 * Usage: node scripts/remove-product-from-user.js <email> <product>
 * Exemple: node scripts/remove-product-from-user.js user@example.com 21jours
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

async function removeProductFromUser(email, productName) {
  try {
    console.log(`🔍 Retrait du produit "${productName}" pour: ${email}\n`);
    
    const emailLower = email.toLowerCase().trim();
    
    // Essayer d'abord avec l'email comme ID
    let userRef = db.collection('users').doc(emailLower);
    let userDoc = await userRef.get();
    
    // Si pas trouvé, chercher par email dans les documents
    if (!userDoc.exists) {
      console.log(`   Document non trouvé avec email comme ID, recherche par email...`);
      const usersSnapshot = await db.collection('users')
        .where('email', '==', emailLower)
        .limit(1)
        .get();
      
      if (!usersSnapshot.empty) {
        userDoc = usersSnapshot.docs[0];
        userRef = db.collection('users').doc(userDoc.id);
        console.log(`   ✅ Document trouvé avec ID: ${userDoc.id}`);
      }
    }
    
    // Si toujours pas trouvé, essayer de récupérer depuis Firebase Auth
    if (!userDoc.exists) {
      console.log(`   Document non trouvé, recherche dans Firebase Auth...`);
      try {
        const userRecord = await auth.getUserByEmail(emailLower);
        userRef = db.collection('users').doc(userRecord.uid);
        userDoc = await userRef.get();
        if (userDoc.exists) {
          console.log(`   ✅ Document trouvé avec UID: ${userRecord.uid}`);
        }
      } catch (authError) {
        console.error(`   ❌ Utilisateur non trouvé dans Firebase Auth: ${authError.message}`);
      }
    }
    
    if (!userDoc.exists) {
      console.error(`❌ Utilisateur non trouvé dans Firestore: ${emailLower}`);
      console.error(`   Vérifié avec email comme ID, recherche par email, et recherche par UID`);
      process.exit(1);
    }
    
    const userData = userDoc.data();
    let products = userData.products || [];
    
    // Si products n'existe pas mais product existe (ancien format), migrer
    if (products.length === 0 && userData.product) {
      products = [{
        name: userData.product,
        startDate: userData.registrationDate || userData.createdAt,
        purchasedAt: userData.createdAt,
      }];
    }
    
    console.log(`📦 Produits actuels: ${JSON.stringify(products.map(p => p.name), null, 2)}`);
    
    // Vérifier si le produit existe
    const productExists = products.some((p) => p.name === productName);
    if (!productExists) {
      console.error(`❌ Le produit "${productName}" n'est pas présent dans les produits de l'utilisateur`);
      console.log(`   Produits trouvés: ${products.map(p => p.name).join(', ') || 'aucun'}`);
      process.exit(1);
    }
    
    // Retirer le produit du tableau
    const initialLength = products.length;
    products = products.filter((p) => p.name !== productName);
    
    if (products.length === initialLength) {
      console.error(`❌ Erreur: Le produit n'a pas pu être retiré`);
      process.exit(1);
    }
    
    // Mettre à jour le document utilisateur
    await userRef.update({
      products: products,
    });
    
    console.log(`\n✅ Produit "${productName}" retiré avec succès`);
    console.log(`📦 Produits restants: ${JSON.stringify(products.map(p => p.name), null, 2)}`);
    console.log(`\n⚠️  L'utilisateur ${emailLower} n'a plus accès au produit "${productName}"`);
    
  } catch (error) {
    console.error(`❌ Erreur lors du retrait du produit:`, error);
    process.exit(1);
  }
}

// Vérifier les arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('❌ Usage: node scripts/remove-product-from-user.js <email> <product>');
  console.error('   Exemple: node scripts/remove-product-from-user.js user@example.com 21jours');
  process.exit(1);
}

const email = args[0];
const product = args[1];

// Valider le produit
const validProducts = ['21jours', 'complet', 'sos-dos-cervicales'];
if (!validProducts.includes(product)) {
  console.error(`❌ Produit invalide: ${product}`);
  console.error(`   Produits valides: ${validProducts.join(', ')}`);
  process.exit(1);
}

removeProductFromUser(email, product)
  .then(() => {
    console.log('\n✅ Opération terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });

