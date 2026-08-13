#!/usr/bin/env node

/**
 * Script de test pour vérifier la configuration de réinitialisation de mot de passe
 * Usage: node test-password-reset.js EMAIL
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

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

async function testPasswordReset(email, auth) {
  try {
    console.log(`\n🔍 Test de réinitialisation de mot de passe pour: ${email}\n`);
    
    // 1. Vérifier que l'utilisateur existe
    console.log('='.repeat(80));
    console.log('1. VÉRIFICATION DE L\'UTILISATEUR');
    console.log('='.repeat(80));
    
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
      console.log('✅ Utilisateur trouvé dans Firebase Authentication');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Email vérifié: ${userRecord.emailVerified ? 'Oui ✅' : 'Non ❌'}`);
      console.log(`   Désactivé: ${userRecord.disabled ? 'Oui ❌' : 'Non ✅'}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('❌ Utilisateur NON trouvé dans Firebase Authentication');
        console.log('   La réinitialisation de mot de passe nécessite que l\'utilisateur existe.');
        console.log('   Pour des raisons de sécurité, Firebase peut ne pas envoyer d\'email si l\'utilisateur n\'existe pas.');
        return;
      }
      throw error;
    }
    
    // 2. Générer un lien de réinitialisation (simulation)
    console.log('\n' + '='.repeat(80));
    console.log('2. GÉNÉRATION D\'UN LIEN DE RÉINITIALISATION');
    console.log('='.repeat(80));
    
    try {
      // Note: On ne peut pas vraiment envoyer l'email depuis un script Node.js
      // car sendPasswordResetEmail est une fonction côté client Firebase Auth
      // Mais on peut vérifier la configuration
      
      console.log('ℹ️  Note: sendPasswordResetEmail() est une fonction côté client Firebase Auth');
      console.log('   Elle ne peut pas être appelée depuis un script serveur.');
      console.log('   Ce script vérifie uniquement la configuration.');
      
      // Vérifier les paramètres de configuration
      const resetUrl = 'https://fluance.io/reinitialiser-mot-de-passe';
      console.log(`\n📋 Configuration attendue:`);
      console.log(`   URL de réinitialisation: ${resetUrl}`);
      console.log(`   handleCodeInApp: true`);
      console.log(`   Domaine autorisé: fluance.io`);
      
    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
    
    // 3. Vérifications de configuration
    console.log('\n' + '='.repeat(80));
    console.log('3. VÉRIFICATIONS DE CONFIGURATION');
    console.log('='.repeat(80));
    
    console.log('\n✅ Points à vérifier dans Firebase Console:');
    console.log('   1. Authentication > Sign-in method > Email/Password est activé');
    console.log('   2. Authentication > Settings > Authorized domains contient "fluance.io"');
    console.log('   3. Authentication > Settings > Email templates > Password reset utilise %LINK%');
    console.log('   4. Le domaine personnalisé actu.fluance.io est vérifié (si configuré)');
    console.log('   5. Usage and billing > Quotas ne sont pas dépassés (100 emails/jour max)');
    
    console.log('\n📧 Points à vérifier côté email:');
    console.log('   1. Vérifier le dossier spam/courrier indésirable');
    console.log('   2. Rechercher: from:noreply@fluance-protected-content.firebaseapp.com');
    console.log('   3. Rechercher: from:support@actu.fluance.io (si domaine vérifié)');
    console.log('   4. Vérifier les filtres de votre boîte email');
    
    console.log('\n🐛 Points à vérifier dans la console du navigateur:');
    console.log('   1. Ouvrir la console (F12) sur la page de réinitialisation');
    console.log('   2. Tenter d\'envoyer l\'email');
    console.log('   3. Vérifier les logs:');
    console.log('      - [Firebase Auth] ===== sendPasswordResetEmail appelée =====');
    console.log('      - [Firebase Auth] ✅ Email de réinitialisation envoyé avec succès');
    console.log('      - OU [Firebase Auth] ❌ ERREUR avec le code d\'erreur');
    
    console.log('\n' + '='.repeat(80));
    console.log('4. RÉSUMÉ');
    console.log('='.repeat(80));
    
    if (!userRecord.emailVerified) {
      console.log('\n⚠️  L\'email de l\'utilisateur n\'est pas vérifié');
      console.log('   Cela ne devrait pas empêcher la réinitialisation, mais peut causer des problèmes.');
    }
    
    if (userRecord.disabled) {
      console.log('\n❌ Le compte est désactivé');
      console.log('   Les emails de réinitialisation ne peuvent pas être envoyés à un compte désactivé.');
    } else {
      console.log('\n✅ Le compte est actif et devrait pouvoir recevoir des emails de réinitialisation.');
      console.log('   Si aucun email n\'arrive, vérifiez:');
      console.log('   - La console du navigateur pour les erreurs');
      console.log('   - Les spams');
      console.log('   - Les quotas Firebase');
      console.log('   - La configuration du template d\'email dans Firebase Console');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Récupérer l'email depuis les arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Erreur: Veuillez fournir un email');
  console.log('Usage: node test-password-reset.js EMAIL');
  console.log('Exemple: node test-password-reset.js test-user-1@example.com');
  process.exit(1);
}

// Exécuter
(async () => {
  try {
    const { auth } = await initFirebase();
    await testPasswordReset(email, auth);
    process.exit(0);
  } catch (error) {
    console.error('Erreur fatale:', error);
    process.exit(1);
  }
})();
