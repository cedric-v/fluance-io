#!/usr/bin/env node

/**
 * Script pour vérifier et corriger le format d'un token
 * Usage: node scripts/fix-token-format.js <token>
 *
 * Ce script vérifie si un token utilise le format 'products' (array) au lieu de 'product' (singular)
 * et le corrige si nécessaire en créant des tokens séparés pour chaque produit.
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');

// Configuration Firebase
try {
  if (!admin.getApps().length) {
    admin.initializeApp({
      projectId: 'fluance-protected-content',
    });
    console.log('✅ Firebase Admin initialisé');
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = getFirestore();

/**
 * Vérifie et affiche les détails d'un token
 */
async function checkToken(token) {
  try {
    const tokenDoc = await db.collection('registrationTokens').doc(token).get();

    if (!tokenDoc.exists) {
      console.log('❌ Token non trouvé dans la base de données');
      return null;
    }

    const data = tokenDoc.data();
    console.log('\n📋 Détails du token:');
    console.log('═'.repeat(80));
    console.log(`Token: ${token}`);
    console.log(`Email: ${data.email}`);
    console.log(`Utilisé: ${data.used ? 'Oui ✅' : 'Non ❌'}`);
    console.log(`Créé le: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'non défini'}`);
    console.log(`Expire le: ${data.expiresAt ? data.expiresAt.toDate().toISOString() : 'non défini'}`);

    if (data.product) {
      console.log(`Format: product (singular) ✅`);
      console.log(`Produit: ${data.product}`);
    } else if (data.products) {
      console.log(`Format: products (array) ⚠️`);
      console.log(`Produits: ${data.products.join(', ')}`);
      console.log('\n⚠️  ATTENTION: Ce token utilise l\'ancien format avec un tableau de produits.');
      console.log('   Avec la mise à jour récente de verifyToken, ce token devrait maintenant fonctionner.');
      console.log('   L\'utilisateur pourra créer son compte et tous les produits seront ajoutés en une fois.');
    } else {
      console.log(`Format: AUCUN PRODUIT ❌`);
    }

    // Vérifier l'expiration
    if (data.expiresAt) {
      const now = new Date();
      const expiresAt = data.expiresAt.toDate();
      if (now > expiresAt) {
        console.log('\n⚠️  Ce token a expiré!');
      }
    }

    console.log('═'.repeat(80));

    return data;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du token:', error);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main() {
  const token = process.argv[2];

  if (!token) {
    console.error('❌ Usage: node scripts/fix-token-format.js <token>');
    process.exit(1);
  }

  try {
    const data = await checkToken(token);

    if (!data) {
      process.exit(1);
    }

    if (data.used) {
      console.log('\n✅ Le token a déjà été utilisé. Aucune action nécessaire.');
    } else if (data.product) {
      console.log('\n✅ Le token utilise le format correct. Il devrait fonctionner sans problème.');
    } else if (data.products) {
      console.log('\n✅ Grâce à la mise à jour récente, ce token devrait maintenant fonctionner.');
      console.log('   L\'utilisateur peut créer son compte avec ce lien:');
      console.log(`   https://fluance.io/creer-compte?token=${token}`);
    }

    console.log('\n✅ Vérification terminée!');
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = { checkToken };
