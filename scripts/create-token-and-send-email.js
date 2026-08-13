/**
 * Script pour créer un token d'accès et envoyer l'email de confirmation
 * Usage: node scripts/create-token-and-send-email.js [email] [product] [amount]
 * 
 * Ce script :
 * 1. Crée un token dans Firestore (registrationTokens)
 * 2. Envoie l'email de création de compte
 * 3. Met à jour les contact properties MailJet
 * 
 * Exemple: node scripts/create-token-and-send-email.js user@example.com sos-dos-cervicales 17
 */

const admin = require('firebase-admin');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Initialiser Firebase Admin
try {
  if (!admin.getApps().length) {
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
        credential: admin.cert(serviceAccount),
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

const db = getFirestore();

/**
 * Génère un token unique
 */
function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Charge un template email HTML et remplace les variables
 */
function loadEmailTemplate(templateName, variables = {}) {
  const templatePath = path.join(__dirname, '../functions/emails', `${templateName}.html`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}.html`);
  }

  let html = fs.readFileSync(templatePath, 'utf8');

  // Remplacer les variables au format {{variable}}
  Object.keys(variables).forEach((key) => {
    const value = variables[key] || '';
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regex, value);
  });

  // Nettoyer les placeholders non remplacés
  html = html.replace(/\{\{[\w]+\}\}/g, '');

  return html;
}

/**
 * Envoie un email via Mailjet
 */
async function sendMailjetEmail(to, subject, html, text, apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    throw new Error('Mailjet API keys not configured');
  }

  const fetch = require('node-fetch');
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [{
        From: {
          Email: 'support@actu.fluance.io',
          Name: 'Fluance',
        },
        To: [{
          Email: to,
        }],
        Subject: subject,
        HTMLPart: html,
        TextPart: text || html.replace(/<[^>]*>/g, ''),
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Mailjet API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

async function createTokenAndSendEmail(email, product, expirationDays = 30, amount = null) {
  console.log(`🔑 Création d'un token d'accès pour ${email}\n`);
  console.log(`   Produit: ${product}`);
  console.log(`   Expiration: ${expirationDays} jours`);
  if (amount) {
    console.log(`   Montant: ${amount} CHF\n`);
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Charger les clés Mailjet depuis les secrets Firebase ou .env
    let mailjetApiKey = process.env.MAILJET_API_KEY;
    let mailjetApiSecret = process.env.MAILJET_API_SECRET;

    if (!mailjetApiKey || !mailjetApiSecret) {
      const envPath = path.join(__dirname, '../functions/.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const keyMatch = envContent.match(/MAILJET_API_KEY=(.+)/);
        const secretMatch = envContent.match(/MAILJET_API_SECRET=(.+)/);
        if (keyMatch) mailjetApiKey = keyMatch[1].trim();
        if (secretMatch) mailjetApiSecret = secretMatch[1].trim();
      }
    }

    if (!mailjetApiKey || !mailjetApiSecret) {
      console.warn('⚠️  MAILJET_API_KEY et MAILJET_API_SECRET non disponibles.');
      console.warn('   Le token sera créé mais l\'email ne sera pas envoyé.');
      console.warn('   Vous pouvez les définir avec:');
      console.warn('   export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)');
      console.warn('   export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)\n');
    }

    // Générer le token
    const token = generateUniqueToken();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);

    // Stocker le token dans Firestore
    const tokenData = {
      email: normalizedEmail,
      product: product,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expirationDate,
      used: false,
    };

    if (amount) {
      tokenData.amount = Math.round(amount * 100); // En centimes
    }

    await db.collection('registrationTokens').doc(token).set(tokenData);
    console.log(`✅ Token créé: ${token}\n`);

    // Générer le lien de création de compte
    const baseUrl = 'https://fluance.io';
    const registrationUrl = `${baseUrl}/creer-compte?token=${token}`;

    // Envoyer l'email si les clés Mailjet sont disponibles
    if (mailjetApiKey && mailjetApiSecret) {
      console.log('📧 Envoi de l\'email de création de compte...');
      try {
        const emailSubject = 'Créez votre compte Fluance';
        const emailHtml = loadEmailTemplate('creation-compte', {
          product: product,
          registrationUrl: registrationUrl,
          expirationDays: expirationDays.toString(),
        });

        await sendMailjetEmail(
            normalizedEmail,
            emailSubject,
            emailHtml,
            null,
            mailjetApiKey,
            mailjetApiSecret,
        );
        console.log(`✅ Email envoyé à ${normalizedEmail}\n`);
      } catch (emailError) {
        console.error('❌ Erreur lors de l\'envoi de l\'email:', emailError.message);
        console.log('   Le token a été créé mais l\'email n\'a pas pu être envoyé.\n');
      }
    }

    console.log('═'.repeat(100));
    console.log('\n📊 RÉSUMÉ:\n');
    console.log(`   ✅ Token créé: ${token}`);
    console.log(`   📧 Email: ${normalizedEmail}`);
    console.log(`   🎯 Produit: ${product}`);
    console.log(`   📅 Expire le: ${expirationDate.toLocaleString('fr-FR')}`);
    console.log(`   🔗 Lien: ${registrationUrl}`);
    if (mailjetApiKey && mailjetApiSecret) {
      console.log(`   ✅ Email envoyé`);
    } else {
      console.log(`   ⚠️  Email non envoyé (clés Mailjet manquantes)`);
    }
    console.log('\n' + '═'.repeat(100));

    return {token, registrationUrl};

  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Exécuter
const email = process.argv[2];
const product = process.argv[3];
const amount = process.argv[4] ? parseFloat(process.argv[4]) : null;

if (!email || !product) {
  console.log('❌ Usage: node scripts/create-token-and-send-email.js [email] [product] [amount]\n');
  console.log('Exemple:');
  console.log('  node scripts/create-token-and-send-email.js user@example.com sos-dos-cervicales 17');
  console.log('\nProduits valides: 21jours, complet, sos-dos-cervicales');
  process.exit(1);
}

const validProducts = ['21jours', 'complet', 'sos-dos-cervicales'];
if (!validProducts.includes(product)) {
  console.error(`❌ Produit invalide: ${product}`);
  console.log(`Produits valides: ${validProducts.join(', ')}`);
  process.exit(1);
}

createTokenAndSendEmail(email, product, 30, amount)
    .then(() => {
      console.log('\n✅ Script terminé.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
