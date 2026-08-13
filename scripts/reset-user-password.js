#!/usr/bin/env node

/**
 * Script pour réinitialiser le mot de passe d'un utilisateur
 * Usage: node scripts/reset-user-password.js EMAIL [NEW_PASSWORD]
 * 
 * Si NEW_PASSWORD n'est pas fourni, un mot de passe temporaire sera généré
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const PROJECT_ID = 'fluance-protected-content';

// Initialiser Firebase Admin
async function initFirebase() {
  try {
    if (admin.getApps().length === 0) {
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
          credential: admin.cert(serviceAccount),
          projectId: PROJECT_ID,
        });
      } else {
        console.log('📁 Utilisation des credentials par défaut (Firebase CLI)');
        admin.initializeApp({
          projectId: PROJECT_ID,
        });
      }
    }
    return { db: getFirestore(), auth: getAuth() };
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
    process.exit(1);
  }
}

function generatePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomBytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  return password;
}

async function resetPassword(email, newPassword, auth) {
  try {
    console.log(`\n🔍 Réinitialisation du mot de passe pour: ${email}\n`);
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Vérifier que l'utilisateur existe
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
      console.log(`✅ Utilisateur trouvé dans Firebase Auth`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Email vérifié: ${userRecord.emailVerified ? 'Oui ✅' : 'Non ❌'}`);
      console.log(`   Désactivé: ${userRecord.disabled ? 'Oui ❌' : 'Non ✅'}`);
      console.log(`   Créé le: ${userRecord.metadata.creationTime}`);
      console.log(`   Dernière connexion: ${userRecord.metadata.lastSignInTime || 'Jamais'}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error(`❌ Utilisateur non trouvé dans Firebase Auth`);
        process.exit(1);
      }
      throw error;
    }
    
    // Générer un mot de passe si non fourni
    if (!newPassword) {
      newPassword = generatePassword(12);
      console.log(`\n🔑 Mot de passe temporaire généré: ${newPassword}`);
      console.log(`   ⚠️  IMPORTANT: Transmettez ce mot de passe à l'utilisateur de manière sécurisée`);
    }
    
    // Mettre à jour le mot de passe
    console.log(`\n🔄 Mise à jour du mot de passe...`);
    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });
    
    console.log(`✅ Mot de passe mis à jour avec succès!`);
    console.log(`\n📋 Informations:`);
    console.log(`   Email: ${normalizedEmail}`);
    console.log(`   Nouveau mot de passe: ${newPassword}`);
    console.log(`\n💡 L'utilisateur peut maintenant se connecter avec ce mot de passe.`);
    console.log(`   Il est recommandé de changer le mot de passe après la première connexion.`);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Récupérer les arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('❌ Erreur: Veuillez fournir un email');
  console.log('\nUsage: node scripts/reset-user-password.js EMAIL [NEW_PASSWORD]');
  console.log('\nExemples:');
  console.log('  node scripts/reset-user-password.js user@example.com');
  console.log('  node scripts/reset-user-password.js user@example.com MonNouveauMotDePasse123!');
  process.exit(1);
}

const email = args[0];
const newPassword = args[1] || null;

// Exécuter
(async () => {
  try {
    const { auth } = await initFirebase();
    await resetPassword(email, newPassword, auth);
    process.exit(0);
  } catch (error) {
    console.error('Erreur fatale:', error);
    process.exit(1);
  }
})();
