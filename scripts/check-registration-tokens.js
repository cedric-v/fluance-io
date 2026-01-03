#!/usr/bin/env node

/**
 * Script pour vérifier les tokens de registration pour un email
 * Usage: node scripts/check-registration-tokens.js EMAIL
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ID = 'fluance-protected-content';

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

async function checkTokens(email, db) {
  try {
    console.log(`\n🔍 Vérification des tokens de registration pour: ${email}\n`);
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Récupérer tous les tokens pour cet email
    const tokensSnapshot = await db.collection('registrationTokens')
      .where('email', '==', normalizedEmail)
      .orderBy('createdAt', 'desc')
      .get();
    
    if (tokensSnapshot.empty) {
      console.log('❌ Aucun token de registration trouvé pour cet email');
      console.log('   Cela peut indiquer que:');
      console.log('   - L\'achat n\'a pas été traité par le webhook');
      console.log('   - Le token a été supprimé');
      console.log('   - L\'email utilisé est différent');
      return;
    }
    
    console.log(`✅ ${tokensSnapshot.size} token(s) trouvé(s)\n`);
    
    tokensSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log('='.repeat(80));
      console.log(`Token ${index + 1}: ${doc.id}`);
      console.log('='.repeat(80));
      console.log(`   Produit: ${data.product || 'non défini'}`);
      console.log(`   Créé le: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'non défini'}`);
      console.log(`   Expire le: ${data.expiresAt ? data.expiresAt.toDate().toISOString() : 'non défini'}`);
      console.log(`   Utilisé: ${data.used ? 'Oui ✅' : 'Non ❌'}`);
      if (data.used) {
        console.log(`   Utilisé le: ${data.usedAt ? data.usedAt.toDate().toISOString() : 'non défini'}`);
        console.log(`   UserId: ${data.userId || 'non défini'}`);
      }
      console.log('');
    });
    
    // Vérifier si un token a été utilisé mais que le document Firestore n'existe pas
    const usedTokens = tokensSnapshot.docs.filter(doc => doc.data().used);
    if (usedTokens.length > 0) {
      console.log('⚠️  Token(s) utilisé(s) détecté(s)');
      for (const tokenDoc of usedTokens) {
        const tokenData = tokenDoc.data();
        if (tokenData.userId) {
          const userDoc = await db.collection('users').doc(tokenData.userId).get();
          if (!userDoc.exists) {
            console.log(`\n❌ PROBLÈME DÉTECTÉ:`);
            console.log(`   Token ${tokenDoc.id} a été utilisé (userId: ${tokenData.userId})`);
            console.log(`   Mais le document Firestore n'existe pas pour cet userId`);
            console.log(`   Cela indique que verifyToken a créé le compte Auth mais a échoué à créer le document Firestore`);
          }
        }
      }
    }
    
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
  console.log('Usage: node scripts/check-registration-tokens.js EMAIL');
  process.exit(1);
}

// Exécuter
(async () => {
  try {
    const { db } = await initFirebase();
    await checkTokens(email, db);
    process.exit(0);
  } catch (error) {
    console.error('Erreur fatale:', error);
    process.exit(1);
  }
})();
