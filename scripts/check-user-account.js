#!/usr/bin/env node

/**
 * Script pour vérifier l'état complet d'un compte utilisateur
 * Usage: node scripts/check-user-account.js <email>
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

// Configuration Firebase
try {
  if (!admin.getApps().length) {
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
      console.log(`📁 Utilisation du service account: ${serviceAccountPath}\n`);
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.cert(serviceAccount),
        projectId: 'fluance-protected-content',
      });
    } else {
      console.log('📁 Utilisation des credentials par défaut\n');
      admin.initializeApp({
        projectId: 'fluance-protected-content',
      });
    }
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = getFirestore();
const auth = getAuth();

async function checkUserAccount(email) {
  const normalizedEmail = email.toLowerCase().trim();
  console.log(`🔍 Vérification complète du compte pour: ${normalizedEmail}\n`);
  console.log('='.repeat(80));

  try {
    // 1. Vérifier dans Firebase Auth
    console.log('\n1️⃣  FIREBASE AUTHENTICATION');
    console.log('-'.repeat(80));
    let authUser = null;
    try {
      authUser = await auth.getUserByEmail(normalizedEmail);
      console.log('✅ Compte Auth trouvé');
      console.log(`   UID: ${authUser.uid}`);
      console.log(`   Email vérifié: ${authUser.emailVerified ? 'Oui' : 'Non'}`);
      console.log(`   Créé le: ${new Date(authUser.metadata.creationTime).toISOString()}`);
      console.log(`   Dernière connexion: ${authUser.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime).toISOString() : 'Jamais'}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('❌ Aucun compte Auth trouvé');
      } else {
        throw error;
      }
    }

    // 2. Vérifier dans Firestore collection 'users'
    console.log('\n2️⃣  FIRESTORE COLLECTION "users"');
    console.log('-'.repeat(80));
    if (authUser) {
      const userDoc = await db.collection('users').doc(authUser.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('✅ Document Firestore trouvé');
        console.log(`   Email: ${userData.email}`);
        console.log(`   Produit (ancien format): ${userData.product || 'N/A'}`);
        console.log(`   Produits (nouveau format): ${userData.products ? JSON.stringify(userData.products) : 'N/A'}`);
        console.log(`   Date création: ${userData.createdAt ? userData.createdAt.toDate().toISOString() : 'N/A'}`);
        console.log(`   Date inscription (21jours): ${userData.registrationDate ? userData.registrationDate.toDate().toISOString() : 'N/A'}`);
        console.log(`   Dernière màj: ${userData.updatedAt ? userData.updatedAt.toDate().toISOString() : 'N/A'}`);
      } else {
        console.log('❌ Aucun document Firestore trouvé');
        console.log('   ⚠️  PROBLÈME: Le compte Auth existe mais pas le document Firestore!');
        console.log('   Cela empêche l\'accès aux contenus protégés.');
      }
    } else {
      console.log('⏭️  Ignoré (pas de compte Auth)');
    }

    // 3. Vérifier les tokens de registration
    console.log('\n3️⃣  TOKENS DE REGISTRATION');
    console.log('-'.repeat(80));
    const tokensSnapshot = await db.collection('registrationTokens')
      .where('email', '==', normalizedEmail)
      .get();

    if (tokensSnapshot.empty) {
      console.log('❌ Aucun token trouvé');
    } else {
      console.log(`✅ ${tokensSnapshot.size} token(s) trouvé(s):\n`);
      tokensSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   Token ${index + 1}:`);
        console.log(`   - ID: ${doc.id.substring(0, 16)}...`);
        console.log(`   - Produit: ${data.product || 'N/A'}`);
        console.log(`   - Produits: ${data.products ? JSON.stringify(data.products) : 'N/A'}`);
        console.log(`   - Utilisé: ${data.used ? 'Oui ✅' : 'Non ❌'}`);
        if (data.used && data.userId) {
          console.log(`   - UserID lié: ${data.userId}`);
          if (authUser && data.userId !== authUser.uid) {
            console.log(`   ⚠️  ATTENTION: Le userID du token (${data.userId}) ne correspond pas au UID Auth (${authUser.uid})`);
          }
        }
        console.log('');
      });
    }

    // 4. Diagnostic final
    console.log('\n4️⃣  DIAGNOSTIC FINAL');
    console.log('-'.repeat(80));

    if (!authUser) {
      console.log('❌ PROBLÈME: Aucun compte Firebase Auth');
      console.log('   Solution: L\'utilisateur doit créer son compte avec un token valide');
    } else {
      const userDoc = await db.collection('users').doc(authUser.uid).get();
      if (!userDoc.exists) {
        console.log('❌ PROBLÈME CRITIQUE: Compte Auth existe mais document Firestore manquant');
        console.log('   Cause probable: Erreur lors de la création du compte via verifyToken');
        console.log('   Impact: L\'utilisateur ne peut pas accéder aux contenus protégés');
        console.log('   Solution: Utiliser la fonction repairUserDocument ou recréer un token');
      } else {
        const userData = userDoc.data();
        const hasProducts = (userData.products && userData.products.length > 0) || userData.product;
        if (hasProducts) {
          console.log('✅ COMPTE FONCTIONNEL');
          console.log('   Le compte est correctement configuré et devrait fonctionner.');
        } else {
          console.log('⚠️  PROBLÈME: Aucun produit associé au compte');
          console.log('   Le compte existe mais n\'a pas de produits configurés.');
        }
      }
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error.message);
    throw error;
  }
}

// Exécuter
const email = process.argv[2];
if (!email) {
  console.error('❌ Usage: node scripts/check-user-account.js <email>');
  process.exit(1);
}

checkUserAccount(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
