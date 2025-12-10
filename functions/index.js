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

const {onRequest, onCall} = require('firebase-functions/v2/https');
const {setGlobalOptions} = require('firebase-functions/v2');
const {HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
// fetch est natif dans Node.js 20+ (pas besoin de node-fetch)

// Définir les options globales (région par défaut)
setGlobalOptions({
  region: 'europe-west1',
});

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Configuration Mailjet (via secrets Firebase - méthode moderne)
// ⚠️ IMPORTANT : Les secrets sont configurés via Firebase CLI :
// echo -n "votre_cle" | firebase functions:secrets:set MAILJET_API_KEY
// Ne JAMAIS mettre de vraies clés dans ce fichier (code public sur GitHub)
// Les secrets sont accessibles via process.env.SECRET_NAME dans les fonctions

// Configuration Stripe (via secrets Firebase - méthode moderne)
// ⚠️ IMPORTANT : Les secrets sont configurés via Firebase CLI :
// echo -n "votre_cle" | firebase functions:secrets:set STRIPE_SECRET_KEY

/**
 * Génère un token unique à usage unique
 */
function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Envoie un email via Mailjet API
 * @param {string} to - Email du destinataire
 * @param {string} subject - Sujet de l'email
 * @param {string} htmlContent - Contenu HTML de l'email
 * @param {string} textContent - Contenu texte de l'email (optionnel)
 * @param {string} apiKey - Clé API Mailjet (depuis les secrets)
 * @param {string} apiSecret - Secret API Mailjet (depuis les secrets)
 */
async function sendMailjetEmail(to, subject, htmlContent, textContent = null, apiKey, apiSecret) {
  // Vérifier que les credentials Mailjet sont configurés
  if (!apiKey || !apiSecret) {
    throw new Error('Mailjet credentials not configured. Please set MAILJET_API_KEY and MAILJET_API_SECRET secrets using: firebase functions:secrets:set');
  }

  const url = 'https://api.mailjet.com/v3.1/send';

  const body = {
    Messages: [
      {
        From: {
          Email: 'support@fluance.io',
          Name: 'Fluance',
        },
        To: [
          {
            Email: to,
          },
        ],
        Subject: subject,
        TextPart: textContent || subject,
        HTMLPart: htmlContent,
      },
    ],
  };

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mailjet API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Crée un token dans Firestore et envoie l'email
 * @param {string} email - Email du client
 * @param {string} product - Nom du produit
 * @param {number} expirationDays - Nombre de jours avant expiration (défaut: 30)
 * @param {string} mailjetApiKey - Clé API Mailjet (depuis les secrets)
 * @param {string} mailjetApiSecret - Secret API Mailjet (depuis les secrets)
 */
async function createTokenAndSendEmail(email, product, expirationDays = 30, mailjetApiKey, mailjetApiSecret) {
  const token = generateUniqueToken();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);

  // Stocker le token dans Firestore
  await db.collection('registrationTokens').doc(token).set({
    email: email.toLowerCase().trim(),
    product: product,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: expirationDate,
    used: false,
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
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #8bc34a;
          color: #fff;
          text-decoration: none;
          border-radius: 4px;
          margin: 20px 0;
        }
        .footer { margin-top: 40px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Bienvenue chez Fluance !</h1>
        <p>Merci pour votre achat de <strong>${product}</strong>.</p>
        <p>Pour accéder à votre contenu protégé, veuillez créer votre compte en cliquant sur le bouton ci-dessous :</p>
        <a href="${registrationUrl}" class="button">Créer mon compte</a>
        <p><small>Ce lien est valable pendant ${expirationDays} jours
          et ne peut être utilisé qu'une seule fois.</small></p>
        <div class="footer">
          <p>Si vous n'avez pas effectué cet achat, veuillez ignorer cet email.</p>
          <p>Fluance - support@fluance.io</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Envoyer l'email
  await sendMailjetEmail(email, emailSubject, emailHtml, null, mailjetApiKey, mailjetApiSecret);

  return token;
}

/**
 * Webhook Stripe - Gère les paiements réussis
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.webhookStripe = onRequest(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
    },
    async (req, res) => {
      // Vérifier la signature Stripe (sera utilisé avec le package Stripe)
      // const sig = req.headers['stripe-signature'];

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
        // amount et currency ne sont plus utilisés car on utilise uniquement les métadonnées
        // const amount = session.amount_total || session.amount;
        // const currency = session.currency || 'chf';

        if (!customerEmail) {
          console.error('No email found in Stripe event');
          return res.status(400).send('No email found');
        }

        // Vérifier si ce paiement est destiné au nouveau système (Firebase)
        // ⚠️ IMPORTANT : Pas de fallback - seuls les paiements avec metadata.system = 'firebase' sont traités
        const system = session.metadata?.system;
        if (system !== 'firebase') {
          console.log(`Paiement Stripe ignoré - système: ${system || 'non défini'} (pas pour Firebase)`);
          return res.status(200).json({received: true, ignored: true});
        }

        // Déterminer le produit depuis les métadonnées uniquement (pas de fallback)
        const product = session.metadata?.product;
        if (!product || (product !== '21jours' && product !== 'complet')) {
          console.error(`Paiement Stripe ignoré - produit invalide: ${product}`);
          return res.status(200).json({received: true, ignored: true});
        }

        try {
          await createTokenAndSendEmail(
              customerEmail,
              product,
              30,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );
          console.log(`Token created and email sent to ${customerEmail} for product ${product}`);
          return res.status(200).json({received: true});
        } catch (error) {
          console.error('Error creating token:', error);
          return res.status(500).send('Error processing payment');
        }
      }

      res.status(200).json({received: true});
    });

/**
 * Webhook PayPal - Gère les paiements réussis
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.webhookPayPal = onRequest(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
    },
    async (req, res) => {
      const event = req.body;

      // Vérifier que c'est un événement de paiement réussi
      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' ||
      event.event_type === 'CHECKOUT.ORDER.APPROVED') {
        const resource = event.resource;
        const customerEmail = resource.payer?.email_address ||
            resource.purchase_units?.[0]?.payee?.email_address;
        // amount et currency ne sont plus utilisés car on utilise uniquement les métadonnées
        // const amount = resource.amount?.value || resource.purchase_units?.[0]?.amount?.value;
        // const currency = resource.amount?.currency_code ||
        //   resource.purchase_units?.[0]?.amount?.currency_code || 'CHF';

        if (!customerEmail) {
          console.error('No email found in PayPal event');
          return res.status(400).send('No email found');
        }

        // Vérifier si ce paiement est destiné au nouveau système (Firebase)
        // ⚠️ IMPORTANT : Pas de fallback - seuls les paiements avec custom_id commençant par 'firebase_' sont traités
        const customId = resource.custom_id || '';
        if (!customId.startsWith('firebase_')) {
          console.log(`Paiement PayPal ignoré - custom_id: ${customId || 'non défini'} (pas pour Firebase)`);
          return res.status(200).json({received: true, ignored: true});
        }

        // Déterminer le produit depuis custom_id uniquement (pas de fallback)
        // Format attendu : 'firebase_21jours' ou 'firebase_complet'
        const product = customId.replace('firebase_', '');
        if (product !== '21jours' && product !== 'complet') {
          console.error(`Paiement PayPal ignoré - produit invalide: ${product}`);
          return res.status(200).json({received: true, ignored: true});
        }

        try {
          await createTokenAndSendEmail(
              customerEmail,
              product,
              30,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );
          console.log(`Token created and email sent to ${customerEmail} for product ${product}`);
          return res.status(200).json({received: true});
        } catch (error) {
          console.error('Error creating token:', error);
          return res.status(500).send('Error processing payment');
        }
      }

      res.status(200).json({received: true});
    });

/**
 * Fonction pour créer manuellement un token (paiement virement, cash, etc.)
 * Requiert une authentification admin
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.createUserToken = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
    },
    async (request) => {
      // Vérifier l'authentification admin (vous pouvez utiliser un claim personnalisé)
      if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError('permission-denied', 'Admin access required');
      }

      const {email, product, expirationDays} = request.data;

      if (!email || !product) {
        throw new HttpsError('invalid-argument', 'Email and product are required');
      }

      try {
        const token = await createTokenAndSendEmail(
            email,
            product,
            expirationDays || 30,
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );
        return {success: true, token};
      } catch (error) {
        console.error('Error creating token:', error);
        throw new HttpsError('internal', 'Error creating token');
      }
    });

/**
 * Vérifie un token et crée le compte Firebase Auth
 * Région : europe-west6 (Zurich - directement en Suisse)
 */
exports.verifyToken = onCall(
    {
      region: 'europe-west1',
    },
    async (request) => {
      const {token, password} = request.data;

      if (!token || !password) {
        throw new HttpsError('invalid-argument', 'Token and password are required');
      }

      // Vérifier le token dans Firestore
      const tokenDoc = await db.collection('registrationTokens').doc(token).get();

      if (!tokenDoc.exists) {
        throw new HttpsError('not-found', 'Token invalide');
      }

      const tokenData = tokenDoc.data();

      // Vérifier si le token a déjà été utilisé
      if (tokenData.used) {
        throw new HttpsError('failed-precondition', 'Ce token a déjà été utilisé');
      }

      // Vérifier si le token a expiré
      const now = new Date();
      const expiresAt = tokenData.expiresAt.toDate();
      if (now > expiresAt) {
        throw new HttpsError('deadline-exceeded', 'Ce token a expiré');
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
              emailVerified: false,
            });
          } else {
            throw error;
          }
        }

        // Mettre à jour le mot de passe si l'utilisateur existe déjà
        if (userRecord) {
          await auth.updateUser(userRecord.uid, {password: password});
        }

        // Marquer le token comme utilisé
        await db.collection('registrationTokens').doc(token).update({
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          userId: userRecord.uid,
        });

        // Créer ou mettre à jour le document utilisateur dans Firestore
        const userData = {
          email: email,
          product: tokenData.product,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Pour le produit "21jours", ajouter la date d'inscription pour l'accès progressif
        if (tokenData.product === '21jours') {
          userData.registrationDate = admin.firestore.FieldValue.serverTimestamp();
        }

        await db.collection('users').doc(userRecord.uid).set(userData, {merge: true});

        return {success: true, userId: userRecord.uid, email: email};
      } catch (error) {
        console.error('Error creating user:', error);
        throw new HttpsError('internal', 'Erreur lors de la création du compte');
      }
    });

/**
 * Fonction utilitaire pour déterminer le produit selon le montant
 * Produits disponibles : "21jours" (19 CHF), "complet" (30 CHF/mois ou 75 CHF/trimestre)
 * ⚠️ Cette fonction n'est plus utilisée car on utilise uniquement les métadonnées
 * Conservée pour référence future si nécessaire
 */
// function determineProductFromAmount(amount, currency) {
//   // Convertir le montant selon la devise
//   let amountInCHF = amount;
//   if (currency.toLowerCase() === 'eur') {
//     amountInCHF = amount * 1.1; // Approximation EUR -> CHF
//   } else if (currency.toLowerCase() === 'usd') {
//     amountInCHF = amount * 0.9; // Approximation USD -> CHF
//   }
//
//   // Tarifs réels :
//   // - "21jours" : 19 CHF
//   // - "complet" : 30 CHF/mois ou 75 CHF/trimestre
//
//   // Déterminer le produit selon le montant
//   // On utilise des plages pour gérer les variations de conversion de devise et frais
//   const tolerance = 5; // Tolérance de ±5 CHF pour les conversions et frais
//
//   if (Math.abs(amountInCHF - 19) <= tolerance || (amountInCHF >= 15 && amountInCHF < 25)) {
//     // Montant autour de 19 CHF (21jours)
//     return '21jours';
//   } else if (Math.abs(amountInCHF - 30) <= tolerance || (amountInCHF >= 25 && amountInCHF < 40)) {
//     // Montant autour de 30 CHF (complet mensuel)
//     return 'complet';
//   } else if (Math.abs(amountInCHF - 75) <= tolerance || (amountInCHF >= 70 && amountInCHF <= 85)) {
//     // Montant autour de 75 CHF (complet trimestriel)
//     return 'complet';
//   } else if (amountInCHF >= 40) {
//     // Montant supérieur à 40 CHF -> probablement complet
//     return 'complet';
//   } else {
//     // Par défaut, si le montant est inférieur à 25 CHF -> 21jours
//     return '21jours';
//   }
// }

/**
 * Fonction pour envoyer des newsletters/communications marketing
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.sendNewsletter = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
    },
    async (request) => {
      // Vérifier l'authentification admin
      if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError('permission-denied', 'Admin access required');
      }

      const {subject, htmlContent, textContent, recipientList} = request.data;

      if (!subject || !htmlContent || !recipientList || !Array.isArray(recipientList)) {
        throw new HttpsError('invalid-argument', 'Missing required fields');
      }

      // Récupérer les emails depuis Firestore si recipientList est un nom de collection
      let emails = [];
      if (typeof recipientList === 'string') {
        const usersSnapshot = await db.collection(recipientList).get();
        emails = usersSnapshot.docs.map((doc) => doc.data().email).filter(Boolean);
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
            Messages: batch.map((email) => ({
              From: {
                Email: 'support@fluance.io',
                Name: 'Fluance',
              },
              To: [{Email: email}],
              Subject: subject,
              TextPart: textContent || subject,
              HTMLPart: htmlContent,
            })),
          };

          const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            results.push(...batch);
          } else {
            const errorText = await response.text();
            errors.push({batch, error: errorText});
          }
        } catch (error) {
          errors.push({batch, error: error.message});
        }
      }

      return {
        success: true,
        sent: results.length,
        failed: errors.length,
        errors: errors,
      };
    });

/**
 * Ajoute un contact à MailJet (pour newsletter/inscription)
 * Cette fonction est publique (pas besoin d'authentification admin)
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.subscribeToNewsletter = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
      cors: true, // Autoriser CORS pour toutes les origines
    },
    async (request) => {
      const {email, name} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      try {
        // Ajouter le contact à MailJet
        // Note: Vous devrez peut-être créer une liste dans MailJet et utiliser son ID
        // Pour l'instant, on ajoute juste le contact (il sera ajouté à la liste par défaut)
        const url = 'https://api.mailjet.com/v3/REST/contact';
        
        const contactData = {
          Email: email.toLowerCase().trim(),
          IsExcludedFromCampaigns: false,
        };

        if (name) {
          const nameParts = name.trim().split(' ');
          if (nameParts.length > 0) {
            contactData.Name = name;
          }
        }

        const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
        
        // Vérifier si le contact existe déjà
        const checkUrl = `https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(contactData.Email)}`;
        let contactExists = false;
        
        try {
          const checkResponse = await fetch(checkUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
            },
          });
          
          if (checkResponse.ok) {
            contactExists = true;
            // Mettre à jour le contact existant si un nom est fourni
            if (name) {
              const updateResponse = await fetch(checkUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Basic ${auth}`,
                },
                body: JSON.stringify(contactData),
              });
              
              if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                console.error('Error updating contact:', errorText);
              }
            }
          }
        } catch (err) {
          // Contact n'existe pas, on va le créer
          console.log('Contact does not exist, will create it');
        }

        // Créer le contact s'il n'existe pas
        if (!contactExists) {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify(contactData),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Mailjet API error:', errorText);
            throw new Error(`Mailjet API error: ${response.status} - ${errorText}`);
          }
        }

        // Optionnel: Ajouter le contact à une liste spécifique
        // Décommentez et remplacez LIST_ID par l'ID de votre liste MailJet
        // const listId = 'LIST_ID'; // À remplacer par votre ID de liste MailJet
        // const addToListUrl = `https://api.mailjet.com/v3/REST/listrecipient`;
        // await fetch(addToListUrl, {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'Authorization': `Basic ${auth}`,
        //   },
        //   body: JSON.stringify({
        //     IsUnsubscribed: false,
        //     ContactAlt: contactData.Email,
        //     ListID: listId,
        //   }),
        // });

        return {
          success: true,
          message: 'Successfully subscribed to newsletter',
          email: contactData.Email,
        };
      } catch (error) {
        console.error('Error subscribing to newsletter:', error);
        throw new HttpsError('internal', 'Error subscribing to newsletter: ' + error.message);
      }
    });

