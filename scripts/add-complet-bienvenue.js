#!/usr/bin/env node
/**
 * Ajoute ou met à jour le contenu "Bienvenue" pour l'approche Fluance complète.
 *
 * Prérequis :
 * - GOOGLE_APPLICATION_CREDENTIALS pointe vers un service account JSON
 *   autorisé sur le projet fluance-protected-content.
 */
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function main() {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const contentHtml = `<div><p>​​​​​​​C'est le moment de vous présenter brièvement en commentaire.</p>
<p>Je vous invite à également répondre à ces 2 questions :</p>
<ol>
<li>Qu'est-ce qui vous a motivé à rejoindre Fluance ?</li>
<li>Quels sont vos souhaits et attentes ?</li>
</ol>
</div>`;

  await db.collection('protectedContent').doc('complet-bienvenue').set({
    product: 'complet',
    type: 'welcome',
    title: 'Bienvenue',
    content: contentHtml,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  console.log('✅ Contenu "Bienvenue" ajouté/à jour : protectedContent/complet-bienvenue');
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
