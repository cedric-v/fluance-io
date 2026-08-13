#!/usr/bin/env node

/**
 * Script pour mettre à jour le jour 22 (bonus) du produit 21jours dans Firestore
 * Ajoute les liens de continuation du parcours sous le contenu existant
 * 
 * Usage:
 *   node scripts/update-21jours-day-22.js
 * 
 * Prérequis:
 *   - Avoir le fichier serviceAccountKey.json dans functions/
 *   - Télécharger depuis Firebase Console > Project Settings > Service Accounts
 */

const fs = require('fs');
const path = require('path');

// Utiliser firebase-admin depuis functions/node_modules
const functionsPath = path.join(__dirname, '../functions');
const admin = require(path.join(functionsPath, 'node_modules/firebase-admin'));

// ⚠️ IMPORTANT: Configurez le chemin vers votre fichier serviceAccountKey.json
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../functions/serviceAccountKey.json');

// Vérifier que le fichier serviceAccount existe
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ Erreur: serviceAccountKey.json introuvable');
  console.error(`   Chemin attendu: ${SERVICE_ACCOUNT_PATH}`);
  console.error('\n   Pour obtenir le fichier:');
  console.error('   1. Allez sur Firebase Console > Project Settings > Service Accounts');
  console.error('   2. Cliquez sur "Generate new private key"');
  console.error('   3. Enregistrez le fichier JSON dans functions/serviceAccountKey.json');
  process.exit(1);
}

// Initialiser Firebase Admin
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

console.log('✅ Firebase Admin initialisé avec service account');

const db = getFirestore();

// Contenu à ajouter sous la vidéo du jour 22
const additionalContent = `
<div class="mt-8 space-y-4">
  <h3 class="text-xl font-semibold mb-4">Pour continuer votre parcours :</h3>
  <ul class="space-y-3">
    <li>
      <a href="/presentiel/prochains-stages/" class="text-fluance hover:underline font-medium">
        → Découvrir les stages en présentiel
      </a>
    </li>
    <li data-hide-if-product="complet">
      <a href="/cours-en-ligne/approche-fluance-complete/" class="text-fluance hover:underline font-medium">
        → Rejoindre l'approche Fluance complète (14 jours offerts)
      </a>
    </li>
  </ul>
</div>`;

async function updateDay22() {
  try {
    console.log('📝 Début de la mise à jour du jour 22...\n');

    const docId = '21jours-jour-22';
    const docRef = db.collection('protectedContent').doc(docId);

    // Récupérer le document existant
    const existingDoc = await docRef.get();
    
    if (!existingDoc.exists) {
      console.error(`❌ Le document ${docId} n'existe pas dans Firestore.`);
      console.error('   Veuillez d\'abord créer le document jour 22 dans Firebase Console.');
      process.exit(1);
    }

    const existingData = existingDoc.data();
    let currentContent = existingData.content || '';

    // Si le contenu supplémentaire existe déjà, le remplacer
    if (currentContent.includes('Pour continuer votre parcours')) {
      console.log(`⚠️  Le contenu supplémentaire est déjà présent dans ${docId}.`);
      console.log('   Remplacement du contenu existant avec la version conditionnelle...');
      
      // Supprimer l'ancien contenu supplémentaire (tout ce qui vient après la vidéo)
      // On cherche la fin de la vidéo (fermeture de la div avec padding-top:56.25%)
      const videoEndRegex = /<\/div>\s*(?=<div class="mt-8|$)/;
      const match = currentContent.match(videoEndRegex);
      if (match) {
        // Garder seulement le contenu jusqu'à la fin de la vidéo
        currentContent = currentContent.substring(0, match.index + match[0].length);
      } else {
        // Si on ne trouve pas la fin de la vidéo, supprimer tout ce qui contient "Pour continuer"
        const continuationIndex = currentContent.indexOf('Pour continuer votre parcours');
        if (continuationIndex !== -1) {
          currentContent = currentContent.substring(0, continuationIndex).trim();
        }
      }
    }

    // Ajouter le contenu supplémentaire à la fin du contenu existant
    const updatedContent = currentContent + additionalContent;

    // Mettre à jour le document
    await docRef.update({
      content: updatedContent,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Document ${docId} mis à jour avec succès`);
    console.log(`   - Titre: ${existingData.title || 'Bonus (jour 22)'}`);
    console.log(`   - Contenu supplémentaire ajouté sous la vidéo`);

    console.log('\n✅ Mise à jour terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du jour 22:', error);
    process.exit(1);
  }
}

// Exécuter le script
updateDay22()
    .then(() => {
      console.log('\n✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
