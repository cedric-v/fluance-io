#!/usr/bin/env node

/**
 * Script pour tester la création de compte avec un token
 * Usage: node test-verify-token.js TOKEN
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ID = 'fluance-protected-content';

// Initialiser Firebase Admin
async function initFirebase() {
    try {
        if (admin.getApps().length === 0) {
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
                    credential: admin.cert(serviceAccount),
                    projectId: PROJECT_ID,
                });
            } else {
                console.log('📁 Utilisation des credentials par défaut (Firebase CLI)');
                admin.initializeApp({
                    projectId: PROJECT_ID,
                });
            }
        }
        return { db: getFirestore(), auth: getAuth() };
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
        process.exit(1);
    }
}

async function testVerifyToken(token, db, auth) {
    try {
        console.log(`\n🔍 Test de vérification du token: ${token}\n`);

        // 1. Vérifier le token dans Firestore
        console.log('='.repeat(80));
        console.log('1. VÉRIFICATION DU TOKEN');
        console.log('='.repeat(80));

        const tokenDoc = await db.collection('registrationTokens').doc(token).get();

        if (!tokenDoc.exists) {
            console.log('❌ Token invalide - Le token n\'existe pas dans Firestore');
            return;
        }

        const tokenData = tokenDoc.data();
        console.log('✅ Token trouvé dans Firestore');
        console.log('─'.repeat(80));
        console.log(`   Email: ${tokenData.email}`);
        console.log(`   Produit(s): ${tokenData.products ? tokenData.products.join(', ') : tokenData.product}`);
        console.log(`   Utilisé: ${tokenData.used ? 'Oui ❌' : 'Non ✅'}`);
        console.log(`   Créé: ${tokenData.createdAt?.toDate().toISOString()}`);
        console.log(`   Expire: ${tokenData.expiresAt?.toDate().toISOString()}`);
        console.log('');

        // 2. Vérifier si le token a déjà été utilisé
        if (tokenData.used) {
            console.log('❌ PROBLÈME: Ce token a déjà été utilisé');
            console.log(`   Utilisé le: ${tokenData.usedAt?.toDate().toISOString()}`);
            console.log(`   User ID: ${tokenData.userId || 'N/A'}`);
            console.log('');
            console.log('💡 SOLUTION: Créer un nouveau token avec:');
            console.log(`   node create-multi-product-token.js ${tokenData.email} ${tokenData.products ? tokenData.products.join(' ') : tokenData.product}`);
            return;
        }

        // 3. Vérifier si le token a expiré
        const now = new Date();
        const expiresAt = tokenData.expiresAt.toDate();
        if (now > expiresAt) {
            console.log('❌ PROBLÈME: Ce token a expiré');
            console.log(`   Expiré le: ${expiresAt.toISOString()}`);
            console.log('');
            console.log('💡 SOLUTION: Créer un nouveau token avec:');
            console.log(`   node create-multi-product-token.js ${tokenData.email} ${tokenData.products ? tokenData.products.join(' ') : tokenData.product}`);
            return;
        }

        console.log('✅ Token valide et non utilisé');
        console.log('');

        // 4. Vérifier si l'utilisateur existe déjà
        console.log('='.repeat(80));
        console.log('2. VÉRIFICATION DE L\'UTILISATEUR');
        console.log('='.repeat(80));

        const email = tokenData.email;
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
            console.log('⚠️  L\'utilisateur existe déjà dans Firebase Authentication');
            console.log('─'.repeat(80));
            console.log(`   UID: ${userRecord.uid}`);
            console.log(`   Email: ${userRecord.email}`);
            console.log(`   Email vérifié: ${userRecord.emailVerified ? 'Oui' : 'Non'}`);
            console.log(`   Créé le: ${userRecord.metadata.creationTime}`);
            console.log('');

            // Vérifier le document Firestore
            const userDoc = await db.collection('users').doc(userRecord.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log('✅ Document Firestore existe');
                console.log('─'.repeat(80));
                console.log(`   Produits: ${userData.products ? userData.products.map(p => p.name).join(', ') : userData.product}`);
                console.log('');
            } else {
                console.log('❌ Document Firestore MANQUANT');
                console.log('   L\'utilisateur existe dans Auth mais pas dans Firestore');
                console.log('');
            }
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log('✅ L\'utilisateur n\'existe pas encore (normal pour une première création)');
                console.log('');
            } else {
                throw error;
            }
        }

        // 5. Vérifier la structure du token
        console.log('='.repeat(80));
        console.log('3. VÉRIFICATION DE LA STRUCTURE DU TOKEN');
        console.log('='.repeat(80));

        const tokenProducts = tokenData.products || (tokenData.product ? [tokenData.product] : []);

        if (tokenProducts.length === 0) {
            console.log('❌ PROBLÈME: Le token n\'a aucun produit défini');
            console.log('   Champs du token:', Object.keys(tokenData));
            console.log('');
            console.log('💡 SOLUTION: Créer un nouveau token avec les bons produits');
            return;
        }

        console.log(`✅ Produits détectés: ${tokenProducts.join(', ')}`);
        console.log('');

        // 6. Résumé
        console.log('='.repeat(80));
        console.log('4. RÉSUMÉ');
        console.log('='.repeat(80));

        console.log('✅ Le token est valide et prêt à être utilisé');
        console.log('');
        console.log('📋 Informations pour la création de compte:');
        console.log('─'.repeat(80));
        console.log(`   Email: ${email}`);
        console.log(`   Produits: ${tokenProducts.join(', ')}`);
        console.log(`   Token: ${token}`);
        console.log('');
        console.log('🔗 Lien de création de compte:');
        console.log(`   https://fluance.io/creer-compte?token=${token}`);
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

// Récupérer le token depuis les arguments
const token = process.argv[2] || 'YOUR_TOKEN_HERE';

// Exécuter
(async () => {
    try {
        const { db, auth } = await initFirebase();
        await testVerifyToken(token, db, auth);
        process.exit(0);
    } catch (error) {
        console.error('Erreur fatale:', error);
        process.exit(1);
    }
})();
