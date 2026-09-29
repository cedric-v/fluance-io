#!/usr/bin/env node

/**
 * Script pour définir la variante du produit "complet" (Fluance Illimité)
 * sur le compte d'un utilisateur.
 *
 * La variante distingue notamment l'offre annuelle (bonus « Cédric répond
 * à vos questions ») de l'offre mensuelle :
 *   - ma_pratique_annuel  → formulaire de question affiché dans /membre/
 *   - ma_pratique_mensuel → pas de bonus annuel
 *
 * Usage:
 *   node scripts/set-complet-variant.js <email> [variant]
 *   node scripts/set-complet-variant.js <email> --clear
 *
 * Exemples:
 *   node scripts/set-complet-variant.js user@example.com ma_pratique_annuel
 *   node scripts/set-complet-variant.js user@example.com ma_pratique_mensuel
 *   node scripts/set-complet-variant.js user@example.com --clear
 *
 * Prérequis : l'utilisateur doit posséder le produit "complet".
 */

const admin = require('firebase-admin');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'fluance-protected-content';
const VALID_VARIANTS = ['ma_pratique_mensuel', 'ma_pratique_annuel', 'mensuel', 'trimestriel'];

async function initFirebase() {
  if (admin.getApps().length === 0) {
    const possiblePaths = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.join(__dirname, '..', 'new-project-service-account.json'),
      path.join(__dirname, '..', 'fluance-protected-content-service-account.json'),
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
      console.log(`📁 Utilisation du service account : ${serviceAccountPath}`);
      admin.initializeApp({
        credential: admin.cert(require(serviceAccountPath)),
        projectId: PROJECT_ID,
      });
    } else {
      console.log('📁 Utilisation des credentials par défaut (Firebase CLI / gcloud ADC)');
      console.log('   ℹ️  Si erreur de quota, lancez avec : GOOGLE_CLOUD_QUOTA_PROJECT=' + PROJECT_ID);
      admin.initializeApp({projectId: PROJECT_ID});
    }
  }
  return {db: getFirestore(), auth: getAuth()};
}

async function setCompletVariant(email, variant, db, auth) {
  const normalizedEmail = email.toLowerCase().trim();
  const clearing = variant === null;
  console.log(`\n🔧 ${clearing ? 'Suppression' : 'Définition'} de la variante du produit "complet"`);
  console.log(`   Email  : ${normalizedEmail}`);
  console.log(`   Variante: ${clearing ? '(supprimée)' : variant}\n`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ Utilisateur non trouvé dans Firebase Auth : ${normalizedEmail}`);
      process.exit(1);
    }
    throw error;
  }

  console.log(`✅ Utilisateur trouvé : ${userRecord.uid}`);

  const userRef = db.collection('users').doc(userRecord.uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    console.error(`❌ Document Firestore introuvable pour ${normalizedEmail}`);
    process.exit(1);
  }

  const userData = userDoc.data();
  const products = userData.products || [];

  const completIndex = products.findIndex((p) => p && p.name === 'complet');
  if (completIndex === -1) {
    console.error('❌ Le produit "complet" n\'existe pas pour cet utilisateur.');
    console.error(`   Produits actuels : ${products.map((p) => p.name).join(', ') || 'aucun'}`);
    console.error(`   Ajoutez-le d'abord : node scripts/add-product-to-user.js ${normalizedEmail} complet`);
    process.exit(1);
  }

  const previous = products[completIndex].variant || null;
  console.log(`   Variante actuelle : ${previous || '(aucune)'}`);

  if (clearing) {
    delete products[completIndex].variant;
  } else {
    products[completIndex].variant = variant;
  }

  await userRef.set({
    products: products,
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});

  // Vérification
  const verify = await userRef.get();
  const verifiedComplet = (verify.data().products || []).find((p) => p && p.name === 'complet');

  console.log('✅ Mise à jour effectuée');
  console.log(`   Variante enregistrée : ${(verifiedComplet && verifiedComplet.variant) || '(aucune)'}`);
  console.log('\n📋 Effets :');
  if (verifiedComplet && verifiedComplet.variant === 'ma_pratique_annuel') {
    console.log('   ✓ Bonus annuel actif : formulaire « Une question ? Cédric vous répond » dans /membre/');
  } else {
    console.log('   • Pas de bonus annuel (formulaire de question masqué)');
  }
  console.log('   ✓ Accès Fluance Illimité (contenus complets) inchangé\n');
}

// --- CLI ---
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: node scripts/set-complet-variant.js <email> [variant|--clear]');
  console.error(`Variantes valides : ${VALID_VARIANTS.join(', ')}`);
  process.exit(1);
}

const email = args[0];
const variantArg = args[1];

let variant;
if (variantArg === '--clear') {
  variant = null;
} else if (variantArg === undefined) {
  variant = 'ma_pratique_annuel';
} else if (VALID_VARIANTS.includes(variantArg)) {
  variant = variantArg;
} else {
  console.error(`❌ Variante invalide : ${variantArg}`);
  console.error(`   Variantes valides : ${VALID_VARIANTS.join(', ')}`);
  process.exit(1);
}

(async () => {
  try {
    const {db, auth} = await initFirebase();
    await setCompletVariant(email, variant, db, auth);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
})();
