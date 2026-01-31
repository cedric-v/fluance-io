#!/usr/bin/env node

/**
 * Script pour réparer le document Firestore d'un utilisateur
 * Usage: node repair-user-document.js EMAIL PRODUCT1 [PRODUCT2] ...
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

async function repairUserDocument(email, products, db, auth) {
    try {
        const emailLower = email.toLowerCase().trim();
        console.log(`\n🔧 Réparation du document Firestore pour: ${emailLower}\n`);

        // 1. Vérifier que l'utilisateur existe dans Firebase Auth
        console.log('='.repeat(80));
        console.log('1. VÉRIFICATION DANS FIREBASE AUTHENTICATION');
        console.log('='.repeat(80));

        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(emailLower);
            console.log('✅ Utilisateur trouvé dans Firebase Authentication');
            console.log('─'.repeat(80));
            console.log(`   UID: ${userRecord.uid}`);
            console.log(`   Email: ${userRecord.email}`);
            console.log(`   Email vérifié: ${userRecord.emailVerified ? 'Oui' : 'Non'}`);
            console.log(`   Créé le: ${userRecord.metadata.creationTime}`);
            console.log('');
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log('❌ Utilisateur NON trouvé dans Firebase Authentication');
                console.log('   L\'utilisateur doit d\'abord créer son compte');
                return;
            }
            throw error;
        }

        const userId = userRecord.uid;

        // 2. Vérifier si le document Firestore existe
        console.log('='.repeat(80));
        console.log('2. VÉRIFICATION DU DOCUMENT FIRESTORE');
        console.log('='.repeat(80));

        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            console.log('⚠️  Le document Firestore existe déjà');
            const userData = userDoc.data();
            console.log('─'.repeat(80));
            console.log(`   Produits actuels: ${userData.products ? userData.products.map(p => p.name).join(', ') : userData.product}`);
            console.log('');
            console.log('💡 Si vous voulez ajouter des produits, utilisez plutôt:');
            console.log(`   node add-product-to-user.js ${emailLower} ${products.join(' ')}`);
            return;
        }

        console.log('✅ Le document Firestore n\'existe pas (va être créé)');
        console.log('');

        // 3. Créer le document Firestore
        console.log('='.repeat(80));
        console.log('3. CRÉATION DU DOCUMENT FIRESTORE');
        console.log('='.repeat(80));

        const now = new Date();

        const productsArray = products.map(productName => ({
            name: productName,
            startDate: now,
            purchasedAt: now,
        }));

        const userData = {
            email: emailLower,
            products: productsArray,
            product: products[0], // Premier produit pour compatibilité
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Pour le produit "21jours", ajouter registrationDate
        if (products.includes('21jours')) {
            userData.registrationDate = admin.firestore.FieldValue.serverTimestamp();
        }

        await userDocRef.set(userData);

        console.log('✅ Document Firestore créé avec succès !');
        console.log('─'.repeat(80));
        console.log(`   UID: ${userId}`);
        console.log(`   Email: ${emailLower}`);
        console.log(`   Produits: ${products.join(', ')}`);
        console.log('');

        // 4. Vérifier que le document a bien été créé
        const verifyDoc = await userDocRef.get();
        if (!verifyDoc.exists) {
            console.log('❌ ERREUR: Le document n\'a pas été créé');
            return;
        }

        console.log('✅ Vérification: Le document existe bien dans Firestore');
        console.log('');

        // 5. Résumé
        console.log('='.repeat(80));
        console.log('4. RÉSUMÉ');
        console.log('='.repeat(80));

        console.log('✅ Le compte de Véronique est maintenant complet !');
        console.log('');
        console.log('📋 Elle peut maintenant:');
        console.log('─'.repeat(80));
        console.log('1. Se connecter sur https://fluance.io/connexion');
        console.log(`2. Utiliser son email: ${emailLower}`);
        console.log('3. Utiliser le mot de passe qu\'elle a choisi lors de la création');
        console.log('4. Accéder à ses programmes:');
        products.forEach((product, index) => {
            console.log(`   ${index + 1}. ${product}`);
        });
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
    console.log('Usage: node repair-user-document.js EMAIL PRODUCT1 [PRODUCT2] ...');
    console.log('');
    console.log('Exemple: node repair-user-document.js veronique.corminboeuf@bluewin.ch 21jours sos-dos-cervicales');
    process.exit(1);
}

const email = args[0];
const products = args.slice(1);

// Exécuter
(async () => {
    try {
        const { db, auth } = await initFirebase();
        await repairUserDocument(email, products, db, auth);
        process.exit(0);
    } catch (error) {
        console.error('Erreur fatale:', error);
        process.exit(1);
    }
})();
