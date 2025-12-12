#!/usr/bin/env node

/**
 * Script pour créer un token d'inscription pour un utilisateur
 * 
 * Usage: node scripts/create-registration-token.js <email> <product> [expirationDays]
 * Exemple: node scripts/create-registration-token.js user@example.com complet 30
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createRegistrationToken(email, product, expirationDays = 30) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const token = generateToken();
    const now = admin.firestore.Timestamp.now();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);
    const expirationTimestamp = admin.firestore.Timestamp.fromDate(expirationDate);

    const tokenData = {
      email: normalizedEmail,
      product: product,
      createdAt: now,
      expiresAt: expirationTimestamp,
      used: false,
    };

    await db.collection('registrationTokens').doc(token).set(tokenData);

    console.log(`✅ Token d'inscription créé avec succès!`);
    console.log(`   Email: ${normalizedEmail}`);
    console.log(`   Produit: ${product}`);
    console.log(`   Expiration: ${expirationDate.toLocaleDateString('fr-FR')} (${expirationDays} jours)`);
    console.log(`\n🔗 Lien de création de compte:`);
    console.log(`   https://fluance.io/creer-compte?token=${token}`);
    console.log(`\n📧 Transmettez ce lien à l'utilisateur pour qu'il puisse créer son compte.`);
    
    return token;
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

// Récupérer les arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/create-registration-token.js <email> <product> [expirationDays]');
  console.error('Exemple: node scripts/create-registration-token.js user@example.com complet 30');
  process.exit(1);
}

const email = args[0];
const product = args[1];
const expirationDays = parseInt(args[2]) || 30;

const validProducts = ['21jours', 'complet'];
if (!validProducts.includes(product)) {
  console.error(`❌ Produit invalide: ${product}`);
  console.error(`   Produits valides: ${validProducts.join(', ')}`);
  process.exit(1);
}

createRegistrationToken(email, product, expirationDays)
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
