#!/usr/bin/env node

/**
 * Script pour mettre à jour le contenu "SOS dos & cervicales" dans Firestore
 * 
 * Usage:
 *   node scripts/update-sos-dos-cervicales.js
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

// Vidéo de contenu
const videoContent = `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/1088cfc3-2795-4052-a395-c526080cf8e6?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`;

// Contenu supplémentaire au-dessus des commentaires (avec attributs data pour affichage conditionnel)
const additionalContent = `
<div class="mt-8 space-y-4" data-continuation-links>
  <h3 class="text-xl font-semibold mb-4">Pour continuer votre parcours :</h3>
  <ul class="space-y-3">
    <li>
      <a href="/presentiel/prochains-stages/" class="text-fluance hover:underline font-medium">
        → Découvrir les stages en présentiel
      </a>
    </li>
    <li data-hide-if-product="21jours">
      <a href="/cours-en-ligne/21-jours-mouvement/" class="text-fluance hover:underline font-medium">
        → Rejoindre le défi "21 jours pour remettre du mouvement"
      </a>
    </li>
    <li data-hide-if-product="complet">
      <a href="/cours-en-ligne/approche-fluance-complete/" class="text-fluance hover:underline font-medium">
        → Rejoindre l'approche Fluance complète (14 jours offerts)
      </a>
    </li>
  </ul>
</div>`;

// Texte personnalisé pour les commentaires
const commentText = 'Partagez ici votre état de fluidité et de détente corporelle entre 0 et 10, avant la pratique et après (exemple : 3 -> 7) et les bienfaits constatés\n(0 étant le pire, 10 le meilleur)';

async function updateSosDosCervicales() {
  try {
    console.log('📝 Début de la mise à jour du contenu SOS dos & cervicales...\n');

    const docId = 'sos-dos-cervicales';
    const docRef = db.collection('protectedContent').doc(docId);

    // Construire le contenu complet (vidéo + contenu supplémentaire)
    const fullContent = videoContent + additionalContent;

    // Vérifier si le document existe déjà
    const existingDoc = await docRef.get();
    
    if (existingDoc.exists) {
      console.log(`⚠️  Le document ${docId} existe déjà. Mise à jour...`);
      
      // Mettre à jour le document existant
      await docRef.update({
        product: 'sos-dos-cervicales', // S'assurer que le champ product est correct
        content: fullContent,
        commentText: commentText,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Document ${docId} mis à jour avec succès`);
    } else {
      // Créer le nouveau document
      await docRef.set({
        product: 'sos-dos-cervicales',
        title: 'SOS dos & cervicales',
        content: fullContent,
        commentText: commentText,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Document ${docId} créé avec succès`);
    }

    console.log('\n✅ Mise à jour terminée avec succès !');
    console.log('   - Vidéo ajoutée');
    console.log('   - Liens de continuation ajoutés (avec affichage conditionnel)');
    console.log('   - Texte personnalisé pour les commentaires ajouté');

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
    process.exit(1);
  }
}

// Exécuter le script
updateSosDosCervicales()
    .then(() => {
      console.log('\n✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
