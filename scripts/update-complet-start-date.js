#!/usr/bin/env node

/**
 * Script pour mettre à jour la date de démarrage du produit "complet" pour un utilisateur
 * Cela permet de débloquer toutes les semaines disponibles
 * 
 * Usage: node scripts/update-complet-start-date.js <email> [weeksAgo]
 * Exemple: node scripts/update-complet-start-date.js user@example.com 8
 * (8 semaines dans le passé pour débloquer toutes les semaines)
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

async function updateCompletStartDate(email, weeksAgo = 8) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Calculer la date de démarrage (X semaines dans le passé)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeksAgo * 7));
    console.log(`📅 Nouvelle date de démarrage: ${startDate.toLocaleDateString('fr-FR')} (il y a ${weeksAgo} semaines)`);
    
    // Trouver l'utilisateur dans Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
      console.log(`✅ Utilisateur trouvé dans Firebase Auth: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error(`❌ Utilisateur non trouvé dans Firebase Auth: ${normalizedEmail}`);
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
      process.exit(1);
    }

    const userData = userDoc.data();
    console.log(`📄 Document Firestore trouvé`);
    
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
    
    // Trouver le produit "complet"
    const completIndex = products.findIndex(p => p.name === 'complet');
    
    if (completIndex === -1) {
      console.error(`❌ Le produit "complet" n'existe pas pour cet utilisateur.`);
      console.error(`   Produits actuels: ${products.map(p => p.name).join(', ') || 'aucun'}`);
      console.error(`   Utilisez d'abord: node scripts/add-product-to-user.js ${email} complet`);
      process.exit(1);
    }

    // Mettre à jour la date de démarrage
    const oldStartDate = products[completIndex].startDate;
    const oldDate = oldStartDate.toDate ? oldStartDate.toDate() : new Date(oldStartDate.seconds * 1000);
    console.log(`   Ancienne date de démarrage: ${oldDate.toLocaleDateString('fr-FR')}`);
    
    products[completIndex].startDate = Timestamp.fromDate(startDate);
    
    console.log(`   Nouvelle date de démarrage: ${startDate.toLocaleDateString('fr-FR')}`);

    // Mettre à jour le document
    await userDocRef.set({
      products: products,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Date de démarrage du produit "complet" mise à jour avec succès!`);
    console.log(`   Toutes les semaines disponibles (0-7) sont maintenant débloquées.`);
    console.log(`   Lien espace membre: https://fluance.io/membre/`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: node scripts/update-complet-start-date.js <email> [weeksAgo]');
  console.error('Exemple: node scripts/update-complet-start-date.js user@example.com 8');
  console.error('weeksAgo: nombre de semaines dans le passé (défaut: 8)');
  process.exit(1);
}

const email = args[0];
const weeksAgo = args[1] ? parseInt(args[1], 10) : 8;

if (isNaN(weeksAgo) || weeksAgo < 1) {
  console.error('❌ weeksAgo doit être un nombre positif');
  process.exit(1);
}

// Exécuter
updateCompletStartDate(email, weeksAgo)
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
