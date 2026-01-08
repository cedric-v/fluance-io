#!/usr/bin/env node

/**
 * Script pour vérifier les métadonnées d'un Payment Intent Stripe
 * 
 * Usage: node scripts/check-stripe-payment-metadata.js <payment_intent_id>
 * Exemple: node scripts/check-stripe-payment-metadata.js pi_3SkiB12Esx6PN6y10OBRM9yS
 */

const fs = require('fs');
const path = require('path');

// Utiliser firebase-admin depuis functions/node_modules
const functionsPath = path.join(__dirname, '../functions');
const stripe = require(path.join(functionsPath, 'node_modules/stripe'));

// ⚠️ IMPORTANT: Récupérer la clé Stripe depuis les variables d'environnement ou un fichier
// Pour ce script, on va utiliser les secrets Firebase si disponibles
// Sinon, il faudra passer la clé en variable d'environnement

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ Erreur: STRIPE_SECRET_KEY non définie');
  console.error('   Définissez-la avec: export STRIPE_SECRET_KEY="sk_..."');
  console.error('   Ou passez-la en argument: STRIPE_SECRET_KEY="sk_..." node scripts/check-stripe-payment-metadata.js <payment_intent_id>');
  process.exit(1);
}

const stripeClient = stripe(STRIPE_SECRET_KEY);

async function checkPaymentMetadata(paymentIntentId) {
  try {
    console.log(`🔍 Vérification des métadonnées pour: ${paymentIntentId}\n`);
    
    // Récupérer le Payment Intent
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId, {
      expand: ['charges.data.customer', 'customer'],
    });
    
    console.log('='.repeat(80));
    console.log('1. PAYMENT INTENT');
    console.log('='.repeat(80));
    console.log(`ID: ${paymentIntent.id}`);
    console.log(`Status: ${paymentIntent.status}`);
    console.log(`Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
    console.log(`Customer: ${paymentIntent.customer || 'N/A'}`);
    console.log(`\n📋 Métadonnées du Payment Intent:`);
    console.log(JSON.stringify(paymentIntent.metadata || {}, null, 2));
    
    const system = paymentIntent.metadata?.system;
    const product = paymentIntent.metadata?.product;
    
    console.log(`\n✅ Vérification:`);
    console.log(`   - system: ${system || '❌ MANQUANT'} ${system === 'firebase' ? '✅' : '❌'}`);
    console.log(`   - product: ${product || '❌ MANQUANT'} ${product === '21jours' ? '✅' : '❌'}`);
    
    // Récupérer les charges associées
    if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('2. CHARGE(S) ASSOCIÉE(S)');
      console.log('='.repeat(80));
      
      for (const charge of paymentIntent.charges.data) {
        console.log(`\nCharge ID: ${charge.id}`);
        console.log(`Status: ${charge.status}`);
        console.log(`Refunded: ${charge.refunded ? '✅ OUI' : '❌ NON'}`);
        console.log(`Amount refunded: ${charge.amount_refunded / 100} ${charge.currency.toUpperCase()}`);
        console.log(`Billing email: ${charge.billing_details?.email || 'N/A'}`);
        console.log(`\n📋 Métadonnées de la charge:`);
        console.log(JSON.stringify(charge.metadata || {}, null, 2));
        
        const chargeSystem = charge.metadata?.system;
        const chargeProduct = charge.metadata?.product;
        
        console.log(`\n✅ Vérification:`);
        console.log(`   - system: ${chargeSystem || '❌ MANQUANT'} ${chargeSystem === 'firebase' ? '✅' : '❌'}`);
        console.log(`   - product: ${chargeProduct || '❌ MANQUANT'} ${chargeProduct === '21jours' ? '✅' : '❌'}`);
      }
    }
    
    // Récupérer le customer si disponible
    if (paymentIntent.customer) {
      console.log('\n' + '='.repeat(80));
      console.log('3. CUSTOMER');
      console.log('='.repeat(80));
      
      let customer;
      if (typeof paymentIntent.customer === 'string') {
        customer = await stripeClient.customers.retrieve(paymentIntent.customer);
      } else {
        customer = paymentIntent.customer;
      }
      
      console.log(`ID: ${customer.id}`);
      console.log(`Email: ${customer.email || 'N/A'}`);
      console.log(`\n📋 Métadonnées du customer:`);
      console.log(JSON.stringify(customer.metadata || {}, null, 2));
    }
    
    // Récupérer la session Checkout si disponible
    console.log('\n' + '='.repeat(80));
    console.log('4. RÉSUMÉ POUR LE WEBHOOK DE REMBOURSEMENT');
    console.log('='.repeat(80));
    
    const hasSystem = (system === 'firebase') || (paymentIntent.charges?.data[0]?.metadata?.system === 'firebase');
    const hasProduct = (product === '21jours') || (paymentIntent.charges?.data[0]?.metadata?.product === '21jours');
    const hasEmail = paymentIntent.charges?.data[0]?.billing_details?.email || 
                     (paymentIntent.customer && typeof paymentIntent.customer === 'object' ? paymentIntent.customer.email : null);
    
    console.log(`\n✅ Métadonnées disponibles pour le remboursement automatique:`);
    console.log(`   - system: ${hasSystem ? '✅ OUI' : '❌ NON'}`);
    console.log(`   - product: ${hasProduct ? '✅ OUI' : '❌ NON'}`);
    console.log(`   - email: ${hasEmail ? `✅ OUI (${hasEmail})` : '❌ NON'}`);
    
    if (hasSystem && hasProduct && hasEmail) {
      console.log(`\n✅ Le remboursement automatique devrait fonctionner correctement !`);
      console.log(`   Le webhook pourra:`);
      console.log(`   1. Détecter l'événement charge.refunded`);
      console.log(`   2. Récupérer les métadonnées (system: firebase, product: 21jours)`);
      console.log(`   3. Récupérer l'email (${hasEmail})`);
      console.log(`   4. Retirer automatiquement le produit de l'utilisateur dans Firestore`);
    } else {
      console.log(`\n⚠️  Le remboursement automatique pourrait ne pas fonctionner:`);
      if (!hasSystem) console.log(`   - Le système n'est pas identifié comme 'firebase'`);
      if (!hasProduct) console.log(`   - Le produit n'est pas identifié comme '21jours'`);
      if (!hasEmail) console.log(`   - L'email n'est pas disponible`);
      console.log(`\n   Solution: Retirer manuellement l'accès avec:`);
      console.log(`   node scripts/remove-product-from-user.js laurence.n43@gmail.com 21jours`);
    }
    
  } catch (error) {
    console.error(`\n❌ Erreur:`, error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.error(`   Le Payment Intent "${paymentIntentId}" n'existe pas ou n'est pas accessible.`);
    }
    process.exit(1);
  }
}

// Vérifier les arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('❌ Usage: node scripts/check-stripe-payment-metadata.js <payment_intent_id>');
  console.error('   Exemple: node scripts/check-stripe-payment-metadata.js pi_3SkiB12Esx6PN6y10OBRM9yS');
  process.exit(1);
}

const paymentIntentId = args[0];

checkPaymentMetadata(paymentIntentId)
  .then(() => {
    console.log('\n✅ Vérification terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });

