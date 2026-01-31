#!/usr/bin/env node

/**
 * Script pour renvoyer l'email de création de compte à un utilisateur
 * Usage: node resend-account-creation-email.js EMAIL
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
        return { db: admin.firestore() };
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
        process.exit(1);
    }
}

async function resendEmail(email, db) {
    try {
        const emailLower = email.toLowerCase().trim();
        console.log(`\n🔍 Recherche du token pour: ${emailLower}\n`);

        // Chercher le token le plus récent pour cet email
        const tokensSnapshot = await db.collection('registrationTokens')
            .where('email', '==', emailLower)
            .where('used', '==', false)
            .get();

        if (tokensSnapshot.empty) {
            console.log('❌ Aucun token non utilisé trouvé pour cet email');
            console.log('   Vérifiez que:');
            console.log('   1. L\'email est correct');
            console.log('   2. Le token n\'a pas déjà été utilisé');
            console.log('   3. Le paiement a bien été traité');
            return;
        }

        // Trier par date de création et prendre le plus récent
        const tokens = [];
        tokensSnapshot.forEach(doc => {
            const data = doc.data();
            tokens.push({
                token: doc.id,
                ...data,
            });
        });

        tokens.sort((a, b) => {
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return b.createdAt.toDate() - a.createdAt.toDate();
        });

        const latestToken = tokens[0];

        console.log('✅ Token trouvé:');
        console.log('─'.repeat(80));
        console.log(`   Email: ${latestToken.email}`);
        console.log(`   Produit(s): ${latestToken.products ? latestToken.products.join(', ') : latestToken.product}`);
        console.log(`   Token: ${latestToken.token}`);
        console.log(`   Créé: ${latestToken.createdAt?.toDate().toISOString()}`);
        console.log(`   Expire: ${latestToken.expiresAt?.toDate().toISOString()}`);
        console.log('');

        // Vérifier si le token a expiré
        const now = new Date();
        const expiresAt = latestToken.expiresAt?.toDate();
        if (expiresAt && expiresAt < now) {
            console.log('⚠️  ATTENTION: Ce token a expiré !');
            console.log('   Vous devrez créer un nouveau token ou prolonger celui-ci.');
            console.log('');
        }

        // Générer le lien de création de compte
        const baseUrl = 'https://fluance.io';
        const registrationUrl = `${baseUrl}/creer-compte?token=${latestToken.token}`;

        console.log('📧 LIEN DE CRÉATION DE COMPTE:');
        console.log('─'.repeat(80));
        console.log(registrationUrl);
        console.log('');

        console.log('📋 INSTRUCTIONS POUR LA CLIENTE:');
        console.log('─'.repeat(80));
        console.log('1. Envoyez-lui ce lien par email');
        console.log('2. Demandez-lui de vérifier ses spams/courrier indésirable');
        console.log('3. Elle doit cliquer sur le lien pour créer son compte');
        console.log('4. Elle pourra ensuite choisir un mot de passe');
        console.log('5. Une fois le compte créé, elle aura accès au programme');
        console.log('');

        // Vérifier si le cross-sell est présent
        const products = latestToken.products || [latestToken.product];
        const hasCrossSell = products.includes('sos-dos-cervicales');

        if (!hasCrossSell) {
            console.log('⚠️  ATTENTION: Cross-sell "SOS Dos et cervicales" NON détecté !');
            console.log('   Produits dans le token: ' + products.join(', '));
            console.log('   Si elle a payé pour le cross-sell, il faudra:');
            console.log('   1. Vérifier le paiement Stripe');
            console.log('   2. Créer un nouveau token avec les 2 produits');
            console.log('   3. Ou ajouter manuellement le produit après création du compte');
            console.log('');
        } else {
            console.log('✅ Cross-sell "SOS Dos et cervicales" inclus dans le token');
            console.log('');
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

// Récupérer l'email depuis les arguments
const email = process.argv[2];

if (!email) {
    console.error('❌ Erreur: Veuillez fournir un email');
    console.log('Usage: node resend-account-creation-email.js EMAIL');
    console.log('Exemple: node resend-account-creation-email.js customer@example.com');
    process.exit(1);
}

// Exécuter
(async () => {
    try {
        const { db } = await initFirebase();
        await resendEmail(email, db);
        process.exit(0);
    } catch (error) {
        console.error('Erreur fatale:', error);
        process.exit(1);
    }
})();
