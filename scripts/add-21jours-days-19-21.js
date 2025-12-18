#!/usr/bin/env node

/**
 * Script pour ajouter les jours 19, 20 et 21 du produit 21jours dans Firestore
 * 
 * Usage:
 *   node scripts/add-21jours-days-19-21.js
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
  credential: admin.credential.cert(serviceAccount),
});

console.log('✅ Firebase Admin initialisé avec service account');

const db = admin.firestore();

// Contenu des jours 19, 20 et 21
const daysContent = [
  {
    day: 19,
    title: 'Détente mâchoire-hanches',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/ab7fe1fd-5042-4948-96e1-7f54a61f6a46?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`,
  },
  {
    day: 20,
    title: 'Secousses libératrices',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/d44e0e3f-cd1c-4c6e-9363-7c72cd1712b5?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`,
  },
  {
    day: 21,
    title: 'Joie de bouger et bilan',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/d761bc2c-d6f3-41e1-85b7-244810a754b2?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>
<div class="mt-8 space-y-4">
  <p class="mb-4">
    <a href="/membre/" data-load-content="21jours-jour-0" class="text-fluance hover:underline font-medium">
      → Voir la page du bilan de départ (Déroulé / bien démarrer)
    </a>
  </p>
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
</div>`,
    commentText: 'Bilan après les 21 pratiques :\npartagez ici votre état de fluidité et de détente corporelle entre 0 et 10\n(0 étant le pire, 10 le meilleur)',
  },
];

async function addDaysToFirestore() {
  try {
    console.log('📝 Début de l\'ajout des jours 19, 20 et 21...\n');

    for (const dayData of daysContent) {
      const docId = `21jours-jour-${dayData.day}`;
      const docRef = db.collection('protectedContent').doc(docId);

      // Vérifier si le document existe déjà
      const existingDoc = await docRef.get();
      
      // Préparer les données à sauvegarder
      const documentData = {
        product: '21jours',
        day: dayData.day,
        title: dayData.title,
        content: dayData.content,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      // Ajouter commentText si présent (pour le jour 21)
      if (dayData.commentText) {
        documentData.commentText = dayData.commentText;
      }
      
      if (existingDoc.exists) {
        console.log(`⚠️  Le document ${docId} existe déjà. Mise à jour...`);
        
        // Mettre à jour le document existant (sans createdAt)
        await docRef.update(documentData);
        console.log(`✅ Document ${docId} mis à jour avec succès`);
      } else {
        // Créer le nouveau document (avec createdAt)
        documentData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        await docRef.set(documentData);
        console.log(`✅ Document ${docId} créé avec succès`);
      }

      console.log(`   - Jour ${dayData.day}: ${dayData.title}`);
    }

    console.log('\n✅ Tous les jours ont été ajoutés/mis à jour avec succès !');
    console.log('\n📋 Résumé:');
    console.log('   - Jour 19: Détente mâchoire-hanches');
    console.log('   - Jour 20: Secousses libératrices');
    console.log('   - Jour 21: Joie de bouger et bilan');

  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des jours:', error);
    process.exit(1);
  }
}

// Exécuter le script
addDaysToFirestore()
    .then(() => {
      console.log('\n✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
