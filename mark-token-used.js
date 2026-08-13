#!/usr/bin/env node

/**
 * Script pour marquer un token de création de compte comme utilisé
 * Utile pour nettoyer le dashboard de monitoring après une réparation manuelle
 * Usage: node mark-token-used.js EMAIL
 */

const admin = require('firebase-admin');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
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
                const serviceAccount = require(serviceAccountPath);
                admin.initializeApp({
                    credential: admin.cert(serviceAccount),
                    projectId: PROJECT_ID,
                });
            } else {
                admin.initializeApp({
                    projectId: PROJECT_ID,
                });
            }
        }
        return { db: getFirestore() };
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
        process.exit(1);
    }
}

async function markTokenUsed(email) {
    if (!email) {
        console.error('❌ Erreur: Veuillez fournir un email');
        process.exit(1);
    }

    try {
        const { db } = await initFirebase();

        console.log(`\n🔍 Recherche du token non utilisé pour: ${email}`);

        const snapshot = await db.collection('registrationTokens')
            .where('email', '==', email.toLowerCase().trim())
            .where('used', '==', false)
            .get();

        if (snapshot.empty) {
            console.log('ℹ️  Aucun token non utilisé trouvé pour cet email.');
            return;
        }

        console.log(`✅ ${snapshot.size} token(s) trouvé(s). Marquage comme utilisé...`);

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                used: true,
                usedAt: FieldValue.serverTimestamp(),
                notes: 'Marqué comme utilisé manuellement (réparation compte effectuée)'
            });
        });

        await batch.commit();
        console.log('🚀 Opération terminée avec succès !');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

const emailArg = process.argv[2];
markTokenUsed(emailArg);
