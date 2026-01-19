/**
 * Script pour créer manuellement un token pour un client
 * Usage: node scripts/create-token-for-customer.js cbaka@bluewin.ch
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
    console.log('✅ Firebase Admin initialisé');
  } else {
    console.log('✅ Firebase Admin déjà initialisé');
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
 * Crée un token et l'ajoute à Firestore
 * Note: Crée un token par produit pour correspondre au format du webhook
 */
async function createTokenForCustomer(email, product, expirationDays = 30) {
  console.log(`\n🔑 Création d'un token pour ${email}`);
  console.log(`📦 Produit: ${product}`);
  console.log(`⏰ Expiration: ${expirationDays} jours`);

  const token = generateUniqueToken();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);

  try {
    // Créer le token dans Firestore (format webhook: singular 'product')
    await db.collection('registrationTokens').doc(token).set({
      email: email.toLowerCase().trim(),
      product: product, // Format webhook: singular product
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expirationDate,
      used: false,
      manuallyCreated: true, // Marquer comme créé manuellement
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
 * Crée plusieurs tokens pour plusieurs produits
 */
async function createTokensForProducts(email, products = ['21jours'], expirationDays = 30) {
  const tokens = [];

  for (const product of products) {
    const token = await createTokenForCustomer(email, product, expirationDays);
    tokens.push({ product, token });
  }

  return tokens;
}

/**
 * Vérifie si l'utilisateur a déjà un compte
 */
async function checkExistingAccount(email) {
  console.log(`\n👤 Vérification du compte pour ${email}...`);

  try {
    const userProductsQuery = await db.collection('userProducts')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (!userProductsQuery.empty) {
      const userData = userProductsQuery.docs[0].data();
      console.log('✅ Compte trouvé:');
      console.log('📦 Produits:', userData.products || [userData.product]);
      return true;
    }

    console.log('❌ Aucun compte trouvé');
    return false;

  } catch (error) {
    console.error('❌ Erreur lors de la vérification du compte:', error);
    return false;
  }
}

/**
 * Fonction principale
 */
async function main() {
  const email = process.argv[2];
  const productArg = process.argv[3];

  if (!email) {
    console.error('❌ Usage: node scripts/create-token-for-customer.js <email> [product1,product2,...]');
    console.error('   Exemples:');
    console.error('   - node scripts/create-token-for-customer.js user@example.com 21jours');
    console.error('   - node scripts/create-token-for-customer.js user@example.com 21jours,sos-dos-cervicales');
    process.exit(1);
  }

  try {
    // Vérifier si l'utilisateur a déjà un compte
    const hasAccount = await checkExistingAccount(email);

    if (hasAccount) {
      console.log('\n⚠️ L\'utilisateur a déjà un compte. Création du token quand même...');
    }

    // Déterminer les produits à créer
    const products = productArg
      ? productArg.split(',').map(p => p.trim())
      : ['21jours', 'sos-dos-cervicales']; // Par défaut: les deux produits

    // Créer un token pour chaque produit
    const tokens = await createTokensForProducts(email, products, 30);

    console.log('\n📧 Instructions pour l\'utilisateur:');
    console.log(`Envoyez ces liens à ${email}:`);
    tokens.forEach(({ product, token }) => {
      console.log(`\n📦 ${product}:`);
      console.log(`   https://fluance.io/creer-compte?token=${token}`);
    });

    console.log('\n💡 Note: L\'utilisateur peut utiliser n\'importe quel lien en premier.');
    console.log('   Une fois connecté, il peut utiliser les autres liens pour ajouter les produits supplémentaires.');

    console.log('\n✅ Opération terminée avec succès!');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = { createTokenForCustomer, createTokensForProducts, checkExistingAccount };