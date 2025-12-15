#!/usr/bin/env node
/**
 * Ajoute ou écrase le contenu "SOS dos & cervicales" dans Firestore.
 *
 * Prérequis :
 * - GOOGLE_APPLICATION_CREDENTIALS pointe vers un service account JSON
 *   autorisé sur le projet (fluance-protected-content).
 * - Le projet par défaut de la cred est correct.
 */
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function main() {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const contentHtml = `<div>La vidéo est en cours de préparation ; elle va être ajoutée sous peu. À très vite.</div>`;

  await db.collection('protectedContent').doc('sos-dos-cervicales').set({
    product: 'sos-dos-cervicales',
    title: 'SOS dos & cervicales',
    content: contentHtml,
    createdAt: now,
    updatedAt: now,
  });

  console.log('✅ Contenu ajouté/écrasé : protectedContent/sos-dos-cervicales');
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
