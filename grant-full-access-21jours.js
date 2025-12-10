#!/usr/bin/env node

/**
 * Script pour donner un accès complet immédiat au cours 21 jours
 * 
 * Ce script met à jour la registrationDate des utilisateurs pour qu'ils aient
 * accès à tous les jours (0-22) immédiatement.
 * 
 * Usage: node grant-full-access-21jours.js email1@example.com email2@example.com
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ID = 'fluance-protected-content';
const DAYS_BACK = 22; // Nombre de jours dans le passé pour avoir accès complet

// Initialiser Firebase Admin
async function initFirebase() {
  try {
    if (admin.apps.length === 0) {
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
        console.log('📁 Utilisation des credentials par défaut (Firebase CLI)');
        admin.initializeApp({
          projectId: PROJECT_ID,
        });
      }
    }
    return { db: admin.firestore(), auth: admin.auth() };
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
    process.exit(1);
  }
}

async function grantFullAccess(db, auth, email) {
  try {
    // Trouver l'utilisateur par email
    const userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
    const userId = userRecord.uid;

    // Calculer la date d'inscription (il y a 22 jours pour avoir accès complet)
    const registrationDate = new Date();
    registrationDate.setDate(registrationDate.getDate() - DAYS_BACK);

    // Mettre à jour le document utilisateur
    await db.collection('users').doc(userId).update({
      registrationDate: admin.firestore.Timestamp.fromDate(registrationDate),
      fullAccessGranted: true, // Flag pour indiquer que l'accès complet a été accordé
      fullAccessGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Accès complet accordé à ${email}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Registration date: ${registrationDate.toISOString().split('T')[0]} (il y a ${DAYS_BACK} jours)`);
    console.log(`   Tous les jours (0-22) sont maintenant accessibles\n`);

    return { success: true, userId, email };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ Utilisateur non trouvé: ${email}`);
      console.error(`   L'utilisateur doit d'abord créer son compte avec le token\n`);
      return { success: false, email, error: 'User not found' };
    }
    throw error;
  }
}

async function main() {
  // Récupérer les emails depuis les arguments de ligne de commande
  const emails = process.argv.slice(2);

  if (emails.length === 0) {
    console.log('❌ Usage: node grant-full-access-21jours.js email1@example.com email2@example.com');
    console.log('\n💡 Ce script donne un accès complet immédiat au cours 21 jours.');
    console.log('   Les utilisateurs doivent avoir créé leur compte avant d\'exécuter ce script.\n');
    process.exit(1);
  }

  console.log('🚀 Attribution d\'accès complet au cours 21 jours\n');
  console.log(`📧 ${emails.length} utilisateur(s) à traiter\n`);

  const { db, auth } = await initFirebase();
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
      const result = await grantFullAccess(db, auth, email);
      results.push(result);
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
  console.log('='.repeat(80));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(80));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`✅ Réussis : ${successCount}`);
  console.log(`❌ Échoués : ${failCount}\n`);

  if (successCount > 0) {
    console.log('✅ Les utilisateurs suivants ont maintenant accès à tous les jours (0-22) :\n');
    results.filter(r => r.success).forEach((result, index) => {
      console.log(`${index + 1}. ${result.email}`);
    });
    console.log();
  }

  if (failCount > 0) {
    console.log('❌ Erreurs :\n');
    results.filter(r => !r.success).forEach((result) => {
      console.log(`   - ${result.email}: ${result.error}`);
    });
    console.log('\n💡 Les utilisateurs doivent d\'abord créer leur compte avec le token.');
    console.log('   Ensuite, réexécutez ce script pour leur donner l\'accès complet.\n');
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

