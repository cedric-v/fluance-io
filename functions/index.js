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
/**
 * Met à jour les contact properties MailJet pour un contact
 * @param {string} email - Email du contact
 * @param {object} properties - Objet avec les properties à mettre à jour
 * @param {string} apiKey - Clé API MailJet
 * @param {string} apiSecret - Secret API MailJet
 */
async function updateMailjetContactProperties(email, properties, apiKey, apiSecret) {
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const contactUrl = `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email.toLowerCase().trim())}`;

  try {
    // Récupérer les properties actuelles
    const getResponse = await fetch(contactUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    // Construire un objet pour faciliter la fusion
    const currentDataMap = {};
    if (getResponse.ok) {
      const getData = await getResponse.json();
      if (getData.Data && getData.Data.length > 0) {
        // La structure de l'API Mailjet est: { Data: [{ ContactID: ..., Data: [{ Name: ..., Value: ... }] }] }
        const contactData = getData.Data[0];
        if (contactData.Data) {
          // Si Data est un tableau (format standard)
          if (Array.isArray(contactData.Data)) {
            contactData.Data.forEach((item) => {
              if (item.Name && item.Value !== undefined) {
                currentDataMap[item.Name] = item.Value;
              }
            });
          } else if (typeof contactData.Data === 'object') {
            // Si Data est un objet (format alternatif possible)
            Object.keys(contactData.Data).forEach((key) => {
              currentDataMap[key] = contactData.Data[key];
            });
          }
        }
      }
    } else if (getResponse.status === 404) {
      // Contact properties n'existent pas encore, c'est normal
      console.log(`Contact properties not found for ${email}, will create new ones`);
    } else {
      const errorText = await getResponse.text();
      console.error(`Error fetching MailJet contact properties for ${email}: ${getResponse.status} - ${errorText}`);
    }

    // Fusionner les nouvelles properties avec les existantes
    const updatedDataMap = {...currentDataMap, ...properties};

    // Convertir l'objet en tableau au format MailJet (Name/Value)
    const dataArray = Object.keys(updatedDataMap).map((key) => ({
      Name: key,
      Value: String(updatedDataMap[key]),
    }));

    // Mettre à jour les properties
    const updateResponse = await fetch(contactUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        Data: dataArray,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`❌ Error updating MailJet contact properties for ${email}:`, errorText);
      console.error(`   Status: ${updateResponse.status}`);
      console.error(`   Properties attempted:`, JSON.stringify(properties));
      console.error(`   Data array sent:`, JSON.stringify(dataArray));
      // Ne pas throw, juste logger l'erreur pour ne pas bloquer le processus
    } else {
      const responseData = await updateResponse.json().catch(() => ({}));
      console.log(`✅ MailJet contact properties updated successfully for ${email}`);
      console.log(`   Properties set:`, JSON.stringify(properties));
      if (responseData.Data) {
        console.log(`   Response:`, JSON.stringify(responseData));
      }
    }
  } catch (error) {
    console.error(`Exception updating MailJet contact properties for ${email}:`, error);
    // Ne pas throw, juste logger l'erreur
  }
}

/**
 * Crée les contact properties MailJet si elles n'existent pas encore
 * @param {string} apiKey - Clé API MailJet
 * @param {string} apiSecret - Secret API MailJet
 */
async function ensureMailjetContactProperties(apiKey, apiSecret) {
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const properties = [
    'statut',
    'source_optin',
    'date_optin',
    'produits_achetes',
    'date_premier_achat',
    'date_dernier_achat',
    'valeur_client',
    'nombre_achats',
    'est_client',
  ];

  console.log(`📋 Ensuring ${properties.length} MailJet contact properties exist`);
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    console.log(`📋 Checking property ${i + 1}/${properties.length}: ${prop}`);
    try {
      const response = await fetch('https://api.mailjet.com/v3/REST/contactmetadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({
          Name: prop,
          Datatype: 'str',
        }),
      });

      if (response.ok) {
        console.log(`📋 Created MailJet contact property: ${prop}`);
      } else {
        const errorText = await response.text();
        if (response.status === 400 && errorText.includes('already exists')) {
          console.log(`📋 MailJet contact property already exists: ${prop}`);
        } else {
          console.error(`Error creating MailJet contact property ${prop}:`, errorText);
        }
      }
    } catch (error) {
      console.error(`Exception creating MailJet contact property ${prop}:`, error);
    }
  }
  console.log('📋 Finished ensuring all MailJet contact properties exist');
}

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
 * Met également à jour les contact properties MailJet pour les achats
 * @param {string} email - Email du client
 * @param {string} product - Nom du produit
 * @param {number} expirationDays - Nombre de jours avant expiration (défaut: 30)
 * @param {string} mailjetApiKey - Clé API Mailjet (depuis les secrets)
 * @param {string} mailjetApiSecret - Secret API Mailjet (depuis les secrets)
 * @param {number} amount - Montant de l'achat en CHF (optionnel, pour mettre à jour les properties)
 */
async function createTokenAndSendEmail(
    email,
    product,
    expirationDays = 30,
    mailjetApiKey,
    mailjetApiSecret,
    amount = null,
) {
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

  // Mettre à jour les contact properties MailJet pour les achats
  if (amount !== null && amount !== undefined) {
    try {
      // Récupérer les properties actuelles pour calculer les totaux
      const auth = Buffer.from(`${mailjetApiKey}:${mailjetApiSecret}`).toString('base64');
      const contactDataUrl = `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email.toLowerCase().trim())}`;

      let currentProperties = {};
      try {
        const getResponse = await fetch(contactDataUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        });
        if (getResponse.ok) {
          const getData = await getResponse.json();
          if (getData.Data && getData.Data.length > 0) {
            const contactData = getData.Data[0];
            if (contactData.Data) {
              // Si Data est un tableau (format standard Mailjet)
              if (Array.isArray(contactData.Data)) {
                // Convertir le tableau [{Name, Value}] en objet {name: value}
                contactData.Data.forEach((item) => {
                  if (item.Name && item.Value !== undefined) {
                    currentProperties[item.Name] = item.Value;
                  }
                });
              } else if (typeof contactData.Data === 'object') {
                // Si Data est déjà un objet (format alternatif)
                currentProperties = contactData.Data;
              }
            }
          }
        }
      } catch {
        console.log('Contact properties not found, will create new ones');
      }

      // Calculer les nouvelles valeurs
      const now = new Date();
      // Format ISO 8601 complet avec heure pour les propriétés datetime Mailjet
      const dateStr = now.toISOString(); // Format: YYYY-MM-DDTHH:MM:SS.sssZ

      const currentProducts = currentProperties.produits_achetes || '';
      const productsList = currentProducts ? currentProducts.split(',').map((p) => p.trim()).filter((p) => p) : [];
      if (!productsList.includes(product)) {
        productsList.push(product);
      }

      const currentValeur = parseFloat(currentProperties.valeur_client || '0') || 0;
      const currentNombreAchats = parseInt(currentProperties.nombre_achats || '0') || 0;

      const isFirstPurchase = !currentProperties.date_premier_achat;

      const updatedProperties = {
        statut: 'client',
        produits_achetes: productsList.join(','),
        date_dernier_achat: dateStr,
        valeur_client: (currentValeur + amount).toFixed(2),
        nombre_achats: currentNombreAchats + 1,
        est_client: 'True',
      };

      // Si c'est le premier achat, définir date_premier_achat
      if (isFirstPurchase) {
        updatedProperties.date_premier_achat = dateStr;
      }

      // Mettre à jour les properties
      await updateMailjetContactProperties(email, updatedProperties, mailjetApiKey, mailjetApiSecret);

      // Ajouter le contact à la liste principale si pas déjà dedans
      const listId = '10524140';
      const addToListUrl = `https://api.mailjet.com/v3/REST/listrecipient`;
      try {
        await fetch(addToListUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
          },
          body: JSON.stringify({
            IsUnsubscribed: false,
            ContactAlt: email.toLowerCase().trim(),
            ListID: parseInt(listId, 10),
          }),
        });
      } catch {
        // Ignorer si déjà dans la liste
        console.log('Contact may already be in list or error adding to list');
      }
    } catch (error) {
      console.error('Error updating MailJet contact properties after purchase:', error.message);
      // Ne pas bloquer le processus si la mise à jour des properties échoue
    }
  }

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
          // Récupérer le montant en CHF
          const amountTotal = session.amount_total || 0;
          const currency = (session.currency || 'chf').toUpperCase();
          let amountCHF = 0;

          // Convertir en CHF si nécessaire (taux approximatifs)
          if (currency === 'CHF') {
            amountCHF = amountTotal / 100; // Stripe utilise les centimes
          } else if (currency === 'EUR') {
            amountCHF = (amountTotal / 100) * 1.05; // Approximation 1 EUR = 1.05 CHF
          } else if (currency === 'USD') {
            amountCHF = (amountTotal / 100) * 0.95; // Approximation 1 USD = 0.95 CHF
          } else {
            amountCHF = amountTotal / 100; // Par défaut, considérer comme CHF
          }

          await createTokenAndSendEmail(
              customerEmail,
              product,
              30,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
              amountCHF,
          );
          console.log(
              `Token created and email sent to ${customerEmail} for product ${product}, amount: ${amountCHF} CHF`,
          );
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
          // Récupérer le montant en CHF depuis PayPal
          const purchaseUnits = resource.purchase_units || [];
          const amount = purchaseUnits[0]?.amount || {};
          const value = parseFloat(amount.value || 0);
          const currency = (amount.currency_code || 'CHF').toUpperCase();
          let amountCHF = 0;

          // Convertir en CHF si nécessaire (taux approximatifs)
          if (currency === 'CHF') {
            amountCHF = value;
          } else if (currency === 'EUR') {
            amountCHF = value * 1.05; // Approximation 1 EUR = 1.05 CHF
          } else if (currency === 'USD') {
            amountCHF = value * 0.95; // Approximation 1 USD = 0.95 CHF
          } else {
            amountCHF = value; // Par défaut, considérer comme CHF
          }

          await createTokenAndSendEmail(
              customerEmail,
              product,
              30,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
              amountCHF,
          );
          console.log(
              `Token created and email sent to ${customerEmail} for product ${product}, amount: ${amountCHF} CHF`,
          );
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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'TURNSTILE_SECRET_KEY'],
      cors: true, // Autoriser CORS pour toutes les origines
    },
    async (request) => {
      const {email, name, turnstileToken, isLocalhost} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      // Valider le token Turnstile (sauf en développement local)
      if (!isLocalhost && !turnstileToken) {
        throw new HttpsError('invalid-argument', 'Turnstile verification required');
      }

      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
      // Valider Turnstile seulement si pas en localhost et si le secret est configuré
      if (!isLocalhost && turnstileSecret && turnstileToken) {
        try {
          // Obtenir l'IP du client depuis les headers
          const clientIP = request.rawRequest?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
                          request.rawRequest?.headers?.['x-real-ip'] ||
                          '';

          // Valider le token avec Cloudflare Turnstile
          const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstileToken,
              remoteip: clientIP,
            }),
          });

          const turnstileResult = await turnstileResponse.json();

          if (!turnstileResult.success) {
            console.error('Turnstile verification failed:', turnstileResult);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }
        } catch (error) {
          if (error instanceof HttpsError) {
            throw error;
          }
          console.error('Error verifying Turnstile token:', error);
          throw new HttpsError('internal', 'Error verifying bot protection');
        }
      } else if (!isLocalhost && !turnstileSecret) {
        console.warn('TURNSTILE_SECRET_KEY not configured. Skipping bot verification.');
      } else if (isLocalhost) {
        console.log('Skipping Turnstile verification in localhost environment.');
      }

      try {
        // Générer un token de confirmation unique pour le double opt-in
        const confirmationToken = generateUniqueToken();
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7); // Token valide 7 jours

        // Stocker le token de confirmation dans Firestore
        await db.collection('newsletterConfirmations').doc(confirmationToken).set({
          email: email.toLowerCase().trim(),
          name: name || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: expirationDate,
          confirmed: false,
          sourceOptin: '2pratiques',
        });

        // Ajouter le contact à MailJet
        // Note: IsOptInPending ne peut pas être défini directement via l'API
        // Il sera géré automatiquement par MailJet lors du processus de double opt-in
        const url = 'https://api.mailjet.com/v3/REST/contact';

        const contactData = {
          Email: email.toLowerCase().trim(),
          IsExcludedFromCampaigns: false,
          // IsOptInPending ne peut pas être défini ici - MailJet le gère automatiquement
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
        } catch {
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

        // Ajouter le contact à la liste principale MailJet (10524140)
        const listId = '10524140';
        const addToListUrl = `https://api.mailjet.com/v3/REST/listrecipient`;

        try {
          const listResponse = await fetch(addToListUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify({
              IsUnsubscribed: false,
              ContactAlt: contactData.Email,
              ListID: parseInt(listId, 10),
            }),
          });

          if (!listResponse.ok) {
            const errorText = await listResponse.text();
            // Si le contact est déjà dans la liste, ce n'est pas une erreur critique
            if (listResponse.status === 400 && errorText.includes('already')) {
              console.log(`Contact ${contactData.Email} is already in list ${listId}`);
            } else {
              console.error('Error adding contact to MailJet list:', errorText);
            }
          } else {
            console.log(`Contact ${contactData.Email} successfully added to list ${listId}`);
          }
        } catch {
          console.error('Error adding contact to MailJet list');
        }

        // Définir les contact properties pour l'opt-in 2 pratiques
        const now = new Date();
        // Format ISO 8601 complet avec heure pour les propriétés datetime Mailjet
        const dateStr = now.toISOString(); // Format: YYYY-MM-DDTHH:MM:SS.sssZ

        const properties = {
          statut: 'prospect',
          source_optin: '2pratiques',
          date_optin: dateStr,
          est_client: 'False',
        };

        console.log('📋 Starting MailJet contact properties update for 2 pratiques:', contactData.Email);
        console.log('📋 Properties to set:', JSON.stringify(properties));
        await updateMailjetContactProperties(
            contactData.Email,
            properties,
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );
        console.log('📋 MailJet contact properties update completed for:', contactData.Email);

        // Envoyer l'email de confirmation avec le template MailJet
        console.log('📧 Starting email confirmation process for:', contactData.Email);
        const confirmationUrl = `https://fluance.io/confirm?email=${encodeURIComponent(contactData.Email)}&token=${confirmationToken}&redirect=2pratiques`;

        let emailSent = false;
        let emailError = null;

        console.log('📧 About to send confirmation email, token:', confirmationToken);
        try {
          const emailPayload = {
            Messages: [
              {
                From: {
                  Email: 'support@actu.fluance.io',
                  Name: 'Cédric de Fluance',
                },
                To: [
                  {
                    Email: contactData.Email,
                    Name: name || contactData.Email,
                  },
                ],
                TemplateID: 7571938,
                TemplateLanguage: true,
                TemplateErrorDeliver: true, // Envoyer même en cas d'erreur de template
                TemplateErrorReporting: 'support@actu.fluance.io', // Recevoir les erreurs de template
                Subject: 'Dernière étape indispensable [[data:firstname:""]]',
                Variables: {
                  token: confirmationToken,
                  email: contactData.Email,
                  firstname: name || '',
                  redirect: '2pratiques',
                },
              },
            ],
          };

          console.log('Sending confirmation email with payload:', JSON.stringify(emailPayload, null, 2));

          const emailResponse = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify(emailPayload),
          });

          // Lire la réponse même en cas d'erreur pour avoir les détails
          let responseData;
          try {
            const responseText = await emailResponse.text();
            responseData = responseText ? JSON.parse(responseText) : {};
          } catch (parseError) {
            console.error('Failed to parse MailJet response as JSON:', parseError);
            // Si on ne peut pas parser, essayer de relire (mais ça peut échouer)
            try {
              const responseClone = emailResponse.clone();
              const rawText = await responseClone.text();
              responseData = {error: 'Failed to parse response', raw: rawText};
            } catch {
              responseData = {error: 'Failed to parse response and cannot read raw text'};
            }
          }

          if (!emailResponse.ok) {
            emailError = `MailJet API error: ${emailResponse.status} - ${JSON.stringify(responseData)}`;
            console.error('❌ Error sending confirmation email:', emailError);
            console.error('Response status:', emailResponse.status);
            console.error('Response headers:', Object.fromEntries(emailResponse.headers.entries()));
            console.error('Response data:', JSON.stringify(responseData, null, 2));

            // Essayer d'envoyer un email simple en fallback si le template échoue
            if (emailResponse.status === 400 || emailResponse.status === 404) {
              console.log('⚠️ Template may not exist or be invalid. Attempting fallback email...');
              try {
                const fallbackHtml = `
                  <!DOCTYPE html>
                  <html>
                  <head><meta charset="UTF-8"></head>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>Dernière étape indispensable ${name ? name : ''}</h2>
                    <p>Merci de confirmer votre inscription à la newsletter Fluance.</p>
                    <p>Cliquez sur le lien ci-dessous pour confirmer :</p>
                    <p>
                      <a href="${confirmationUrl}" style="display: inline-block; padding: 12px 24px;
                        background-color: #ffce2d; color: #0f172a; text-decoration: none;
                        border-radius: 4px; font-weight: bold;">
                        Confirmer mon inscription
                      </a>
                    </p>
                    <p>Ou copiez ce lien dans votre navigateur :</p>
                    <p style="word-break: break-all;">${confirmationUrl}</p>
                    <p>Ce lien est valide pendant 7 jours.</p>
                  </body>
                  </html>
                `;

                const fallbackResponse = await fetch('https://api.mailjet.com/v3.1/send', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`,
                  },
                  body: JSON.stringify({
                    Messages: [
                      {
                        From: {
                          Email: 'support@actu.fluance.io',
                          Name: 'Cédric de Fluance',
                        },
                        To: [
                          {
                            Email: contactData.Email,
                            Name: name || contactData.Email,
                          },
                        ],
                        Subject: `Dernière étape indispensable ${name ? name : ''}`,
                        HTMLPart: fallbackHtml,
                        TextPart: `Merci de confirmer votre inscription. Cliquez sur ce lien : ${confirmationUrl}`,
                      },
                    ],
                  }),
                });

                const fallbackData = await fallbackResponse.json();
                if (fallbackResponse.ok) {
                  emailSent = true;
                  emailError = null;
                  console.log('✅ Fallback email sent successfully');
                } else {
                  console.error('❌ Fallback email also failed:', JSON.stringify(fallbackData, null, 2));
                }
              } catch (fallbackErr) {
                console.error('❌ Exception sending fallback email:', fallbackErr);
              }
            }
          } else {
            emailSent = true;
            emailError = null;
            console.log(`✅ Confirmation email sent successfully to ${contactData.Email}`);
            console.log('MailJet response:', JSON.stringify(responseData, null, 2));

            // Vérifier que l'email est bien dans la réponse
            if (responseData.Messages && responseData.Messages.length > 0) {
              const messageStatus = responseData.Messages[0];
              console.log('Message status:', JSON.stringify(messageStatus, null, 2));
              if (messageStatus.Errors && messageStatus.Errors.length > 0) {
                console.error('⚠️ MailJet reported errors in message:', messageStatus.Errors);
                emailError = `MailJet message errors: ${JSON.stringify(messageStatus.Errors)}`;
                emailSent = false;
              }
            }
          }
        } catch (err) {
          emailError = `Exception: ${err.message}`;
          console.error('Exception sending confirmation email:', emailError);
          console.error('Stack trace:', err.stack);
        }

        return {
          success: true,
          message: emailSent ?
            'Confirmation email sent. Please check your inbox.' :
            'Contact created but confirmation email may not have been sent. Please check logs.',
          email: contactData.Email,
          emailSent: emailSent,
          emailError: emailError || null,
        };
      } catch (error) {
        console.error('Error subscribing to newsletter:', error);
        throw new HttpsError('internal', 'Error subscribing to newsletter: ' + error.message);
      }
    });

/**
 * Confirme l'opt-in newsletter (double opt-in)
 * Cette fonction est publique (pas besoin d'authentification admin)
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.confirmNewsletterOptIn = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
      cors: true, // Autoriser CORS pour toutes les origines
    },
    async (request) => {
      const {email, token} = request.data;

      if (!email || !token) {
        throw new HttpsError('invalid-argument', 'Email and token are required');
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      try {
        // Vérifier le token dans Firestore
        const tokenDoc = await db.collection('newsletterConfirmations').doc(token).get();

        if (!tokenDoc.exists) {
          throw new HttpsError('not-found', 'Token invalide');
        }

        const tokenData = tokenDoc.data();

        // Vérifier que l'email correspond
        if (tokenData.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
          throw new HttpsError('permission-denied', 'Email does not match token');
        }

        // Vérifier si déjà confirmé
        if (tokenData.confirmed) {
          return {
            success: true,
            message: 'Email already confirmed',
            email: email,
            alreadyConfirmed: true,
          };
        }

        // Vérifier si le token a expiré
        const now = new Date();
        const expiresAt = tokenData.expiresAt.toDate();
        if (now > expiresAt) {
          throw new HttpsError('deadline-exceeded', 'Ce lien de confirmation a expiré. Veuillez vous réinscrire.');
        }

        const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');

        // Note: MailJet ne permet pas de modifier IsOptInPending directement via l'API
        // Le statut d'opt-in est géré automatiquement par MailJet
        // On se contente de marquer le token comme confirmé dans Firestore
        // et d'ajouter le contact à la liste si nécessaire
        console.log(`Confirming opt-in for ${email} - MailJet will handle IsOptInPending automatically`);

        // Marquer le token comme confirmé dans Firestore
        await db.collection('newsletterConfirmations').doc(token).update({
          confirmed: true,
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Ajouter le contact à la liste principale MailJet (10524140)
        const listId = '10524140';
        const addToListUrl = `https://api.mailjet.com/v3/REST/listrecipient`;

        try {
          const listResponse = await fetch(addToListUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify({
              IsUnsubscribed: false,
              ContactAlt: email.toLowerCase().trim(),
              ListID: parseInt(listId, 10),
            }),
          });

          if (!listResponse.ok) {
            const errorText = await listResponse.text();
            // Si le contact est déjà dans la liste, ce n'est pas une erreur critique
            if (listResponse.status === 400 && errorText.includes('already')) {
              console.log(`Contact ${email} is already in list ${listId}`);
            } else {
              console.error('Error adding contact to MailJet list:', errorText);
            }
          } else {
            console.log(`Contact ${email} successfully added to list ${listId}`);
          }
        } catch {
          console.error('Error adding contact to MailJet list');
        }

        return {
          success: true,
          message: 'Email confirmed successfully',
          email: email,
          sourceOptin: tokenData.sourceOptin || null,
        };
      } catch (error) {
        console.error('Error confirming newsletter opt-in:', error);
        if (error instanceof HttpsError) {
          throw error;
        }
        throw new HttpsError('internal', 'Error confirming newsletter opt-in: ' + error.message);
      }
    });

/**
 * Inscription à la newsletter 5 jours (liste MailJet spécifique)
 * Cette fonction est publique (pas besoin d'authentification admin)
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 * Liste MailJet : 10524236
 */
exports.subscribeTo5Days = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'TURNSTILE_SECRET_KEY'],
      cors: true,
    },
    async (request) => {
      const {email, name, turnstileToken, isLocalhost} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      // Valider le token Turnstile (sauf en développement local)
      if (!isLocalhost && !turnstileToken) {
        throw new HttpsError('invalid-argument', 'Turnstile verification required');
      }

      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
      // Valider Turnstile seulement si pas en localhost et si le secret est configuré
      if (!isLocalhost && turnstileSecret && turnstileToken) {
        try {
          const clientIP = request.rawRequest?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
                          request.rawRequest?.headers?.['x-real-ip'] ||
                          '';

          const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstileToken,
              remoteip: clientIP,
            }),
          });

          const turnstileResult = await turnstileResponse.json();

          if (!turnstileResult.success) {
            console.error('Turnstile verification failed:', turnstileResult);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }
        } catch (error) {
          if (error instanceof HttpsError) {
            throw error;
          }
          console.error('Error verifying Turnstile token:', error);
          throw new HttpsError('internal', 'Error verifying bot protection');
        }
      } else if (!isLocalhost && !turnstileSecret) {
        console.warn('TURNSTILE_SECRET_KEY not configured. Skipping bot verification.');
      } else if (isLocalhost) {
        console.log('Skipping Turnstile verification in localhost environment.');
      }

      try {
        // Générer un token de confirmation unique pour le double opt-in
        const confirmationToken = generateUniqueToken();
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7); // Token valide 7 jours

        // Stocker le token de confirmation dans Firestore
        await db.collection('newsletterConfirmations').doc(confirmationToken).set({
          email: email.toLowerCase().trim(),
          name: name || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: expirationDate,
          confirmed: false,
          sourceOptin: '5joursofferts',
        });

        // Ajouter le contact à MailJet
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
        } catch {
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

        // Ajouter le contact à la liste principale MailJet (10524140)
        const listId = '10524140';
        const addToListUrl = `https://api.mailjet.com/v3/REST/listrecipient`;

        try {
          const listResponse = await fetch(addToListUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify({
              IsUnsubscribed: false,
              ContactAlt: contactData.Email,
              ListID: parseInt(listId, 10),
            }),
          });

          if (!listResponse.ok) {
            const errorText = await listResponse.text();
            if (listResponse.status === 400 && errorText.includes('already')) {
              console.log(`Contact ${contactData.Email} is already in list ${listId}`);
            } else {
              console.error('Error adding contact to MailJet list:', errorText);
            }
          } else {
            console.log(`Contact ${contactData.Email} successfully added to list ${listId}`);
          }
        } catch (listError) {
          console.error('Error adding contact to MailJet list:', listError.message);
        }

        // Définir les contact properties pour l'opt-in 5 jours
        console.log('📋 Starting MailJet contact properties update for 5 jours:', contactData.Email);
        await ensureMailjetContactProperties(process.env.MAILJET_API_KEY, process.env.MAILJET_API_SECRET);
        const now = new Date();
        // Format ISO 8601 complet avec heure pour les propriétés datetime Mailjet
        const dateStr = now.toISOString(); // Format: YYYY-MM-DDTHH:MM:SS.sssZ

        // Récupérer les properties actuelles pour ne pas écraser source_optin si déjà défini
        let currentProperties = {};
        try {
          const contactDataUrl = `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(contactData.Email)}`;
          console.log('📋 Fetching current contact properties from:', contactDataUrl);
          const getResponse = await fetch(contactDataUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
            },
          });
          if (getResponse.ok) {
            const getData = await getResponse.json();
            if (getData.Data && getData.Data.length > 0) {
              const contactData = getData.Data[0];
              if (contactData.Data) {
                // Si Data est un tableau (format standard Mailjet)
                if (Array.isArray(contactData.Data)) {
                  // Convertir le tableau [{Name, Value}] en objet {name: value}
                  contactData.Data.forEach((item) => {
                    if (item.Name && item.Value !== undefined) {
                      currentProperties[item.Name] = item.Value;
                    }
                  });
                } else if (typeof contactData.Data === 'object') {
                  // Si Data est déjà un objet (format alternatif)
                  currentProperties = contactData.Data;
                }
              }
              console.log('📋 Current properties found:', JSON.stringify(currentProperties));
            } else {
              console.log('📋 No existing properties found');
            }
          } else {
            console.log('📋 Contact properties not found (status:', getResponse.status, ')');
          }
        } catch (error) {
          console.log('📋 Error fetching contact properties, will create new ones:', error.message);
        }

        // Si source_optin existe déjà, l'ajouter à la liste (séparée par virgules)
        const currentSourceOptin = currentProperties.source_optin || '';
        const sourceOptinListBase = currentSourceOptin ? currentSourceOptin.split(',').map((s) => s.trim()).filter((s) => s) : [];
        const sourceOptinList = sourceOptinListBase.includes('5joursofferts') ?
          sourceOptinListBase :
          [...sourceOptinListBase, '5joursofferts'];

        const properties = {
          statut: 'prospect',
          source_optin: sourceOptinList.join(','),
          date_optin: dateStr,
          est_client: 'False',
        };

        // Si date_optin existe déjà et est plus ancienne, la conserver
        // Comparer les dates au format ISO (YYYY-MM-DD) ou ancien format (JJ/MM/AAAA)
        if (currentProperties.date_optin) {
          const currentDate = currentProperties.date_optin;
          // Convertir l'ancien format JJ/MM/AAAA en YYYY-MM-DD si nécessaire
          let currentDateISO = currentDate;
          if (currentDate.includes('/')) {
            const [day, month, year] = currentDate.split('/');
            currentDateISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          // Comparer les dates ISO
          if (currentDateISO < dateStr) {
            properties.date_optin = currentDateISO; // Utiliser le format ISO
          }
        }

        console.log('📋 Updating MailJet contact properties with:', JSON.stringify(properties));
        await updateMailjetContactProperties(
            contactData.Email,
            properties,
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );
        console.log('📋 MailJet contact properties update completed for:', contactData.Email);

        // Envoyer l'email de confirmation avec le template MailJet
        console.log('📧 Starting email confirmation process for 5 jours:', contactData.Email);
        const confirmationUrl = `https://fluance.io/confirm?email=${encodeURIComponent(contactData.Email)}&token=${confirmationToken}&redirect=5joursofferts`;

        let emailSent = false;
        let emailError = null;

        console.log('📧 About to send confirmation email, token:', confirmationToken);
        try {
          const emailPayload = {
            Messages: [
              {
                From: {
                  Email: 'support@actu.fluance.io',
                  Name: 'Cédric de Fluance',
                },
                To: [
                  {
                    Email: contactData.Email,
                    Name: name || contactData.Email,
                  },
                ],
                TemplateID: 7571938,
                TemplateLanguage: true,
                TemplateErrorDeliver: true,
                TemplateErrorReporting: 'support@actu.fluance.io',
                Subject: 'Dernière étape indispensable [[data:firstname:""]]',
                Variables: {
                  token: confirmationToken,
                  email: contactData.Email,
                  firstname: name || '',
                  redirect: '5joursofferts',
                },
              },
            ],
          };

          console.log('Sending confirmation email with payload:', JSON.stringify(emailPayload, null, 2));

          const emailResponse = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify(emailPayload),
          });

          // Lire la réponse même en cas d'erreur pour avoir les détails
          let responseData;
          try {
            const responseText = await emailResponse.text();
            responseData = responseText ? JSON.parse(responseText) : {};
          } catch (parseError) {
            console.error('Failed to parse MailJet response as JSON:', parseError);
            try {
              const responseClone = emailResponse.clone();
              const rawText = await responseClone.text();
              responseData = {error: 'Failed to parse response', raw: rawText};
            } catch {
              responseData = {error: 'Failed to parse response and cannot read raw text'};
            }
          }

          if (!emailResponse.ok) {
            emailError = `MailJet API error: ${emailResponse.status} - ${JSON.stringify(responseData)}`;
            console.error('❌ Error sending confirmation email:', emailError);
            console.error('Response status:', emailResponse.status);
            console.error('Response headers:', Object.fromEntries(emailResponse.headers.entries()));
            console.error('Response data:', JSON.stringify(responseData, null, 2));

            // Essayer d'envoyer un email simple en fallback si le template échoue
            if (emailResponse.status === 400 || emailResponse.status === 404) {
              console.log('⚠️ Template may not exist or be invalid. Attempting fallback email...');
              try {
                const fallbackHtml = `
                  <!DOCTYPE html>
                  <html>
                  <head><meta charset="UTF-8"></head>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>Dernière étape indispensable ${name ? name : ''}</h2>
                    <p>Merci de confirmer votre inscription aux 5 pratiques Fluance.</p>
                    <p>Cliquez sur le lien ci-dessous pour confirmer :</p>
                    <p>
                      <a href="${confirmationUrl}" style="display: inline-block; padding: 12px 24px;
                        background-color: #ffce2d; color: #0f172a; text-decoration: none;
                        border-radius: 4px; font-weight: bold;">
                        Confirmer mon inscription
                      </a>
                    </p>
                    <p>Ou copiez ce lien dans votre navigateur :</p>
                    <p style="word-break: break-all;">${confirmationUrl}</p>
                    <p>Ce lien est valide pendant 7 jours.</p>
                  </body>
                  </html>
                `;

                const fallbackResponse = await fetch('https://api.mailjet.com/v3.1/send', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`,
                  },
                  body: JSON.stringify({
                    Messages: [
                      {
                        From: {
                          Email: 'support@actu.fluance.io',
                          Name: 'Cédric de Fluance',
                        },
                        To: [
                          {
                            Email: contactData.Email,
                            Name: name || contactData.Email,
                          },
                        ],
                        Subject: `Dernière étape indispensable ${name ? name : ''}`,
                        HTMLPart: fallbackHtml,
                        TextPart: `Merci de confirmer votre inscription. Cliquez sur ce lien : ${confirmationUrl}`,
                      },
                    ],
                  }),
                });

                const fallbackData = await fallbackResponse.json();
                if (fallbackResponse.ok) {
                  emailSent = true;
                  emailError = null;
                  console.log('✅ Fallback email sent successfully');
                } else {
                  console.error('❌ Fallback email also failed:', JSON.stringify(fallbackData, null, 2));
                }
              } catch (fallbackErr) {
                console.error('❌ Exception sending fallback email:', fallbackErr);
              }
            }
          } else {
            emailSent = true;
            emailError = null;
            console.log(`✅ Confirmation email sent successfully to ${contactData.Email}`);
            console.log('MailJet response:', JSON.stringify(responseData, null, 2));

            // Vérifier que l'email est bien dans la réponse
            if (responseData.Messages && responseData.Messages.length > 0) {
              const messageStatus = responseData.Messages[0];
              console.log('Message status:', JSON.stringify(messageStatus, null, 2));
              if (messageStatus.Errors && messageStatus.Errors.length > 0) {
                console.error('⚠️ MailJet reported errors in message:', messageStatus.Errors);
                emailError = `MailJet message errors: ${JSON.stringify(messageStatus.Errors)}`;
                emailSent = false;
              }
            }
          }
        } catch (err) {
          emailError = `Exception: ${err.message}`;
          console.error('Exception sending confirmation email:', emailError);
          console.error('Stack trace:', err.stack);
        }

        return {
          success: true,
          message: emailSent ?
            'Confirmation email sent. Please check your inbox.' :
            'Contact created but confirmation email may not have been sent. Please check logs.',
          email: contactData.Email,
          emailSent: emailSent,
          emailError: emailError || null,
        };
      } catch (error) {
        console.error('Error subscribing to 5 days:', error);
        throw new HttpsError('internal', 'Error subscribing to 5 days: ' + error.message);
      }
    });

