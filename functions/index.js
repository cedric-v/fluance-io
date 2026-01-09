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

// Price ID du produit cross-sell "SOS dos & cervicales"
const STRIPE_PRICE_ID_SOS_DOS_CERVICALES = 'price_1SeWdF2Esx6PN6y1XlbpIObG';

// Configuration Mailjet (via secrets Firebase - méthode moderne)
// ⚠️ IMPORTANT : Les secrets sont configurés via Firebase CLI :
// echo -n "votre_cle" | firebase functions:secrets:set MAILJET_API_KEY
// Ne JAMAIS mettre de vraies clés dans ce fichier (code public sur GitHub)
// Les secrets sont accessibles via process.env.SECRET_NAME dans les fonctions

// Configuration Stripe (via secrets Firebase - méthode moderne)
// ⚠️ IMPORTANT : Les secrets sont configurés via Firebase CLI :
// echo -n "votre_cle" | firebase functions:secrets:set STRIPE_SECRET_KEY

/**
 * Vérifie si une date est exclue (jours fériés où on ne veut pas envoyer d'emails marketing)
 * @param {Date} date - La date à vérifier
 * @returns {boolean} - true si la date est exclue, false sinon
 */
function isExcludedDate(date) {
  const month = date.getMonth(); // 0-11 (0 = janvier, 11 = décembre)
  const day = date.getDate();

  // 25 décembre (Noël)
  if (month === 11 && day === 25) return true;

  // 26 décembre (Boxing Day)
  if (month === 11 && day === 26) return true;

  // 31 décembre (Nouvel An - veille)
  if (month === 11 && day === 31) return true;

  // 1er janvier (Jour de l'An)
  if (month === 0 && day === 1) return true;

  return false;
}

/**
 * Calcule la date d'envoi prévue pour un email marketing basé sur la date d'opt-in et le jour
 * @param {Date} optinDate - Date d'inscription (déjà normalisée à minuit)
 * @param {number} currentDay - Jour calculé (currentDay = daysSinceOptin + 1)
 * @returns {Date} - Date d'envoi prévue (normalisée à minuit en heure locale)
 *
 * Exemple : Si opt-in le 22 déc
 * - currentDay = 1 → date prévue = 22 déc (même jour, 0 jours après)
 * - currentDay = 2 → date prévue = 23 déc (1 jour après)
 * - currentDay = 4 → date prévue = 25 déc (3 jours après)
 */
function getScheduledEmailDate(optinDate, currentDay) {
  // Créer une nouvelle date pour éviter de modifier l'originale
  // Utiliser les composants année/mois/jour pour éviter les problèmes de fuseau horaire
  const year = optinDate.getFullYear();
  const month = optinDate.getMonth();
  const day = optinDate.getDate();
  const scheduledDate = new Date(year, month, day + (currentDay - 1));
  return scheduledDate;
}

/**
 * Capitalise un nom/prénom avec gestion des préfixes et prénoms composés
 * @param {string} name - Le nom à capitaliser
 * @returns {string} - Le nom avec capitalisation appropriée
 *
 * Gère :
 * - Prénoms composés (tirets, espaces) : "jean-pierre" → "Jean-Pierre"
 * - Préfixes courants : "mcdonald" → "McDonald", "o'brien" → "O'Brien"
 */
function capitalizeName(name) {
  if (!name) return '';

  // Liste des préfixes à gérer spécialement (sans espaces)
  const prefixes = ['mc', 'mac', 'o\'', 'd\''];

  // Détecter les séparateurs (espaces ou tirets) pour les préserver
  const hasHyphen = name.includes('-');
  const separator = hasHyphen ? '-' : ' ';

  return name
      .toLowerCase()
      .split(hasHyphen ? '-' : /\s+/)
      .map((word) => {
        // Vérifier si le mot commence par un préfixe connu (sans espace)
        for (const prefix of prefixes) {
          if (word.startsWith(prefix) && word.length > prefix.length) {
            // Capitaliser le préfixe et la lettre suivante
            const afterPrefix = word.slice(prefix.length);
            return prefix.charAt(0).toUpperCase() + prefix.slice(1) +
                   afterPrefix.charAt(0).toUpperCase() + afterPrefix.slice(1);
          }
        }
        // Capitalisation normale : première lettre en majuscule
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(separator);
}

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
    'firstname',
    'lastname',
    'phone',
    'address',
    'region',
    'liste_attente_stages',
    'langue',
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

/**
 * Envoie une notification à support@fluance.io pour chaque nouvel opt-in
 */
async function sendOptInNotification(email, name, sourceOptin, apiKey, apiSecret) {
  try {
    const sourceLabel = sourceOptin === '2pratiques' ? '2 pratiques offertes' : '5 jours offerts';
    const subject = `Nouvel opt-in : ${sourceLabel}`;
    const dateStr = new Date().toLocaleString('fr-FR', {
      timeZone: 'Europe/Zurich',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7A1F3D; border-bottom: 2px solid #E6B84A; padding-bottom: 10px;">Nouvel opt-in Fluance</h2>
        <div style="background-color: #fdfaf6; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 5px 0;"><strong>Email :</strong> ` +
            `<a href="mailto:${email}" style="color: #7A1F3D;">${email}</a></p>
          ${name ? `<p style="margin: 5px 0;"><strong>Nom :</strong> ${name}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Source :</strong> ${sourceLabel}</p>
          <p style="margin: 5px 0;"><strong>Date :</strong> ${dateStr}</p>
        </div>
      </div>
    `;
    const textContent =
      `Nouvel opt-in Fluance\n\nEmail: ${email}\n${name ? `Nom: ${name}\n` : ''}Source: ${sourceLabel}\nDate: ${dateStr}`;

    await sendMailjetEmail(
        'support@fluance.io',
        subject,
        htmlContent,
        textContent,
        apiKey,
        apiSecret,
        'support@actu.fluance.io',
        'Fluance - Notification Opt-in',
    );
    console.log(`✅ Opt-in notification sent to support@fluance.io for ${email} (${sourceLabel})`);
  } catch (error) {
    // Ne pas faire échouer l'opt-in si la notification échoue
    console.error('Error sending opt-in notification:', error.message);
  }
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
    customerName = null,
    customerPhone = null,
    customerAddress = null,
    langue = 'fr',
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

      // Valider et normaliser la langue
      const langueNormalisee = (langue === 'en' || langue === 'EN') ? 'en' : 'fr';

      const updatedProperties = {
        statut: 'client',
        produits_achetes: productsList.join(','),
        date_dernier_achat: dateStr,
        valeur_client: (currentValeur + amount).toFixed(2),
        nombre_achats: currentNombreAchats + 1,
        est_client: 'True',
        langue: langueNormalisee,
      };

      // Ajouter les coordonnées complémentaires si disponibles
      if (customerName) {
        const firstName = customerName.split(' ')[0]; // Prénom (premier mot)
        const lastName = customerName.split(' ').slice(1).join(' '); // Nom (reste)
        updatedProperties.firstname = capitalizeName(firstName);
        if (lastName) {
          updatedProperties.lastname = capitalizeName(lastName);
        }
      }
      if (customerPhone) {
        updatedProperties.phone = customerPhone;
      }
      if (customerAddress) {
        updatedProperties.address = customerAddress;
      }

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
 * Gère les échecs de paiement avec relances progressives et désactivation après plusieurs tentatives
 * Conforme aux bonnes pratiques européennes (délai de grâce, plusieurs tentatives, options alternatives)
 * @param {object} invoice - Objet invoice Stripe
 * @param {object} subscription - Objet subscription Stripe (optionnel)
 * @param {string} customerEmail - Email du client
 * @param {string} apiKey - Clé API Mailjet
 * @param {string} apiSecret - Secret API Mailjet
 */
async function handlePaymentFailure(invoice, subscription, customerEmail, apiKey, apiSecret) {
  try {
    const emailLower = customerEmail.toLowerCase().trim();
    const subscriptionId = invoice.subscription;
    const invoiceId = invoice.id;
    const amount = invoice.amount_due / 100; // Convertir de centimes
    const currency = invoice.currency.toUpperCase();

    // Déterminer si c'est un premier paiement ou un renouvellement
    const isFirstPayment = !subscription || subscription.status === 'incomplete' || subscription.status === 'incomplete_expired';
    const product = subscription?.metadata?.product || 'complet';
    const system = subscription?.metadata?.system;

    // Vérifier que c'est pour le système Firebase
    if (system !== 'firebase') {
      console.log(`Payment failure ignored - système: ${system || 'non défini'}`);
      return {ignored: true, reason: 'Not Firebase system'};
    }

    // Récupérer ou créer le document de suivi des échecs
    const failureDocRef = db.collection('paymentFailures').doc(`${subscriptionId || invoiceId}_${emailLower}`);
    const failureDoc = await failureDocRef.get();

    let failureData;
    if (failureDoc.exists) {
      failureData = failureDoc.data();
      failureData.attemptCount = (failureData.attemptCount || 0) + 1;
      failureData.lastFailureAt = admin.firestore.FieldValue.serverTimestamp();
      failureData.failureReasons = failureData.failureReasons || [];
      failureData.failureReasons.push({
        invoiceId: invoiceId,
        reason: invoice.last_payment_error?.message || 'Unknown error',
        amount: amount,
        currency: currency,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      failureData = {
        email: emailLower,
        subscriptionId: subscriptionId,
        invoiceId: invoiceId,
        product: product,
        amount: amount,
        currency: currency,
        attemptCount: 1,
        firstFailureAt: admin.firestore.FieldValue.serverTimestamp(),
        lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
        isFirstPayment: isFirstPayment,
        failureReasons: [{
          invoiceId: invoiceId,
          reason: invoice.last_payment_error?.message || 'Unknown error',
          amount: amount,
          currency: currency,
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        }],
        emailsSent: [],
        status: 'active', // active, suspended, resolved
      };
    }

    // Constantes pour les bonnes pratiques européennes
    const MAX_ATTEMPTS = 3; // 3 tentatives avant suspension

    const isLastAttempt = failureData.attemptCount >= MAX_ATTEMPTS;
    const shouldSuspend = failureData.attemptCount >= MAX_ATTEMPTS;

    // Mettre à jour le document
    await failureDocRef.set(failureData, {merge: true});

    // Récupérer les informations du client depuis Firestore
    let firstName = '';
    try {
      const userQuery = await db.collection('users')
          .where('email', '==', emailLower)
          .limit(1)
          .get();
      if (!userQuery.empty) {
        const userData = userQuery.docs[0].data();
        firstName = userData.name?.split(' ')[0] || '';
      }
    } catch (error) {
      console.warn('Error fetching user data:', error.message);
    }

    // Générer les liens de paiement
    let stripePaymentLink = '';
    let updatePaymentLink = '';
    let reactivateLink = '';

    if (process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        if (isFirstPayment) {
          // Pour le premier paiement, créer un lien de paiement
          const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
              price: subscription?.items?.data[0]?.price?.id || invoice.lines.data[0]?.price?.id,
              quantity: 1,
            }],
            mode: 'subscription',
            customer_email: emailLower,
            success_url: `https://fluance.io/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://fluance.io/cancel`,
            metadata: {
              system: 'firebase',
              product: product,
            },
            subscription_data: {
              metadata: {
                system: 'firebase',
                product: product,
              },
            },
          });
          stripePaymentLink = checkoutSession.url;
        } else if (subscriptionId) {
          // Pour les renouvellements, créer un lien de mise à jour de carte
          const customerPortal = await stripe.billingPortal.sessions.create({
            customer: subscription.customer,
            return_url: 'https://fluance.io/mon-compte',
          });
          updatePaymentLink = customerPortal.url;
          reactivateLink = customerPortal.url;
        }
      } catch (stripeError) {
        console.error('Error creating Stripe links:', stripeError.message);
      }
    }

    // Préparer les variables pour les emails
    const productName = product === 'complet' ? 'Approche Fluance complète' : product;
    const failureReason = invoice.last_payment_error?.message || 'Carte refusée ou fonds insuffisants';
    const warningMessage = isLastAttempt ?
      '⚠️ Attention : Il s\'agit de votre dernière tentative. Si le paiement n\'est pas effectué dans les 3 jours, votre abonnement sera suspendu.' :
      `Vous avez encore ${MAX_ATTEMPTS - failureData.attemptCount} tentative(s) avant la suspension.`;

    // Envoyer l'email approprié
    let emailTemplate;
    let emailSubject;
    let emailVariables;

    if (isFirstPayment) {
      // Email pour premier paiement échoué
      emailTemplate = 'echec-paiement-premier-abonnement';
      emailSubject = `Finaliser votre abonnement Fluance - Paiement requis`;
      emailVariables = {
        firstName: firstName || 'Bonjour',
        productName: productName,
        failureReason: failureReason,
        stripePaymentLink: stripePaymentLink ||
          'https://fluance.io/cours-en-ligne/approche-fluance-complete/',
        paypalRequestLink: `mailto:support@fluance.io?subject=Demande%20lien%20PayPal&` +
          `body=Bonjour,%20je%20souhaite%20recevoir%20un%20lien%20de%20paiement%20PayPal%20pour%20mon%20abonnement.`,
        amount: `${amount} ${currency}`,
        reference: `FLU-${subscriptionId?.substring(0, 8) || invoiceId.substring(0, 8)}`,
      };
    } else {
      // Email pour renouvellement échoué
      emailTemplate = 'echec-paiement-renouvellement';
      emailSubject = `⚠️ Problème de paiement - Action requise pour votre abonnement`;
      emailVariables = {
        firstName: firstName || 'Bonjour',
        productName: productName,
        failureReason: failureReason,
        attemptNumber: failureData.attemptCount,
        maxAttempts: MAX_ATTEMPTS,
        warningMessage: warningMessage,
        updatePaymentLink: updatePaymentLink ||
          'https://billing.stripe.com/p/login/4gM3coe0tgPp3Qcd608k800',
        paypalRequestLink: `mailto:support@fluance.io?subject=Demande%20lien%20PayPal&` +
          `body=Bonjour,%20je%20souhaite%20recevoir%20un%20lien%20de%20paiement%20PayPal%20pour%20mon%20abonnement.`,
      };
    }

    // Envoyer l'email
    try {
      const emailHtml = loadEmailTemplate(emailTemplate, emailVariables);
      const emailText = `${emailSubject}\n\nBonjour ${firstName || ''},\n\nVotre paiement n'a pas pu être effectué. Veuillez mettre à jour votre moyen de paiement.`;

      await sendMailjetEmail(
          emailLower,
          emailSubject,
          emailHtml,
          emailText,
          apiKey,
          apiSecret,
          'support@actu.fluance.io',
          'Cédric de Fluance',
      );

      // Enregistrer l'email envoyé
      failureData.emailsSent = failureData.emailsSent || [];
      failureData.emailsSent.push({
        template: emailTemplate,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        attemptNumber: failureData.attemptCount,
      });
      await failureDocRef.update({emailsSent: failureData.emailsSent});

      console.log(
          `✅ Payment failure email sent to ${emailLower} ` +
          `(attempt ${failureData.attemptCount}/${MAX_ATTEMPTS})`,
      );
    } catch (emailError) {
      console.error(`❌ Error sending payment failure email to ${emailLower}:`, emailError.message);
    }

    // Si c'est la dernière tentative, suspendre l'abonnement après le délai de grâce
    if (shouldSuspend) {
      // Programmer la suspension dans 3 jours (délai de grâce supplémentaire)
      const suspendAt = new Date();
      suspendAt.setDate(suspendAt.getDate() + 3);

      await failureDocRef.update({
        status: 'pending_suspension',
        suspendAt: admin.firestore.Timestamp.fromDate(suspendAt),
      });

      console.log(`⚠️ Subscription ${subscriptionId} will be suspended on ${suspendAt.toISOString()}`);

      // Envoyer un email de suspension
      try {
        const suspendEmailHtml = loadEmailTemplate('suspension-abonnement', {
          firstName: firstName || 'Bonjour',
          productName: productName,
          reactivateLink: reactivateLink || updatePaymentLink || 'https://billing.stripe.com/p/login/4gM3coe0tgPp3Qcd608k800',
        });
        const suspendEmailText =
          `Votre abonnement ${productName} a été suspendu après plusieurs tentatives de paiement échouées.`;

        await sendMailjetEmail(
            emailLower,
            `Votre abonnement Fluance a été suspendu`,
            suspendEmailHtml,
            suspendEmailText,
            apiKey,
            apiSecret,
            'support@actu.fluance.io',
            'Cédric de Fluance',
        );
      } catch (suspendEmailError) {
        console.error(`❌ Error sending suspension email:`, suspendEmailError.message);
      }

      // Suspendre l'abonnement dans Stripe
      if (subscriptionId && process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          await stripe.subscriptions.update(subscriptionId, {
            pause_collection: {
              behavior: 'mark_uncollectible',
            },
          });
          console.log(`✅ Subscription ${subscriptionId} paused in Stripe`);
        } catch (stripeError) {
          console.error(`❌ Error pausing subscription in Stripe:`, stripeError.message);
        }
      }

      // L'accès sera retiré par la fonction scheduled `processPendingSuspensions`
      // qui vérifie quotidiennement les suspensions en attente
    }

    return {
      success: true,
      attemptCount: failureData.attemptCount,
      isLastAttempt: isLastAttempt,
      willSuspend: shouldSuspend,
    };
  } catch (error) {
    console.error('Error handling payment failure:', error);
    throw error;
  }
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
        // amount et currency ne sont plus utilisés car on utilise uniquement les métadonnées
        // const amount = session.amount_total || session.amount;
        // const currency = session.currency || 'chf';

        // Vérifier d'abord si ce paiement est destiné au système Firebase.
        // ⚠️ IMPORTANT : Pas de fallback - seuls les paiements avec metadata.system = 'firebase' sont traités.
        const system = session.metadata?.system;
        if (system !== 'firebase') {
          console.log(
              `Paiement Stripe ignoré - système: ${system || 'non défini'} (pas pour Firebase)`,
          );
          return res.status(200).json({received: true, ignored: true});
        }

        // Ensuite seulement, exiger la présence de l'email (spécifique aux paiements Fluance).
        const customerEmail = session.customer_details?.email || session.customer_email;
        if (!customerEmail) {
          console.error('No email found in Stripe event (Firebase system)');
          return res.status(400).send('No email found');
        }

        // Récupérer les coordonnées complémentaires depuis Stripe
        const customerName = session.customer_details?.name || null;
        const customerPhone = session.customer_details?.phone || null;
        const customerAddress = session.customer_details?.address || null;
        // Formater l'adresse complète si disponible
        let fullAddress = null;
        if (customerAddress) {
          const addressParts = [];
          if (customerAddress.line1) addressParts.push(customerAddress.line1);
          if (customerAddress.line2) addressParts.push(customerAddress.line2);
          if (customerAddress.city) addressParts.push(customerAddress.city);
          if (customerAddress.postal_code) addressParts.push(customerAddress.postal_code);
          if (customerAddress.country) addressParts.push(customerAddress.country);
          if (addressParts.length > 0) {
            fullAddress = addressParts.join(', ');
          }
        }

        // Déterminer le produit depuis les métadonnées uniquement (pas de fallback)
        const product = session.metadata?.product;
        if (!product || (product !== '21jours' && product !== 'complet' && product !== 'rdv-clarte')) {
          console.error(`Paiement Stripe ignoré - produit invalide: ${product}`);
          return res.status(200).json({received: true, ignored: true});
        }

        // Extraire la langue depuis les métadonnées (défaut: 'fr')
        const langue = session.metadata?.locale || session.metadata?.langue || 'fr';

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
              customerName,
              customerPhone,
              fullAddress,
              langue,
          );
          console.log(
              `Token created and email sent to ${customerEmail} for product ${product}, amount: ${amountCHF} CHF`,
          );

          // Vérifier si le produit cross-sell "SOS dos & cervicales" a été acheté
          try {
            // Récupérer les line_items de la session Stripe pour détecter les cross-sells
            let hasCrossSell = false;
            if (process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
              try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                // Récupérer la session complète avec line_items
                const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
                  expand: ['line_items'],
                });

                // Vérifier si le price_id du cross-sell est présent dans les line_items
                if (fullSession.line_items && fullSession.line_items.data) {
                  for (const lineItem of fullSession.line_items.data) {
                    if (lineItem.price && lineItem.price.id === STRIPE_PRICE_ID_SOS_DOS_CERVICALES) {
                      hasCrossSell = true;
                      console.log(`Cross-sell "SOS dos & cervicales" détecté pour ${customerEmail}`);
                      break;
                    }
                  }
                }
              } catch (stripeError) {
                console.warn('Error retrieving Stripe session line_items:', stripeError.message);
                // Si on ne peut pas récupérer les line_items, on continue sans le cross-sell
              }
            }

            // Si le cross-sell a été détecté, créer un token pour ce produit (réutiliser les mêmes coordonnées)
            if (hasCrossSell) {
              await createTokenAndSendEmail(
                  customerEmail,
                  'sos-dos-cervicales',
                  30,
                  process.env.MAILJET_API_KEY,
                  process.env.MAILJET_API_SECRET,
                  17, // Montant du cross-sell en CHF
                  customerName,
                  customerPhone,
                  fullAddress,
                  langue,
              );
              console.log(
                  `Token created and email sent to ${customerEmail} for cross-sell product sos-dos-cervicales`,
              );
            }
          } catch (crossSellError) {
            // Ne pas faire échouer le webhook si le traitement du cross-sell échoue
            console.error('Error processing cross-sell:', crossSellError);
          }

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
            // Récupérer la subscription depuis Stripe pour avoir les métadonnées
            let subscription = null;
            if (process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
              try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                subscription = await stripe.subscriptions.retrieve(subscriptionId, {
                  expand: ['customer', 'items.data.price'],
                });
              } catch (stripeError) {
                console.warn('Error retrieving subscription from Stripe:', stripeError.message);
              }
            }

            // Vérifier si c'est pour le système Firebase
            const system = subscription?.metadata?.system;
            if (system !== 'firebase') {
              console.log(`Payment failure ignored - système: ${system || 'non défini'}`);
              return res.status(200).json({received: true, ignored: true});
            }

            // Gérer l'échec de paiement avec relances progressives
            console.log(`Payment failed for ${customerEmail}, subscription: ${subscriptionId}`);
            await handlePaymentFailure(
                invoice,
                subscription,
                customerEmail,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );

            return res.status(200).json({received: true});
          } catch (error) {
            console.error('Error processing payment failed event:', error);
            return res.status(200).json({received: true});
          }
        }

        // Pour les paiements sans subscription (one-time), juste logger
        console.log(`Payment failed for ${customerEmail}, no subscription (one-time payment)`);
        return res.status(200).json({received: true});
      }

      // Gérer les événements de remboursement
      // Note: Stripe n'a pas d'événement payment_intent.refunded
      // Les remboursements déclenchent charge.refunded (pour les charges directes)
      // ou peuvent être liés à un Payment Intent via la charge associée
      if (event.type === 'charge.refunded') {
        const charge = event.data.object;
        let customerEmail = null;
        let product = null;
        let system = null;

        // Récupérer l'email depuis les métadonnées de la charge ou du customer
        customerEmail = charge.metadata?.email || charge.billing_details?.email;
        product = charge.metadata?.product;
        system = charge.metadata?.system;

        // Si l'email n'est pas dans les métadonnées, essayer de récupérer depuis le customer
        if (!customerEmail && charge.customer) {
          try {
            if (process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
              const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
              const customer = await stripe.customers.retrieve(charge.customer);
              customerEmail = customer.email || customer.metadata?.email;
              // Si le produit n'est pas dans les métadonnées de la charge, vérifier le customer
              if (!product) {
                product = customer.metadata?.product;
              }
              if (!system) {
                system = customer.metadata?.system;
              }
            }
          } catch (stripeError) {
            console.warn('Error retrieving customer from Stripe:', stripeError.message);
          }
        }

        // Si l'email n'est toujours pas trouvé, essayer de récupérer depuis le Payment Intent associé
        if (!customerEmail && charge.payment_intent) {
          try {
            if (process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
              const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
              const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent);
              customerEmail = paymentIntent.metadata?.email || customerEmail;
              if (!product) {
                product = paymentIntent.metadata?.product;
              }
              if (!system) {
                system = paymentIntent.metadata?.system;
              }
            }
          } catch (stripeError) {
            console.warn('Error retrieving payment intent from Stripe:', stripeError.message);
          }
        }

        if (!customerEmail) {
          console.error('No email found in refund event');
          return res.status(200).json({received: true, ignored: true});
        }

        // Vérifier si c'est pour le système Firebase
        if (system !== 'firebase') {
          console.log(`Refund ignored - système: ${system || 'non défini'}`);
          return res.status(200).json({received: true, ignored: true});
        }

        // Vérifier le produit (seuls 21jours et sos-dos-cervicales peuvent être remboursés,
        // pas "complet" qui est un abonnement)
        if (!product || (product !== '21jours' && product !== 'sos-dos-cervicales')) {
          console.log(
              `Refund ignored - produit: ${product} ` +
              `(seuls '21jours' et 'sos-dos-cervicales' peuvent être remboursés)`,
          );
          return res.status(200).json({received: true, ignored: true});
        }

        try {
          // Retirer le produit de l'utilisateur
          await removeProductFromUser(customerEmail, product);
          console.log(`Refund processed and product '${product}' removed for ${customerEmail}`);
          return res.status(200).json({received: true});
        } catch (error) {
          console.error('Error removing product after refund:', error);
          return res.status(500).send('Error processing refund');
        }
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
          // Récupérer les coordonnées complémentaires depuis PayPal
          const payer = resource.payer || {};
          const purchaseUnits = resource.purchase_units || [];
          const shipping = purchaseUnits[0]?.shipping || {};
          const payerName = payer.name || {};
          const customerName = payerName.given_name && payerName.surname ?
            `${payerName.given_name} ${payerName.surname}` : null;
          const customerPhone = payer.phone?.phone_number?.national_number || null;
          // Formater l'adresse PayPal si disponible
          let fullAddress = null;
          if (shipping.address) {
            const addressParts = [];
            if (shipping.address.address_line_1) addressParts.push(shipping.address.address_line_1);
            if (shipping.address.address_line_2) addressParts.push(shipping.address.address_line_2);
            if (shipping.address.admin_area_2) addressParts.push(shipping.address.admin_area_2); // Ville
            if (shipping.address.postal_code) addressParts.push(shipping.address.postal_code);
            if (shipping.address.country_code) addressParts.push(shipping.address.country_code);
            if (addressParts.length > 0) {
              fullAddress = addressParts.join(', ');
            }
          }

          // Récupérer le montant en CHF depuis PayPal
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

          // Extraire la langue depuis les métadonnées PayPal (défaut: 'fr')
          const langue = resource.custom_id?.locale || resource.custom_id?.langue || 'fr';

          await createTokenAndSendEmail(
              customerEmail,
              product,
              30,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
              amountCHF,
              customerName,
              customerPhone,
              fullAddress,
              langue,
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
            locale: locale === 'en' ? 'en' : 'fr',
            // Ajouter le variant pour rdv-clarte si présent
            ...(product === 'rdv-clarte' && variant ? {variant: variant} : {}),
          },
          // Pour les paiements uniques, s'assurer que les métadonnées sont aussi sur le Payment Intent
          // (nécessaire pour les remboursements qui récupèrent les métadonnées depuis le Payment Intent)
          payment_intent_data: mode === 'payment' ? {
            metadata: {
              system: 'firebase',
              product: product,
              locale: locale === 'en' ? 'en' : 'fr',
              // Ajouter le variant pour rdv-clarte si présent
              ...(product === 'rdv-clarte' && variant ? {variant: variant} : {}),
            },
          } : undefined,
          // Pour les abonnements, passer les métadonnées aussi dans la subscription
          subscription_data: mode === 'subscription' ? {
            metadata: {
              system: 'firebase',
              product: product,
              // Ajouter le variant pour rdv-clarte si présent
              ...(product === 'rdv-clarte' && variant ? {variant: variant} : {}),
            },
            // Période d'essai gratuite de 14 jours pour le produit "complet"
            ...(product === 'complet' ? {trial_period_days: 14} : {}),
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
 * Vérifie les métadonnées d'un Payment Intent Stripe pour les remboursements
 * Utilisé pour vérifier que les métadonnées sont présentes avant un remboursement
 */
exports.checkStripePaymentMetadata = onCall(
    {
      region: 'europe-west1',
      secrets: ['STRIPE_SECRET_KEY'],
    },
    async (request) => {
      const {paymentIntentId} = request.data;

      if (!paymentIntentId) {
        throw new HttpsError('invalid-argument', 'paymentIntentId is required');
      }

      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        // Récupérer le Payment Intent avec les charges et le customer
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['charges.data.customer', 'customer'],
        });

        const result = {
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
          metadata: paymentIntent.metadata || {},
          charges: [],
          customer: null,
          refundReady: false,
          issues: [],
        };

        // Vérifier les métadonnées du Payment Intent
        const system = paymentIntent.metadata?.system;
        const product = paymentIntent.metadata?.product;

        result.metadataCheck = {
          system: system || null,
          product: product || null,
          systemValid: system === 'firebase',
          productValid: product === '21jours' || product === 'sos-dos-cervicales',
        };

        // Récupérer les charges associées
        if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
          for (const charge of paymentIntent.charges.data) {
            const chargeData = {
              id: charge.id,
              status: charge.status,
              refunded: charge.refunded,
              amountRefunded: charge.amount_refunded / 100,
              billingEmail: charge.billing_details?.email || null,
              metadata: charge.metadata || {},
            };

            // Vérifier les métadonnées de la charge
            chargeData.metadataCheck = {
              system: charge.metadata?.system || null,
              product: charge.metadata?.product || null,
              systemValid: charge.metadata?.system === 'firebase',
              productValid: charge.metadata?.product === '21jours' ||
                           charge.metadata?.product === 'sos-dos-cervicales',
            };

            result.charges.push(chargeData);
          }
        }

        // Récupérer le customer si disponible
        if (paymentIntent.customer) {
          let customer;
          if (typeof paymentIntent.customer === 'string') {
            customer = await stripe.customers.retrieve(paymentIntent.customer);
          } else {
            customer = paymentIntent.customer;
          }

          result.customer = {
            id: customer.id,
            email: customer.email || null,
            metadata: customer.metadata || {},
          };
        }

        // Déterminer si le remboursement automatique fonctionnera
        const hasSystem = result.metadataCheck.systemValid ||
                         (result.charges[0]?.metadataCheck?.systemValid || false);
        const hasProduct = result.metadataCheck.productValid ||
                          (result.charges[0]?.metadataCheck?.productValid || false);
        const hasEmail = result.charges[0]?.billingEmail ||
                        result.customer?.email;

        result.refundReady = hasSystem && hasProduct && hasEmail;

        if (!hasSystem) {
          result.issues.push('Le système n\'est pas identifié comme "firebase" dans les métadonnées');
        }
        if (!hasProduct) {
          result.issues.push('Le produit n\'est pas identifié comme "21jours" ou "sos-dos-cervicales" dans les métadonnées');
        }
        if (!hasEmail) {
          result.issues.push('L\'email n\'est pas disponible dans la charge ou le customer');
        }

        return result;
      } catch (error) {
        console.error('Error checking Stripe payment metadata:', error);
        if (error.type === 'StripeInvalidRequestError') {
          throw new HttpsError('not-found', `Payment Intent "${paymentIntentId}" not found`);
        }
        throw new HttpsError('internal', `Error checking metadata: ${error.message}`);
      }
    });

/**
 * Récupère les détails d'une session Stripe Checkout
 * Utilisé pour le suivi de conversion Google Analytics
 */
exports.getStripeCheckoutSession = onCall(
    {
      region: 'europe-west1',
      secrets: ['STRIPE_SECRET_KEY'],
    },
    async (request) => {
      const {sessionId} = request.data;

      if (!sessionId) {
        throw new HttpsError('invalid-argument', 'sessionId is required');
      }

      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['line_items', 'customer'],
        });

        // Extraire les informations nécessaires
        const product = session.metadata?.product || null;
        const amount = session.amount_total ? session.amount_total / 100 : 0; // Convertir de centimes en unités
        const currency = session.currency?.toUpperCase() || 'CHF';

        // Déterminer le nom du produit
        let productName = '';
        if (product === '21jours') {
          productName = 'Défi 21 jours';
        } else if (product === 'complet') {
          productName = 'Approche Fluance complète';
        } else if (product === 'rdv-clarte') {
          productName = 'RDV Clarté';
        }

        return {
          success: true,
          sessionId: session.id,
          product: product,
          productName: productName,
          amount: amount,
          currency: currency,
          customerEmail: session.customer_details?.email || session.customer_email,
        };
      } catch (error) {
        console.error('Error retrieving Stripe session:', error);
        throw new HttpsError('internal', `Error retrieving session: ${error.message}`);
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
            null, // amount (null pour création manuelle)
            null, // customerName (non disponible pour création manuelle)
            null, // customerPhone (non disponible pour création manuelle)
            null, // customerAddress (non disponible pour création manuelle)
            'fr', // langue (par défaut 'fr' pour création manuelle admin)
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

        // Mettre à jour le mot de passe pour s'assurer qu'il est défini correctement
        // Cela est nécessaire si l'utilisateur existait déjà (créé via passwordless par exemple)
        // ou si on veut s'assurer que le mot de passe correspond au token
        try {
          await auth.updateUser(userRecord.uid, {password: password});
          console.log(`[verifyToken] Password updated for user ${email}`);
        } catch (updateError) {
          console.error(`[verifyToken] Error updating password for ${email}:`, updateError);
          // Si la mise à jour échoue, cela peut indiquer un problème
          // Mais on continue quand même car l'utilisateur peut utiliser "mot de passe oublié"
          // Ne pas faire échouer la fonction complètement
        }

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
        // IMPORTANT: Faire cela AVANT de marquer le token comme utilisé
        // pour éviter que le token soit marqué comme utilisé si la création échoue
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

        // Créer ou mettre à jour le document Firestore
        // Utiliser set() au lieu de set(..., {merge: true}) pour s'assurer que le document est créé
        // même s'il n'existe pas encore
        await userDocRef.set(userData, {merge: true});

        // Vérifier que le document a bien été créé/mis à jour
        const verifyDoc = await userDocRef.get();
        if (!verifyDoc.exists) {
          throw new Error('Failed to create Firestore document after set operation');
        }

        // Marquer le token comme utilisé UNIQUEMENT après avoir créé le document Firestore
        await db.collection('registrationTokens').doc(token).update({
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          userId: userRecord.uid,
        });

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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
    },
    async (request) => {
      const {email, product = null} = request.data;

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
          const products = existingData.products || [];
          return {
            success: true,
            message: 'Document Firestore existe déjà',
            userId: userId,
            email: normalizedEmail,
            products: products.map((p) => p.name),
            product: existingData.product,
          };
        }

        // Essayer de détecter les produits depuis Mailjet si disponible
        let detectedProducts = [];
        if (product) {
          // Si un produit est spécifié, l'utiliser
          detectedProducts = [product];
        } else {
          // Sinon, essayer de détecter depuis Mailjet
          try {
            const mailjetAuth = Buffer.from(
                `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`,
            ).toString('base64');
            const contactDataUrl = `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(normalizedEmail)}`;
            const contactResponse = await fetch(contactDataUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${mailjetAuth}`,
              },
            });

            if (contactResponse.ok) {
              const contactData = await contactResponse.json();
              if (contactData.Data && contactData.Data.length > 0) {
                const contactProperties = contactData.Data[0].Data || {};
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

                // Extraire les produits depuis produits_achetes
                const produitsAchetes = properties.produits_achetes || '';
                if (produitsAchetes) {
                  detectedProducts = produitsAchetes.split(',')
                      .map((p) => p.trim())
                      .filter((p) => p && (p === '21jours' || p === 'complet' || p === 'sos-dos-cervicales'));
                  console.log(`[repairUserDocument] Produits détectés depuis Mailjet: ${detectedProducts.join(', ')}`);
                }
              }
            }
          } catch (mailjetError) {
            console.warn(
                `[repairUserDocument] Impossible de récupérer les produits depuis Mailjet:`,
                mailjetError.message,
            );
            // Continuer avec le produit par défaut
          }
        }

        // Si aucun produit détecté, utiliser '21jours' par défaut
        if (detectedProducts.length === 0) {
          detectedProducts = ['21jours'];
          console.log(`[repairUserDocument] Aucun produit détecté, utilisation de '21jours' par défaut`);
        }

        // Créer le document Firestore avec products[]
        const now = admin.firestore.FieldValue.serverTimestamp();
        const productsArray = detectedProducts.map((prod) => ({
          name: prod,
          startDate: now,
          purchasedAt: now,
        }));

        const userData = {
          email: normalizedEmail,
          products: productsArray,
          product: detectedProducts[0], // Garder pour compatibilité rétroactive (premier produit)
          createdAt: now,
          updatedAt: now,
        };

        // Pour le produit "21jours", ajouter aussi registrationDate pour compatibilité
        if (detectedProducts.includes('21jours') && !userData.registrationDate) {
          userData.registrationDate = now;
        }

        await db.collection('users').doc(userId).set(userData);

        console.log(`Document Firestore créé pour ${normalizedEmail} (${userId}) avec produits: ${detectedProducts.join(', ')}`);

        return {
          success: true,
          message: 'Document Firestore créé avec succès',
          userId: userId,
          email: normalizedEmail,
          products: detectedProducts,
          product: detectedProducts[0],
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
      const {email, name, turnstileToken, isLocalhost, turnstileSkipped, locale = 'fr'} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      // Valider le token Turnstile (sauf en développement local ou si fallback activé)
      if (!isLocalhost && !turnstileSkipped && !turnstileToken) {
        throw new HttpsError('invalid-argument', 'Turnstile verification required');
      }

      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

      // Si Turnstile a été ignoré (fallback), logger un avertissement mais continuer
      if (turnstileSkipped) {
        console.warn(
            `[subscribeToNewsletter] Turnstile skipped for ${email} (fallback mode). ` +
            'Double opt-in will still protect against bots.',
        );
      }

      // Valider Turnstile seulement si pas en localhost, pas en fallback, et si le secret est configuré
      if (!isLocalhost && !turnstileSkipped && turnstileSecret && turnstileToken) {
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
          reminderSent: false,
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

        // Valider et normaliser la langue
        const langue = (locale === 'en' || locale === 'EN') ? 'en' : 'fr';

        const properties = {
          statut: 'prospect',
          source_optin: '2pratiques',
          date_optin: dateStr,
          est_client: 'False',
          langue: langue,
        };

        // Ajouter le prénom aux propriétés si disponible
        if (name) {
          properties.firstname = capitalizeName(name);
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

        // Envoyer une notification à support@fluance.io pour le nouvel opt-in
        await sendOptInNotification(
            contactData.Email,
            name || '',
            '2pratiques',
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );

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
 * Inscription à la liste d'attente pour les prochains stages
 * Cette fonction est publique (pas besoin d'authentification admin)
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.subscribeToStagesWaitingList = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'TURNSTILE_SECRET_KEY'],
      cors: true, // Autoriser CORS pour toutes les origines
    },
    async (request) => {
      const {email, name, region, turnstileToken, isLocalhost, turnstileSkipped, locale = 'fr'} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      if (!name) {
        throw new HttpsError('invalid-argument', 'Name is required');
      }

      if (!region) {
        throw new HttpsError('invalid-argument', 'Region is required');
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      // Valider la région
      const validRegions = [
        'France : Est',
        'France : Nord',
        'France : Sud',
        'France : Ouest',
        'France : outre-mer',
        'Belgique',
        'Québec',
        'Suisse',
        'Autres régions',
      ];
      if (!validRegions.includes(region)) {
        throw new HttpsError('invalid-argument', 'Invalid region');
      }

      // Valider le token Turnstile (sauf en développement local ou si fallback activé)
      if (!isLocalhost && !turnstileSkipped && !turnstileToken) {
        throw new HttpsError('invalid-argument', 'Turnstile verification required');
      }

      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

      // Si Turnstile a été ignoré (fallback), logger un avertissement mais continuer
      if (turnstileSkipped) {
        console.warn(
            `[subscribeToStagesWaitingList] Turnstile skipped for ${email} (fallback mode)`,
        );
      }

      // Valider Turnstile seulement si pas en localhost, pas en fallback, et si le secret est configuré
      if (!isLocalhost && !turnstileSkipped && turnstileSecret && turnstileToken) {
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
        // Ajouter le contact à MailJet
        const url = 'https://api.mailjet.com/v3/REST/contact';

        const contactData = {
          Email: email.toLowerCase().trim(),
          IsExcludedFromCampaigns: false,
        };

        if (name) {
          contactData.Name = name;
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
          reminderSent: false,
          sourceOptin: 'stages',
          region: region,
          locale: locale,
        });

        // Valider et normaliser la langue
        const langue = (locale === 'en' || locale === 'EN') ? 'en' : 'fr';

        // Déterminer les URLs selon la langue
        const baseUrl = 'https://fluance.io';
        const url21jours = langue === 'en' ?
          `${baseUrl}/en/cours-en-ligne/21-jours-mouvement/` :
          `${baseUrl}/cours-en-ligne/21-jours-mouvement/`;

        // Envoyer l'email de confirmation avec le template spécifique aux stages
        console.log('📧 Starting email confirmation process for stages waiting list:', contactData.Email);
        const confirmationUrl = `${baseUrl}/confirm?email=${encodeURIComponent(contactData.Email)}&token=${confirmationToken}&redirect=stages`;

        let emailSent = false;
        let emailError = null;

        console.log('📧 About to send confirmation email, token:', confirmationToken);
        try {
          const emailSubject = langue === 'en' ?
            `Last step${name ? ' ' + name : ''}` :
            `Dernière étape indispensable${name ? ' ' + name : ''}`;

          // Préparer le texte de région pour le template
          const regionText = region ? ` dans votre région (${region})` : '';

          const emailHtml = loadEmailTemplate('confirmation-stages', {
            firstName: name || '',
            confirmationUrl: confirmationUrl,
            regionText: regionText,
            url21jours: url21jours,
          });

          const emailText = langue === 'en' ?
            `Hello${name ? ' ' + name : ''},\n\n` +
            `Thank you for signing up for the waiting list for upcoming Fluance workshops${region ? ' in your region (' + region + ')' : ''}!\n\n` +
            `To finalize your registration and be notified first when upcoming workshops are announced, ` +
            `please confirm your email address by clicking on this link:\n\n` +
            `${confirmationUrl}\n\n` +
            `This link is valid for 7 days.\n\n` +
            `In the meantime, you can:\n` +
            `• Follow the 21-day online course: ${url21jours}\n` +
            `• Subscribe to the YouTube channel: https://www.youtube.com/@fluanceio\n\n` +
            `If you did not request this registration, you can ignore this email.` :
            `Bonjour${name ? ' ' + name : ''},\n\n` +
            `Merci pour votre inscription à la liste d'attente des prochains stages Fluance${region ? ' dans votre région (' + region + ')' : ''} !\n\n` +
            `Pour finaliser votre inscription et être informé(e) en priorité dès que les prochains stages seront annoncés, ` +
            `il vous suffit de confirmer votre adresse email en cliquant sur ce lien :\n\n` +
            `${confirmationUrl}\n\n` +
            `Ce lien est valide pendant 7 jours.\n\n` +
            `En attendant, vous pouvez :\n` +
            `• Suivre le cours en ligne de 21 jours : ${url21jours}\n` +
            `• S'abonner à la chaîne YouTube : https://www.youtube.com/@fluanceio\n\n` +
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
        console.error('Error subscribing to stages waiting list:', error);
        throw new HttpsError('internal', 'Error subscribing to stages waiting list: ' + error.message);
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

        // Mettre à jour les propriétés MailJet selon le type d'opt-in
        const confirmationDate = new Date();
        const dateStr = confirmationDate.toISOString();

        // Récupérer les propriétés actuelles
        let currentProperties = {};
        try {
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
                if (Array.isArray(contactData.Data)) {
                  contactData.Data.forEach((item) => {
                    if (item.Name && item.Value !== undefined) {
                      currentProperties[item.Name] = item.Value;
                    }
                  });
                } else if (typeof contactData.Data === 'object') {
                  currentProperties = contactData.Data;
                }
              }
            }
          }
        } catch (error) {
          console.log('Error fetching contact properties:', error.message);
        }

        // Si c'est une confirmation pour les 5 jours, mettre à jour le statut de la série
        if (tokenData.sourceOptin === '5joursofferts') {
          try {
            const properties = {
              'serie_5jours_status': 'started', // Série démarrée après confirmation
            };

            // Si serie_5jours_debut n'existe pas, l'ajouter maintenant
            if (!currentProperties['serie_5jours_debut']) {
              properties['serie_5jours_debut'] = dateStr;
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

        // Si c'est une confirmation pour les stages, mettre à jour les propriétés
        if (tokenData.sourceOptin === 'stages') {
          try {
            // Valider et normaliser la langue
            const locale = tokenData.locale || 'fr';
            const langue = (locale === 'en' || locale === 'EN') ? 'en' : 'fr';

            const properties = {
              region: tokenData.region || '',
              liste_attente_stages: dateStr,
              langue: langue,
            };

            // Ajouter le prénom aux propriétés si disponible
            if (tokenData.name) {
              properties.firstname = capitalizeName(tokenData.name);
            }

            // Si source_optin existe déjà, l'ajouter à la liste (séparée par virgules)
            const currentSourceOptin = currentProperties.source_optin || '';
            const sourceOptinListBase = currentSourceOptin ? currentSourceOptin.split(',').map((s) => s.trim()).filter((s) => s) : [];
            const sourceOptinList = sourceOptinListBase.includes('stages') ?
              sourceOptinListBase :
              [...sourceOptinListBase, 'stages'];

            if (sourceOptinList.length > 0) {
              properties.source_optin = sourceOptinList.join(',');
            } else {
              properties.source_optin = 'stages';
            }

            // Si statut n'existe pas, le définir comme prospect
            if (!currentProperties.statut) {
              properties.statut = 'prospect';
            }

            // Si date_optin n'existe pas, la définir
            if (!currentProperties.date_optin) {
              properties.date_optin = dateStr;
            }

            // Si est_client n'existe pas, le définir comme False
            if (!currentProperties.est_client) {
              properties.est_client = 'False';
            }

            console.log('📋 Starting MailJet contact properties update for confirmed stages waiting list:', email);
            console.log('📋 Properties to set:', JSON.stringify(properties));
            await updateMailjetContactProperties(
                email.toLowerCase().trim(),
                properties,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );
            console.log('📋 MailJet contact properties update completed for confirmed stages:', email);
          } catch (error) {
            console.error('Error updating stages waiting list properties:', error);
            // Ne pas faire échouer la confirmation si la mise à jour des propriétés échoue
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
      const {email, name, turnstileToken, isLocalhost, locale = 'fr'} = request.data;

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
          reminderSent: false,
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

        // Valider et normaliser la langue
        const langue = (locale === 'en' || locale === 'EN') ? 'en' : 'fr';

        const properties = {
          statut: 'prospect',
          source_optin: sourceOptinList.join(','),
          date_optin: dateStr,
          est_client: 'False',
          langue: langue,
        };

        // Ajouter le prénom aux propriétés si disponible
        if (name) {
          properties.firstname = capitalizeName(name);
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

        // Envoyer une notification à support@fluance.io pour le nouvel opt-in
        await sendOptInNotification(
            contactData.Email,
            name || '',
            '5joursofferts',
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );

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

        // Vérifier si l'utilisateur est client (a des produits dans Firestore)
        let isClient = false;
        let userRecord = null;

        try {
          // Chercher l'utilisateur dans Firebase Auth
          userRecord = await adminAuth.getUserByEmail(normalizedEmail);
          const userId = userRecord.uid;
          console.log(`[Password Reset] User found in Firebase Auth: ${userId}`);

          // Vérifier si l'utilisateur a des produits dans Firestore
          const userDocRef = db.collection('users').doc(userId);
          const userDoc = await userDocRef.get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            const products = userData.products || [];
            console.log(`[Password Reset] User document exists, products:`, products);

            // Migration depuis ancien format si nécessaire
            if (products.length === 0 && userData.product) {
              isClient = true; // Ancien format avec product unique
              console.log(`[Password Reset] User is client (old format, product: ${userData.product})`);
            } else if (products.length > 0) {
              isClient = true; // Nouveau format avec products[]
              console.log(`[Password Reset] User is client (new format, ${products.length} products)`);
            } else {
              console.log(`[Password Reset] User document exists but no products found - not a client`);
            }
          } else {
            console.log(`[Password Reset] User document does not exist in Firestore - not a client`);
          }
        } catch (authError) {
          if (authError.code === 'auth/user-not-found') {
            // L'utilisateur n'existe pas dans Firebase Auth, donc pas client
            isClient = false;
            console.log(`[Password Reset] User ${normalizedEmail} not found in Firebase Auth - not a client`);
          } else {
            // Autre erreur, on continue quand même mais on log
            console.warn(`[Password Reset] Error checking user status for ${normalizedEmail}:`, authError);
            // Par défaut, on considère que ce n'est pas un client si on ne peut pas vérifier
            isClient = false;
          }
        }

        console.log(`[Password Reset] Final isClient status for ${normalizedEmail}: ${isClient}`);

        // Si l'utilisateur n'est pas client, envoyer un email de redirection vers les opt-ins
        if (!isClient) {
          console.log(`[Password Reset] User ${normalizedEmail} is not a client, sending redirect email to opt-ins`);

          // Créer ou mettre à jour le contact dans MailJet
          const mailjetAuth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
          const contactUrl = `https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(normalizedEmail)}`;

          try {
            const checkResponse = await fetch(contactUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${mailjetAuth}`,
              },
            });

            if (!checkResponse.ok) {
              const createUrl = 'https://api.mailjet.com/v3/REST/contact';
              const contactData = {
                Email: normalizedEmail,
                IsExcludedFromCampaigns: false,
              };

              const createResponse = await fetch(createUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Basic ${mailjetAuth}`,
                },
                body: JSON.stringify(contactData),
              });

              if (createResponse.ok) {
                console.log(`[Password Reset] Contact created in MailJet: ${normalizedEmail}`);
              } else {
                const errorText = await createResponse.text();
                console.warn(`[Password Reset] Could not create contact in MailJet: ${errorText}`);
              }
            }
          } catch (contactError) {
            console.warn(`[Password Reset] Error managing contact in MailJet:`, contactError);
          }

          // Envoyer l'email de redirection vers les opt-ins
          const emailSubject = 'Bienvenue sur Fluance : découvrez nos offres gratuites';
          const emailHtml = loadEmailTemplate('non-client-connexion', {});
          const emailText = `Bienvenue sur Fluance\n\n` +
              `Bonjour,\n\n` +
              `Vous avez demandé à réinitialiser votre mot de passe, ` +
              `mais nous n'avons pas trouvé de compte client associé à cette adresse email.\n\n` +
              `Pas de souci ! Si vous souhaitez découvrir Fluance, ` +
              `nous vous invitons à rejoindre l'une de nos offres gratuites :\n\n` +
              `🎁 2 pratiques offertes : https://fluance.io/2-pratiques-offertes/\n` +
              `🎁 5 jours offerts : https://fluance.io/cours-en-ligne/5jours/inscription/\n\n` +
              `Vous êtes déjà client ? Vérifiez que vous utilisez bien l'adresse email ` +
              `associée à votre achat. Si le problème persiste, contactez-nous à ` +
              `support@fluance.io.\n\n` +
              `Cordialement,\nL'équipe Fluance`;

          console.log(`[Password Reset] Sending redirect email to ${normalizedEmail}`);

          await sendMailjetEmail(
              normalizedEmail,
              emailSubject,
              emailHtml,
              emailText,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );

          console.log(`[Password Reset] Non-client redirect email sent via Mailjet to ${normalizedEmail}`);

          return {
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.',
            isClient: false,
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

      const normalizedEmail = email.toLowerCase().trim();

      try {
        // Utiliser admin.auth() directement pour éviter les problèmes d'initialisation
        const adminAuth = admin.auth();

        // Vérifier si l'utilisateur est client (a des produits dans Firestore)
        let isClient = false;
        let userRecord = null;

        try {
          // Chercher l'utilisateur dans Firebase Auth
          userRecord = await adminAuth.getUserByEmail(normalizedEmail);
          const userId = userRecord.uid;
          console.log(`[Non-client check] User found in Firebase Auth: ${userId}`);

          // Vérifier si l'utilisateur a des produits dans Firestore
          const userDocRef = db.collection('users').doc(userId);
          const userDoc = await userDocRef.get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            const products = userData.products || [];
            console.log(`[Non-client check] User document exists, products:`, products);

            // Migration depuis ancien format si nécessaire
            if (products.length === 0 && userData.product) {
              isClient = true; // Ancien format avec product unique
              console.log(`[Non-client check] User is client (old format, product: ${userData.product})`);
            } else if (products.length > 0) {
              isClient = true; // Nouveau format avec products[]
              console.log(`[Non-client check] User is client (new format, ${products.length} products)`);
            } else {
              console.log(`[Non-client check] User document exists but no products found - not a client`);
            }
          } else {
            console.log(`[Non-client check] User document does not exist in Firestore - not a client`);
          }
        } catch (authError) {
          if (authError.code === 'auth/user-not-found') {
            // L'utilisateur n'existe pas dans Firebase Auth, donc pas client
            isClient = false;
            console.log(`[Non-client check] User ${normalizedEmail} not found in Firebase Auth - not a client`);
          } else {
            // Autre erreur, on continue quand même mais on log
            console.warn(`[Non-client check] Error checking user status for ${normalizedEmail}:`, authError);
            // Par défaut, on considère que ce n'est pas un client si on ne peut pas vérifier
            isClient = false;
          }
        }

        console.log(`[Non-client check] Final isClient status for ${normalizedEmail}: ${isClient}`);

        // Si l'utilisateur n'est pas client, envoyer un email de redirection
        if (!isClient) {
          console.log(`User ${normalizedEmail} is not a client, sending redirect email to opt-ins`);

          // Créer ou mettre à jour le contact dans MailJet
          const mailjetAuthNonClient = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
          const contactUrl = `https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(normalizedEmail)}`;

          try {
            const checkResponse = await fetch(contactUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${mailjetAuthNonClient}`,
              },
            });

            if (!checkResponse.ok) {
              const createUrl = 'https://api.mailjet.com/v3/REST/contact';
              const contactData = {
                Email: normalizedEmail,
                IsExcludedFromCampaigns: false,
              };

              const createResponse = await fetch(createUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Basic ${mailjetAuth}`,
                },
                body: JSON.stringify(contactData),
              });

              if (createResponse.ok) {
                console.log(`Contact created in MailJet: ${normalizedEmail}`);
              } else {
                const errorText = await createResponse.text();
                console.warn(`Could not create contact in MailJet: ${errorText}`);
              }
            }
          } catch (contactError) {
            console.warn(`Error managing contact in MailJet:`, contactError);
          }

          // Envoyer l'email de redirection vers les opt-ins
          const emailSubject = 'Bienvenue sur Fluance : découvrez nos offres gratuites';
          const emailHtml = loadEmailTemplate('non-client-connexion', {});
          const emailText = `Bienvenue sur Fluance\n\n` +
              `Bonjour,\n\n` +
              `Vous avez demandé à vous connecter à votre compte Fluance, ` +
              `mais nous n'avons pas trouvé de compte client associé à cette adresse email.\n\n` +
              `Pas de souci ! Si vous souhaitez découvrir Fluance, ` +
              `nous vous invitons à rejoindre l'une de nos offres gratuites :\n\n` +
              `🎁 2 pratiques offertes : https://fluance.io/2-pratiques-offertes/\n` +
              `🎁 5 jours offerts : https://fluance.io/cours-en-ligne/5jours/inscription/\n\n` +
              `Vous êtes déjà client ? Vérifiez que vous utilisez bien l'adresse email ` +
              `associée à votre achat. Si le problème persiste, contactez-nous à ` +
              `support@fluance.io.\n\n` +
              `Cordialement,\nL'équipe Fluance`;

          console.log(`[Non-client] Sending redirect email to ${normalizedEmail}`);

          await sendMailjetEmail(
              normalizedEmail,
              emailSubject,
              emailHtml,
              emailText,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );

          console.log(`Non-client redirect email sent via Mailjet to ${normalizedEmail}`);

          return {
            success: true,
            message: 'Redirect email sent successfully. User is not a client.',
            isClient: false,
          };
        }

        // L'utilisateur est client, générer le lien de connexion normal
        console.log(`[Client] User ${normalizedEmail} is a client, generating sign-in link`);
        const signInLink = await adminAuth.generateSignInWithEmailLink(
            normalizedEmail,
            {
              url: 'https://fluance.io/connexion-membre',
              handleCodeInApp: true,
            },
        );

        console.log(`[Client] Sign-in link generated for client ${normalizedEmail}`);

        // Créer ou mettre à jour le contact dans MailJet pour qu'il apparaisse dans l'historique
        const mailjetAuth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
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
            normalizedEmail,
            emailSubject,
            emailHtml,
            emailText,
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );

        console.log(`Sign-in link email sent via Mailjet to ${normalizedEmail}`);

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
          const hasComplet = products.some((p) => p && p.name === 'complet');
          const firstName =
            userData.firstName ||
            userData.firstname ||
            userData.prenom ||
            (typeof userData.name === 'string' ? userData.name.split(' ')[0] : '') ||
            '';

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
                // Produit 21jours : email par jour (jours 1-21) + bonus jour 22
                const currentDay = daysSinceStart + 1; // Jour 1 = premier jour après achat

                if (currentDay >= 1 && currentDay <= 22) {
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
                  let emailSubject;
                  let emailHtml;
                  const isBonusDay = currentDay === 22;

                  let textIntro;

                  if (!isBonusDay) {
                    emailSubject = `Jour ${currentDay} de votre defi 21 jours - ` +
                      `${contentData.title || 'Nouveau contenu disponible'}`;

                    emailHtml = loadEmailTemplate('nouveau-contenu-21jours', {
                      day: currentDay,
                      title: contentData.title || 'Nouveau contenu',
                    });

                    textIntro =
                      `Jour ${currentDay} de votre defi 21 jours - ` +
                      `${contentData.title || 'Nouveau contenu disponible'}`;
                  } else {
                    // Jour 22 : bonus final + teasing pour l'approche complète
                    const bonusTitle =
                      contentData.title || '3 minutes pour soulager votre dos';

                    emailSubject =
                      `Bonus de votre defi 21 jours - ${bonusTitle}`;

                    const bonusNamePart = firstName ? ` ${firstName}` : '';
                    emailHtml =
                      '<p>Bonjour' + bonusNamePart + ',</p>' +
                      '<p>Voici le <strong>bonus</strong> de votre defi ' +
                      '<strong>21 jours pour remettre du mouvement</strong>.</p>' +
                      '<p>Offrez-vous encore quelques minutes aujourd\'hui pour ' +
                      'integrer ce que vous avez explore ces dernieres semaines.</p>' +
                      '<p>Demain, je vous enverrai un email pour vous montrer ' +
                      'comment <strong>continuer sur votre lancee</strong> avec ' +
                      'l\'<strong>approche Fluance complete</strong>, qui vous ' +
                      'propose une nouvelle mini-serie de pratiques chaque semaine.</p>' +
                      '<p>Pour l\'instant, profitez pleinement de ce bonus :</p>' +
                      '<p><a href="https://fluance.io/membre/">' +
                      'Acceder a votre bonus dans votre espace membre</a></p>';

                    textIntro =
                      `Bonus de votre defi 21 jours - ${bonusTitle}`;
                  }

                  await sendMailjetEmail(
                      email,
                      emailSubject,
                      emailHtml,
                      `${textIntro}\n\nAccedez a votre contenu : https://fluance.io/membre/`,
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

                // Après le bonus (jour 22) : séquence d'emails pour inviter à l'approche complète
                if (!hasComplet && currentDay > 22) {
                  const daysAfterEnd = currentDay - 22; // J+1 = 1, J+4 = 4, J+8 = 8
                  const sequenceDays = [1, 4, 8];

                  if (sequenceDays.includes(daysAfterEnd)) {
                    const emailSentDocId = `${userId}_21jours_to_complet_day_${daysAfterEnd}`;
                    const emailSentDoc = await db.collection('contentEmailsSent')
                        .doc(emailSentDocId).get();

                    if (!emailSentDoc.exists) {
                      const baseUrl = 'https://fluance.io';
                      const completUrl = `${baseUrl}/cours-en-ligne/approche-fluance-complete/`;
                      const namePart = firstName ? ` ${firstName}` : '';

                      let emailSubject;
                      let emailHtml;
                      let emailText;

                      if (daysAfterEnd === 1) {
                        emailSubject =
                          'Et maintenant, comment continuer sur votre lancee ?';

                        emailHtml =
                          '<p>Bonjour' + namePart + ',</p>' +
                          '<p>Felicitations pour avoir termine le defi ' +
                          '<strong>21 jours pour remettre du mouvement</strong>.</p>' +
                          '<p>Vous avez deja pose des bases importantes pour ' +
                          'votre corps : plus de mobilite, plus de conscience, ' +
                          'plus de respiration.</p>' +
                          '<p><strong>Saviez-vous que l\'activite physique reguliere ' +
                          'reduit le risque d\'Alzheimer de 30 a 40% ?</strong> ' +
                          'La cle, c\'est la continuite.</p>' +
                          '<p>La question maintenant : <strong>comment garder ' +
                          'cet elan</strong> dans la duree ?</p>' +
                          '<p>L\'<strong>approche Fluance complete</strong> ' +
                          'vous propose une nouvelle mini-serie de pratiques ' +
                          'chaque semaine, toujours courtes, pour continuer a ' +
                          'entretenir votre dos, vos epaules et votre energie.</p>' +
                          '<p>Avec l\'approche complete, vous continuez a honorer ' +
                          'votre corps, sans forcer. Une nouvelle pratique chaque ' +
                          'semaine, toujours dans cette approche respectueuse.</p>' +
                          '<p><strong>Les 14 premiers jours sont offerts</strong> : ' +
                          'vous pouvez tester sans engagement et decider ensuite ' +
                          'si vous souhaitez continuer.</p>' +
                          '<p>Decouvrez la suite naturelle de votre parcours :</p>' +
                          '<p><a href="' + completUrl + '">' +
                          'Decouvrir l\'approche Fluance complete</a></p>';

                        emailText = [
                          `Bonjour${namePart},`,
                          '',
                          'Felicitations pour avoir termine le defi ' +
                            '"21 jours pour remettre du mouvement".',
                          '',
                          'Vous avez pose des bases importantes pour votre ' +
                            'corps : plus de mobilite, plus de conscience, ' +
                            'plus de respiration.',
                          '',
                          'Saviez-vous que l\'activite physique reguliere ' +
                            'reduit le risque d\'Alzheimer de 30 a 40% ? ' +
                            'La cle, c\'est la continuite.',
                          '',
                          'La question maintenant : comment garder cet elan ' +
                            'dans la duree ?',
                          '',
                          'L\'approche Fluance complete vous propose une ' +
                            'nouvelle mini-serie de pratiques chaque semaine, ' +
                            'toujours courtes, pour continuer a entretenir ' +
                            'votre dos, vos epaules et votre energie.',
                          '',
                          'Avec l\'approche complete, vous continuez a honorer ' +
                            'votre corps, sans forcer. Une nouvelle pratique ' +
                            'chaque semaine, toujours dans cette approche respectueuse.',
                          '',
                          'Les 14 premiers jours sont offerts : vous pouvez ' +
                            'tester sans engagement et decider ensuite si vous ' +
                            'souhaitez continuer.',
                          '',
                          'Decouvrez la suite naturelle de votre parcours :',
                          completUrl,
                        ].join('\n');
                      } else if (daysAfterEnd === 4) {
                        emailSubject =
                          'Vous aimeriez continuer... mais vous hesitez ?';

                        emailHtml =
                          '<p>Bonjour' + namePart + ',</p>' +
                          '<p>Vous avez deja montre que vous pouviez vous ' +
                          'offrir quelques minutes par jour pour votre corps.</p>' +
                          '<p><strong>Apres 21 jours, vous avez cree une habitude. ' +
                          'Mais saviez-vous qu\'avec 10h par jour assis, vous avez ' +
                          '40% de risque de symptomes depressifs ?</strong> ' +
                          'Continuer, c\'est proteger votre sante mentale.</p>' +
                          '<p>Peut-etre que vous hesitez a continuer : manque ' +
                          'de temps, peur de ne pas tenir, doute sur ' +
                          'l\'utilite sur le long terme...</p>' +
                          '<p>Avec l\'<strong>approche Fluance complete</strong>, ' +
                          'vous recevez chaque semaine une nouvelle mini-serie. ' +
                          'Les seances restent simples, courtes, et pensees ' +
                          'pour s\'integrer a un quotidien charge.</p>' +
                          '<p>L\'approche complete ne vous demande pas d\'etre ' +
                          'plus discipline(e). Elle vous invite a continuer a ' +
                          'honorer votre corps, a votre rythme, sans forcer.</p>' +
                          '<p><strong>Les 14 premiers jours sont offerts</strong> : ' +
                          'testez sans engagement et decidez ensuite si vous ' +
                          'souhaitez continuer.</p>' +
                          '<p>Pour voir comment cela peut soutenir votre corps ' +
                          'dans les prochaines semaines :</p>' +
                          '<p><a href="' + completUrl + '">' +
                          'Voir l\'approche Fluance complete</a></p>';

                        emailText = [
                          `Bonjour${namePart},`,
                          '',
                          'Vous avez deja montre que vous pouviez vous offrir ' +
                            'quelques minutes par jour pour votre corps.',
                          '',
                          'Vous hesitez peut-etre a continuer : manque de ' +
                            'temps, peur de ne pas tenir, doute sur ' +
                            'l\'utilite sur le long terme.',
                          '',
                          'Avec l\'approche Fluance complete, vous recevez ' +
                            'chaque semaine une nouvelle mini-serie. Les ' +
                            'seances restent simples, courtes, et pensees ' +
                            'pour s\'integrer a un quotidien charge.',
                          '',
                          'Les 14 premiers jours sont offerts : testez sans ' +
                            'engagement et decidez ensuite si vous souhaitez ' +
                            'continuer.',
                          '',
                          'L\'approche complete ne vous demande pas d\'etre ' +
                            'plus discipline(e). Elle vous invite a continuer ' +
                            'a honorer votre corps, a votre rythme, sans forcer.',
                          '',
                          'Les 14 premiers jours sont offerts : testez sans ' +
                            'engagement et decidez ensuite si vous souhaitez ' +
                            'continuer.',
                          '',
                          'Pour voir comment cela peut soutenir votre corps ' +
                            'dans les prochaines semaines :',
                          completUrl,
                        ].join('\n');
                      } else {
                        emailSubject =
                          'Dernier rappel pour continuer avec ' +
                          'l\'approche Fluance complete';

                        emailHtml =
                          '<p>Bonjour' + namePart + ',</p>' +
                          '<p>Il y a quelques jours, vous avez termine le ' +
                          'defi <strong>21 jours pour remettre du mouvement' +
                          '</strong>.</p>' +
                          '<p><strong>Votre liberte de mouvement est un pilier ' +
                          'de votre sante. Prenez-en soin.</strong></p>' +
                          '<p>Comment se sent votre corps aujourd\'hui ? Et ' +
                          'comment aimeriez-vous qu\'il se sente dans 3 ou ' +
                          '6 mois ?</p>' +
                          '<p>Si vous souhaitez garder cet elan, ' +
                          'l\'<strong>approche Fluance complete</strong> peut ' +
                          'devenir votre rituel hebdomadaire : une nouvelle ' +
                          'mini-serie de pratiques chaque semaine, pour ' +
                          'continuer a delier, renforcer et apaiser.</p>' +
                          '<p>Fluance n\'est pas une methode qui vous force a ' +
                          'changer. C\'est un espace ou votre corps peut enfin ' +
                          'se sentir en securite pour lacher prise, semaine ' +
                          'apres semaine.</p>' +
                          '<p><strong>Les 14 premiers jours sont offerts</strong> : ' +
                          'testez sans engagement et decidez ensuite si vous ' +
                          'souhaitez continuer.</p>' +
                          '<p>Ceci est un dernier rappel doux : si c\'est le ' +
                          'bon moment pour vous, vous pouvez rejoindre ' +
                          'l\'approche complete ici :</p>' +
                          '<p><a href="' + completUrl + '">' +
                          'Rejoindre l\'approche Fluance complete</a></p>';

                        emailText = [
                          `Bonjour${namePart},`,
                          '',
                          'Il y a quelques jours, vous avez termine le defi ' +
                            '"21 jours pour remettre du mouvement".',
                          '',
                          'Votre liberte de mouvement est un pilier de votre ' +
                            'sante. Prenez-en soin.',
                          '',
                          'Comment se sent votre corps aujourd\'hui ? Et ' +
                            'comment aimeriez-vous qu\'il se sente dans 3 ou ' +
                            '6 mois ?',
                          '',
                          'Si vous souhaitez garder cet elan, l\'approche ' +
                            'Fluance complete peut devenir votre rituel ' +
                            'hebdomadaire : une nouvelle mini-serie de ' +
                            'pratiques chaque semaine, pour continuer a ' +
                            'delier, renforcer et apaiser.',
                          '',
                          'Fluance n\'est pas une methode qui vous force a ' +
                            'changer. C\'est un espace ou votre corps peut ' +
                            'enfin se sentir en securite pour lacher prise, ' +
                            'semaine apres semaine.',
                          '',
                          'Les 14 premiers jours sont offerts : testez sans ' +
                            'engagement et decidez ensuite si vous souhaitez ' +
                            'continuer.',
                          '',
                          'Ceci est un dernier rappel doux : si c\'est le ' +
                            'bon moment pour vous, vous pouvez rejoindre ' +
                            'l\'approche complete ici :',
                          completUrl,
                        ].join('\n');
                      }

                      await sendMailjetEmail(
                          email,
                          emailSubject,
                          emailHtml,
                          emailText,
                          mailjetApiKey,
                          mailjetApiSecret,
                          'fluance@actu.fluance.io',
                          'Cédric de Fluance',
                      );

                      await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                        userId: userId,
                        email: email,
                        type: 'marketing_21jours_to_complet',
                        day: daysAfterEnd,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                      });

                      console.log(`✅ Post-21jours email (J+${daysAfterEnd}) sent to ${email} for approche complète`);
                      emailsSent++;
                    }
                  }
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
                    // Format DD/MM/YYYY
                    const [day, month, year] = dateStr.split('/');
                    optinDate = new Date(year, month - 1, day);
                  } else if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/i)) {
                    // Format Mailjet: YYYY-MM-DD HH:MM AM/PM (ex: "2025-12-13 08:54 PM")
                    const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) (AM|PM)$/i);
                    if (parts) {
                      const [, year, month, day, hour, minute, ampm] = parts;
                      let hour24 = parseInt(hour, 10);
                      if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
                        hour24 += 12;
                      } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
                        hour24 = 0;
                      }
                      optinDate = new Date(year, parseInt(month, 10) - 1, day, hour24, parseInt(minute, 10));
                    } else {
                      optinDate = new Date(dateStr);
                    }
                  } else {
                    // Format ISO (YYYY-MM-DDTHH:MM:SS.sssZ) ou autre format
                    optinDate = new Date(dateStr);
                  }

                  // Vérifier que la date est valide
                  if (isNaN(optinDate.getTime())) {
                    console.warn(`⚠️ Date opt-in invalide pour ${email}: ${dateStr}`);
                    continue;
                  }
                } else {
                  // Pas de date d'opt-in, on skip
                  console.log(`⏭️ Pas de date_optin pour ${email}, skip`);
                  continue;
                }

                const daysSinceOptin = Math.floor((now - optinDate) / (1000 * 60 * 60 * 24));
                const currentDay = daysSinceOptin + 1;

                console.log(
                    `📊 Contact ${email}: source_optin="${sourceOptin}", ` +
                    `date_optin="${properties.date_optin}", currentDay=${currentDay}`,
                );

                // Vérifier si inscrit aux 5 jours
                const has5jours = sourceOptin.includes('5joursofferts');
                const serie5joursDebut = properties.serie_5jours_debut;

                // SCÉNARIO 1 : Opt-in "2 pratiques" → J+1 à J+7 : Proposer "5 jours offerts"
                // On envoie même si on a raté le jour exact (jusqu'à J+7 pour rattraper)
                if (sourceOptin.includes('2pratiques') && !has5jours && currentDay >= 2 && currentDay <= 7) {
                  // Vérifier si la date d'envoi prévue est exclue (jours fériés)
                  // Normaliser optinDate à minuit pour un calcul précis
                  const normalizedOptinDate = new Date(optinDate);
                  normalizedOptinDate.setHours(0, 0, 0, 0);
                  const scheduledDate = getScheduledEmailDate(normalizedOptinDate, currentDay);
                  if (isExcludedDate(scheduledDate)) {
                    console.log(
                        `⏸️ Email marketing 2pratiques→5jours reporté pour ${email} ` +
                        `(date prévue: ${scheduledDate.toISOString().split('T')[0]} est exclue)`,
                    );
                    continue; // Passer au contact suivant, l'email sera envoyé le jour suivant
                  }

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
                    // Vérifier si la date d'envoi prévue est exclue (jours fériés)
                    // Normaliser cinqJoursStart à minuit pour un calcul précis
                    const normalizedCinqJoursStart = new Date(cinqJoursStart);
                    normalizedCinqJoursStart.setHours(0, 0, 0, 0);
                    const scheduledDate = getScheduledEmailDate(normalizedCinqJoursStart, joursApres5jours);
                    if (isExcludedDate(scheduledDate)) {
                      console.log(
                          `⏸️ Email marketing 5jours→21jours reporté pour ${email} ` +
                          `(date prévue: ${scheduledDate.toISOString().split('T')[0]} est exclue, ` +
                          `jour ${joursApres5jours})`,
                      );
                      continue; // Passer au contact suivant, l'email sera envoyé le jour suivant
                    }

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
                    // Vérifier si la date d'envoi prévue est exclue (jours fériés)
                    // Normaliser optinDate à minuit pour un calcul précis
                    const normalizedOptinDate = new Date(optinDate);
                    normalizedOptinDate.setHours(0, 0, 0, 0);
                    const scheduledDate = getScheduledEmailDate(normalizedOptinDate, currentDay);
                    if (isExcludedDate(scheduledDate)) {
                      console.log(
                          `⏸️ Email relance 5jours reporté pour ${email} ` +
                          `(date prévue: ${scheduledDate.toISOString().split('T')[0]} est exclue)`,
                      );
                      // Ne pas envoyer ce jour, sera envoyé le jour suivant grâce au système de rattrapage
                      // Note: currentDay === 4 correspond à J+4, donc sera rattrapé le J+5 si pas exclu
                    } else {
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
                  }

                  // Après la relance, si toujours pas inscrit aux 5 jours : série promotion 21 jours
                  // Jours 8, 15, 22 après l'opt-in initial (après la relance J+3)
                  const joursPromo21joursSans5jours = [8, 15, 22];
                  if (joursPromo21joursSans5jours.includes(currentDay)) {
                    // Vérifier si la date d'envoi prévue est exclue (jours fériés)
                    // Normaliser optinDate à minuit pour un calcul précis
                    const normalizedOptinDate = new Date(optinDate);
                    normalizedOptinDate.setHours(0, 0, 0, 0);
                    const scheduledDate = getScheduledEmailDate(normalizedOptinDate, currentDay);
                    if (isExcludedDate(scheduledDate)) {
                      console.log(
                          `⏸️ Email marketing 2pratiques→21jours reporté pour ${email} ` +
                          `(date prévue: ${scheduledDate.toISOString().split('T')[0]} est exclue, ` +
                          `jour ${currentDay})`,
                      );
                      continue; // Passer au contact suivant, l'email sera envoyé le jour suivant
                    }

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

                // SCÉNARIO 4 : Prospect qui n'a pas acheté le 21 jours → Proposer l'approche complète
                // Pour "2pratiques" : après J+22 (dernière relance 21 jours)
                // Pour "5jours" : après J+17 (dernière relance 21 jours)
                const has21jours = produitsAchetes.includes('21jours');
                const hasComplet = produitsAchetes.includes('complet');
                if (!has21jours && !hasComplet) {
                  // Vérifier aussi dans Firestore si l'utilisateur a acheté le 21 jours
                  let has21joursInFirestore = false;
                  try {
                    const emailLower = email.toLowerCase().trim();
                    const userQuery = await db.collection('users')
                        .where('email', '==', emailLower)
                        .limit(1)
                        .get();

                    if (!userQuery.empty) {
                      const userData = userQuery.docs[0].data();
                      const userProducts = userData.products || [];
                      has21joursInFirestore = userProducts.some((p) => p && p.name === '21jours');
                    }
                  } catch (firestoreError) {
                    console.warn(`⚠️ Error checking Firestore for ${email}:`, firestoreError.message);
                  }

                  if (!has21joursInFirestore) {
                    let shouldProposeComplet = false;
                    let daysAfterLast21joursPromo = 0;

                    // Pour "2pratiques" : après J+22, proposer l'approche complète
                    if (sourceOptin.includes('2pratiques') && !has5jours && currentDay > 22) {
                      daysAfterLast21joursPromo = currentDay - 22;
                      // Proposer l'approche complète à J+25, J+30, J+37
                      // (soit 3, 8, 15 jours après la dernière relance 21 jours)
                      const joursPromoComplet = [25, 30, 37];
                      shouldProposeComplet = joursPromoComplet.includes(currentDay);
                    } else if (has5jours && serie5joursDebut) {
                      // Pour "5jours" : après J+17, proposer l'approche complète
                      const cinqJoursStart = new Date(serie5joursDebut);
                      const daysSince5jours = Math.floor(
                          (now - cinqJoursStart) / (1000 * 60 * 60 * 24));
                      const joursApres5jours = daysSince5jours + 1;

                      if (joursApres5jours > 17) {
                        daysAfterLast21joursPromo = joursApres5jours - 17;
                        // Proposer l'approche complète à J+20, J+25, J+32
                        // (soit 3, 8, 15 jours après la dernière relance 21 jours)
                        const joursPromoComplet = [20, 25, 32];
                        shouldProposeComplet = joursPromoComplet.includes(joursApres5jours);
                      }
                    }

                    if (shouldProposeComplet) {
                      // Utiliser le bon jour selon le type de prospect pour l'ID
                      let dayForId = currentDay;
                      let scheduledDate;
                      if (has5jours && serie5joursDebut) {
                        const cinqJoursStart = new Date(serie5joursDebut);
                        const daysSince5jours = Math.floor((now - cinqJoursStart) / (1000 * 60 * 60 * 24));
                        dayForId = daysSince5jours + 1;
                        // Normaliser cinqJoursStart à minuit pour un calcul précis
                        const normalizedCinqJoursStart = new Date(cinqJoursStart);
                        normalizedCinqJoursStart.setHours(0, 0, 0, 0);
                        scheduledDate = getScheduledEmailDate(normalizedCinqJoursStart, dayForId);
                      } else {
                        // Normaliser optinDate à minuit pour un calcul précis
                        const normalizedOptinDate = new Date(optinDate);
                        normalizedOptinDate.setHours(0, 0, 0, 0);
                        scheduledDate = getScheduledEmailDate(normalizedOptinDate, currentDay);
                      }

                      // Vérifier si la date d'envoi prévue est exclue (jours fériés)
                      if (isExcludedDate(scheduledDate)) {
                        console.log(
                            `⏸️ Email marketing prospect→complet reporté pour ${email} ` +
                            `(date prévue: ${scheduledDate.toISOString().split('T')[0]} est exclue, ` +
                            `jour ${dayForId})`,
                        );
                        continue; // Passer au contact suivant, l'email sera envoyé le jour suivant
                      }

                      const emailSentDocId = `marketing_prospect_to_complet_` +
                          `${email.toLowerCase().trim()}_day_${dayForId}`;
                      const emailSentDoc = await db.collection('contentEmailsSent')
                          .doc(emailSentDocId).get();

                      if (!emailSentDoc.exists) {
                        const baseUrl = 'https://fluance.io';
                        const completUrl = `${baseUrl}/cours-en-ligne/approche-fluance-complete/`;
                        const namePart = firstName ? ` ${firstName}` : '';

                        let emailSubject;
                        let emailHtml;
                        let emailText;

                        // Premier email : présentation de l'approche complète
                        if (daysAfterLast21joursPromo === 3) {
                          emailSubject = 'Et si vous continuiez avec Fluance ?';
                          emailHtml =
                            '<p>Bonjour' + namePart + ',</p>' +
                            '<p>Vous avez peut-être hesite a vous lancer dans le defi ' +
                            '<strong>21 jours pour remettre du mouvement</strong>.</p>' +
                            '<p><strong>Saviez-vous que la sedentarite tue +5 millions ' +
                            'de personnes par an ?</strong> Rester assis 8h par jour ' +
                            'augmente de 147% le risque de maladie cardiovasculaire.</p>' +
                            '<p>Je comprends : il peut etre difficile de s\'engager sur ' +
                            '21 jours d\'un coup.</p>' +
                            '<p>Mais peut-etre seriez-vous interesse(e) par ' +
                            'l\'<strong>approche Fluance complete</strong> ?</p>' +
                            '<p>C\'est une approche plus <strong>douce et progressive</strong> : ' +
                            'une nouvelle mini-serie de pratiques chaque semaine, toujours ' +
                            'courtes (2 a 5 minutes), pour continuer a entretenir votre dos, ' +
                            'vos epaules et votre energie.</p>' +
                            '<p><strong>Fluance ne vous demande pas de forcer votre corps.</strong> ' +
                            'Nous honorons vos tensions, vos resistances. C\'est en donnant ' +
                            'a votre corps la permission de rester tel qu\'il est que le ' +
                            'changement devient possible.</p>' +
                            '<p><strong>Les 14 premiers jours sont offerts</strong> : ' +
                            'vous pouvez tester sans engagement et decider ensuite ' +
                            'si vous souhaitez continuer.</p>' +
                            '<p>Decouvrez cette approche :</p>' +
                            '<p><a href="' + completUrl + '">' +
                            'Decouvrir l\'approche Fluance complete</a></p>';

                          emailText = [
                            `Bonjour${namePart},`,
                            '',
                            'Vous avez peut-etre hesite a vous lancer dans le defi ' +
                              '"21 jours pour remettre du mouvement".',
                            '',
                            'Saviez-vous que la sedentarite tue +5 millions de personnes ' +
                              'par an ? Rester assis 8h par jour augmente de 147% le risque ' +
                              'de maladie cardiovasculaire.',
                            '',
                            'Je comprends : il peut etre difficile de s\'engager sur ' +
                              '21 jours d\'un coup.',
                            '',
                            'Mais peut-etre seriez-vous interesse(e) par ' +
                              'l\'approche Fluance complete ?',
                            '',
                            'C\'est une approche plus douce et progressive : ' +
                              'une nouvelle mini-serie de pratiques chaque semaine, toujours ' +
                              'courtes (2 a 5 minutes), pour continuer a entretenir votre dos, ' +
                              'vos epaules et votre energie.',
                            '',
                            'Fluance ne vous demande pas de forcer votre corps. Nous honorons ' +
                              'vos tensions, vos resistances. C\'est en donnant a votre corps ' +
                              'la permission de rester tel qu\'il est que le changement devient possible.',
                            '',
                            'Les 14 premiers jours sont offerts : vous pouvez tester sans ' +
                              'engagement et decider ensuite si vous souhaitez continuer.',
                            '',
                            'Decouvrez cette approche :',
                            completUrl,
                          ].join('\n');
                        } else if (daysAfterLast21joursPromo === 8) {
                          // Deuxième email : relance
                          emailSubject = 'Vous aimeriez continuer... mais vous hesitez ?';
                          emailHtml =
                            '<p>Bonjour' + namePart + ',</p>' +
                            '<p>Vous avez peut-etre hesite a vous lancer dans le defi ' +
                            '<strong>21 jours pour remettre du mouvement</strong>.</p>' +
                            '<p><strong>L\'activite physique reguliere reduit le risque ' +
                            'd\'Alzheimer de 30 a 40%.</strong> Chez les femmes traitees ' +
                            'd\'un cancer du sein, 3h par semaine diminuent le risque de ' +
                            'recidive de 20 a 50%.</p>' +
                            '<p>Peut-etre que vous hesitez : manque de temps, peur de ne pas tenir, ' +
                            'doute sur l\'utilite sur le long terme...</p>' +
                            '<p>Avec l\'<strong>approche Fluance complete</strong>, ' +
                            'vous recevez chaque semaine une nouvelle mini-serie. ' +
                            'Les seances restent simples, courtes, et pensees ' +
                            'pour s\'integrer a un quotidien charge.</p>' +
                            '<p><strong>L\'approche complete ne vous demande pas d\'etre ' +
                            'plus discipline(e).</strong> Elle vous invite a honorer votre ' +
                            'corps, a votre rythme, sans forcer. C\'est la que la vraie ' +
                            'transformation commence.</p>' +
                            '<p><strong>Les 14 premiers jours sont offerts</strong> : ' +
                            'testez sans engagement et decidez ensuite si vous ' +
                            'souhaitez continuer.</p>' +
                            '<p>Pour voir comment cela peut soutenir votre corps ' +
                            'dans les prochaines semaines :</p>' +
                            '<p><a href="' + completUrl + '">' +
                            'Voir l\'approche Fluance complete</a></p>';

                          emailText = [
                            `Bonjour${namePart},`,
                            '',
                            'Vous avez peut-etre hesite a vous lancer dans le defi ' +
                              '"21 jours pour remettre du mouvement".',
                            '',
                            'L\'activite physique reguliere reduit le risque ' +
                              'd\'Alzheimer de 30 a 40%. Chez les femmes traitees ' +
                              'd\'un cancer du sein, 3h par semaine diminuent le risque ' +
                              'de recidive de 20 a 50%.',
                            '',
                            'Vous hesitez peut-etre : manque de temps, peur de ne pas tenir, ' +
                              'doute sur l\'utilite sur le long terme.',
                            '',
                            'Avec l\'approche Fluance complete, vous recevez ' +
                              'chaque semaine une nouvelle mini-serie. Les ' +
                              'seances restent simples, courtes, et pensees ' +
                              'pour s\'integrer a un quotidien charge.',
                            '',
                            'L\'approche complete ne vous demande pas d\'etre ' +
                              'plus discipline(e). Elle vous invite a honorer votre ' +
                              'corps, a votre rythme, sans forcer. C\'est la que la vraie ' +
                              'transformation commence.',
                            '',
                            'Les 14 premiers jours sont offerts : testez sans ' +
                              'engagement et decidez ensuite si vous souhaitez ' +
                              'continuer.',
                            '',
                            'Pour voir comment cela peut soutenir votre corps ' +
                              'dans les prochaines semaines :',
                            completUrl,
                          ].join('\n');
                        } else {
                          // Troisième email : dernier rappel
                          emailSubject = 'Dernier rappel pour continuer avec l\'approche Fluance complete';
                          emailHtml =
                            '<p>Bonjour' + namePart + ',</p>' +
                            '<p>Il y a quelques jours, je vous ai parle du defi ' +
                            '<strong>21 jours pour remettre du mouvement</strong>.</p>' +
                            '<p><strong>Votre liberte de mouvement est un pilier ' +
                            'de votre sante. Prenez-en soin.</strong></p>' +
                            '<p>Comment se sent votre corps aujourd\'hui ? Et ' +
                            'comment aimeriez-vous qu\'il se sente dans 3 ou ' +
                            '6 mois ?</p>' +
                            '<p>Si vous souhaitez garder un elan, ' +
                            'l\'<strong>approche Fluance complete</strong> peut ' +
                            'devenir votre rituel hebdomadaire : une nouvelle ' +
                            'mini-serie de pratiques chaque semaine, pour ' +
                            'continuer a delier, renforcer et apaiser.</p>' +
                            '<p>Fluance n\'est pas une methode qui vous force a ' +
                            'changer. C\'est un espace ou votre corps peut enfin ' +
                            'se sentir en securite pour lacher prise, semaine ' +
                            'apres semaine.</p>' +
                            '<p><strong>Les 14 premiers jours sont offerts</strong> : ' +
                            'testez sans engagement et decidez ensuite si vous ' +
                            'souhaitez continuer.</p>' +
                            '<p>Ceci est un dernier rappel doux : si c\'est le ' +
                            'bon moment pour vous, vous pouvez rejoindre ' +
                            'l\'approche complete ici :</p>' +
                            '<p><a href="' + completUrl + '">' +
                            'Rejoindre l\'approche Fluance complete</a></p>';

                          emailText = [
                            `Bonjour${namePart},`,
                            '',
                            'Il y a quelques jours, je vous ai parle du defi ' +
                              '"21 jours pour remettre du mouvement".',
                            '',
                            'Votre liberte de mouvement est un pilier de votre ' +
                              'sante. Prenez-en soin.',
                            '',
                            'Comment se sent votre corps aujourd\'hui ? Et ' +
                              'comment aimeriez-vous qu\'il se sente dans 3 ou ' +
                              '6 mois ?',
                            '',
                            'Si vous souhaitez garder un elan, l\'approche ' +
                              'Fluance complete peut devenir votre rituel ' +
                              'hebdomadaire : une nouvelle mini-serie de ' +
                              'pratiques chaque semaine, pour continuer a ' +
                              'delier, renforcer et apaiser.',
                            '',
                            'Fluance n\'est pas une methode qui vous force a ' +
                              'changer. C\'est un espace ou votre corps peut ' +
                              'enfin se sentir en securite pour lacher prise, ' +
                              'semaine apres semaine.',
                            '',
                            'Les 14 premiers jours sont offerts : testez sans ' +
                              'engagement et decidez ensuite si vous souhaitez ' +
                              'continuer.',
                            '',
                            'Ceci est un dernier rappel doux : si c\'est le ' +
                              'bon moment pour vous, vous pouvez rejoindre ' +
                              'l\'approche complete ici :',
                            completUrl,
                          ].join('\n');
                        }

                        await sendMailjetEmail(
                            email,
                            emailSubject,
                            emailHtml,
                            emailText,
                            mailjetApiKey,
                            mailjetApiSecret,
                            'fluance@actu.fluance.io',
                            'Cédric de Fluance',
                        );

                        await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                          email: email,
                          type: 'marketing_prospect_to_complet',
                          day: dayForId,
                          sentAt: admin.firestore.FieldValue.serverTimestamp(),
                        });

                        console.log(`✅ Marketing email sent to ${email} for prospect→complet day ${dayForId}`);
                        marketingEmailsSent++;
                      }
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

        // Email "réseaux sociaux" : 10 jours après le dernier email programmé
        console.log('📧 Starting social networks email (10 days after last scheduled email)');
        let socialEmailsSent = 0;

        try {
          // Traiter les clients (Firestore users)
          const usersSnapshotForSocial = await db.collection('users').get();
          for (const userDoc of usersSnapshotForSocial.docs) {
            const userId = userDoc.id;
            try {
              const userDoc = await db.collection('users').doc(userId).get();
              if (!userDoc.exists) continue;

              const userData = userDoc.data();
              const email = userData.email;
              if (!email) continue;

              const firstName = userData.firstName || userData.firstname || '';

              // Trouver le dernier email envoyé pour ce client
              // Note: On récupère tous les emails et on trie en mémoire pour éviter l'index composite
              const allEmailsQuery = await db.collection('contentEmailsSent')
                  .where('email', '==', email)
                  .get();

              if (allEmailsQuery.empty) continue;

              // Trouver le dernier email (avec sentAt le plus récent)
              let lastEmailSentAt = null;
              for (const doc of allEmailsQuery.docs) {
                const data = doc.data();
                if (data.sentAt) {
                  const sentAtDate = data.sentAt.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
                  if (!lastEmailSentAt || sentAtDate > lastEmailSentAt) {
                    lastEmailSentAt = sentAtDate;
                  }
                }
              }

              if (!lastEmailSentAt) continue;

              // Calculer les jours depuis le dernier email
              const lastEmailDate = lastEmailSentAt;
              const daysSinceLastEmail = Math.floor((now - lastEmailDate) / (1000 * 60 * 60 * 24));

              // Envoyer si 10 jours se sont écoulés
              if (daysSinceLastEmail >= 10) {
                const emailSentDocId = `social_networks_${email.toLowerCase().trim()}`;
                const emailSentDoc = await db.collection('contentEmailsSent')
                    .doc(emailSentDocId).get();

                if (!emailSentDoc.exists) {
                  const namePart = firstName ? ` ${firstName}` : '';
                  const emailSubject = 'Fluance : on se retrouve sur les reseaux sociaux ?';
                  const emailHtml =
                      '<p>Bonjour' + namePart + ',</p>' +
                      '<p>En complement des e-mails de Fluance, je vous invite aussi a ' +
                      'rejoindre le <a href="https://t.me/+TsD5YCuHvLB7Bdft">groupe Telegram</a> ' +
                      'ou le <a href="https://www.facebook.com/groups/fluanceio/">groupe Facebook</a> ' +
                      'pour vous aider a prendre le reflexe de bouger en conscience ' +
                      'regulierement et vous donner de l\'inspiration.</p>' +
                      '<p>Fluance est aussi <a href="https://www.youtube.com/@fluanceio">YouTube</a> ' +
                      'et <a href="https://www.instagram.com/fluanceio/">Instagram</a>.</p>' +
                      '<p>Les liens des autres reseaux sont au pied de ' +
                      '<a href="https://fluance.io/">cette page</a>.</p>' +
                      '<p>Une bonne pratique et a bientot,<br>Cedric</p>';

                  const emailText = [
                    `Bonjour${namePart},`,
                    '',
                    'En complement des e-mails de Fluance, je vous invite aussi a ' +
                      'rejoindre le groupe Telegram ou le groupe Facebook pour vous aider ' +
                      'a prendre le reflexe de bouger en conscience regulierement et vous ' +
                      'donner de l\'inspiration.',
                    '',
                    'Fluance est aussi YouTube et Instagram.',
                    'Les liens des autres reseaux sont au pied de cette page.',
                    '',
                    'Une bonne pratique et a bientot,',
                    'Cedric',
                    '',
                    'Liens:',
                    'Groupe Telegram: https://t.me/+TsD5YCuHvLB7Bdft',
                    'Groupe Facebook: https://www.facebook.com/groups/fluanceio/',
                    'YouTube: https://www.youtube.com/@fluanceio',
                    'Instagram: https://www.instagram.com/fluanceio/',
                    'Site web: https://fluance.io/',
                  ].join('\n');

                  await sendMailjetEmail(
                      email,
                      emailSubject,
                      emailHtml,
                      emailText,
                      mailjetApiKey,
                      mailjetApiSecret,
                      'fluance@actu.fluance.io',
                      'Cédric de Fluance',
                  );

                  await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                    email: email,
                    type: 'social_networks',
                    daysSinceLastEmail: daysSinceLastEmail,
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  console.log(
                      `✅ Social networks email sent to ${email} ` +
                      `(${daysSinceLastEmail} days after last email)`,
                  );
                  socialEmailsSent++;
                }
              }
            } catch (userError) {
              console.error(`❌ Error processing user ${userId} for social networks email:`, userError);
            }
          }

          // Traiter les prospects (Mailjet contacts)
          try {
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
                  const contactDataUrl =
                    `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email.toLowerCase().trim())}`;
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

                  const firstName = properties.firstname || contact.Name || '';
                  const estClient = properties.est_client === 'True' || properties.est_client === true;
                  const produitsAchetes = properties.produits_achetes || '';

                  // Ignorer les clients (déjà traités plus haut)
                  if (estClient || produitsAchetes.includes('21jours') || produitsAchetes.includes('complet')) {
                    continue;
                  }

                  // Trouver le dernier email envoyé pour ce prospect
                  // Note: On récupère tous les emails et on trie en mémoire pour éviter l'index composite
                  const allEmailsQuery = await db.collection('contentEmailsSent')
                      .where('email', '==', email)
                      .get();

                  if (allEmailsQuery.empty) continue;

                  // Trouver le dernier email (avec sentAt le plus récent)
                  let lastEmailSentAt = null;
                  for (const doc of allEmailsQuery.docs) {
                    const data = doc.data();
                    if (data.sentAt) {
                      const sentAtDate = data.sentAt.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
                      if (!lastEmailSentAt || sentAtDate > lastEmailSentAt) {
                        lastEmailSentAt = sentAtDate;
                      }
                    }
                  }

                  if (!lastEmailSentAt) continue;

                  // Calculer les jours depuis le dernier email
                  const lastEmailDate = lastEmailSentAt;
                  const daysSinceLastEmail = Math.floor((now - lastEmailDate) / (1000 * 60 * 60 * 24));

                  // Envoyer si 10 jours se sont écoulés
                  if (daysSinceLastEmail >= 10) {
                    const emailSentDocId = `social_networks_${email.toLowerCase().trim()}`;
                    const emailSentDoc = await db.collection('contentEmailsSent')
                        .doc(emailSentDocId).get();

                    if (!emailSentDoc.exists) {
                      const namePart = firstName ? ` ${firstName}` : '';
                      const emailSubject = 'Fluance : on se retrouve sur les reseaux sociaux ?';
                      const emailHtml =
                          '<p>Bonjour' + namePart + ',</p>' +
                          '<p>En complement des e-mails de Fluance, je vous invite aussi a ' +
                          'rejoindre le <a href="https://t.me/+TsD5YCuHvLB7Bdft">groupe Telegram</a> ' +
                          'ou le <a href="https://www.facebook.com/groups/fluanceio/">groupe Facebook</a> ' +
                          'pour vous aider a prendre le reflexe de bouger en conscience ' +
                          'regulierement et vous donner de l\'inspiration.</p>' +
                          '<p>Fluance est aussi <a href="https://www.youtube.com/@fluanceio">YouTube</a> ' +
                          'et <a href="https://www.instagram.com/fluanceio/">Instagram</a>.</p>' +
                          '<p>Les liens des autres reseaux sont au pied de ' +
                          '<a href="https://fluance.io/">cette page</a>.</p>' +
                          '<p>Une bonne pratique et a bientot,<br>Cedric</p>';

                      const emailText = [
                        `Bonjour${namePart},`,
                        '',
                        'En complement des e-mails de Fluance, je vous invite aussi a ' +
                          'rejoindre le groupe Telegram ou le groupe Facebook pour vous aider ' +
                          'a prendre le reflexe de bouger en conscience regulierement et vous ' +
                          'donner de l\'inspiration.',
                        '',
                        'Fluance est aussi YouTube et Instagram.',
                        'Les liens des autres reseaux sont au pied de cette page.',
                        '',
                        'Une bonne pratique et a bientot,',
                        'Cedric',
                        '',
                        'Liens:',
                        'Groupe Telegram: https://t.me/+TsD5YCuHvLB7Bdft',
                        'Groupe Facebook: https://www.facebook.com/groups/fluanceio/',
                        'YouTube: https://www.youtube.com/@fluanceio',
                        'Instagram: https://www.instagram.com/fluanceio/',
                        'Site web: https://fluance.io/',
                      ].join('\n');

                      await sendMailjetEmail(
                          email,
                          emailSubject,
                          emailHtml,
                          emailText,
                          mailjetApiKey,
                          mailjetApiSecret,
                          'fluance@actu.fluance.io',
                          'Cédric de Fluance',
                      );

                      await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                        email: email,
                        type: 'social_networks',
                        daysSinceLastEmail: daysSinceLastEmail,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                      });

                      console.log(
                          `✅ Social networks email sent to ${email} ` +
                          `(${daysSinceLastEmail} days after last email)`,
                      );
                      socialEmailsSent++;
                    }
                  }
                } catch (contactError) {
                  console.error(`❌ Error processing contact ${email} for social networks email:`, contactError);
                }
              }
            }
          } catch (prospectError) {
            console.error('❌ Error processing prospects for social networks email:', prospectError);
          }
        } catch (socialError) {
          console.error('❌ Error in social networks email section:', socialError);
          // Ne pas faire échouer toute la fonction si cette partie échoue
        }

        console.log(`📧 Email job completed: ${emailsSent} sent (clients), ` +
            `${marketingEmailsSent} sent (marketing), ` +
            `${socialEmailsSent} sent (social networks), ` +
            `${emailsSkipped + marketingEmailsSkipped} skipped, ${errors} errors`);
        return {
          success: true,
          emailsSent,
          marketingEmailsSent,
          socialEmailsSent,
          emailsSkipped,
          marketingEmailsSkipped,
          errors,
        };
      } catch (error) {
        console.error('❌ Error in sendNewContentEmails:', error);
        throw error;
      }
    });

/**
 * Fonction scheduled pour traiter les suspensions d'abonnements en attente
 * S'exécute quotidiennement à 10h (Europe/Paris)
 * Retire l'accès aux utilisateurs après le délai de grâce (3 jours après la dernière tentative)
 */
exports.processPendingSuspensions = onSchedule(
    {
      schedule: '0 10 * * *', // Tous les jours à 10h
      timeZone: 'Europe/Paris',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
      region: 'europe-west1',
    },
    async (_event) => {
      console.log('🔍 Starting scheduled job for pending subscription suspensions');
      const now = admin.firestore.Timestamp.now();
      const mailjetApiKey = process.env.MAILJET_API_KEY;
      const mailjetApiSecret = process.env.MAILJET_API_SECRET;

      if (!mailjetApiKey || !mailjetApiSecret) {
        console.error('❌ Mailjet credentials not configured');
        return;
      }

      try {
        // Récupérer tous les échecs de paiement en attente de suspension
        const pendingSuspensions = await db.collection('paymentFailures')
            .where('status', '==', 'pending_suspension')
            .where('suspendAt', '<=', now)
            .get();

        console.log(`📊 Found ${pendingSuspensions.size} subscriptions to suspend`);

        for (const doc of pendingSuspensions.docs) {
          const failureData = doc.data();
          const email = failureData.email;
          const product = failureData.product;
          const subscriptionId = failureData.subscriptionId;

          try {
            // Retirer l'accès au produit
            await removeProductFromUser(email, product);
            console.log(`✅ Access removed for ${email} (product: ${product})`);

            // Mettre à jour le statut
            await doc.ref.update({
              status: 'suspended',
              suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Récupérer le prénom pour l'email
            let firstName = '';
            try {
              const userQuery = await db.collection('users')
                  .where('email', '==', email)
                  .limit(1)
                  .get();
              if (!userQuery.empty) {
                const userData = userQuery.docs[0].data();
                firstName = userData.name?.split(' ')[0] || '';
              }
            } catch (error) {
              console.warn('Error fetching user data:', error.message);
            }

            // Générer le lien de réactivation
            let reactivateLink = 'https://fluance.io/mon-compte';
            if (subscriptionId && process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
              try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                if (subscription.customer) {
                  const customerPortal = await stripe.billingPortal.sessions.create({
                    customer: subscription.customer,
                    return_url: 'https://fluance.io/mon-compte',
                  });
                  reactivateLink = customerPortal.url;
                }
              } catch (stripeError) {
                console.warn('Error creating reactivation link:', stripeError.message);
              }
            }

            // Envoyer l'email de suspension
            const productName = product === 'complet' ? 'Approche Fluance complète' : product;
            const suspendEmailHtml = loadEmailTemplate('suspension-abonnement', {
              firstName: firstName || 'Bonjour',
              productName: productName,
              reactivateLink: reactivateLink,
            });
            const suspendEmailText =
          `Votre abonnement ${productName} a été suspendu après plusieurs tentatives de paiement échouées.`;

            await sendMailjetEmail(
                email,
                `Votre abonnement Fluance a été suspendu`,
                suspendEmailHtml,
                suspendEmailText,
                mailjetApiKey,
                mailjetApiSecret,
                'support@actu.fluance.io',
                'Cédric de Fluance',
            );

            console.log(`✅ Suspension email sent to ${email}`);
          } catch (error) {
            console.error(`❌ Error processing suspension for ${email}:`, error.message);
          }
        }

        console.log(`✅ Processed ${pendingSuspensions.size} pending suspensions`);
      } catch (error) {
        console.error('❌ Error in processPendingSuspensions:', error);
        throw error;
      }
    });

/**
 * Fonction scheduled pour envoyer des relances aux opt-ins non confirmés
 * S'exécute quotidiennement à 9h (Europe/Paris)
 * Envoie une relance unique 3-4 jours après l'inscription si non confirmée
 */
exports.sendOptInReminders = onSchedule(
    {
      schedule: '0 9 * * *', // Tous les jours à 9h
      timeZone: 'Europe/Paris',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET'],
      region: 'europe-west1',
    },
    async (_event) => {
      console.log('📧 Starting scheduled job for opt-in reminders');
      const now = new Date();
      const mailjetApiKey = process.env.MAILJET_API_KEY;
      const mailjetApiSecret = process.env.MAILJET_API_SECRET;

      if (!mailjetApiKey || !mailjetApiSecret) {
        console.error('❌ Mailjet credentials not configured');
        return;
      }

      try {
        // Récupérer tous les opt-ins non confirmés qui n'ont pas encore reçu de relance
        const unconfirmedQuery = await db.collection('newsletterConfirmations')
            .where('confirmed', '==', false)
            .where('reminderSent', '==', false)
            .get();

        if (unconfirmedQuery.empty) {
          console.log('✅ No unconfirmed opt-ins to remind');
          return;
        }

        console.log(`📋 Found ${unconfirmedQuery.size} unconfirmed opt-ins to check`);

        let remindersSent = 0;
        let remindersSkipped = 0;
        let errors = 0;

        for (const doc of unconfirmedQuery.docs) {
          try {
            const tokenData = doc.data();
            const tokenId = doc.id;

            // Vérifier que le token n'a pas expiré
            if (!tokenData.expiresAt) {
              console.warn(`⚠️ Token ${tokenId} has no expiration date, skipping`);
              remindersSkipped++;
              continue;
            }

            const expiresAt = tokenData.expiresAt.toDate();
            if (now > expiresAt) {
              console.log(`⏰ Token ${tokenId} has expired, skipping reminder`);
              remindersSkipped++;
              continue;
            }

            // Vérifier la date de création
            if (!tokenData.createdAt) {
              console.warn(`⚠️ Token ${tokenData.email} has no creation date, skipping`);
              remindersSkipped++;
              continue;
            }

            const createdAt = tokenData.createdAt.toDate();
            const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

            // Envoyer la relance entre 3 et 4 jours après l'inscription
            if (daysSinceCreation < 3 || daysSinceCreation > 4) {
              // Trop tôt ou trop tard, on attendra le prochain jour
              continue;
            }

            const email = tokenData.email;
            const name = tokenData.name || '';
            const sourceOptin = tokenData.sourceOptin || '2pratiques';

            // Déterminer le contenu de l'opt-in pour le message
            let optinContent = 'vos contenus Fluance offerts';
            let redirectParam = '2pratiques';
            if (sourceOptin === '5joursofferts') {
              optinContent = 'vos 5 pratiques Fluance offertes';
              redirectParam = '5joursofferts';
            } else if (sourceOptin === '2pratiques') {
              optinContent = 'vos 2 pratiques Fluance offertes';
            }

            // Construire l'URL de confirmation
            const confirmationUrl =
              `https://fluance.io/confirm?email=${encodeURIComponent(email)}` +
              `&token=${tokenId}&redirect=${redirectParam}`;

            // Formater la date d'expiration pour l'email
            const expirationDateStr = expiresAt.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            // Utiliser l'écriture inclusive pour éviter les suppositions de genre
            const inscriptionText = 'inscrit·e';

            // Charger et envoyer l'email de relance
            const emailSubject =
              `Un dernier clic pour recevoir vos contenus${name ? ' ' + name : ''}`;
            const emailHtml = loadEmailTemplate('relance-confirmation-optin', {
              firstName: name || '',
              inscriptionText: inscriptionText,
              optinContent: optinContent,
              confirmationUrl: confirmationUrl,
              expirationDate: expirationDateStr,
            });
            const emailText = `Bonjour${name ? ' ' + name : ''},\n\n` +
              `Il y a quelques jours, vous vous êtes ${inscriptionText} ` +
              `pour recevoir ${optinContent} de Fluance.\n\n` +
              `Pour finaliser votre inscription et recevoir vos contenus, ` +
              `il vous suffit de confirmer votre adresse email en cliquant sur ce lien :\n\n` +
              `${confirmationUrl}\n\n` +
              `Ce lien est valide jusqu'au ${expirationDateStr}.\n\n` +
              `Si vous n'avez pas demandé cette inscription, vous pouvez ignorer cet email. ` +
              `Vous ne recevrez plus de relances.`;

            await sendMailjetEmail(
                email,
                emailSubject,
                emailHtml,
                emailText,
                mailjetApiKey,
                mailjetApiSecret,
                'support@actu.fluance.io',
                'Cédric de Fluance',
            );

            // Marquer la relance comme envoyée
            await db.collection('newsletterConfirmations').doc(tokenId).update({
              reminderSent: true,
              reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            remindersSent++;
            console.log(
                `✅ Reminder sent to ${email} (${sourceOptin}, ${daysSinceCreation} days after signup)`,
            );
          } catch (error) {
            errors++;
            console.error(`❌ Error processing reminder for token ${doc.id}:`, error);
          }
        }

        console.log(`📊 Reminders summary: ${remindersSent} sent, ${remindersSkipped} skipped, ${errors} errors`);
        return {
          success: true,
          remindersSent,
          remindersSkipped,
          errors,
        };
      } catch (error) {
        console.error('❌ Error in sendOptInReminders:', error);
        throw error;
      }
    });

