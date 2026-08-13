#!/usr/bin/env node

/**
 * Script de monitoring de l'automatisation des paiements
 * Affiche un tableau de bord de santé des dernières 24h
 * Usage: node monitor-automation.js [days]
 */

const admin = require('firebase-admin');
const {getFirestore} = require('firebase-admin/firestore');
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

async function monitorAutomation(days = 1) {
    try {
        const { db } = await initFirebase();

        const now = new Date();
        const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        console.log('\n' + '='.repeat(80));
        console.log(`📊 DASHBOARD DE MONITORING FLUANCE (Derniers ${days} jour(s))`);
        console.log('='.repeat(80));
        console.log(`Période: du ${startDate.toISOString()} au ${now.toISOString()}\n`);

        // 1. Récupérer les logs d'audit
        const auditSnapshot = await db.collection('audit_payments')
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp', 'desc')
            .get();

        const logs = auditSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Récupérer les tokens de création de compte
        const tokensSnapshot = await db.collection('registrationTokens')
            .where('createdAt', '>=', startDate)
            .get();

        const tokens = tokensSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 3. Synthèse
        console.log('📈 SYNTHÈSE DE L\'AUTOMATISATION');
        console.log('─'.repeat(80));
        console.log(`✅ Paiements détectés par le webhook:  ${logs.length}`);
        console.log(`🔑 Tokens de création générés:           ${tokens.length}`);

        const usedTokens = tokens.filter(t => t.used).length;
        const activationRate = tokens.length > 0 ? (usedTokens / tokens.length * 100).toFixed(1) : 0;

        console.log(`🚀 Taux d'activation des comptes:       ${activationRate}% (${usedTokens}/${tokens.length})`);

        // 4. Alertes (montants discordants)
        console.log('\n⚠️ ALERTES RÉCENTES');
        console.log('─'.repeat(80));

        const alerts = logs.filter(l => l.alert === true);
        if (alerts.length === 0) {
            console.log('✅ Aucune erreur de montant ou de cross-sell détectée.');
        } else {
            alerts.forEach(alert => {
                console.log(`🔴 [ALERTE] ${alert.email}: ${alert.amount} CHF payés vs ${alert.expectedAmount} attendus`);
                console.log(`   Session: ${alert.stripeSessionId}`);
            });
        }

        // 5. Dernières transactions
        console.log('\n🕒 10 DERNIÈRES TRANSACTIONS');
        console.log('─'.repeat(80));
        console.log('TIMESTAMP          | EMAIL                          | MONTANT | PRODUITS');
        console.log('─'.repeat(80));

        logs.slice(0, 10).forEach(log => {
            const ts = log.timestamp?.toDate().toISOString().substring(0, 16).replace('T', ' ');
            const email = log.email.padEnd(30).substring(0, 30);
            const amount = log.amount.toString().padStart(6) + ' CHF';
            const products = log.products ? log.products.join(', ') : log.product;
            console.log(`${ts} | ${email} | ${amount} | ${products}`);
        });

        // 6. Comptes non activés
        console.log('\n⌛ COMPTES EN ATTENTE D\'ACTIVATION (Tokens non utilisés)');
        console.log('─'.repeat(80));

        const pendingTokens = tokens.filter(t => !t.used);
        if (pendingTokens.length === 0) {
            console.log('✅ Tous les clients ont activé leur compte !');
        } else {
            pendingTokens.forEach(t => {
                const ts = t.createdAt?.toDate().toISOString().substring(0, 16).replace('T', ' ');
                console.log(`${ts} | ${t.email.padEnd(30)} | Produits: ${t.products ? t.products.join(', ') : t.product}`);
            });
        }

        console.log('\n' + '='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

const daysArg = process.argv[2] ? parseInt(process.argv[2]) : 1;
monitorAutomation(daysArg);
