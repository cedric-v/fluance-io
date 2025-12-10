#!/usr/bin/env node

/**
 * Script pour créer les tokens d'accès au cours 21 jours
 * Usage: node create-tokens-21jours.js email1@example.com email2@example.com
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

// Configuration
const PROJECT_ID = 'fluance-protected-content';
const BASE_URL = 'https://fluance.io';
const PRODUCT = '21jours';
const EXPIRATION_DAYS = 365; // 1 an pour l'accès complet

// Initialiser Firebase Admin
async function initFirebase() {
  try {
    if (admin.apps.length === 0) {
      const fs = require('fs');
      const path = require('path');
      
      // Essayer plusieurs chemins possibles pour le service account
      const possiblePaths = [
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        path.join(__dirname, 'new-project-service-account.json'),
        path.join(__dirname, 'fluance-protected-content-service-account.json'),
        path.join(__dirname, 'functions', 'serviceAccountKey.json'),
      ].filter(Boolean);

      let serviceAccountPath = null;
      for (const possiblePath of possiblePaths) {
        if (possiblePath && fs.existsSync(possiblePath)) {
          serviceAccountPath = possiblePath;
          break;
        }
      }

      if (serviceAccountPath) {
        console.log(`📁 Utilisation du service account : ${serviceAccountPath}`);
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: PROJECT_ID,
        });
      } else {
        // Utiliser les credentials par défaut (via gcloud ou Firebase CLI)
        console.log('📁 Utilisation des credentials par défaut (Firebase CLI)');
        admin.initializeApp({
          projectId: PROJECT_ID,
        });
      }
    }
    return admin.firestore();
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
    console.log('\n💡 Solutions possibles :');
    console.log('   1. Téléchargez le service account JSON depuis Firebase Console');
    console.log('      - Allez dans Project Settings > Service Accounts');
    console.log('      - Cliquez sur "Generate new private key"');
    console.log('      - Enregistrez-le comme "new-project-service-account.json" à la racine');
    console.log('   2. Ou utilisez Firebase CLI : firebase login');
    console.log('   3. Ou définissez GOOGLE_APPLICATION_CREDENTIALS');
    process.exit(1);
  }
}

function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createToken(db, email) {
  const token = generateUniqueToken();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + EXPIRATION_DAYS);

  // Stocker le token dans Firestore
  await db.collection('registrationTokens').doc(token).set({
    email: email.toLowerCase().trim(),
    product: PRODUCT,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: expirationDate,
    used: false,
  });

  return { token, expirationDate };
}

async function main() {
  // Récupérer les emails depuis les arguments de ligne de commande
  const emails = process.argv.slice(2);

  if (emails.length === 0) {
    console.log('❌ Usage: node create-tokens-21jours.js email1@example.com email2@example.com');
    process.exit(1);
  }

  console.log('🚀 Création des tokens d\'accès au cours 21 jours\n');
  console.log(`📧 ${emails.length} client(s) à traiter\n`);

  const db = await initFirebase();
  console.log('✅ Firebase Admin initialisé\n');

  const results = [];

  for (const email of emails) {
    // Valider le format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      console.log(`⚠️  Email invalide ignoré: ${email}`);
      results.push({ email, success: false, error: 'Format email invalide' });
      continue;
    }

    try {
      const { token, expirationDate } = await createToken(db, email);
      const registrationUrl = `${BASE_URL}/creer-compte?token=${token}`;
      
      results.push({
        email: email.trim(),
        token,
        url: registrationUrl,
        expirationDate: expirationDate.toISOString().split('T')[0],
        success: true,
      });

      console.log(`✅ Token créé pour ${email.trim()}`);
    } catch (error) {
      console.error(`❌ Erreur pour ${email}:`, error.message);
      results.push({
        email: email.trim(),
        success: false,
        error: error.message,
      });
    }
  }

  // Afficher le résumé
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(80));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`✅ Réussis : ${successCount}`);
  console.log(`❌ Échoués : ${failCount}\n`);

  if (successCount > 0) {
    console.log('📧 URLs de création de compte à envoyer aux clients :\n');
    results.filter(r => r.success).forEach((result, index) => {
      console.log(`${index + 1}. ${result.email}`);
      console.log(`   URL : ${result.url}`);
      console.log(`   Expire le : ${result.expirationDate}\n`);
    });

    console.log('💡 Instructions :');
    console.log('   - Copiez chaque URL et envoyez-la par email au client correspondant');
    console.log('   - Chaque lien est valable pendant 365 jours');
    console.log('   - Chaque lien ne peut être utilisé qu\'une seule fois\n');
  }

  if (failCount > 0) {
    console.log('❌ Erreurs :\n');
    results.filter(r => !r.success).forEach((result) => {
      console.log(`   - ${result.email}: ${result.error}`);
    });
    console.log();
  }

  process.exit(failCount > 0 ? 1 : 0);
}

// Gérer les erreurs non capturées
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});

// Exécuter le script
main().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

