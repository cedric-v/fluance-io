#!/usr/bin/env node
/**
 * Script pour vérifier si un email a déjà été envoyé à un contact
 * en consultant la collection contentEmailsSent dans Firestore.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
 *   export GCLOUD_PROJECT="your-project-id"
 *   node scripts/check-email-sent-status.js email1@example.com email2@example.com
 */

const admin = require('firebase-admin');

const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GCLOUD_PROJECT = process.env.GCLOUD_PROJECT;

if (!GOOGLE_APPLICATION_CREDENTIALS || !GCLOUD_PROJECT) {
  console.error('❌ Erreur: GOOGLE_APPLICATION_CREDENTIALS et GCLOUD_PROJECT doivent être définis');
  process.exit(1);
}

const emails = process.argv.slice(2);

if (emails.length === 0) {
  console.error('Usage: node scripts/check-email-sent-status.js email1@example.com email2@example.com');
  process.exit(1);
}

// Initialiser Firebase Admin
try {
  const serviceAccount = require(GOOGLE_APPLICATION_CREDENTIALS);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: GCLOUD_PROJECT,
  });
} catch (error) {
  console.error('❌ Erreur lors de l\'initialisation de Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function checkEmailStatus(email) {
  console.log(`\n📧 Vérification de ${email}...`);
  console.log('─'.repeat(60));

  const normalizedEmail = email.toLowerCase().trim();
  const emailSentDocId = `marketing_2pratiques_to_5jours_${normalizedEmail}`;

  try {
    const emailSentDoc = await db.collection('contentEmailsSent')
        .doc(emailSentDocId).get();

    if (emailSentDoc.exists) {
      const data = emailSentDoc.data();
      console.log('✅ Email DÉJÀ ENVOYÉ');
      console.log('📋 Détails:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n⚠️  L\'email ne sera pas renvoyé car le document existe déjà.');
    } else {
      console.log('❌ Email PAS ENCORE ENVOYÉ');
      console.log(`📋 Document ID recherché: ${emailSentDocId}`);
      console.log('\n✅ L\'email sera envoyé lors de la prochaine exécution de la fonction.');
    }
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 Vérification du statut d\'envoi des emails marketing\n');

  for (const email of emails) {
    await checkEmailStatus(email);
  }

  console.log('\n✅ Vérification terminée');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
