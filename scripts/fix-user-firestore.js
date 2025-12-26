#!/usr/bin/env node

/**
 * Script pour corriger un compte utilisateur avec document Firestore manquant
 * Crée le document Firestore manquant avec les produits achetés
 * 
 * Usage: node scripts/fix-user-firestore.js <email> [product1] [product2] ...
 * Exemple: node scripts/fix-user-firestore.js user@example.com 21jours complet
 * 
 * Si aucun produit n'est spécifié, le script tentera de les détecter depuis Mailjet
 * (nécessite les variables d'environnement MAILJET_API_KEY et MAILJET_API_SECRET)
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
  process.exit(1);
}

// Initialiser Firebase Admin
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function fixUserAccount(email, productsFromArgs = []) {
  try {
    console.log(`🔍 Diagnostic et correction du compte: ${email}\n`);
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // 1. Vérifier Firebase Auth
    console.log('='.repeat(80));
    console.log('1. VÉRIFICATION FIREBASE AUTH');
    console.log('='.repeat(80));
    
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
      console.log(`✅ Utilisateur trouvé dans Firebase Auth`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Créé le: ${userRecord.metadata.creationTime}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error(`❌ Utilisateur non trouvé dans Firebase Auth`);
        console.error('   L\'utilisateur doit d\'abord créer son compte.');
        process.exit(1);
      }
      throw error;
    }
    
    const userId = userRecord.uid;
    
    // 2. Vérifier Firestore
    console.log('\n' + '='.repeat(80));
    console.log('2. VÉRIFICATION FIRESTORE');
    console.log('='.repeat(80));
    
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (userDoc.exists) {
      console.log(`✅ Document Firestore existe déjà`);
      const userData = userDoc.data();
      const existingProducts = userData.products || [];
      console.log(`   Produits actuels: ${existingProducts.map(p => p.name).join(', ') || 'aucun'}`);
      console.log('\n⚠️  Le document existe déjà. Aucune action nécessaire.');
      return;
    }
    
    console.log(`❌ Document Firestore manquant - création nécessaire`);
    
    // 3. Déterminer les produits
    console.log('\n' + '='.repeat(80));
    console.log('3. DÉTERMINATION DES PRODUITS');
    console.log('='.repeat(80));
    
    let detectedProducts = [];
    
    // Priorité 1 : Produits fournis en arguments
    if (productsFromArgs.length > 0) {
      detectedProducts = productsFromArgs.filter(p => 
        p === '21jours' || p === 'complet' || p === 'sos-dos-cervicales'
      );
      console.log(`✅ Produits fournis en arguments: ${detectedProducts.join(', ')}`);
    } else {
      // Priorité 2 : Détection depuis Mailjet
      console.log('⚠️  Aucun produit fourni en argument, tentative de détection depuis Mailjet...');
      
      const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
      const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;
      
      if (MAILJET_API_KEY && MAILJET_API_SECRET) {
        try {
          const https = require('https');
          const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');
          const contactDataUrl = `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(normalizedEmail)}`;
          
          const response = await new Promise((resolve, reject) => {
            const req = https.request(contactDataUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${auth}`,
              },
            }, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                if (res.statusCode === 200) {
                  try {
                    resolve(JSON.parse(data));
                  } catch (e) {
                    reject(e);
                  }
                } else if (res.statusCode === 404) {
                  resolve(null);
                } else {
                  reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
              });
            });
            req.on('error', reject);
            req.end();
          });
          
          if (response && response.Data && response.Data.length > 0) {
            const contactProperties = response.Data[0].Data || {};
            let properties = {};
            
            if (Array.isArray(contactProperties)) {
              contactProperties.forEach((item) => {
                if (item.Name && item.Value !== undefined) {
                  properties[item.Name] = item.Value;
                }
              });
            } else {
              properties = contactProperties;
            }
            
            const produitsAchetes = properties.produits_achetes || '';
            if (produitsAchetes) {
              detectedProducts = produitsAchetes.split(',')
                .map((p) => p.trim())
                .filter((p) => p && (p === '21jours' || p === 'complet' || p === 'sos-dos-cervicales'));
              console.log(`✅ Produits détectés depuis Mailjet: ${detectedProducts.join(', ')}`);
            } else {
              console.log('⚠️  Aucun produit trouvé dans Mailjet');
            }
          } else {
            console.log('⚠️  Contact non trouvé dans Mailjet');
          }
        } catch (mailjetError) {
          console.warn(`⚠️  Impossible de récupérer les produits depuis Mailjet: ${mailjetError.message}`);
        }
      } else {
        console.log('⚠️  Variables d\'environnement MAILJET_API_KEY et MAILJET_API_SECRET non définies');
      }
    }
    
    // Priorité 3 : Produit par défaut
    if (detectedProducts.length === 0) {
      detectedProducts = ['21jours'];
      console.log(`⚠️  Aucun produit détecté, utilisation de '21jours' par défaut`);
    }
    
    // 4. Créer le document Firestore
    console.log('\n' + '='.repeat(80));
    console.log('4. CRÉATION DU DOCUMENT FIRESTORE');
    console.log('='.repeat(80));
    
    const now = admin.firestore.Timestamp.now();
    const productsArray = detectedProducts.map((prod) => ({
      name: prod,
      startDate: now,
      purchasedAt: now,
    }));
    
    const userData = {
      email: normalizedEmail,
      products: productsArray,
      product: detectedProducts[0], // Garder pour compatibilité (premier produit)
      createdAt: now,
      updatedAt: now,
    };
    
    // Pour le produit "21jours", ajouter aussi registrationDate pour compatibilité
    if (detectedProducts.includes('21jours')) {
      userData.registrationDate = now;
    }
    
    await userDocRef.set(userData);
    
    console.log(`✅ Document Firestore créé avec succès!`);
    console.log(`   Produits ajoutés: ${detectedProducts.join(', ')}`);
    console.log(`   Date de démarrage: maintenant (accès immédiat)`);
    
    // 5. Vérification finale
    console.log('\n' + '='.repeat(80));
    console.log('5. VÉRIFICATION FINALE');
    console.log('='.repeat(80));
    
    const verifyDoc = await userDocRef.get();
    if (verifyDoc.exists) {
      const verifyData = verifyDoc.data();
      console.log(`✅ Document vérifié`);
      console.log(`   Email: ${verifyData.email}`);
      console.log(`   Produits: ${verifyData.products.map(p => p.name).join(', ')}`);
    } else {
      console.error(`❌ Erreur: Le document n'a pas été créé correctement`);
      process.exit(1);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ CORRECTION TERMINÉE AVEC SUCCÈS');
    console.log('='.repeat(80));
    console.log(`\nL'utilisateur ${email} devrait maintenant pouvoir accéder à son espace membre.`);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('❌ Erreur: Veuillez fournir un email');
  console.log('\nUsage: node scripts/fix-user-firestore.js <email> [product1] [product2] ...');
  console.log('\nExemples:');
  console.log('  node scripts/fix-user-firestore.js user@example.com');
  console.log('  node scripts/fix-user-firestore.js user@example.com 21jours complet');
  console.log('\nProduits valides: 21jours, complet, sos-dos-cervicales');
  process.exit(1);
}

const email = args[0];
const products = args.slice(1);

// Valider les produits si fournis
const validProducts = ['21jours', 'complet', 'sos-dos-cervicales'];
if (products.length > 0) {
  const invalidProducts = products.filter(p => !validProducts.includes(p));
  if (invalidProducts.length > 0) {
    console.error(`❌ Produits invalides: ${invalidProducts.join(', ')}`);
    console.error(`   Produits valides: ${validProducts.join(', ')}`);
    process.exit(1);
  }
}

// Exécuter
fixUserAccount(email, products)
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
