/**
 * Firebase Functions pour Fluance - Contenu protégé
 *
 * Fonctions :
 * - webhookStripe : Gère les webhooks Stripe pour générer les tokens
 * - webhookPayPal : Gère les webhooks PayPal pour générer les tokens
 * - createStripeCheckoutSession : Crée une session Stripe Checkout
 * - createUserToken : Crée manuellement un token pour un utilisateur
 * - verifyToken : Vérifie un token et crée le compte Firebase Auth
 * - sendEmail : Envoie un email via Mailjet
 */

const {onRequest, onCall} = require('firebase-functions/v2/https');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {setGlobalOptions} = require('firebase-functions/v2');
const {HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
    'serie_5jours_debut',
    'serie_5jours_status',
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

/**
 * Charge un template email HTML et remplace les variables
 * @param {string} templateName - Nom du template (sans extension .html)
 * @param {object} variables - Objet avec les variables à remplacer
 * @returns {string} HTML avec variables remplacées
 */
function loadEmailTemplate(templateName, variables = {}) {
  const templatePath = path.join(__dirname, 'emails', `${templateName}.html`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}.html`);
  }

  let html = fs.readFileSync(templatePath, 'utf8');

  // Remplacer les variables au format {{variable}}
  Object.keys(variables).forEach((key) => {
    const value = variables[key] || '';
    // Remplacer {{key}} partout dans le HTML
    // Cas 1 : Avec espace avant (ex: "Bonjour {{firstName}}," -> "Bonjour Cédric," ou "Bonjour,")
    const regexWithSpace = new RegExp(`\\s+\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regexWithSpace, value ? ` ${value}` : '');

    // Cas 2 : Sans espace avant (ex: href="{{confirmationUrl}}" -> href="https://...")
    const regexWithoutSpace = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regexWithoutSpace, value);
  });

  // Nettoyer les placeholders non remplacés (optionnel, pour debug)
  html = html.replace(/\{\{[\w]+\}\}/g, '');

  return html;
}

async function sendMailjetEmail(to, subject, htmlContent, textContent = null, apiKey, apiSecret, fromEmail = 'support@actu.fluance.io', fromName = 'Fluance') {
  // Vérifier que les credentials Mailjet sont configurés
  if (!apiKey || !apiSecret) {
    throw new Error('Mailjet credentials not configured. Please set MAILJET_API_KEY and MAILJET_API_SECRET secrets using: firebase functions:secrets:set');
  }

  const url = 'https://api.mailjet.com/v3.1/send';

  const body = {
    Messages: [
      {
        From: {
          Email: fromEmail,
          Name: fromName,
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

  console.log(`[Mailjet] Sending email via Mailjet to: ${to}`);
  console.log(`[Mailjet] Subject: ${subject}`);
  console.log(`[Mailjet] From: ${fromEmail}`);

  // Vérifier que les credentials sont présents (sans les logger)
  if (!apiKey || !apiSecret) {
    throw new Error('Mailjet credentials not configured');
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log(`[Mailjet] API response status: ${response.status}`);
    console.log(`[Mailjet] Response preview: ${responseText.substring(0, 300)}`);

    if (!response.ok) {
      // Logger seulement le statut et un résumé de l'erreur (pas les détails complets)
      try {
        const errorData = JSON.parse(responseText);
        const errorMessage = errorData.ErrorMessage || errorData.ErrorInfo || 'Unknown error';
        console.error(`❌ Mailjet API error: ${response.status} - ${errorMessage}`);
        throw new Error(`Mailjet API error: ${response.status} - ${errorMessage}`);
      } catch {
        // Si la réponse n'est pas du JSON, logger seulement le statut
        console.error(`❌ Mailjet API error: ${response.status}`);
        throw new Error(`Mailjet API error: ${response.status}`);
      }
    }

    // Parser la réponse seulement si elle est OK
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      // Logger seulement les informations non sensibles
      if (responseData.Messages && responseData.Messages.length > 0) {
        const messageStatus = responseData.Messages[0].Status || 'unknown';
        console.log(`✅ Email sent successfully via Mailjet to ${to} (Status: ${messageStatus})`);
      } else {
        console.log(`✅ Email sent successfully via Mailjet to ${to}`);
      }
    } catch {
      // Si la réponse n'est pas du JSON valide, retourner quand même un objet
      console.log(`✅ Email sent successfully via Mailjet to ${to}`);
      responseData = {success: true};
    }

    return responseData;
  } catch (error) {
    // Logger seulement le message d'erreur, pas la stack trace complète qui pourrait contenir des infos sensibles
    console.error(`❌ Error in sendMailjetEmail: ${error.message}`);
    throw error;
  }
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
  const emailHtml = loadEmailTemplate('creation-compte', {
    product: product,
    registrationUrl: registrationUrl,
    expirationDays: expirationDays.toString(),
  });

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
 * Retire un produit du tableau products d'un utilisateur dans Firestore
 * @param {string} email - Email de l'utilisateur
 * @param {string} productName - Nom du produit à retirer ('complet' ou '21jours')
 */
async function removeProductFromUser(email, productName) {
  try {
    const emailLower = email.toLowerCase().trim();
    const userRef = db.collection('users').doc(emailLower);

    // Récupérer le document utilisateur
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`User document not found for ${emailLower}`);
      return {success: false, message: 'User not found'};
    }

    const userData = userDoc.data();
    let products = userData.products || [];

    // Si products n'existe pas mais product existe (ancien format), migrer
    if (products.length === 0 && userData.product) {
      products = [{
        name: userData.product,
        startDate: userData.registrationDate || userData.createdAt,
        purchasedAt: userData.createdAt,
      }];
    }

    // Retirer le produit du tableau
    const initialLength = products.length;
    products = products.filter((p) => p.name !== productName);

    if (products.length === initialLength) {
      console.log(`Product ${productName} not found in user ${emailLower} products`);
      return {success: false, message: 'Product not found in user products'};
    }

    // Mettre à jour le document utilisateur
    await userRef.update({
      products: products,
    });

    console.log(`Product ${productName} removed from user ${emailLower}`);
    return {success: true, message: 'Product removed successfully'};
  } catch (error) {
    console.error(`Error removing product ${productName} from user ${email}:`, error);
    throw error;
  }
}

/**
 * Webhook Stripe - Gère les paiements réussis, annulations et échecs
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.webhookStripe = onRequest(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'STRIPE_WEBHOOK_SECRET'],
    },
    async (req, res) => {
      // Vérifier la signature Stripe
      const sig = req.headers['stripe-signature'];

      // Note: Pour utiliser Stripe, installer le package: npm install stripe
      // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      let event;

      try {
        // Si le package Stripe est installé et le secret configuré, vérifier la signature
        if (process.env.STRIPE_WEBHOOK_SECRET && typeof require !== 'undefined') {
          try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
            event = stripe.webhooks.constructEvent(
                req.rawBody || JSON.stringify(req.body),
                sig,
                process.env.STRIPE_WEBHOOK_SECRET,
            );
          } catch {
            // Si le package Stripe n'est pas installé, accepter l'événement tel quel (développement)
            console.warn('Stripe package not installed or webhook secret not configured, ' +
                'accepting event without verification');
            event = req.body;
          }
        } else {
          // Pour l'instant, on accepte l'événement tel quel (à sécuriser en production)
          console.warn('STRIPE_WEBHOOK_SECRET not configured, accepting event without verification');
          event = req.body;
        }
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Gérer les événements de paiement réussi
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
        if (!product || (product !== '21jours' && product !== 'complet' && product !== 'rdv-clarte')) {
          console.error(`Paiement Stripe ignoré - produit invalide: ${product}`);
          return res.status(200).json({received: true, ignored: true});
        }

        // Pour le RDV Clarté (cedricv.com), pas besoin de créer un token ni d'envoyer d'email
        // Le paiement est juste loggé et la redirection se fait via success_url
        if (product === 'rdv-clarte') {
          console.log(`Paiement RDV Clarté réussi - Email: ${customerEmail}, Session: ${session.id}`);
          return res.status(200).json({
            received: true,
            product: 'rdv-clarte',
            message: 'Payment successful, redirecting to confirmation page',
          });
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

      // Gérer les événements d'annulation d'abonnement
      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const customerEmail = subscription.metadata?.email || subscription.customer_email;

        if (!customerEmail) {
          console.error('No email found in subscription cancellation event');
          return res.status(400).send('No email found');
        }

        // Vérifier si c'est pour le système Firebase
        const system = subscription.metadata?.system;
        if (system !== 'firebase') {
          console.log(`Subscription cancellation ignored - système: ${system || 'non défini'}`);
          return res.status(200).json({received: true, ignored: true});
        }

        // Vérifier le produit
        const product = subscription.metadata?.product;
        if (product !== 'complet' && product !== 'rdv-clarte') {
          console.log(
              `Subscription cancellation ignored - produit: ${product} ` +
              `(seul 'complet' ou 'rdv-clarte' peuvent être annulés)`,
          );
          return res.status(200).json({received: true, ignored: true});
        }

        try {
          if (product === 'rdv-clarte') {
            // Pour le RDV Clarté, pas d'espace membre, juste logger l'annulation
            console.log(`Abonnement RDV Clarté annulé - Email: ${customerEmail}, Subscription: ${subscription.id}`);
            // TODO: Si vous avez besoin de notifier le client ou de faire d'autres actions, ajoutez-les ici
            return res.status(200).json({
              received: true,
              product: 'rdv-clarte',
              message: 'Subscription cancelled successfully',
            });
          } else {
            // Pour 'complet', retirer le produit de l'utilisateur
            await removeProductFromUser(customerEmail, 'complet');
            console.log(`Subscription cancelled and product 'complet' removed for ${customerEmail}`);
            return res.status(200).json({received: true});
          }
        } catch (error) {
          console.error('Error removing product after subscription cancellation:', error);
          return res.status(500).send('Error processing cancellation');
        }
      }

      // Gérer les événements d'échec de paiement
      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object;
        const customerEmail = invoice.customer_email;

        if (!customerEmail) {
          console.error('No email found in payment failed event');
          return res.status(400).send('No email found');
        }

        // Récupérer les métadonnées de la subscription si disponible
        const subscriptionId = invoice.subscription;
        if (subscriptionId) {
          try {
            // Note: Pour invoice.payment_failed, on ne retire pas immédiatement l'accès
            // On pourrait envoyer un email de notification au client
            // L'accès sera retiré seulement si l'abonnement est finalement annulé
            console.log(`Payment failed for ${customerEmail}, subscription: ${subscriptionId}`);
            // TODO: Envoyer un email de notification au client
            // Pour le RDV Clarté, pas d'action supplémentaire nécessaire
            return res.status(200).json({received: true});
          } catch (error) {
            console.error('Error processing payment failed event:', error);
            return res.status(200).json({received: true});
          }
        }

        console.log(`Payment failed for ${customerEmail}, subscription: ${subscriptionId}`);
        // TODO: Envoyer un email de notification au client
        return res.status(200).json({received: true});
      }

      res.status(200).json({received: true});
    });

/**
 * Webhook PayPal - Gère les paiements réussis, annulations et échecs
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

      // Gérer les événements de paiement réussi
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

      // Gérer les événements d'annulation d'abonnement PayPal
      if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ||
          event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
        const resource = event.resource;
        const customerEmail = resource.subscriber?.email_address ||
            resource.payer?.email_address;

        if (!customerEmail) {
          console.error('No email found in PayPal subscription cancellation event');
          return res.status(400).send('No email found');
        }

        // Vérifier si c'est pour le système Firebase via custom_id
        const customId = resource.custom_id || '';
        if (!customId.startsWith('firebase_')) {
          console.log(`PayPal subscription cancellation ignored - custom_id: ${customId || 'non défini'}`);
          return res.status(200).json({received: true, ignored: true});
        }

        // Vérifier le produit
        const product = customId.replace('firebase_', '');
        if (product !== 'complet') {
          console.log(`PayPal subscription cancellation ignored - produit: ${product} ` +
              `(seul 'complet' peut être annulé)`);
          return res.status(200).json({received: true, ignored: true});
        }

        try {
          // Retirer le produit "complet" de l'utilisateur
          await removeProductFromUser(customerEmail, 'complet');
          console.log(`PayPal subscription ${event.event_type} and product 'complet' removed for ${customerEmail}`);
          return res.status(200).json({received: true});
        } catch (error) {
          console.error('Error removing product after PayPal subscription cancellation:', error);
          return res.status(500).send('Error processing cancellation');
        }
      }

      // Gérer les événements d'échec de paiement PayPal
      if (event.event_type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' ||
          event.event_type === 'PAYMENT.SALE.DENIED') {
        const resource = event.resource;
        const customerEmail = resource.subscriber?.email_address ||
            resource.payer?.email_address;

        if (!customerEmail) {
          console.error('No email found in PayPal payment failed event');
          return res.status(400).send('No email found');
        }

        // Note: Pour les échecs de paiement, on ne retire pas immédiatement l'accès
        // On pourrait envoyer un email de notification au client
        // L'accès sera retiré seulement si l'abonnement est finalement annulé
        console.log(`PayPal payment failed for ${customerEmail}, event: ${event.event_type}`);
        // TODO: Envoyer un email de notification au client
        return res.status(200).json({received: true});
      }

      res.status(200).json({received: true});
    });

/**
 * Crée une session Stripe Checkout
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Stripe
 */
exports.createStripeCheckoutSession = onCall(
    {
      region: 'europe-west1',
      secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID_RDV_CLARTE_UNIQUE', 'STRIPE_PRICE_ID_RDV_CLARTE_ABONNEMENT'],
    },
    async (request) => {
      const {product, variant, locale = 'fr'} = request.data;

      // Valider les paramètres
      if (!product || (product !== '21jours' && product !== 'complet' && product !== 'rdv-clarte')) {
        throw new HttpsError('invalid-argument', 'Product must be "21jours", "complet", or "rdv-clarte"');
      }

      if (product === 'complet' && !variant) {
        throw new HttpsError('invalid-argument', 'Variant is required for "complet" product (must be "mensuel" or "trimestriel")');
      }

      if (product === 'complet' && variant !== 'mensuel' && variant !== 'trimestriel') {
        throw new HttpsError('invalid-argument', 'Variant must be "mensuel" or "trimestriel"');
      }

      // Pour rdv-clarte, variant est optionnel : 'unique' (paiement unique) ou 'abonnement' (abonnement mensuel)
      if (product === 'rdv-clarte' && variant && variant !== 'unique' && variant !== 'abonnement') {
        throw new HttpsError('invalid-argument', 'Variant for "rdv-clarte" must be "unique" or "abonnement"');
      }

      // Mapping des produits vers les Price IDs Stripe
      const priceIds = {
        '21jours': 'price_1SdZ2X2Esx6PN6y1wnkrLfSu',
        'complet': {
          'mensuel': 'price_1SdZ4p2Esx6PN6y1bzRGQSC5',
          'trimestriel': 'price_1SdZ6E2Esx6PN6y11qme0Rde',
        },
        'rdv-clarte': {
          // ⚠️ IMPORTANT : Remplacez 'price_XXXXX' par les vrais Price IDs Stripe
          'unique': process.env.STRIPE_PRICE_ID_RDV_CLARTE_UNIQUE || 'price_XXXXX', // 100 CHF, paiement unique
          'abonnement': process.env.STRIPE_PRICE_ID_RDV_CLARTE_ABONNEMENT || 'price_YYYYY', // 69 CHF/mois, abonnement
        },
      };

      // Déterminer le Price ID
      let priceId;
      if (product === '21jours') {
        priceId = priceIds['21jours'];
      } else if (product === 'rdv-clarte') {
        const rdvVariant = variant || 'unique'; // Par défaut, paiement unique
        priceId = priceIds['rdv-clarte'][rdvVariant];
        if (priceId === 'price_XXXXX' || priceId === 'price_YYYYY') {
          const secretName =
              `STRIPE_PRICE_ID_RDV_CLARTE_${rdvVariant.toUpperCase()}`;
          throw new HttpsError(
              'failed-precondition',
              `Stripe Price ID for RDV Clarté (${rdvVariant}) not configured. ` +
              `Set ${secretName} secret.`,
          );
        }
      } else {
        priceId = priceIds['complet'][variant];
      }

      // Déterminer le mode (payment pour one-time, subscription pour abonnements)
      const mode = (product === '21jours' || (product === 'rdv-clarte' && (!variant || variant === 'unique'))) ?
        'payment' :
        'subscription';

      // URLs de redirection selon le produit et la locale
      let baseUrl; let successUrl; let cancelUrl;
      if (product === 'rdv-clarte') {
        // Pour le RDV Clarté, rediriger vers cedricv.com
        baseUrl = 'https://cedricv.com';
        successUrl = locale === 'en' ?
          `${baseUrl}/en/confirmation?session_id={CHECKOUT_SESSION_ID}` :
          `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = locale === 'en' ?
          `${baseUrl}/en/rdv/clarte` :
          `${baseUrl}/rdv/clarte`;
      } else {
        // Pour les autres produits, rediriger vers fluance.io
        baseUrl = 'https://fluance.io';
        successUrl = locale === 'en' ?
          `${baseUrl}/en/success?session_id={CHECKOUT_SESSION_ID}` :
          `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = locale === 'en' ?
          `${baseUrl}/en/cancel` :
          `${baseUrl}/cancel`;
      }

      try {
        // Vérifier si le package Stripe est installé
        let stripe;
        try {
          stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        } catch {
          throw new HttpsError('failed-precondition',
              'Stripe package not installed. Run: npm install stripe in functions/ directory');
        }

        // Créer la session Checkout
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          mode: mode,
          success_url: successUrl,
          cancel_url: cancelUrl,
          // Définir la langue de l'interface Stripe Checkout
          // 'auto' détecte automatiquement la langue du navigateur
          // 'fr' pour français, 'en' pour anglais
          locale: locale === 'en' ? 'en' : 'fr',
          metadata: {
            system: 'firebase',
            product: product,
            // Ajouter le variant pour rdv-clarte si présent
            ...(product === 'rdv-clarte' && variant ? {variant: variant} : {}),
          },
          // Pour les abonnements, passer les métadonnées aussi dans la subscription
          subscription_data: mode === 'subscription' ? {
            metadata: {
              system: 'firebase',
              product: product,
              // Ajouter le variant pour rdv-clarte si présent
              ...(product === 'rdv-clarte' && variant ? {variant: variant} : {}),
            },
          } : undefined,
        });

        return {
          success: true,
          sessionId: session.id,
          url: session.url,
        };
      } catch (error) {
        console.error('Error creating Stripe Checkout session:', error);
        throw new HttpsError('internal', `Error creating checkout session: ${error.message}`);
      }
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

        // Récupérer le document utilisateur existant pour gérer les produits multiples
        const userDocRef = db.collection('users').doc(userRecord.uid);
        const userDoc = await userDocRef.get();
        const existingUserData = userDoc.exists ? userDoc.data() : {};

        // Gérer le tableau de produits
        let products = existingUserData.products || [];

        // Si products n'existe pas mais product existe (ancien format), migrer
        if (products.length === 0 && existingUserData.product) {
          products = [{
            name: existingUserData.product,
            startDate: existingUserData.registrationDate ||
              existingUserData.createdAt ||
              admin.firestore.FieldValue.serverTimestamp(),
            purchasedAt: existingUserData.createdAt ||
              admin.firestore.FieldValue.serverTimestamp(),
          }];
        }

        // Vérifier si le produit existe déjà dans le tableau
        const productExists = products.some((p) => p.name === tokenData.product);
        if (!productExists) {
          // Ajouter le nouveau produit avec sa date de démarrage
          const now = admin.firestore.FieldValue.serverTimestamp();
          products.push({
            name: tokenData.product,
            startDate: now, // Date de démarrage pour le drip
            purchasedAt: now,
          });
        }

        // Créer ou mettre à jour le document utilisateur dans Firestore
        const userData = {
          email: email,
          products: products,
          product: tokenData.product, // Garder pour compatibilité rétroactive
          createdAt: existingUserData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Pour le produit "21jours", ajouter aussi registrationDate pour compatibilité
        if (tokenData.product === '21jours' && !existingUserData.registrationDate) {
          userData.registrationDate = admin.firestore.FieldValue.serverTimestamp();
        }

        await userDocRef.set(userData, {merge: true});

        return {success: true, userId: userRecord.uid, email: email};
      } catch (error) {
        console.error('Error creating user:', error);
        throw new HttpsError('internal', 'Erreur lors de la création du compte');
      }
    });

/**
 * Crée ou répare le document Firestore pour un utilisateur existant dans Firebase Auth
 * Utile si l'utilisateur existe dans Auth mais pas dans Firestore
 * Région : europe-west1
 */
exports.repairUserDocument = onCall(
    {
      region: 'europe-west1',
      cors: true,
    },
    async (request) => {
      const {email, product = '21jours'} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      try {
        const normalizedEmail = email.toLowerCase().trim();
        const adminAuth = admin.auth();

        // Vérifier que l'utilisateur existe dans Firebase Auth
        let userRecord;
        try {
          userRecord = await adminAuth.getUserByEmail(normalizedEmail);
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            throw new HttpsError('not-found', 'Utilisateur non trouvé dans Firebase Authentication');
          }
          throw error;
        }

        const userId = userRecord.uid;

        // Vérifier si le document existe déjà
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists) {
          // Le document existe déjà, retourner les informations
          const existingData = userDoc.data();
          console.log(`Document Firestore existe déjà pour ${normalizedEmail}`);
          return {
            success: true,
            message: 'Document Firestore existe déjà',
            userId: userId,
            email: normalizedEmail,
            product: existingData.product,
          };
        }

        // Créer le document Firestore avec products[]
        const now = admin.firestore.FieldValue.serverTimestamp();
        const userData = {
          email: normalizedEmail,
          products: [{
            name: product,
            startDate: now,
            purchasedAt: now,
          }],
          product: product, // Garder pour compatibilité rétroactive
          createdAt: now,
          updatedAt: now,
        };

        // Pour le produit "21jours", ajouter aussi registrationDate pour compatibilité
        if (product === '21jours') {
          userData.registrationDate = now;
        }

        await db.collection('users').doc(userId).set(userData);

        console.log(`Document Firestore créé pour ${normalizedEmail} (${userId})`);

        return {
          success: true,
          message: 'Document Firestore créé avec succès',
          userId: userId,
          email: normalizedEmail,
          product: product,
        };
      } catch (error) {
        console.error('Error repairing user document:', error);
        if (error instanceof HttpsError) {
          throw error;
        }
        throw new HttpsError('internal', 'Erreur lors de la création du document: ' + error.message);
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
                Email: 'fluance@actu.fluance.io',
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

        // Ajouter le prénom aux propriétés si disponible
        if (name) {
          properties.firstname = name;
        }

        console.log('📋 Starting MailJet contact properties update for 2 pratiques:', contactData.Email);
        console.log('📋 Properties to set:', JSON.stringify(properties));
        await updateMailjetContactProperties(
            contactData.Email,
            properties,
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );
        console.log('📋 MailJet contact properties update completed for:', contactData.Email);

        // Envoyer l'email de confirmation avec le template MJML
        console.log('📧 Starting email confirmation process for:', contactData.Email);
        const confirmationUrl = `https://fluance.io/confirm?email=${encodeURIComponent(contactData.Email)}&token=${confirmationToken}&redirect=2pratiques`;

        let emailSent = false;
        let emailError = null;

        console.log('📧 About to send confirmation email, token:', confirmationToken);
        try {
          const emailSubject = `Dernière étape indispensable${name ? ' ' + name : ''}`;
          const emailHtml = loadEmailTemplate('confirmation-optin', {
            firstName: name || '',
            confirmationUrl: confirmationUrl,
          });
          const emailText = `Bonjour${name ? ' ' + name : ''},\n\n` +
            `Merci pour votre inscription ! Pour recevoir vos 2 pratiques Fluance offertes, ` +
            `il vous suffit de confirmer votre adresse email en cliquant sur ce lien :\n\n` +
            `${confirmationUrl}\n\n` +
            `Ce lien est valide pendant 7 jours.\n\n` +
            `Si vous n'avez pas demandé cette inscription, vous pouvez ignorer cet email.`;

          await sendMailjetEmail(
              contactData.Email,
              emailSubject,
              emailHtml,
              emailText,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
              'support@actu.fluance.io',
              'Cédric de Fluance',
          );

          emailSent = true;
          console.log(`✅ Confirmation email sent successfully to ${contactData.Email}`);
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

        // Si c'est une confirmation pour les 5 jours, mettre à jour le statut de la série
        if (tokenData.sourceOptin === '5joursofferts') {
          try {
            const now = new Date();
            const dateStr = now.toISOString();
            const properties = {
              'serie_5jours_status': 'started', // Série démarrée après confirmation
            };

            // Récupérer les propriétés actuelles pour vérifier si serie_5jours_debut existe
            const contactDataUrl = `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email.toLowerCase().trim())}`;
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
                  let currentProperties = {};
                  if (Array.isArray(contactData.Data)) {
                    contactData.Data.forEach((item) => {
                      if (item.Name && item.Value !== undefined) {
                        currentProperties[item.Name] = item.Value;
                      }
                    });
                  } else if (typeof contactData.Data === 'object') {
                    currentProperties = contactData.Data;
                  }

                  // Si serie_5jours_debut n'existe pas, l'ajouter maintenant
                  if (!currentProperties['serie_5jours_debut']) {
                    properties['serie_5jours_debut'] = dateStr;
                  }
                }
              }
            }

            await updateMailjetContactProperties(
                email.toLowerCase().trim(),
                properties,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );
            console.log(`Updated serie_5jours_status to 'started' for ${email}`);
          } catch (error) {
            console.error('Error updating 5jours series status:', error);
            // Ne pas faire échouer la confirmation si la mise à jour du statut échoue
          }
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

        // Ajouter le prénom aux propriétés si disponible
        if (name) {
          properties.firstname = name;
        }

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

        // Gérer les propriétés de la série des 5 jours
        // Ne définir serie_5jours_debut que si elle n'existe pas déjà (pour ne pas réinitialiser une série en cours)
        if (!currentProperties['serie_5jours_debut']) {
          properties['serie_5jours_debut'] = dateStr;
          properties['serie_5jours_status'] = 'started'; // Statut initial : série démarrée (redirection immédiate vers jour 1)
        } else {
          // Si la série a déjà commencé, ne pas réinitialiser
          // Mais mettre à jour le statut si nécessaire
          if (!currentProperties['serie_5jours_status'] || currentProperties['serie_5jours_status'] === 'cancelled') {
            properties['serie_5jours_status'] = 'started';
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

        // Envoyer l'email de confirmation avec le template MJML
        console.log('📧 Starting email confirmation process for 5 jours:', contactData.Email);
        const confirmationUrl = `https://fluance.io/confirm?email=${encodeURIComponent(contactData.Email)}&token=${confirmationToken}&redirect=5joursofferts`;

        let emailSent = false;
        let emailError = null;

        console.log('📧 About to send confirmation email, token:', confirmationToken);
        try {
          const emailSubject = `Dernière étape indispensable${name ? ' ' + name : ''}`;
          const emailHtml = loadEmailTemplate('confirmation-optin', {
            firstName: name || '',
            confirmationUrl: confirmationUrl,
          });
          const emailText = `Bonjour${name ? ' ' + name : ''},\n\n` +
            `Merci pour votre inscription ! Pour recevoir vos 5 pratiques Fluance offertes, ` +
            `il vous suffit de confirmer votre adresse email en cliquant sur ce lien :\n\n` +
            `${confirmationUrl}\n\n` +
            `Ce lien est valide pendant 7 jours.\n\n` +
            `Si vous n'avez pas demandé cette inscription, vous pouvez ignorer cet email.`;

          await sendMailjetEmail(
              contactData.Email,
              emailSubject,
              emailHtml,
              emailText,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
              'support@actu.fluance.io',
              'Cédric de Fluance',
          );

          emailSent = true;
          console.log(`✅ Confirmation email sent successfully to ${contactData.Email}`);
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

/**
 * Fonction pour envoyer un email de réinitialisation de mot de passe via Mailjet
 * Utilise un système de tokens personnalisé hébergé sur fluance.io (pas de pages Firebase)
 *
 * Région : europe-west1
 */
exports.sendPasswordResetEmailViaMailjet = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
      cors: true,
    },
    async (request) => {
      const {email} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      try {
        const normalizedEmail = email.toLowerCase().trim();
        const adminAuth = admin.auth();

        // Vérifier que l'utilisateur existe
        let userExists = false;
        try {
          // eslint-disable-next-line no-unused-vars
          const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
          userExists = true;
          console.log(`✅ User found: ${normalizedEmail}`);
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            // Pour des raisons de sécurité, ne pas révéler si l'utilisateur existe ou non
            console.log(`⚠️ Password reset requested for non-existent user: ${email}`);
            return {
              success: true,
              message: 'If an account exists with this email, a password reset link has been sent.',
            };
          }
          throw error;
        }

        if (!userExists) {
          console.log(`⚠️ User does not exist, returning early`);
          return {
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.',
          };
        }

        // Générer un token de réinitialisation personnalisé (hébergé sur fluance.io)
        const token = generateUniqueToken();
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 1); // Valide pendant 1 heure

        // Stocker le token dans Firestore
        await db.collection('passwordResetTokens').doc(token).set({
          email: normalizedEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: expirationDate,
          used: false,
        });

        // Générer le lien de réinitialisation (100% sur fluance.io)
        const resetLink = `https://fluance.io/reinitialiser-mot-de-passe?token=${token}`;

        console.log(`Password reset token generated for ${email}`);

        // Créer ou mettre à jour le contact dans MailJet pour qu'il apparaisse dans l'historique
        const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
        const contactUrl = `https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(normalizedEmail)}`;

        try {
          // Vérifier si le contact existe
          const checkResponse = await fetch(contactUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
            },
          });

          if (!checkResponse.ok) {
            // Créer le contact s'il n'existe pas
            const createUrl = 'https://api.mailjet.com/v3/REST/contact';
            const contactData = {
              Email: normalizedEmail,
              IsExcludedFromCampaigns: false,
            };

            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
              },
              body: JSON.stringify(contactData),
            });

            if (createResponse.ok) {
              console.log(`Contact created in MailJet: ${normalizedEmail}`);
            } else {
              const errorText = await createResponse.text();
              console.warn(`Could not create contact in MailJet (may already exist): ${errorText}`);
            }
          } else {
            console.log(`Contact already exists in MailJet: ${normalizedEmail}`);
          }
        } catch (contactError) {
          console.warn(`Error managing contact in MailJet (continuing anyway):`, contactError);
          // Continuer même si la création du contact échoue
        }

        // Envoyer l'email via Mailjet
        const emailSubject = 'Réinitialisation de votre mot de passe Fluance';
        const emailHtml = loadEmailTemplate('reinitialisation-mot-de-passe', {
          resetLink: resetLink,
        });
        const emailText = `Réinitialisation de votre mot de passe Fluance\n\n` +
            `Bonjour,\n\n` +
            `Vous avez demandé à réinitialiser votre mot de passe pour votre compte Fluance.\n\n` +
            `Cliquez sur ce lien pour réinitialiser votre mot de passe :\n${resetLink}\n\n` +
            `Ce lien est valide pendant 1 heure.\n\n` +
            `Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.\n\n` +
            `Cordialement,\nL'équipe Fluance`;

        console.log(`[Password Reset] About to call sendMailjetEmail for ${normalizedEmail}`);
        console.log(`[Password Reset] Email will be sent from: support@actu.fluance.io`);
        try {
          const mailjetResult = await sendMailjetEmail(
              normalizedEmail,
              emailSubject,
              emailHtml,
              emailText,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );
          console.log(`[Password Reset] Mailjet result:`, JSON.stringify(mailjetResult).substring(0, 200));
          console.log(`[Password Reset] Password reset email sent via Mailjet to ${normalizedEmail}`);
        } catch (emailError) {
          // Logger seulement le message d'erreur, pas la stack trace complète
          console.error(`❌ Error calling sendMailjetEmail: ${emailError.message}`);
          throw emailError;
        }

        return {
          success: true,
          message: 'Password reset email sent successfully.',
        };
      } catch (error) {
        console.error('Error sending password reset email via Mailjet:', error);
        throw new HttpsError('internal', 'Error sending password reset email: ' + error.message);
      }
    });

/**
 * Vérifie un token de réinitialisation de mot de passe et réinitialise le mot de passe
 * Région : europe-west1
 */
exports.verifyPasswordResetToken = onCall(
    {
      region: 'europe-west1',
      cors: true,
    },
    async (request) => {
      const {token, newPassword} = request.data;

      if (!token || !newPassword) {
        throw new HttpsError('invalid-argument', 'Token and new password are required');
      }

      if (newPassword.length < 6) {
        throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long');
      }

      try {
        // Vérifier le token dans Firestore
        const tokenDoc = await db.collection('passwordResetTokens').doc(token).get();

        if (!tokenDoc.exists) {
          throw new HttpsError('not-found', 'Token invalide ou expiré');
        }

        const tokenData = tokenDoc.data();

        // Vérifier si le token a déjà été utilisé
        if (tokenData.used) {
          throw new HttpsError('failed-precondition', 'Ce lien a déjà été utilisé');
        }

        // Vérifier si le token a expiré
        const now = new Date();
        const expiresAt = tokenData.expiresAt.toDate();
        if (now > expiresAt) {
          throw new HttpsError('deadline-exceeded', 'Ce lien a expiré. Veuillez demander un nouveau lien.');
        }

        const email = tokenData.email;

        // Réinitialiser le mot de passe via Firebase Admin SDK
        const adminAuth = admin.auth();
        const userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.updateUser(userRecord.uid, {password: newPassword});

        // Marquer le token comme utilisé
        await db.collection('passwordResetTokens').doc(token).update({
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Password reset successful for ${email}`);

        return {
          success: true,
          message: 'Password reset successfully.',
        };
      } catch (error) {
        console.error('Error verifying password reset token:', error);
        if (error instanceof HttpsError) {
          throw error;
        }
        throw new HttpsError('internal', 'Error resetting password: ' + error.message);
      }
    });

/**
 * Vérifie si un token de réinitialisation est valide et retourne l'email associé
 * Région : europe-west1
 */
exports.checkPasswordResetToken = onCall(
    {
      region: 'europe-west1',
      cors: true,
    },
    async (request) => {
      const {token} = request.data;

      if (!token) {
        throw new HttpsError('invalid-argument', 'Token is required');
      }

      try {
        // Vérifier le token dans Firestore
        const tokenDoc = await db.collection('passwordResetTokens').doc(token).get();

        if (!tokenDoc.exists) {
          return {success: false, error: 'Token invalide ou expiré'};
        }

        const tokenData = tokenDoc.data();

        // Vérifier si le token a déjà été utilisé
        if (tokenData.used) {
          return {success: false, error: 'Ce lien a déjà été utilisé'};
        }

        // Vérifier si le token a expiré
        const now = new Date();
        const expiresAt = tokenData.expiresAt.toDate();
        if (now > expiresAt) {
          return {success: false, error: 'Ce lien a expiré. Veuillez demander un nouveau lien.'};
        }

        return {
          success: true,
          email: tokenData.email,
        };
      } catch (error) {
        console.error('Error checking password reset token:', error);
        return {success: false, error: 'Erreur lors de la vérification du token'};
      }
    });

/**
 * Fonction pour envoyer un lien de connexion passwordless via Mailjet
 * Cette fonction génère un lien de connexion Firebase et l'envoie via Mailjet
 *
 * Région : europe-west1
 */
exports.sendSignInLinkViaMailjet = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
      cors: true,
    },
    async (request) => {
      const {email} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      try {
        // Utiliser admin.auth() directement pour éviter les problèmes d'initialisation
        const adminAuth = admin.auth();

        // Générer le lien de connexion passwordless Firebase
        const signInLink = await adminAuth.generateSignInWithEmailLink(
            email.toLowerCase().trim(),
            {
              url: 'https://fluance.io/connexion-membre',
              handleCodeInApp: true,
            },
        );

        console.log(`Sign-in link generated for ${email}`);

        // Créer ou mettre à jour le contact dans MailJet pour qu'il apparaisse dans l'historique
        const normalizedEmail = email.toLowerCase().trim();
        const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
        const contactUrl = `https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(normalizedEmail)}`;

        try {
          // Vérifier si le contact existe
          const checkResponse = await fetch(contactUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
            },
          });

          if (!checkResponse.ok) {
            // Créer le contact s'il n'existe pas
            const createUrl = 'https://api.mailjet.com/v3/REST/contact';
            const contactData = {
              Email: normalizedEmail,
              IsExcludedFromCampaigns: false,
            };

            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
              },
              body: JSON.stringify(contactData),
            });

            if (createResponse.ok) {
              console.log(`Contact created in MailJet: ${normalizedEmail}`);
            } else {
              const errorText = await createResponse.text();
              console.warn(`Could not create contact in MailJet (may already exist): ${errorText}`);
            }
          } else {
            console.log(`Contact already exists in MailJet: ${normalizedEmail}`);
          }
        } catch (contactError) {
          console.warn(`Error managing contact in MailJet (continuing anyway):`, contactError);
          // Continuer même si la création du contact échoue
        }

        // Envoyer l'email via Mailjet
        const emailSubject = 'Connexion à votre compte Fluance';
        const emailHtml = loadEmailTemplate('connexion', {
          signInLink: signInLink,
        });
        const emailText = `Connexion à votre compte Fluance\n\n` +
            `Bonjour,\n\n` +
            `Cliquez sur ce lien pour vous connecter à votre compte Fluance :\n${signInLink}\n\n` +
            `Ce lien est valide pendant 1 heure et ne peut être utilisé qu'une seule fois.\n\n` +
            `Si vous n'avez pas demandé cette connexion, vous pouvez ignorer cet email.\n\n` +
            `Cordialement,\nL'équipe Fluance`;

        await sendMailjetEmail(
            email.toLowerCase().trim(),
            emailSubject,
            emailHtml,
            emailText,
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );

        console.log(`Sign-in link email sent via Mailjet to ${email}`);

        return {
          success: true,
          message: 'Sign-in link email sent successfully.',
        };
      } catch (error) {
        console.error('Error sending sign-in link email via Mailjet:', error);
        throw new HttpsError('internal', 'Error sending sign-in link email: ' + error.message);
      }
    });

/**
 * Fonction qui envoie une notification par email lorsqu'un nouveau commentaire est ajouté
 * Écoute les nouveaux documents dans comments/{pageId}/messages
 */
exports.notifyNewComment = onDocumentCreated(
    {
      document: 'comments/{pageId}/messages/{messageId}',
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'NOTIFICATION_EMAIL'],
    },
    async (event) => {
      const commentData = event.data.data();
      const pageId = event.params.pageId;
      // eslint-disable-next-line no-unused-vars
      const messageId = event.params.messageId;

      if (!commentData) {
        console.error('No data in comment document');
        return;
      }

      const name = commentData.name || 'Anonyme';
      const text = commentData.text || '';

      // Décoder le pageId pour obtenir l'URL de la page
      // Le pageId est encodé comme: origin + pathname (ou origin + pathname + '|' + contentId)
      let pageUrl = decodeURIComponent(pageId);

      // Si le pageId contient un pipe, c'est pour les commentaires de contenu protégé
      // Format: origin + pathname + '|' + contentId
      if (pageUrl.includes('|')) {
        const parts = pageUrl.split('|');
        pageUrl = parts[0]; // Prendre seulement l'URL de la page
      }

      // Construire l'URL complète
      let fullUrl = pageUrl;
      if (!pageUrl.startsWith('http')) {
        // Si c'est juste un chemin, ajouter le domaine
        fullUrl = `https://fluance.io${pageUrl.startsWith('/') ? '' : '/'}${pageUrl}`;
      }

      try {
        // Email de notification (configuré via Firebase Secrets: NOTIFICATION_EMAIL)
        const notificationEmail = process.env.NOTIFICATION_EMAIL;

        if (!notificationEmail) {
          console.error('NOTIFICATION_EMAIL secret not configured. Skipping notification.');
          return;
        }

        const emailSubject = `Nouveau commentaire de ${name}`;
        const emailHtml = loadEmailTemplate('notification-commentaire', {
          name: escapeHtml(name),
          comment: escapeHtml(text),
          pageUrl: escapeHtml(fullUrl),
          fullUrl: fullUrl, // URL non échappée pour le lien
        });
        const emailText = `Nouveau commentaire\n\n` +
            `Prénom: ${name}\n\n` +
            `Commentaire:\n${text}\n\n` +
            `Page: ${fullUrl}\n\n` +
            `Voir la page: ${fullUrl}`;

        await sendMailjetEmail(
            notificationEmail,
            emailSubject,
            emailHtml,
            emailText,
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );

        console.log(`Notification email sent for new comment from ${name} on ${fullUrl}`);
      } catch (error) {
        console.error('Error sending notification email for new comment:', error);
        // Ne pas faire échouer la fonction si l'email échoue
        // Le commentaire a déjà été créé
      }
    });

/**
 * Fonction utilitaire pour échapper le HTML dans les emails
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
}

/**
 * Fonction scheduled pour envoyer des emails de nouveaux contenus
 * S'exécute quotidiennement à 8h (Europe/Paris)
 * Envoie des emails pour :
 * - Produit "21jours" : un email par jour (jours 1-21)
 * - Produit "complet" : un email par semaine (semaines 1-14)
 */
exports.sendNewContentEmails = onSchedule(
    {
      schedule: '0 8 * * *', // Tous les jours à 8h
      timeZone: 'Europe/Paris',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
      region: 'europe-west1',
    },
    async (_event) => {
      console.log('📧 Starting scheduled email job for new content');
      const now = new Date();
      const mailjetApiKey = process.env.MAILJET_API_KEY;
      const mailjetApiSecret = process.env.MAILJET_API_SECRET;

      if (!mailjetApiKey || !mailjetApiSecret) {
        console.error('❌ Mailjet credentials not configured');
        return;
      }

      try {
        // Récupérer tous les utilisateurs avec des produits actifs
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Found ${usersSnapshot.size} users to check`);

        let emailsSent = 0;
        let emailsSkipped = 0;
        let errors = 0;

        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          const email = userData.email;
          const userId = userDoc.id;

          if (!email) {
            console.warn(`⚠️ User ${userId} has no email, skipping`);
            continue;
          }

          const products = userData.products || [];

          // Si products est vide mais product existe (ancien format), migrer
          if (products.length === 0 && userData.product) {
            console.log(`🔄 Migrating user ${userId} from old format`);
            const startDate = userData.registrationDate ||
                userData.createdAt?.toDate() ||
                new Date();
            products.push({
              name: userData.product,
              startDate: admin.firestore.Timestamp.fromDate(startDate),
              purchasedAt: userData.createdAt ||
                  admin.firestore.Timestamp.fromDate(new Date()),
            });
          }

          // Traiter chaque produit de l'utilisateur
          for (const product of products) {
            if (!product.name || !product.startDate) {
              console.warn(`⚠️ User ${userId} has invalid product data:`, product);
              continue;
            }

            const productName = product.name;
            const startDate = product.startDate.toDate();
            const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            const weeksSinceStart = Math.floor(daysSinceStart / 7);

            try {
              if (productName === '21jours') {
                // Produit 21jours : email par jour (jours 1-21)
                const currentDay = daysSinceStart + 1; // Jour 1 = premier jour après achat

                if (currentDay >= 1 && currentDay <= 21) {
                  // Vérifier si l'email a déjà été envoyé pour ce jour
                  const emailSentDocId = `${userId}_21jours_day_${currentDay}`;
                  const emailSentDoc = await db.collection('contentEmailsSent')
                      .doc(emailSentDocId).get();

                  if (emailSentDoc.exists) {
                    console.log(`⏭️ Email already sent to ${email} for 21jours day ${currentDay}`);
                    emailsSkipped++;
                    continue;
                  }

                  // Vérifier si le contenu existe et est accessible
                  const contentDocId = `21jours-jour-${currentDay}`;
                  const contentDoc = await db.collection('protectedContent')
                      .doc(contentDocId).get();

                  if (!contentDoc.exists) {
                    console.warn(`⚠️ Content not found: ${contentDocId}`);
                    continue;
                  }

                  const contentData = contentDoc.data();
                  if (contentData.product !== '21jours') {
                    console.warn(`⚠️ Content ${contentDocId} has wrong product`);
                    continue;
                  }

                  // Vérifier que le contenu est accessible (jour correspond)
                  if (contentData.day !== undefined && contentData.day !== currentDay) {
                    console.warn(`⚠️ Content ${contentDocId} day mismatch: ` +
                        `expected ${currentDay}, got ${contentData.day}`);
                    continue;
                  }

                  // Envoyer l'email
                  const emailSubject = `Jour ${currentDay} de votre défi 21 jours - ${contentData.title || 'Nouveau contenu disponible'}`;
                  const emailHtml = loadEmailTemplate('nouveau-contenu-21jours', {
                    day: currentDay,
                    title: contentData.title || 'Nouveau contenu',
                  });

                  await sendMailjetEmail(
                      email,
                      emailSubject,
                      emailHtml,
                      `Jour ${currentDay} de votre défi 21 jours - ${contentData.title || 'Nouveau contenu disponible'}\n\nAccédez à votre contenu : https://fluance.io/membre/`,
                      mailjetApiKey,
                      mailjetApiSecret,
                      'support@actu.fluance.io',
                      'Cédric de Fluance',
                  );

                  // Marquer l'email comme envoyé
                  await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                    userId: userId,
                    email: email,
                    product: '21jours',
                    day: currentDay,
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  console.log(`✅ Email sent to ${email} for 21jours day ${currentDay}`);
                  emailsSent++;
                }
              } else if (productName === 'complet') {
                // Produit complet : email par semaine (semaines 1-14)
                const currentWeek = weeksSinceStart + 1; // Semaine 1 = première semaine après achat

                if (currentWeek >= 1 && currentWeek <= 14) {
                  // Vérifier si l'email a déjà été envoyé pour cette semaine
                  const emailSentDocId = `${userId}_complet_week_${currentWeek}`;
                  const emailSentDoc = await db.collection('contentEmailsSent')
                      .doc(emailSentDocId).get();

                  if (emailSentDoc.exists) {
                    console.log(`⏭️ Email already sent to ${email} for complet week ${currentWeek}`);
                    emailsSkipped++;
                    continue;
                  }

                  // Vérifier si le contenu existe et est accessible
                  const contentDocId = `complet-week-${currentWeek}`;
                  const contentDoc = await db.collection('protectedContent')
                      .doc(contentDocId).get();

                  if (!contentDoc.exists) {
                    console.warn(`⚠️ Content not found: ${contentDocId}`);
                    continue;
                  }

                  const contentData = contentDoc.data();
                  if (contentData.product !== 'complet') {
                    console.warn(`⚠️ Content ${contentDocId} has wrong product`);
                    continue;
                  }

                  // Vérifier que le contenu est accessible (semaine correspond)
                  if (contentData.week !== undefined && contentData.week !== currentWeek) {
                    console.warn(`⚠️ Content ${contentDocId} week mismatch: ` +
                        `expected ${currentWeek}, got ${contentData.week}`);
                    continue;
                  }

                  // Envoyer l'email
                  const emailSubject = `Semaine ${currentWeek} - Nouveau contenu disponible - ${contentData.title || 'Approche Fluance Complète'}`;
                  const emailHtml = loadEmailTemplate('nouveau-contenu-complet', {
                    week: currentWeek,
                    title: contentData.title || 'Nouveau contenu',
                  });

                  await sendMailjetEmail(
                      email,
                      emailSubject,
                      emailHtml,
                      `Semaine ${currentWeek} - Nouveau contenu disponible - ${contentData.title || 'Approche Fluance Complète'}\n\nAccédez à votre contenu : https://fluance.io/membre/`,
                      mailjetApiKey,
                      mailjetApiSecret,
                  );

                  // Marquer l'email comme envoyé
                  await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                    userId: userId,
                    email: email,
                    product: 'complet',
                    week: currentWeek,
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  console.log(`✅ Email sent to ${email} for complet week ${currentWeek}`);
                  emailsSent++;
                }
              }
            } catch (productError) {
              console.error(`❌ Error processing product ${productName} for user ${userId}:`, productError);
              errors++;
            }
          }
        }

        // Traiter les emails marketing pour les prospects
        console.log('📧 Starting marketing emails for prospects');
        let marketingEmailsSent = 0;
        const marketingEmailsSkipped = 0;

        try {
          // Récupérer tous les contacts Mailjet
          const auth = Buffer.from(`${mailjetApiKey}:${mailjetApiSecret}`).toString('base64');
          const contactListUrl = 'https://api.mailjet.com/v3/REST/contact';
          const listResponse = await fetch(contactListUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
            },
          });

          if (listResponse.ok) {
            const listData = await listResponse.json();
            const contacts = listData.Data || [];

            for (const contact of contacts) {
              const email = contact.Email;
              if (!email) continue;

              try {
                // Récupérer les propriétés du contact
                const contactDataUrl = `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email.toLowerCase().trim())}`;
                const contactDataResponse = await fetch(contactDataUrl, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Basic ${auth}`,
                  },
                });

                if (!contactDataResponse.ok) continue;

                const contactDataResult = await contactDataResponse.json();
                if (!contactDataResult.Data || contactDataResult.Data.length === 0) continue;

                const contactData = contactDataResult.Data[0];
                if (!contactData.Data) continue;

                // Parser les propriétés
                let properties = {};
                if (Array.isArray(contactData.Data)) {
                  contactData.Data.forEach((item) => {
                    if (item.Name && item.Value !== undefined) {
                      properties[item.Name] = item.Value;
                    }
                  });
                } else if (typeof contactData.Data === 'object') {
                  properties = contactData.Data;
                }

                // Récupérer le prénom si disponible
                const firstName = properties.firstname || contact.Name || '';

                // Vérifier que c'est un prospect (pas un client)
                const sourceOptin = properties.source_optin || '';
                const estClient = properties.est_client === 'True' || properties.est_client === true;
                const produitsAchetes = properties.produits_achetes || '';

                if (estClient || produitsAchetes.includes('21jours') || produitsAchetes.includes('complet')) {
                  // C'est un client, on skip (déjà traité plus haut)
                  continue;
                }

                // Calculer les jours depuis l'inscription initiale (date_optin)
                let optinDate;
                if (properties.date_optin) {
                  const dateStr = properties.date_optin;
                  if (dateStr.includes('/')) {
                    const [day, month, year] = dateStr.split('/');
                    optinDate = new Date(year, month - 1, day);
                  } else {
                    optinDate = new Date(dateStr);
                  }
                } else {
                  // Pas de date d'opt-in, on skip
                  continue;
                }

                const daysSinceOptin = Math.floor((now - optinDate) / (1000 * 60 * 60 * 24));
                const currentDay = daysSinceOptin + 1;

                // Vérifier si inscrit aux 5 jours
                const has5jours = sourceOptin.includes('5joursofferts');
                const serie5joursDebut = properties.serie_5jours_debut;

                // SCÉNARIO 1 : Opt-in "2 pratiques" → J+1 : Proposer "5 jours offerts"
                if (sourceOptin.includes('2pratiques') && !has5jours && currentDay === 2) {
                  const emailSentDocId = `marketing_2pratiques_to_5jours_${email.toLowerCase().trim()}`;
                  const emailSentDoc = await db.collection('contentEmailsSent')
                      .doc(emailSentDocId).get();

                  if (!emailSentDoc.exists) {
                    const emailSubject = '5 pratiques offertes pour libérer les tensions';
                    const emailHtml = loadEmailTemplate('promotion-5jours', {
                      firstName: firstName || '',
                    });

                    await sendMailjetEmail(
                        email,
                        emailSubject,
                        emailHtml,
                        `${emailSubject}\n\nDécouvrez les 5 jours offerts : https://fluance.io/#5jours`,
                        mailjetApiKey,
                        mailjetApiSecret,
                        'fluance@actu.fluance.io',
                        'Cédric de Fluance',
                    );

                    await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                      email: email,
                      type: 'marketing_2pratiques_to_5jours',
                      day: currentDay,
                      sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    console.log(`✅ Marketing email sent to ${email} for 2pratiques→5jours`);
                    marketingEmailsSent++;
                  }
                }

                // SCÉNARIO 2 : Inscrit aux "5 jours" → Après les 5 jours : 2-3 emails pour 21 jours
                if (has5jours && serie5joursDebut) {
                  const cinqJoursStart = new Date(serie5joursDebut);
                  const daysSince5jours = Math.floor((now - cinqJoursStart) / (1000 * 60 * 60 * 24));
                  const joursApres5jours = daysSince5jours + 1;

                  // Emails aux jours 6, 10, 17 après le début des 5 jours
                  const joursPromo21jours = [6, 10, 17];
                  if (joursPromo21jours.includes(joursApres5jours)) {
                    const emailSentDocId = `marketing_5jours_to_21jours_` +
                        `${email.toLowerCase().trim()}_day_${joursApres5jours}`;
                    const emailSentDoc = await db.collection('contentEmailsSent')
                        .doc(emailSentDocId).get();

                    if (!emailSentDoc.exists) {
                      let emailSubject;
                      let templateName;

                      if (joursApres5jours === 6) {
                        emailSubject = 'Jour 6 : on continue ensemble ?';
                        templateName = 'promotion-21jours-jour6';
                      } else if (joursApres5jours === 10) {
                        emailSubject = 'Fluance : sortir des tensions physiques et du trop-plein';
                        templateName = 'promotion-21jours-relance';
                      } else {
                        emailSubject = '21 jours de Fluance : c\'est le moment';
                        templateName = 'promotion-21jours-final';
                      }

                      const emailHtml = loadEmailTemplate(templateName, {
                        firstName: firstName || '',
                      });
                      await sendMailjetEmail(
                          email,
                          emailSubject,
                          emailHtml,
                          `${emailSubject}\n\nDécouvrez le défi 21 jours : https://fluance.io/cours-en-ligne/21-jours-mouvement/`,
                          mailjetApiKey,
                          mailjetApiSecret,
                          'fluance@actu.fluance.io',
                          'Cédric de Fluance',
                      );

                      await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                        email: email,
                        type: 'marketing_5jours_to_21jours',
                        day: joursApres5jours,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                      });

                      console.log(`✅ Marketing email sent to ${email} for 5jours→21jours day ${joursApres5jours}`);
                      marketingEmailsSent++;
                    }
                  }
                }

                // SCÉNARIO 3 : PAS inscrit aux "5 jours" → Relance + série promotion 21 jours
                if (sourceOptin.includes('2pratiques') && !has5jours) {
                  // J+3 : 1 relance pour les 5 jours
                  if (currentDay === 4) {
                    const emailSentDocId = `marketing_relance_5jours_${email.toLowerCase().trim()}`;
                    const emailSentDoc = await db.collection('contentEmailsSent')
                        .doc(emailSentDocId).get();

                    if (!emailSentDoc.exists) {
                      const emailSubject = 'Découvrez les 5 jours de pratiques offertes';
                      const emailHtml = loadEmailTemplate('relance-5jours', {
                        firstName: firstName || '',
                      });

                      await sendMailjetEmail(
                          email,
                          emailSubject,
                          emailHtml,
                          `${emailSubject}\n\nDécouvrez les 5 jours offerts : https://fluance.io/#5jours`,
                          mailjetApiKey,
                          mailjetApiSecret,
                          'fluance@actu.fluance.io',
                          'Cédric de Fluance',
                      );

                      await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                        email: email,
                        type: 'marketing_relance_5jours',
                        day: currentDay,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                      });

                      console.log(`✅ Relance email sent to ${email} for 5jours`);
                      marketingEmailsSent++;
                    }
                  }

                  // Après la relance, si toujours pas inscrit aux 5 jours : série promotion 21 jours
                  // Jours 8, 15, 22 après l'opt-in initial (après la relance J+3)
                  const joursPromo21joursSans5jours = [8, 15, 22];
                  if (joursPromo21joursSans5jours.includes(currentDay)) {
                    const emailSentDocId = `marketing_2pratiques_to_21jours_` +
                        `${email.toLowerCase().trim()}_day_${currentDay}`;
                    const emailSentDoc = await db.collection('contentEmailsSent')
                        .doc(emailSentDocId).get();

                    if (!emailSentDoc.exists) {
                      let emailSubject;
                      let templateName;

                      if (currentDay === 8) {
                        emailSubject = 'Fluance : sortir des tensions physiques et du trop-plein';
                        templateName = 'promotion-21jours-relance';
                      } else {
                        emailSubject = '21 jours de Fluance : c\'est le moment';
                        templateName = 'promotion-21jours-final';
                      }

                      const emailHtml = loadEmailTemplate(templateName, {
                        firstName: firstName || '',
                      });

                      await sendMailjetEmail(
                          email,
                          emailSubject,
                          emailHtml,
                          `${emailSubject}\n\nDécouvrez le défi 21 jours : https://fluance.io/cours-en-ligne/21-jours-mouvement/`,
                          mailjetApiKey,
                          mailjetApiSecret,
                          'fluance@actu.fluance.io',
                          'Cédric de Fluance',
                      );

                      await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                        email: email,
                        type: 'marketing_2pratiques_to_21jours',
                        day: currentDay,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                      });

                      console.log(`✅ Marketing email sent to ${email} for 2pratiques→21jours day ${currentDay}`);
                      marketingEmailsSent++;
                    }
                  }
                }
              } catch (contactError) {
                console.error(`❌ Error processing contact ${email}:`, contactError);
                errors++;
              }
            }
          } else {
            console.warn('⚠️ Could not fetch Mailjet contacts for marketing emails');
          }
        } catch (marketingError) {
          console.error('❌ Error in marketing emails section:', marketingError);
          // Ne pas faire échouer toute la fonction si la partie marketing échoue
        }

        console.log(`📧 Email job completed: ${emailsSent} sent (clients), ` +
            `${marketingEmailsSent} sent (marketing), ` +
            `${emailsSkipped + marketingEmailsSkipped} skipped, ${errors} errors`);
        return {
          success: true,
          emailsSent,
          marketingEmailsSent,
          emailsSkipped,
          marketingEmailsSkipped,
          errors,
        };
      } catch (error) {
        console.error('❌ Error in sendNewContentEmails:', error);
        throw error;
      }
    });

