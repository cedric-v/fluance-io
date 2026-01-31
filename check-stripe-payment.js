#!/usr/bin/env node

/**
 * Script pour vérifier un paiement Stripe et détecter les cross-sells
 * Usage: node check-stripe-payment.js PAYMENT_INTENT_ID
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_live_...');

const STRIPE_PRICE_ID_SOS_DOS_CERVICALES = 'price_1SeWdF2Esx6PN6y1XlbpIObG';

async function checkStripePayment(paymentIntentId) {
    try {
        console.log(`\n🔍 Vérification du paiement Stripe: ${paymentIntentId}\n`);

        // 1. Récupérer le PaymentIntent
        console.log('='.repeat(80));
        console.log('1. PAYMENT INTENT');
        console.log('='.repeat(80));

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        console.log('✅ Payment Intent trouvé:');
        console.log('─'.repeat(80));
        console.log(`   ID: ${paymentIntent.id}`);
        console.log(`   Montant: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
        console.log(`   Statut: ${paymentIntent.status}`);
        console.log(`   Email: ${paymentIntent.receipt_email || 'N/A'}`);
        console.log(`   Créé: ${new Date(paymentIntent.created * 1000).toISOString()}`);
        console.log('');

        console.log('📋 Métadonnées:');
        console.log('─'.repeat(80));
        if (paymentIntent.metadata && Object.keys(paymentIntent.metadata).length > 0) {
            Object.entries(paymentIntent.metadata).forEach(([key, value]) => {
                console.log(`   ${key}: ${value}`);
            });
        } else {
            console.log('   Aucune métadonnée');
        }
        console.log('');

        // 2. Récupérer la Checkout Session
        console.log('='.repeat(80));
        console.log('2. CHECKOUT SESSION');
        console.log('='.repeat(80));

        let checkoutSession = null;
        try {
            // Chercher la session via le payment intent
            const sessions = await stripe.checkout.sessions.list({
                payment_intent: paymentIntentId,
                limit: 1,
            });

            if (sessions.data.length > 0) {
                checkoutSession = sessions.data[0];
                console.log('✅ Checkout Session trouvée:');
                console.log('─'.repeat(80));
                console.log(`   ID: ${checkoutSession.id}`);
                console.log(`   Montant total: ${checkoutSession.amount_total / 100} ${checkoutSession.currency.toUpperCase()}`);
                console.log(`   Email: ${checkoutSession.customer_details?.email || 'N/A'}`);
                console.log(`   Statut: ${checkoutSession.status}`);
                console.log('');
            } else {
                console.log('❌ Aucune Checkout Session trouvée');
                console.log('');
            }
        } catch (error) {
            console.log(`❌ Erreur lors de la récupération de la session: ${error.message}`);
            console.log('');
        }

        // 3. Récupérer les line items
        if (checkoutSession) {
            console.log('='.repeat(80));
            console.log('3. LINE ITEMS (Produits achetés)');
            console.log('='.repeat(80));

            try {
                const fullSession = await stripe.checkout.sessions.retrieve(checkoutSession.id, {
                    expand: ['line_items'],
                });

                if (fullSession.line_items && fullSession.line_items.data) {
                    console.log(`✅ ${fullSession.line_items.data.length} produit(s) acheté(s):\n`);

                    let hasCrossSell = false;
                    fullSession.line_items.data.forEach((lineItem, index) => {
                        console.log(`${index + 1}. ${lineItem.description || 'Produit'}`);
                        console.log(`   Price ID: ${lineItem.price?.id || 'N/A'}`);
                        console.log(`   Quantité: ${lineItem.quantity}`);
                        console.log(`   Montant: ${lineItem.amount_total / 100} ${fullSession.currency.toUpperCase()}`);

                        if (lineItem.price?.id === STRIPE_PRICE_ID_SOS_DOS_CERVICALES) {
                            console.log(`   ✅ CROSS-SELL "SOS Dos & Cervicales" DÉTECTÉ !`);
                            hasCrossSell = true;
                        }
                        console.log('');
                    });

                    console.log('='.repeat(80));
                    console.log('4. RÉSUMÉ');
                    console.log('='.repeat(80));

                    if (hasCrossSell) {
                        console.log('✅ Le cross-sell "SOS Dos & Cervicales" a bien été acheté');
                        console.log('   ⚠️  PROBLÈME: Il n\'a pas été ajouté au token de registration !');
                        console.log('');
                        console.log('📋 ACTIONS À FAIRE:');
                        console.log('─'.repeat(80));
                        console.log('1. Créer un nouveau token avec les 2 produits (21jours + sos-dos-cervicales)');
                        console.log('2. Ou ajouter manuellement le produit après création du compte');
                        console.log('3. Vérifier pourquoi le webhook n\'a pas détecté le cross-sell');
                    } else {
                        console.log('❌ Le cross-sell "SOS Dos & Cervicales" n\'a PAS été acheté');
                        console.log('   Le token contient uniquement le produit principal (21jours)');
                    }
                    console.log('');

                } else {
                    console.log('❌ Aucun line item trouvé');
                    console.log('');
                }
            } catch (error) {
                console.log(`❌ Erreur lors de la récupération des line items: ${error.message}`);
                console.log('');
            }
        }

        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
        process.exit(1);
    }
}

// Récupérer le payment intent ID depuis les arguments
const paymentIntentId = process.argv[2];

if (!paymentIntentId) {
    console.error('❌ Erreur: Veuillez fournir un Payment Intent ID');
    console.log('Usage: node check-stripe-payment.js PAYMENT_INTENT_ID');
    console.log('Exemple: node check-stripe-payment.js pi_3SuxyN2Esx6PN6y11BmwWwB7');
    process.exit(1);
}

// Vérifier que la clé Stripe est configurée
if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_live_...') {
    console.error('❌ Erreur: STRIPE_SECRET_KEY non configurée');
    console.log('Veuillez définir la variable d\'environnement STRIPE_SECRET_KEY');
    console.log('Exemple: export STRIPE_SECRET_KEY=sk_live_...');
    process.exit(1);
}

// Exécuter
(async () => {
    try {
        await checkStripePayment(paymentIntentId);
        process.exit(0);
    } catch (error) {
        console.error('Erreur fatale:', error);
        process.exit(1);
    }
})();
