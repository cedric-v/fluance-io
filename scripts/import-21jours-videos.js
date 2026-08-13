#!/usr/bin/env node

/**
 * Script pour importer les vidéos du cours "21 jours" dans Firestore
 * 
 * Usage:
 *   1. Remplir le fichier 21jours-videos-data.json avec les titres et codes embed
 *   2. Configurer le chemin vers serviceAccountKey.json (ligne 20)
 *   3. Exécuter: node scripts/import-21jours-videos.js
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
  credential: admin.cert(serviceAccount)
});

const db = getFirestore();

// Charger les données depuis le fichier (JSON ou TXT)
const DATA_FILE_JSON = path.join(__dirname, '21jours-videos-data.json');
const DATA_FILE_TXT = path.join(__dirname, '21jours-videos-data.txt');

let videosData = [];

// Essayer d'abord le format texte simple (plus facile à éditer)
if (fs.existsSync(DATA_FILE_TXT)) {
  console.log('📄 Lecture du fichier texte simple...');
  videosData = parseTextFile(DATA_FILE_TXT);
} else if (fs.existsSync(DATA_FILE_JSON)) {
  console.log('📄 Lecture du fichier JSON...');
  videosData = JSON.parse(fs.readFileSync(DATA_FILE_JSON, 'utf8'));
} else {
  console.error(`❌ Erreur: Aucun fichier de données trouvé`);
  console.error(`   Cherché: ${DATA_FILE_TXT} ou ${DATA_FILE_JSON}`);
  process.exit(1);
}

/**
 * Parse le fichier texte simple au format:
 * === JOUR X ===
 * TITRE: Titre
 * EMBED:
 * [code HTML]
 * ===
 */
function parseTextFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const videos = [];
  
  // Diviser par les séparateurs === JOUR X ===
  const sections = content.split(/=== JOUR (\d+) ===/);
  
  // Ignorer le premier élément (tout avant le premier JOUR)
  for (let i = 1; i < sections.length; i += 2) {
    const day = parseInt(sections[i], 10);
    const sectionContent = sections[i + 1] || '';
    
    // Extraire le titre (ligne TITRE: ...)
    const titleMatch = sectionContent.match(/TITRE:\s*(.+?)(?:\n|$)/i);
    if (!titleMatch) continue;
    
    const title = titleMatch[1].trim();
    
    // Extraire le code embed (tout après EMBED: jusqu'au COMMENT_TEXT: ou === ou fin)
    const embedMatch = sectionContent.match(/EMBED:\s*([\s\S]*?)(?=\nCOMMENT_TEXT:|\n===|$)/i);
    if (!embedMatch) continue;
    
    let embedCode = embedMatch[1].trim();
    
    // Nettoyer : supprimer les lignes vides au début/fin
    embedCode = embedCode.replace(/^\s+|\s+$/g, '');
    
    // Ignorer si c'est le placeholder
    if (embedCode.includes('[Collez ici le code embed]') || !embedCode) {
      continue;
    }
    
    // Extraire le texte personnalisé pour les commentaires (optionnel)
    const commentTextMatch = sectionContent.match(/COMMENT_TEXT:\s*([\s\S]*?)(?=\n===|$)/i);
    let commentText = null;
    if (commentTextMatch) {
      commentText = commentTextMatch[1].trim();
      // Nettoyer : supprimer les lignes vides au début/fin
      commentText = commentText.replace(/^\s+|\s+$/g, '');
      if (!commentText || commentText.length === 0) {
        commentText = null;
      }
    }
    
    videos.push({
      day: day,
      title: title,
      embedCode: embedCode,
      commentText: commentText
    });
  }
  
  return videos;
}

/**
 * Génère le HTML formaté pour une vidéo
 */
function generateVideoHTML(title, embedCode) {
  // Nettoyer le code embed (supprimer les espaces en début/fin)
  const cleanEmbed = embedCode.trim();
  
  // Vérifier si c'est déjà un iframe complet ou juste un ID YouTube
  let iframeCode = cleanEmbed;
  
  // Si c'est juste un ID YouTube (format: VIDEO_ID ou https://youtube.com/watch?v=VIDEO_ID)
  if (!cleanEmbed.includes('<iframe') && !cleanEmbed.includes('<embed')) {
    // Extraire l'ID si c'est une URL
    let videoId = cleanEmbed;
    if (cleanEmbed.includes('youtube.com/watch?v=')) {
      videoId = cleanEmbed.split('v=')[1].split('&')[0];
    } else if (cleanEmbed.includes('youtu.be/')) {
      videoId = cleanEmbed.split('youtu.be/')[1].split('?')[0];
    }
    
    // Générer l'iframe YouTube
    iframeCode = `<iframe 
      width="560" 
      height="315" 
      src="https://www.youtube.com/embed/${videoId}" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen>
    </iframe>`;
  }
  
  return `<div class="protected-video-content">
  <h2 class="text-2xl md:text-3xl font-semibold text-fluance mb-6">${title}</h2>
  
  <div class="video-container mb-8" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
    ${iframeCode}
  </div>
  
  <style>
    .video-container iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  </style>
</div>`;
}

/**
 * Importe une vidéo dans Firestore
 */
async function importVideo(videoData) {
  const { day, title, embedCode, commentText } = videoData;
  
  // Vérifier que les données sont complètes
  if (day === undefined || !title || !embedCode || embedCode === 'COLLER_LE_CODE_EMBED_ICI') {
    console.warn(`⚠️  Jour ${day}: Données incomplètes, ignoré`);
    return false;
  }
  
  const docId = `21jours-jour-${day}`;
  const docRef = db.collection('protectedContent').doc(docId);
  
  // Générer le HTML
  const htmlContent = generateVideoHTML(title, embedCode);
  
  // Préparer les données
  const data = {
    product: '21jours',
    day: day,
    title: title,
    content: htmlContent
  };
  
  // Ajouter le texte personnalisé pour les commentaires si fourni
  if (commentText) {
    data.commentText = commentText;
  }
  
  try {
    // Vérifier si le document existe déjà
    const doc = await docRef.get();
    
    if (doc.exists) {
      // Mettre à jour le document existant
      await docRef.update(data);
      console.log(`✅ Mis à jour : ${docId} - ${title}`);
    } else {
      // Créer un nouveau document
      await docRef.set(data);
      console.log(`✅ Créé : ${docId} - ${title}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Erreur pour ${docId}:`, error.message);
    return false;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de l\'import des vidéos 21 jours...\n');
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (const videoData of videosData) {
    const result = await importVideo(videoData);
    
    if (result === true) {
      successCount++;
    } else if (result === false && (videoData.embedCode === 'COLLER_LE_CODE_EMBED_ICI' || !videoData.embedCode)) {
      skippedCount++;
    } else {
      errorCount++;
    }
    
    // Petite pause pour éviter de surcharger Firestore
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Résumé:');
  console.log(`   ✅ Créés/Mis à jour: ${successCount}`);
  console.log(`   ⚠️  Ignorés (données manquantes): ${skippedCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  
  if (successCount > 0) {
    console.log('\n✅ Import terminé avec succès !');
  } else {
    console.log('\n⚠️  Aucune vidéo n\'a été importée. Vérifiez le fichier JSON.');
  }
}

// Exécuter le script
main()
  .then(() => {
    console.log('\n👋 Terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
