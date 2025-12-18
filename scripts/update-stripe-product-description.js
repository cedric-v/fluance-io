/**
 * Script pour mettre à jour la description du produit Stripe trimestriel
 * 
 * Ce script corrige le texte affiché sur Stripe Checkout :
 * - Remplace "Alors" par "Puis "
 * - Remplace "à partir de" par "à partir du "
 * 
 * Usage:
 *   node scripts/update-stripe-product-description.js
 * 
 * Prérequis:
 *   - Avoir la clé API Stripe (sk_live_XXXXX ou sk_test_XXXXX) dans STRIPE_SECRET_KEY
 *   - Le produit trimestriel doit avoir le Product ID: prod_TakbVXK9sDba9F
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Utiliser la clé depuis les variables d'environnement
// Le script doit être exécuté depuis functions/ où stripe est installé
// OU installer stripe à la racine : npm install stripe
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error('❌ STRIPE_SECRET_KEY n\'est pas défini dans les variables d\'environnement');
  console.error('💡 Configurez STRIPE_SECRET_KEY dans votre .env ou utilisez:');
  console.error('   export STRIPE_SECRET_KEY=sk_live_XXXXX');
  process.exit(1);
}

// Utiliser stripe depuis functions/ si disponible, sinon depuis node_modules
let stripe;
try {
  stripe = require('../functions/node_modules/stripe')(stripeKey);
} catch {
  try {
    stripe = require('stripe')(stripeKey);
  } catch {
    console.error('❌ Le package stripe n\'est pas installé');
    console.error('💡 Installez-le avec: npm install stripe');
    console.error('   OU exécutez le script depuis functions/: cd functions && node ../scripts/update-stripe-product-description.js');
    process.exit(1);
  }
}

const PRODUCT_ID_TRIMESTRIEL = 'prod_TakbVXK9sDba9F';

async function updateProductDescription() {
  try {
    console.log('🔍 Récupération du produit actuel...');
    const product = await stripe.products.retrieve(PRODUCT_ID_TRIMESTRIEL);
    
    console.log('📝 Description actuelle:', product.description);
    
    // Nouvelle description avec les corrections
    const newDescription = product.description
      .replace(/Alors/g, 'Puis ')
      .replace(/à partir de/g, 'à partir du ');
    
    if (newDescription === product.description) {
      console.log('✅ La description est déjà correcte, aucune modification nécessaire.');
      return;
    }
    
    console.log('📝 Nouvelle description:', newDescription);
    
    // Mettre à jour le produit
    const updatedProduct = await stripe.products.update(PRODUCT_ID_TRIMESTRIEL, {
      description: newDescription,
    });
    
    console.log('✅ Produit mis à jour avec succès!');
    console.log('📝 Nouvelle description:', updatedProduct.description);
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.error('💡 Vérifiez que STRIPE_SECRET_KEY est correctement configuré dans .env');
    }
    process.exit(1);
  }
}

// Exécuter le script
updateProductDescription();
