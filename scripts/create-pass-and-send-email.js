/**
 * Script pour créer manuellement un Flow Pass et envoyer l'email de confirmation
 * Usage: node scripts/create-pass-and-send-email.js [email] [passType]
 * 
 * Exemples:
 *   node scripts/create-pass-and-send-email.js nicolevonlanthen@hotmail.com flow_pass
 *   node scripts/create-pass-and-send-email.js user@example.com semester_pass
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin avec credentials
try {
  if (!admin.apps.length) {
    const possiblePaths = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.join(__dirname, '../functions/serviceAccountKey.json'),
      path.join(__dirname, '../new-project-service-account.json'),
    ];
    
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
        projectId: 'fluance-protected-content',
      });
    } else {
      admin.initializeApp({
        projectId: 'fluance-protected-content',
      });
    }
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = admin.firestore();

// Configuration des pass (identique à passService.js)
const PASS_CONFIG = {
  flow_pass: {
    name: 'Flow Pass',
    sessions: 10,
    validityDays: 365, // 12 mois
    price: 21000, // 210 CHF en centimes
    isRecurring: false,
  },
  semester_pass: {
    name: 'Pass Semestriel',
    sessions: -1, // Illimité
    validityDays: 183, // ~6 mois
    price: 34000, // 340 CHF en centimes
    isRecurring: true,
  },
};

async function createPassAndSendEmail(email, passType = 'flow_pass') {
  const normalizedEmail = email.toLowerCase().trim();
  const config = PASS_CONFIG[passType];

  if (!config) {
    console.error(`❌ Type de pass invalide: ${passType}`);
    console.log('Types disponibles: flow_pass, semester_pass');
    process.exit(1);
  }

  console.log(`🔍 Création d'un ${config.name} pour: ${normalizedEmail}\n`);

  try {
    // Vérifier si un pass actif existe déjà
    const existingPasses = await db.collection('userPasses')
        .where('email', '==', normalizedEmail)
        .where('passType', '==', passType)
        .where('status', '==', 'active')
        .get();

    if (!existingPasses.empty) {
      console.log('⚠️  Un pass actif existe déjà pour cet email:');
      existingPasses.docs.forEach((doc) => {
        const pass = doc.data();
        console.log(`   - ID: ${doc.id}`);
        console.log(`   - Type: ${pass.passName || pass.passType}`);
        console.log(`   - Séances: ${pass.sessionsUsed || 0}/${pass.sessionsTotal || 'N/A'}`);
        console.log(`   - Acheté le: ${pass.purchaseDate?.toDate ? pass.purchaseDate.toDate() : pass.purchaseDate}`);
        console.log(`   - Expire le: ${pass.expiryDate?.toDate ? pass.expiryDate.toDate() : pass.expiryDate}`);
      });
      console.log('\n❓ Voulez-vous quand même créer un nouveau pass ? (y/N)');
      // Pour un script non-interactif, on continue quand même mais on log un avertissement
      console.log('⚠️  Continuation automatique...\n');
    }

    // Récupérer les informations utilisateur depuis les bookings existants si disponibles
    let firstName = '';
    let lastName = '';
    let phone = '';

    const bookings = await db.collection('bookings')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();

    if (!bookings.empty) {
      const booking = bookings.docs[0].data();
      firstName = booking.firstName || '';
      lastName = booking.lastName || '';
      phone = booking.phone || '';
      console.log(`📋 Informations utilisateur trouvées: ${firstName} ${lastName}`);
    }

    // Créer le pass
    const now = new Date();
    const expiryDate = new Date(now.getTime() + config.validityDays * 24 * 60 * 60 * 1000);

    const passData = {
      email: normalizedEmail,
      passType: passType,
      passName: config.name,
      sessionsTotal: config.sessions,
      sessionsUsed: 0,
      sessionsRemaining: config.sessions, // -1 pour illimité
      purchaseDate: now,
      expiryDate: expiryDate,
      status: 'active',
      isRecurring: config.isRecurring,
      price: config.price,
      currency: 'CHF',
      // Infos Stripe (vide pour création manuelle)
      stripePaymentIntentId: null,
      stripeSubscriptionId: null,
      // Infos utilisateur
      firstName: firstName,
      lastName: lastName,
      phone: phone,
      // Historique
      sessionsHistory: [],
      createdAt: now,
      updatedAt: now,
      // Flag pour indiquer que c'est une création manuelle
      manuallyCreated: true,
      manuallyCreatedAt: now,
    };

    const passRef = await db.collection('userPasses').add(passData);
    const passId = passRef.id;

    console.log(`✅ Pass créé avec succès !`);
    console.log(`   - Pass ID: ${passId}`);
    console.log(`   - Type: ${config.name}`);
    console.log(`   - Séances: ${config.sessions === -1 ? 'Illimité' : config.sessions}`);
    console.log(`   - Expire le: ${expiryDate.toLocaleString('fr-FR')}\n`);

    // Envoyer l'email de confirmation
    console.log('📧 Envoi de l\'email de confirmation...');
    try {
      await db.collection('mail').add({
        to: normalizedEmail,
        template: {
          name: 'pass-purchase-confirmation',
          data: {
            firstName: firstName || '',
            passType: config.name,
            sessions: config.sessions,
            validityMonths: Math.floor(config.validityDays / 30),
            isUnlimited: config.sessions === -1,
            isRecurring: config.isRecurring || false,
            passId: passId,
          },
        },
      });
      console.log(`✅ Email de confirmation envoyé à ${normalizedEmail}\n`);
    } catch (emailError) {
      console.error('❌ Erreur lors de l\'envoi de l\'email:', emailError.message);
      console.log('⚠️  Le pass a été créé mais l\'email n\'a pas pu être envoyé.');
      console.log('   Vous pouvez vérifier les logs Firebase pour plus de détails.\n');
    }

    console.log('✅ Script terminé avec succès !');
    return {
      success: true,
      passId: passId,
      email: normalizedEmail,
    };
  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Exécuter
const email = process.argv[2];
const passType = process.argv[3] || 'flow_pass';

if (!email) {
  console.log('❌ Usage: node scripts/create-pass-and-send-email.js [email] [passType]\n');
  console.log('Exemples:');
  console.log('  node scripts/create-pass-and-send-email.js nicolevonlanthen@hotmail.com flow_pass');
  console.log('  node scripts/create-pass-and-send-email.js user@example.com semester_pass');
  process.exit(1);
}

createPassAndSendEmail(email, passType)
    .then((result) => {
      console.log('\n📊 Résumé:');
      console.log(`   - Pass ID: ${result.passId}`);
      console.log(`   - Email: ${result.email}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
