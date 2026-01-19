#!/usr/bin/env node

/**
 * Script pour créer UN SEUL token avec PLUSIEURS produits
 * Usage: node scripts/create-single-token-multiple-products.js <email> <product1,product2,...>
 *
 * Exemple: node scripts/create-single-token-multiple-products.js cbaka@bluewin.ch 21jours,sos-dos-cervicales
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration Firebase
try {
  if (!admin.apps.length) {
    // Chercher le service account dans plusieurs emplacements possibles
    const possiblePaths = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.join(__dirname, 'fluance-protected-content-service-account.json'),
      path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'),
    ].filter(Boolean);

    let serviceAccountPath = null;
    for (const possiblePath of possiblePaths) {
      if (possiblePath && fs.existsSync(possiblePath)) {
        serviceAccountPath = possiblePath;
        break;
      }
    }

    if (serviceAccountPath) {
      console.log(`✅ Utilisation du service account: ${serviceAccountPath}`);
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'fluance-protected-content',
      });
    } else {
      console.log('✅ Utilisation des credentials par défaut (Firebase CLI)');
      admin.initializeApp({
        projectId: 'fluance-protected-content',
      });
    }
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Génère un token unique
 */
function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Crée UN token avec plusieurs produits
 */
async function createSingleTokenForMultipleProducts(email, products, expirationDays = 30) {
  console.log(`\n🔑 Création d'UN token avec plusieurs produits pour ${email}`);
  console.log(`📦 Produits: ${products.join(', ')}`);
  console.log(`⏰ Expiration: ${expirationDays} jours`);

  const token = generateUniqueToken();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);

  try {
    // Créer le token dans Firestore avec le format 'products' (array)
    await db.collection('registrationTokens').doc(token).set({
      email: email.toLowerCase().trim(),
      products: products, // Format array pour plusieurs produits
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expirationDate,
      used: false,
      manuallyCreated: true,
    });

    console.log('✅ Token créé avec succès!');
    console.log('🔗 Token:', token);
    console.log('📧 Lien:', `https://fluance.io/creer-compte?token=${token}`);
    console.log('⏰ Expire le:', expirationDate.toISOString());

    return token;

  } catch (error) {
    console.error('❌ Erreur lors de la création du token:', error);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main() {
  const email = process.argv[2];
  const productsArg = process.argv[3];

  if (!email || !productsArg) {
    console.error('❌ Usage: node scripts/create-single-token-multiple-products.js <email> <product1,product2,...>');
    console.error('   Exemple: node scripts/create-single-token-multiple-products.js user@example.com 21jours,sos-dos-cervicales');
    process.exit(1);
  }

  const products = productsArg.split(',').map(p => p.trim());

  if (products.length < 2) {
    console.error('❌ Veuillez spécifier au moins 2 produits séparés par des virgules');
    process.exit(1);
  }

  try {
    const token = await createSingleTokenForMultipleProducts(email, products, 30);

    // Créer une liste formatée des produits
    const productNames = {
      '21jours': '21 jours pour un Dos en Forme',
      'sos-dos-cervicales': 'SOS Dos & Cervicales',
      'complet': 'Programme Complet',
    };

    const productList = products.map((p) => productNames[p] || p).join(' + ');

    console.log('\n' + '='.repeat(80));
    console.log('📧 EMAIL À ENVOYER AU CLIENT');
    console.log('='.repeat(80));
    console.log(`\nBonjour,\n`);
    console.log(`Suite à votre achat de "${productList}",`);
    console.log(`voici votre lien pour créer votre compte et accéder à vos programmes :\n`);
    console.log(`https://fluance.io/creer-compte?token=${token}\n`);
    console.log(`En créant votre compte avec ce lien, vous aurez immédiatement accès`);
    console.log(`à tous vos programmes dans votre espace client.\n`);
    console.log(`Ce lien est valable pendant 30 jours.\n`);
    console.log(`Bonne pratique !`);
    console.log(`L'équipe Fluance\n`);
    console.log('='.repeat(80));

    console.log('\n✅ Opération terminée avec succès!');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter
if (require.main === module) {
  main();
}

module.exports = { createSingleTokenForMultipleProducts };
