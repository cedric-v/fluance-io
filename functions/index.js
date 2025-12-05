/**
 * Firebase Functions pour Fluance - Contenu protégé
 * 
 * Fonctions :
 * - webhookStripe : Gère les webhooks Stripe pour générer les tokens
 * - webhookPayPal : Gère les webhooks PayPal pour générer les tokens
 * - createUserToken : Crée manuellement un token pour un utilisateur
 * - verifyToken : Vérifie un token et crée le compte Firebase Auth
 * - sendEmail : Envoie un email via Mailjet
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Configuration Mailjet (à définir dans Firebase Functions config)
// firebase functions:config:set mailjet.api_key="YOUR_API_KEY" mailjet.api_secret="YOUR_API_SECRET"
const mailjetConfig = functions.config().mailjet || {
  api_key: process.env.MAILJET_API_KEY,
  api_secret: process.env.MAILJET_API_SECRET
};

// Configuration Stripe (à définir dans Firebase Functions config)
// firebase functions:config:set stripe.webhook_secret="YOUR_WEBHOOK_SECRET"
const stripeConfig = functions.config().stripe || {
  webhook_secret: process.env.STRIPE_WEBHOOK_SECRET
};

/**
 * Génère un token unique à usage unique
 */
function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Envoie un email via Mailjet API
 */
async function sendMailjetEmail(to, subject, htmlContent, textContent = null) {
  const url = 'https://api.mailjet.com/v3.1/send';
  
  const body = {
    Messages: [
      {
        From: {
          Email: 'support@fluance.io',
          Name: 'Fluance'
        },
        To: [
          {
            Email: to
          }
        ],
        Subject: subject,
        TextPart: textContent || subject,
        HTMLPart: htmlContent
      }
    ]
  };

  const auth = Buffer.from(`${mailjetConfig.api_key}:${mailjetConfig.api_secret}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mailjet API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Crée un token dans Firestore et envoie l'email
 */
async function createTokenAndSendEmail(email, product, expirationDays = 30) {
  const token = generateUniqueToken();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);

  // Stocker le token dans Firestore
  await db.collection('registrationTokens').doc(token).set({
    email: email.toLowerCase().trim(),
    product: product,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: expirationDate,
    used: false
  });

  // Générer le lien de création de compte
  const baseUrl = 'https://fluance.io';
  const registrationUrl = `${baseUrl}/creer-compte?token=${token}`;

  // Contenu de l'email
  const emailSubject = 'Créez votre compte Fluance';
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #8bc34a; color: #fff; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 40px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Bienvenue chez Fluance !</h1>
        <p>Merci pour votre achat de <strong>${product}</strong>.</p>
        <p>Pour accéder à votre contenu protégé, veuillez créer votre compte en cliquant sur le bouton ci-dessous :</p>
        <a href="${registrationUrl}" class="button">Créer mon compte</a>
        <p><small>Ce lien est valable pendant ${expirationDays} jours et ne peut être utilisé qu'une seule fois.</small></p>
        <div class="footer">
          <p>Si vous n'avez pas effectué cet achat, veuillez ignorer cet email.</p>
          <p>Fluance - support@fluance.io</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Envoyer l'email
  await sendMailjetEmail(email, emailSubject, emailHtml);

  return token;
}

/**
 * Webhook Stripe - Gère les paiements réussis
 */
exports.webhookStripe = functions.https.onRequest(async (req, res) => {
  // Vérifier la signature Stripe
  const sig = req.headers['stripe-signature'];
  
  // Note: Pour utiliser Stripe, installer le package: npm install stripe
  // const stripe = require('stripe')(functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY);

  let event;

  try {
    // Pour Stripe, vous devez installer le package Stripe et utiliser constructEvent
    // Pour l'instant, on accepte l'événement tel quel (à sécuriser en production)
    event = req.body;
    
    // Décommenter et utiliser ceci une fois Stripe installé :
    // event = stripe.webhooks.constructEvent(
    //   req.rawBody,
    //   sig,
    //   stripeConfig.webhook_secret
    // );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer l'événement
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || session.customer_email;
    const amount = session.amount_total || session.amount;
    const currency = session.currency || 'chf';

    if (!customerEmail) {
      console.error('No email found in Stripe event');
      return res.status(400).send('No email found');
    }

    // Déterminer le produit selon le montant ou les metadata
    const product = session.metadata?.product || determineProductFromAmount(amount, currency);

    try {
      await createTokenAndSendEmail(customerEmail, product);
      console.log(`Token created and email sent to ${customerEmail} for product ${product}`);
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error creating token:', error);
      return res.status(500).send('Error processing payment');
    }
  }

  res.status(200).json({ received: true });
});

/**
 * Webhook PayPal - Gère les paiements réussis
 */
exports.webhookPayPal = functions.https.onRequest(async (req, res) => {
  const event = req.body;

  // Vérifier que c'est un événement de paiement réussi
  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' || 
      event.event_type === 'CHECKOUT.ORDER.APPROVED') {
    
    const resource = event.resource;
    const customerEmail = resource.payer?.email_address || 
                         resource.purchase_units?.[0]?.payee?.email_address;
    const amount = resource.amount?.value || resource.purchase_units?.[0]?.amount?.value;
    const currency = resource.amount?.currency_code || resource.purchase_units?.[0]?.amount?.currency_code || 'CHF';

    if (!customerEmail) {
      console.error('No email found in PayPal event');
      return res.status(400).send('No email found');
    }

    // Déterminer le produit selon le montant ou les metadata
    const product = resource.custom_id || determineProductFromAmount(amount, currency);

    try {
      await createTokenAndSendEmail(customerEmail, product);
      console.log(`Token created and email sent to ${customerEmail} for product ${product}`);
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error creating token:', error);
      return res.status(500).send('Error processing payment');
    }
  }

  res.status(200).json({ received: true });
});

/**
 * Fonction pour créer manuellement un token (paiement virement, cash, etc.)
 * Requiert une authentification admin
 */
exports.createUserToken = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification admin (vous pouvez utiliser un claim personnalisé)
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { email, product, expirationDays } = data;

  if (!email || !product) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and product are required');
  }

  try {
    const token = await createTokenAndSendEmail(email, product, expirationDays || 30);
    return { success: true, token };
  } catch (error) {
    console.error('Error creating token:', error);
    throw new functions.https.HttpsError('internal', 'Error creating token');
  }
});

/**
 * Vérifie un token et crée le compte Firebase Auth
 */
exports.verifyToken = functions.https.onCall(async (data, context) => {
  const { token, password } = data;

  if (!token || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Token and password are required');
  }

  // Vérifier le token dans Firestore
  const tokenDoc = await db.collection('registrationTokens').doc(token).get();

  if (!tokenDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Token invalide');
  }

  const tokenData = tokenDoc.data();

  // Vérifier si le token a déjà été utilisé
  if (tokenData.used) {
    throw new functions.https.HttpsError('failed-precondition', 'Ce token a déjà été utilisé');
  }

  // Vérifier si le token a expiré
  const now = new Date();
  const expiresAt = tokenData.expiresAt.toDate();
  if (now > expiresAt) {
    throw new functions.https.HttpsError('deadline-exceeded', 'Ce token a expiré');
  }

  const email = tokenData.email;

  try {
    // Vérifier si l'utilisateur existe déjà
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Créer un nouvel utilisateur
        userRecord = await auth.createUser({
          email: email,
          password: password,
          emailVerified: false
        });
      } else {
        throw error;
      }
    }

    // Mettre à jour le mot de passe si l'utilisateur existe déjà
    if (userRecord) {
      await auth.updateUser(userRecord.uid, { password: password });
    }

    // Marquer le token comme utilisé
    await db.collection('registrationTokens').doc(token).update({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: userRecord.uid
    });

    // Créer ou mettre à jour le document utilisateur dans Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      product: tokenData.product,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, userId: userRecord.uid, email: email };
  } catch (error) {
    console.error('Error creating user:', error);
    throw new functions.https.HttpsError('internal', 'Erreur lors de la création du compte');
  }
});

/**
 * Fonction utilitaire pour déterminer le produit selon le montant
 */
function determineProductFromAmount(amount, currency) {
  // Convertir le montant selon la devise
  let amountInCHF = amount;
  if (currency.toLowerCase() === 'eur') {
    amountInCHF = amount * 1.1; // Approximation
  } else if (currency.toLowerCase() === 'usd') {
    amountInCHF = amount * 0.9; // Approximation
  }

  // Définir les produits selon les montants (à adapter selon vos tarifs)
  if (amountInCHF >= 200) {
    return 'Approche Fluance Complète';
  } else if (amountInCHF >= 100) {
    return 'Cours en ligne';
  } else {
    return 'Produit standard';
  }
}

/**
 * Fonction pour envoyer des newsletters/communications marketing
 */
exports.sendNewsletter = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification admin
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { subject, htmlContent, textContent, recipientList } = data;

  if (!subject || !htmlContent || !recipientList || !Array.isArray(recipientList)) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  // Récupérer les emails depuis Firestore si recipientList est un nom de collection
  let emails = [];
  if (typeof recipientList === 'string') {
    const usersSnapshot = await db.collection(recipientList).get();
    emails = usersSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
  } else {
    emails = recipientList;
  }

  const results = [];
  const errors = [];

  // Envoyer les emails par batch (Mailjet limite à 50 destinataires par requête)
  const batchSize = 50;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    try {
      const url = 'https://api.mailjet.com/v3.1/send';
      const body = {
        Messages: batch.map(email => ({
          From: {
            Email: 'support@fluance.io',
            Name: 'Fluance'
          },
          To: [{ Email: email }],
          Subject: subject,
          TextPart: textContent || subject,
          HTMLPart: htmlContent
        }))
      };

      const auth = Buffer.from(`${mailjetConfig.api_key}:${mailjetConfig.api_secret}`).toString('base64');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        results.push(...batch);
      } else {
        const errorText = await response.text();
        errors.push({ batch, error: errorText });
      }
    } catch (error) {
      errors.push({ batch, error: error.message });
    }
  }

  return {
    success: true,
    sent: results.length,
    failed: errors.length,
    errors: errors
  };
});

