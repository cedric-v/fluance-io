#!/usr/bin/env node

/**
 * Script pour envoyer les accès au cours 21 jours via Mailjet
 * 
 * Usage:
 *   node send-access-21jours.js
 * 
 * Prérequis:
 *   - Firebase CLI installé et configuré
 *   - Compte admin configuré dans Firebase Auth
 *   - Secrets Mailjet configurés dans Firebase Functions
 */

const readline = require('readline');
const admin = require('firebase-admin');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const crypto = require('crypto');

// Configuration
const PROJECT_ID = 'fluance-protected-content';
const BASE_URL = 'https://fluance.io';
const PRODUCT = '21jours';
const DEFAULT_EXPIRATION_DAYS = 365; // 1 an pour l'accès complet

// Initialiser Firebase Admin
let db;
let auth;

async function initFirebase() {
  try {
    // Vérifier si Firebase Admin est déjà initialisé
    if (admin.getApps().length === 0) {
      // Essayer de charger depuis le service account
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.cert(serviceAccount),
          projectId: PROJECT_ID,
        });
      } else {
        // Utiliser les credentials par défaut (via gcloud ou Firebase CLI)
        admin.initializeApp({
          projectId: PROJECT_ID,
        });
      }
    }
    
    db = getFirestore();
    auth = getAuth();
    console.log('✅ Firebase Admin initialisé');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
    console.log('\n💡 Assurez-vous que :');
    console.log('   1. Firebase CLI est installé : npm install -g firebase-tools');
    console.log('   2. Vous êtes connecté : firebase login');
    console.log('   3. Vous avez les permissions sur le projet');
    process.exit(1);
  }
}

function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, answer => {
    rl.close();
    resolve(answer);
  }));
}

async function createTokenAndStore(email, expirationDays) {
  const token = generateUniqueToken();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);

  // Stocker le token dans Firestore
  await db.collection('registrationTokens').doc(token).set({
    email: email.toLowerCase().trim(),
    product: PRODUCT,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: expirationDate,
    used: false,
  });

  return { token, expirationDate };
}

async function sendEmailViaFunction(email, expirationDays) {
  // Note: Cette méthode nécessite que vous soyez connecté avec un compte admin
  // et que vous appeliez la fonction depuis le navigateur
  console.log('\n📧 Pour envoyer l\'email via Mailjet, utilisez la fonction Firebase :');
  console.log('\n   Dans la console du navigateur (sur https://fluance.io) :');
  console.log(`   const createUserToken = firebase.functions().httpsCallable('createUserToken');`);
  console.log(`   await createUserToken({`);
  console.log(`     email: '${email}',`);
  console.log(`     product: '${PRODUCT}',`);
  console.log(`     expirationDays: ${expirationDays}`);
  console.log(`   });`);
  console.log('\n   Ou utilisez le script send-email-via-function.js');
}

async function main() {
  console.log('🚀 Script d\'envoi d\'accès au cours 21 jours\n');
  
  await initFirebase();

  // Demander les emails
  console.log('📧 Entrez les emails des clients (un par ligne, ligne vide pour terminer) :');
  const emails = [];
  let email;
  
  do {
    email = await askQuestion(`Email ${emails.length + 1} (ou Entrée pour terminer): `);
    if (email.trim()) {
      // Valider le format email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        console.log('⚠️  Format d\'email invalide, ignoré');
        continue;
      }
      emails.push(email.trim());
    }
  } while (email.trim());

  if (emails.length === 0) {
    console.log('❌ Aucun email fourni. Arrêt.');
    process.exit(0);
  }

  // Demander la durée d'expiration
  const expirationInput = await askQuestion(`Durée de validité en jours (défaut: ${DEFAULT_EXPIRATION_DAYS}) : `);
  const expirationDays = expirationInput.trim() ? parseInt(expirationInput.trim(), 10) : DEFAULT_EXPIRATION_DAYS;

  if (isNaN(expirationDays) || expirationDays <= 0) {
    console.log('❌ Durée invalide. Utilisation de la valeur par défaut.');
    expirationDays = DEFAULT_EXPIRATION_DAYS;
  }

  console.log(`\n📋 Résumé :`);
  console.log(`   - ${emails.length} client(s)`);
  console.log(`   - Produit : ${PRODUCT}`);
  console.log(`   - Durée : ${expirationDays} jours`);
  console.log(`   - Emails : ${emails.join(', ')}`);

  const confirm = await askQuestion('\n✅ Confirmer la création des tokens ? (o/N) : ');
  if (confirm.toLowerCase() !== 'o' && confirm.toLowerCase() !== 'oui' && confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    console.log('❌ Opération annulée.');
    process.exit(0);
  }

  // Créer les tokens
  console.log('\n🔄 Création des tokens...\n');
  const results = [];

  for (const email of emails) {
    try {
      const { token, expirationDate } = await createTokenAndStore(email, expirationDays);
      const registrationUrl = `${BASE_URL}/creer-compte?token=${token}`;
      
      results.push({
        email,
        token,
        url: registrationUrl,
        expirationDate: expirationDate.toISOString().split('T')[0],
        success: true,
      });

      console.log(`✅ Token créé pour ${email}`);
      console.log(`   URL : ${registrationUrl}`);
      console.log(`   Expire le : ${expirationDate.toISOString().split('T')[0]}\n`);
    } catch (error) {
      console.error(`❌ Erreur pour ${email}:`, error.message);
      results.push({
        email,
        success: false,
        error: error.message,
      });
    }
  }

  // Afficher le résumé
  console.log('\n📊 Résumé :');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`   ✅ Réussis : ${successCount}`);
  console.log(`   ❌ Échoués : ${failCount}`);

  // Afficher les URLs pour envoi manuel
  if (successCount > 0) {
    console.log('\n📧 URLs de création de compte (à envoyer manuellement si Mailjet n\'est pas configuré) :');
    results.filter(r => r.success).forEach(result => {
      console.log(`\n   ${result.email} :`);
      console.log(`   ${result.url}`);
    });

    console.log('\n💡 Pour envoyer automatiquement via Mailjet :');
    console.log('   1. Assurez-vous que les secrets Mailjet sont configurés');
    console.log('   2. Utilisez la fonction Firebase createUserToken (voir ENVOYER_ACCES_21JOURS.md)');
    console.log('   3. Ou utilisez le script send-email-via-function.js');
  }

  process.exit(0);
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

