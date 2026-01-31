#!/usr/bin/env node

/**
 * Script pour créer un nouveau token avec plusieurs produits
 * Usage: node create-multi-product-token.js EMAIL PRODUCT1 PRODUCT2 ...
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
        return { db: admin.firestore() };
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
        process.exit(1);
    }
}

function generateUniqueToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function createMultiProductToken(email, products, expirationDays, db) {
    try {
        const emailLower = email.toLowerCase().trim();
        console.log(`\n🔧 Création d'un nouveau token pour: ${emailLower}`);
        console.log(`   Produits: ${products.join(', ')}`);
        console.log(`   Validité: ${expirationDays} jours\n`);

        // Générer un nouveau token
        const token = generateUniqueToken();
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + expirationDays);

        // Créer le document dans Firestore
        await db.collection('registrationTokens').doc(token).set({
            email: emailLower,
            products: products,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: expirationDate,
            used: false,
            note: 'Token créé manuellement pour corriger un problème de cross-sell',
        });

        console.log('✅ Token créé avec succès !');
        console.log('─'.repeat(80));
        console.log(`   Token: ${token}`);
        console.log(`   Email: ${emailLower}`);
        console.log(`   Produits: ${products.join(', ')}`);
        console.log(`   Expire le: ${expirationDate.toISOString()}`);
        console.log('');

        // Générer le lien de création de compte
        const baseUrl = 'https://fluance.io';
        const registrationUrl = `${baseUrl}/creer-compte?token=${token}`;

        console.log('📧 LIEN DE CRÉATION DE COMPTE:');
        console.log('─'.repeat(80));
        console.log(registrationUrl);
        console.log('');

        console.log('📋 INSTRUCTIONS:');
        console.log('─'.repeat(80));
        console.log('1. Envoyez ce lien à la cliente par email');
        console.log('2. Elle doit cliquer sur le lien pour créer son compte');
        console.log('3. Une fois le compte créé, elle aura accès aux 2 programmes:');
        console.log('   - 21 jours pour remettre du mouvement');
        console.log('   - SOS dos & cervicales');
        console.log('');

        // Invalider l'ancien token
        console.log('🔄 Invalidation de l\'ancien token...');
        const oldTokensSnapshot = await db.collection('registrationTokens')
            .where('email', '==', emailLower)
            .where('used', '==', false)
            .get();

        let invalidatedCount = 0;
        for (const doc of oldTokensSnapshot.docs) {
            if (doc.id !== token) {
                await doc.ref.update({
                    used: true,
                    invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    invalidationReason: 'Remplacé par un nouveau token avec tous les produits',
                });
                invalidatedCount++;
            }
        }

        if (invalidatedCount > 0) {
            console.log(`✅ ${invalidatedCount} ancien(s) token(s) invalidé(s)`);
        } else {
            console.log('ℹ️  Aucun ancien token à invalider');
        }
        console.log('');

        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
        process.exit(1);
    }
}

// Récupérer les arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('❌ Erreur: Veuillez fournir un email et au moins un produit');
    console.log('Usage: node create-multi-product-token.js EMAIL PRODUCT1 [PRODUCT2] [PRODUCT3] ...');
    console.log('');
    console.log('Produits disponibles:');
    console.log('  - 21jours');
    console.log('  - sos-dos-cervicales');
    console.log('  - complet');
    console.log('');
    console.log('Exemple: node create-multi-product-token.js veronique.corminboeuf@bluewin.ch 21jours sos-dos-cervicales');
    process.exit(1);
}

const email = args[0];
const products = args.slice(1);
const expirationDays = 30;

// Valider les produits
const validProducts = ['21jours', 'sos-dos-cervicales', 'complet'];
const invalidProducts = products.filter(p => !validProducts.includes(p));

if (invalidProducts.length > 0) {
    console.error(`❌ Erreur: Produit(s) invalide(s): ${invalidProducts.join(', ')}`);
    console.log(`Produits valides: ${validProducts.join(', ')}`);
    process.exit(1);
}

// Exécuter
(async () => {
    try {
        const { db } = await initFirebase();
        await createMultiProductToken(email, products, expirationDays, db);
        process.exit(0);
    } catch (error) {
        console.error('Erreur fatale:', error);
        process.exit(1);
    }
})();
