#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const functionsPath = path.join(__dirname, '../functions');
const admin = require(path.join(functionsPath, 'node_modules/firebase-admin'));

const projectId = 'fluance-protected-content';
process.env.GCLOUD_PROJECT = projectId;
process.env.GOOGLE_CLOUD_QUOTA_PROJECT = projectId;
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId });

admin.initializeApp({ projectId });

const db = admin.firestore();
const auth = admin.auth();

const ALL_PRODUCTS = ['21jours', 'complet', 'sos-dos-cervicales'];

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password + '!';
}

async function createDemoAccount(email, password) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`\n=== Traitement pour: ${normalizedEmail} ===`);

    // Date de début dans le passé pour débloquer tout le contenu
    const startDate = new Date('2024-01-01');
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);

    // Créer ou récupérer l'utilisateur Firebase Auth
    let userRecord;
    let userId;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
      userId = userRecord.uid;
      console.log(`Utilisateur existant dans Firebase Auth: ${userId}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`Creation du compte utilisateur...`);
        userRecord = await auth.createUser({
          email: normalizedEmail,
          password: password,
          emailVerified: true,
        });
        userId = userRecord.uid;
        console.log(`Compte cree: ${userId}`);
      } else {
        throw error;
      }
    }

    // Préparer le tableau de produits
    const products = ALL_PRODUCTS.map(name => ({
      name: name,
      startDate: startTimestamp,
      purchasedAt: startTimestamp,
    }));

    // Créer/mettre à jour le document Firestore
    await db.collection('users').doc(userId).set({
      email: normalizedEmail,
      products: products,
      product: ALL_PRODUCTS[0],
      isDemo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      registrationDate: startTimestamp,
    }, { merge: true });

    console.log(`Produits configures: ${products.map(p => p.name).join(', ')}`);
    console.log(`Flag isDemo: true`);
    console.log(`Date de debut: ${startDate.toLocaleDateString('fr-FR')}`);
    console.log(`Compte demo cree avec succes!`);
    console.log(`Lien espace membre: https://fluance.io/membre/`);

    return { email: normalizedEmail, password, userId };
  } catch (error) {
    console.error(`Erreur pour ${email}:`, error.message);
    throw error;
  }
}

async function main() {
  const accounts = [
    { email: process.argv[2], password: process.argv[3] },
    { email: process.argv[4], password: process.argv[5] },
  ];

  if (!accounts[0].email || !accounts[1].email) {
    console.error('Usage: node scripts/create-demo-accounts.js <email1> <password1> <email2> <password2>');
    process.exit(1);
  }

  const results = [];
  for (const account of accounts) {
    const result = await createDemoAccount(account.email, account.password);
    results.push(result);
  }

  console.log('\n========================================');
  console.log('   Comptes de démonstration créés');
  console.log('========================================');
  for (const r of results) {
    console.log(`\nEmail: ${r.email}`);
    console.log(`Mot de passe: ${r.password}`);
    console.log(`UID: ${r.userId}`);
  }
}

main().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
