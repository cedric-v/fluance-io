#!/usr/bin/env node

/**
 * Script pour importer le contenu du produit "complet" dans Firestore
 * 
 * Usage:
 *   1. Configurer le chemin vers serviceAccountKey.json (ligne 20)
 *   2. Exécuter: node scripts/import-complet-content.js
 */

const fs = require('fs');
const path = require('path');

// Utiliser firebase-admin depuis functions/node_modules
const functionsPath = path.join(__dirname, '../functions');
const admin = require(path.join(functionsPath, 'node_modules/firebase-admin'));

// ⚠️ IMPORTANT: Configurez le chemin vers votre fichier serviceAccountKey.json
// Téléchargez-le depuis Firebase Console > Project Settings > Service Accounts
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
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Contenu du produit "complet"
 * Structure: { week, title, content }
 * week: 0 = bonus (accessible immédiatement), 1-14 = semaines
 */
const completContent = [
  {
    week: 0,
    title: 'Bonus : 3 minutes pour soulager votre dos, vous ancrer et retrouver plus d\'énergie',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/af636eae-8b09-4d28-9b7c-8233d6f86b67?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 1,
    title: 'Ancrage et apaisement',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/479894/a91caa5f-2582-44cf-b027-01c8ac0dc1f8?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 2,
    title: 'Libérer le dos',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/8f0a7b86-48a1-4d4a-8fdd-7d4868b726ca?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 3,
    title: 'Auto-massages',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/479894/9db9bb12-a932-482a-8c7b-2d490fecb978?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 4,
    title: 'Libérer les hanches',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/d3022f8d-fed8-452b-9ec2-13e8b21315db?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 5,
    title: 'Jambes fluides',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/c2ee806c-d51a-40fb-9a43-13d6f6711665?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 6,
    title: 'Bras souples et mobiles',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/278c9314-7cfa-4a2b-babe-8cf0b082d8ee?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 7,
    title: 'Le mouvement part des hanches',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/00cd814d-a659-4edc-8bf7-aa8c67271aad?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 8,
    title: 'Équilibre et se sentir bien debout',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/469740b7-e6a9-4ab1-aad7-394ca453fe2d?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  },
  {
    week: 9,
    title: 'Suivre vos ressentis',
    content: `<div style="position:relative;padding-top:56.25%;"><iframe src="https://player.mediadelivery.net/embed/479894/40ba5583-46ce-40ef-b786-776850a2edd5?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>`
  }
];

async function importCompletContent() {
  console.log('🚀 Début de l\'import du contenu "complet"...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const item of completContent) {
    try {
      // Générer un ID unique pour le document
      const docId = `complet-week-${item.week}`;

      // Vérifier si le document existe déjà
      const existingDoc = await db.collection('protectedContent').doc(docId).get();
      
      if (existingDoc.exists) {
        console.log(`⚠️  Document ${docId} existe déjà. Mise à jour...`);
      }

      // Préparer les données
      const data = {
        product: 'complet',
        week: item.week,
        title: item.title,
        content: item.content,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Créer ou mettre à jour le document
      await db.collection('protectedContent').doc(docId).set(data, { merge: true });

      const action = existingDoc.exists ? 'mis à jour' : 'créé';
      console.log(`✅ ${action}: ${docId} - ${item.title} (semaine ${item.week})`);
      successCount++;

    } catch (error) {
      console.error(`❌ Erreur pour semaine ${item.week} (${item.title}):`, error.message);
      errorCount++;
    }
  }

  console.log('\n📊 Résumé:');
  console.log(`   ✅ Succès: ${successCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  console.log(`   📦 Total: ${completContent.length} contenus`);
  
  if (errorCount === 0) {
    console.log('\n🎉 Import terminé avec succès!');
  } else {
    console.log('\n⚠️  Import terminé avec des erreurs.');
    process.exit(1);
  }
}

// Exécuter l'import
importCompletContent()
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
