#!/usr/bin/env node

/**
 * Script pour vérifier les logs Firebase Functions pour un paiement spécifique
 * Usage: node check-webhook-logs.js PAYMENT_INTENT_ID
 */

const { execSync } = require('child_process');

const paymentIntentId = process.argv[2] || 'YOUR_PAYMENT_INTENT_ID';
const email = process.argv[3] || 'customer';

console.log(`\n🔍 Recherche des logs pour le paiement: ${paymentIntentId}`);
console.log(`   Email: ${email}\n`);

console.log('='.repeat(80));
console.log('LOGS FIREBASE FUNCTIONS');
console.log('='.repeat(80));
console.log('');

try {
    // Chercher les logs avec le payment intent ID
    console.log('📋 Recherche par Payment Intent ID...\n');
    try {
        const result = execSync(
            `firebase functions:log --limit 500 2>&1 | grep -i "${paymentIntentId}" -A 10 -B 10`,
            { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
        console.log(result);
    } catch (error) {
        console.log('❌ Aucun log trouvé avec le Payment Intent ID\n');
    }

    // Chercher les logs avec l'email
    console.log('\n📋 Recherche par email...\n');
    try {
        const result = execSync(
            `firebase functions:log --limit 500 2>&1 | grep -i "${email}" -A 5 -B 5`,
            { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
        console.log(result);
    } catch (error) {
        console.log('❌ Aucun log trouvé avec l\'email\n');
    }

    // Chercher les logs de cross-sell
    console.log('\n📋 Recherche des logs de cross-sell récents...\n');
    try {
        const result = execSync(
            `firebase functions:log --limit 500 2>&1 | grep -i "cross-sell" -A 5 -B 5`,
            { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
        console.log(result);
    } catch (error) {
        console.log('❌ Aucun log de cross-sell trouvé\n');
    }

} catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
}

console.log('\n' + '='.repeat(80));
console.log('FIN DES LOGS');
console.log('='.repeat(80) + '\n');
