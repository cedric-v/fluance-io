#!/usr/bin/env node

/**
 * Script pour vérifier un utilisateur dans Firestore
 * Usage: node check-user-firestore.js EMAIL
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ID = 'fluance-protected-content';

// Initialiser Firebase Admin
async function initFirebase() {
  try {
    if (admin.apps.length === 0) {
      const possiblePaths = [
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        path.join(__dirname, 'new-project-service-account.json'),
        path.join(__dirname, 'fluance-protected-content-service-account.json'),
        path.join(__dirname, 'functions', 'serviceAccountKey.json'),
      ].filter(Boolean);

      let serviceAccountPath = null;
      for (const possiblePath of possiblePaths) {
        if (possiblePath && fs.existsSync(possiblePath)) {
          serviceAccountPath = possiblePath;
          break;
        }
      }

      if (serviceAccountPath) {
        console.log(`📁 Utilisation du service account : ${serviceAccountPath}`);
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: PROJECT_ID,
        });
      } else {
        console.log('📁 Utilisation des credentials par défaut (Firebase CLI)');
        admin.initializeApp({
          projectId: PROJECT_ID,
        });
      }
    }
    return { db: admin.firestore(), auth: admin.auth() };
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Firebase:', error.message);
    console.log('\n💡 Assurez-vous que :');
    console.log('   1. Firebase CLI est installé : npm install -g firebase-tools');
    console.log('   2. Vous êtes connecté : firebase login');
    console.log('   3. Vous avez les permissions sur le projet');
    process.exit(1);
  }
}

async function checkUser(email, db, auth) {
  try {
    console.log(`\n🔍 Vérification de l'utilisateur: ${email}\n`);
    
    // 1. Vérifier dans Firebase Authentication
    console.log('='.repeat(80));
    console.log('1. FIREBASE AUTHENTICATION');
    console.log('='.repeat(80));
    
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
      console.log('✅ Utilisateur trouvé dans Firebase Authentication');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Email vérifié: ${userRecord.emailVerified ? 'Oui ✅' : 'Non ❌'}`);
      console.log(`   Créé le: ${userRecord.metadata.creationTime}`);
      console.log(`   Dernière connexion: ${userRecord.metadata.lastSignInTime || 'Jamais'}`);
      console.log(`   Désactivé: ${userRecord.disabled ? 'Oui ❌' : 'Non ✅'}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('❌ Utilisateur NON trouvé dans Firebase Authentication');
        console.log('   L\'utilisateur doit d\'abord créer son compte.');
        return;
      }
      throw error;
    }
    
    const userId = userRecord.uid;
    
    // 2. Vérifier dans Firestore (collection users)
    console.log('\n' + '='.repeat(80));
    console.log('2. FIRESTORE - Collection users');
    console.log('='.repeat(80));
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('❌ Document utilisateur NON trouvé dans Firestore');
      console.log('   Le document doit être créé lors de la création du compte.');
      console.log('   Cela peut indiquer que:');
      console.log('   - Le compte a été créé manuellement dans Authentication');
      console.log('   - La fonction verifyToken n\'a pas été appelée');
      console.log('   - Une erreur s\'est produite lors de la création du document');
      return;
    }
    
    console.log('✅ Document utilisateur trouvé dans Firestore');
    const userData = userDoc.data();
    
    console.log('\n📋 Données du document:');
    console.log('─'.repeat(80));
    Object.keys(userData).forEach(key => {
      const value = userData[key];
      if (value && typeof value === 'object' && value.toDate) {
        // C'est un Timestamp Firestore
        console.log(`   ${key}: ${value.toDate().toISOString()} (${value.toDate().toLocaleDateString('fr-FR')})`);
      } else {
        console.log(`   ${key}: ${value}`);
      }
    });
    
    // 3. Vérifier les champs requis
    console.log('\n' + '='.repeat(80));
    console.log('3. VÉRIFICATION DES CHAMPS REQUIS');
    console.log('='.repeat(80));
    
    const requiredFields = {
      'product': 'Le produit auquel l\'utilisateur a accès (ex: "21jours", "complet")',
      'email': 'L\'email de l\'utilisateur',
    };
    
    const optionalFields = {
      'registrationDate': 'Date d\'inscription (requis pour "21jours" - accès progressif)',
      'createdAt': 'Date de création du compte',
      'updatedAt': 'Date de dernière mise à jour',
    };
    
    let hasErrors = false;
    
    // Vérifier les champs requis
    for (const [field, description] of Object.entries(requiredFields)) {
      if (!userData[field]) {
        console.log(`❌ ${field}: MANQUANT - ${description}`);
        hasErrors = true;
      } else {
        console.log(`✅ ${field}: ${userData[field]}`);
      }
    }
    
    // Vérifier les champs optionnels mais importants
    for (const [field, description] of Object.entries(optionalFields)) {
      if (!userData[field]) {
        console.log(`⚠️  ${field}: MANQUANT - ${description}`);
        if (userData.product === '21jours' && field === 'registrationDate') {
          console.log('   ⚠️  IMPORTANT: registrationDate est requis pour l\'accès progressif au produit "21jours"');
          hasErrors = true;
        }
      } else {
        const value = userData[field];
        if (value && typeof value === 'object' && value.toDate) {
          console.log(`✅ ${field}: ${value.toDate().toISOString()}`);
        } else {
          console.log(`✅ ${field}: ${value}`);
        }
      }
    }
    
    // 4. Vérifier le produit spécifique
    console.log('\n' + '='.repeat(80));
    console.log('4. VÉRIFICATION DU PRODUIT');
    console.log('='.repeat(80));
    
    const product = userData.product;
    if (!product) {
      console.log('❌ Aucun produit défini');
      console.log('   Le champ "product" est requis pour accéder au contenu protégé.');
      hasErrors = true;
    } else {
      console.log(`✅ Produit: ${product}`);
      
      if (product === '21jours') {
        console.log('\n📅 Vérification de l\'accès progressif (21 jours):');
        console.log('─'.repeat(80));
        
        let registrationDate = userData.registrationDate;
        if (!registrationDate) {
          registrationDate = userData.createdAt;
          if (!registrationDate) {
            console.log('❌ Aucune date d\'inscription trouvée');
            console.log('   L\'accès progressif ne peut pas fonctionner sans registrationDate ou createdAt');
            hasErrors = true;
          } else {
            console.log('⚠️  registrationDate manquant, utilisation de createdAt');
            console.log(`   Date utilisée: ${registrationDate.toDate().toISOString()}`);
          }
        } else {
          console.log(`✅ Date d'inscription: ${registrationDate.toDate().toISOString()}`);
        }
        
        if (registrationDate) {
          const now = new Date();
          const registration = registrationDate.toDate();
          const daysSinceRegistration = Math.floor((now - registration) / (1000 * 60 * 60 * 24));
          console.log(`   Jours depuis l'inscription: ${daysSinceRegistration}`);
          console.log(`   Jour actuel du défi: ${daysSinceRegistration + 1}`);
          console.log(`   Jours accessibles: 0-${Math.min(daysSinceRegistration + 1, 22)}`);
        }
      }
    }
    
    // 5. Vérifier le contenu protégé disponible
    console.log('\n' + '='.repeat(80));
    console.log('5. CONTENU PROTÉGÉ DISPONIBLE');
    console.log('='.repeat(80));
    
    if (product) {
      try {
        const contentQuery = await db.collection('protectedContent')
          .where('product', '==', product)
          .get();
        
        if (contentQuery.empty) {
          console.log(`⚠️  Aucun contenu protégé trouvé pour le produit "${product}"`);
          console.log('   Vérifiez que des documents existent dans la collection "protectedContent"');
        } else {
          console.log(`✅ ${contentQuery.size} document(s) de contenu protégé trouvé(s) pour "${product}"`);
          
          if (product === '21jours') {
            const days = [];
            contentQuery.forEach(doc => {
              const data = doc.data();
              if (data.day !== undefined) {
                days.push(data.day);
              }
            });
            days.sort((a, b) => a - b);
            console.log(`   Jours disponibles: ${days.join(', ')}`);
          }
        }
      } catch (error) {
        console.log(`❌ Erreur lors de la vérification du contenu: ${error.message}`);
      }
    }
    
    // 6. Résumé et recommandations
    console.log('\n' + '='.repeat(80));
    console.log('6. RÉSUMÉ');
    console.log('='.repeat(80));
    
    if (hasErrors) {
      console.log('\n❌ Des problèmes ont été détectés:');
      console.log('   1. Vérifiez que tous les champs requis sont présents');
      if (product === '21jours' && !userData.registrationDate) {
        console.log('   2. Pour le produit "21jours", ajoutez registrationDate dans Firestore');
        console.log('      ou utilisez le script grant-full-access-21jours.js');
      }
      if (!userData.product) {
        console.log('   3. Ajoutez le champ "product" dans le document utilisateur');
      }
    } else {
      console.log('\n✅ Tous les champs requis sont présents');
      console.log('   L\'utilisateur devrait pouvoir accéder au contenu protégé.');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Récupérer l'email depuis les arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Erreur: Veuillez fournir un email');
  console.log('Usage: node check-user-firestore.js EMAIL');
  console.log('Exemple: node check-user-firestore.js sylvie707@cgocable.ca');
  process.exit(1);
}

// Exécuter
(async () => {
  try {
    const { db, auth } = await initFirebase();
    await checkUser(email, db, auth);
    process.exit(0);
  } catch (error) {
    console.error('Erreur fatale:', error);
    process.exit(1);
  }
})();
