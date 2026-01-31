#!/usr/bin/env node

/**
 * Script pour vérifier un paiement Stripe dans Firestore
 * Usage: node check-payment.js PAYMENT_INTENT_ID
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
        return { db: admin.firestore(), auth: admin.auth() };
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
        process.exit(1);
    }
}

async function checkPayment(paymentIntentId, db, auth) {
    try {
        console.log(`\n🔍 Recherche du paiement: ${paymentIntentId}\n`);

        // 1. Chercher dans les tokens de registration
        console.log('='.repeat(80));
        console.log('1. RECHERCHE DANS LES TOKENS DE REGISTRATION');
        console.log('='.repeat(80));

        const tokensSnapshot = await db.collection('registrationTokens').get();
        console.log(`📋 ${tokensSnapshot.size} token(s) trouvé(s) au total\n`);

        let foundTokens = [];
        tokensSnapshot.forEach(doc => {
            const data = doc.data();
            foundTokens.push({
                token: doc.id,
                email: data.email,
                product: data.product,
                products: data.products,
                used: data.used,
                createdAt: data.createdAt?.toDate(),
                expiresAt: data.expiresAt?.toDate(),
            });
        });

        // Trier par date de création (plus récents en premier)
        foundTokens.sort((a, b) => {
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return b.createdAt - a.createdAt;
        });

        console.log('📋 Derniers tokens créés:');
        console.log('─'.repeat(80));
        foundTokens.slice(0, 10).forEach((token, index) => {
            const productDisplay = token.products ? token.products.join(', ') : token.product;
            const status = token.used ? '✅ Utilisé' : '⏳ Non utilisé';
            const expired = token.expiresAt && token.expiresAt < new Date() ? '❌ Expiré' : '✅ Valide';
            console.log(`${index + 1}. Email: ${token.email}`);
            console.log(`   Produit(s): ${productDisplay}`);
            console.log(`   Statut: ${status} - ${expired}`);
            console.log(`   Créé: ${token.createdAt?.toISOString() || 'N/A'}`);
            console.log(`   Expire: ${token.expiresAt?.toISOString() || 'N/A'}`);
            console.log(`   Token: ${token.token}`);
            console.log('');
        });

        // 2. Chercher dans les utilisateurs
        console.log('\n' + '='.repeat(80));
        console.log('2. RECHERCHE DANS LES UTILISATEURS');
        console.log('='.repeat(80));

        const usersSnapshot = await db.collection('users').get();
        console.log(`📋 ${usersSnapshot.size} utilisateur(s) trouvé(s) au total\n`);

        let foundUsers = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            foundUsers.push({
                uid: doc.id,
                email: data.email,
                product: data.product,
                products: data.products,
                createdAt: data.createdAt?.toDate(),
                registrationDate: data.registrationDate?.toDate(),
            });
        });

        // Trier par date de création (plus récents en premier)
        foundUsers.sort((a, b) => {
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return b.createdAt - a.createdAt;
        });

        console.log('📋 Derniers utilisateurs créés:');
        console.log('─'.repeat(80));
        foundUsers.slice(0, 10).forEach((user, index) => {
            const productDisplay = user.products ?
                user.products.map(p => p.name || p).join(', ') :
                user.product;
            console.log(`${index + 1}. Email: ${user.email}`);
            console.log(`   UID: ${user.uid}`);
            console.log(`   Produit(s): ${productDisplay}`);
            console.log(`   Créé: ${user.createdAt?.toISOString() || 'N/A'}`);
            console.log('');
        });

        // 3. Chercher les tokens avec le produit "21jours" créés récemment
        console.log('\n' + '='.repeat(80));
        console.log('3. TOKENS "21jours" RÉCENTS (dernières 48h)');
        console.log('='.repeat(80));

        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const recent21joursTokens = foundTokens.filter(token => {
            const has21jours = token.product === '21jours' ||
                (token.products && token.products.includes('21jours'));
            const isRecent = token.createdAt && token.createdAt >= twoDaysAgo;
            return has21jours && isRecent;
        });

        if (recent21joursTokens.length === 0) {
            console.log('❌ Aucun token "21jours" créé dans les dernières 48h');
        } else {
            console.log(`✅ ${recent21joursTokens.length} token(s) "21jours" trouvé(s):\n`);
            recent21joursTokens.forEach((token, index) => {
                const productDisplay = token.products ? token.products.join(' + ') : token.product;
                const status = token.used ? '✅ Utilisé' : '⏳ Non utilisé';
                console.log(`${index + 1}. Email: ${token.email}`);
                console.log(`   Produit(s): ${productDisplay}`);
                console.log(`   Statut: ${status}`);
                console.log(`   Créé: ${token.createdAt?.toISOString()}`);
                console.log(`   Token: ${token.token}`);
                console.log(`   Lien: https://fluance.io/creer-compte?token=${token.token}`);
                console.log('');
            });
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
const paymentIntentId = process.argv[2] || 'pi_3SuxyN2Esx6PN6y11BmwWwB7';

console.log(`🔍 Recherche du paiement: ${paymentIntentId}`);

// Exécuter
(async () => {
    try {
        const { db, auth } = await initFirebase();
        await checkPayment(paymentIntentId, db, auth);
        process.exit(0);
    } catch (error) {
        console.error('Erreur fatale:', error);
        process.exit(1);
    }
})();
