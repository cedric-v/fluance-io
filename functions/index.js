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
const {getFirestore, Timestamp, FieldValue} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
// fetch est natif dans Node.js 18+ (pas besoin de node-fetch)

// Définir les options globales (région par défaut)
setGlobalOptions({
  region: 'europe-west1',
});

admin.initializeApp();

const db = getFirestore();
const auth = getAuth();

// Import du service d'alertes admin
// Import du service d'alertes admin
const {sendAdminAlert} = require('./services/adminAlerts');
const blogLeadHub = require('./blogLeadHub');

// Import services nouveaux
const {bexioService} = require('./services/bexioService');
const {ensureStripePrice} = require('./services/stripePrices');

// ⚠️ TRANSITION MOLLIE : services utilisés uniquement pour traiter les
// abonnements Mollie encore actifs (plus aucun nouveau paiement Mollie).
// À supprimer avec la section TRANSITION en fin de fichier.
const {mollieService} = require('./services/mollieService');
const {PubSub} = require('@google-cloud/pubsub');
const {onMessagePublished} = require('firebase-functions/v2/pubsub');

// PubSub client for publishing messages from HTTP function
const pubSubClient = new PubSub();

// Hostnames autorisés pour la vérification Turnstile (bonnes pratiques 2026 :
// lier le token au domaine de rendu du widget, en plus de la clé secrète).
const ALLOWED_TURNSTILE_HOSTNAMES = ['fluance.io', 'www.fluance.io', 'localhost', '127.0.0.1'];

// Origines web autorisées pour les endpoints de réservation (CORS).
// Limiter les origines empêche les sites tiers de lire les réponses API
// depuis le navigateur de la victime (exfiltration cross-site).
const ALLOWED_WEB_ORIGINS = [
  'https://fluance.io',
  'https://www.fluance.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

// ============================================================
// Helpers sécurité communs (auth, rate limiting, IP)
// ============================================================

/**
 * Vérifie le token Firebase Auth présent dans le header Authorization
 * (format « Bearer <token> »). Retourne le token décodé ou null.
 * @param {Object} req - Requête HTTP
 * @returns {Promise<Object|null>} token décodé ({uid, email, ...}) ou null
 */
async function verifyIdToken(req) {
  const authHeader = req.headers &&
    (req.headers.authorization || req.headers.Authorization);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    return await getAuth().verifyIdToken(authHeader.slice(7).trim());
  } catch (error) {
    console.warn('Invalid Firebase ID token:', error.message);
    return null;
  }
}

/**
 * Retourne l'IP du client (header x-forwarded-for ou socket).
 * @param {Object} req - Requête HTTP (ou rawRequest pour les onCall)
 * @returns {string}
 */
function getClientIp(req) {
  const headers = (req && req.headers) || (req && req.rawRequest && req.rawRequest.headers) || {};
  const fwd = headers['x-forwarded-for'] || headers['x-real-ip'];
  if (fwd) {
    return String(fwd).split(',')[0].trim();
  }
  const ip = (req && req.ip) || (req && req.socket && req.socket.remoteAddress);
  return ip || 'unknown';
}

/**
 * Retourne true si l'IP est privée/locale (développement local uniquement).
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIp(ip) {
  if (!ip) return false;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || ip === '::ffff:127.0.0.1') {
    return true;
  }
  return /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^169\.254\./.test(ip);
}

/**
 * Rate limiter simple basé sur Firestore (fenêtre glissante par clé).
 * Ne bloque jamais en cas d'erreur interne (fail-open pour l'utilisateur).
 * @param {string} key - Clé de limitation (ip, email, ...)
 * @param {string} bucket - Nom du bucket (préfixe du document)
 * @param {number} max - Nombre maximal de requêtes autorisées
 * @param {number} windowSeconds - Fenêtre en secondes
 * @returns {Promise<{limited: boolean, retryAfterSeconds?: number}>}
 */
async function checkRateLimit(key, bucket, max, windowSeconds) {
  if (!key) {
    return {limited: false};
  }
  const ref = db.collection('rateLimits').doc(`${bucket}_${String(key).slice(0, 128)}`);
  const now = Date.now();
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      if (data.windowStart && now - data.windowStart < windowSeconds * 1000) {
        if ((data.count || 0) >= max) {
          const retryAfterSeconds = Math.max(1,
              Math.ceil((windowSeconds * 1000 - (now - data.windowStart)) / 1000));
          return {limited: true, retryAfterSeconds};
        }
        tx.set(ref, {count: (data.count || 0) + 1, windowStart: data.windowStart});
        return {limited: false};
      }
      tx.set(ref, {count: 1, windowStart: now});
      return {limited: false};
    });
  } catch (error) {
    // Ne jamais bloquer un utilisateur légitime à cause du limiter lui-même
    console.warn('Rate limiter error:', error.message);
    return {limited: false};
  }
}

exports.captureLead = blogLeadHub.captureLead;
exports.sendContactEmail = blogLeadHub.sendContactEmail;

// Price ID du produit cross-sell "SOS dos & cervicales"
const STRIPE_PRICE_ID_SOS_DOS_CERVICALES = 'price_1SeWdF2Esx6PN6y1XlbpIObG';

// Prix des produits (en centimes CHF) pour vérification
const PRODUCT_PRICES = {
  '21jours': 1900, // 19 CHF
  'sos-dos-cervicales': 1700, // 17 CHF
  'complet': 9700, // 97 CHF
};

// ============================================================
// STRIPE — Identifiants et configuration (passerelle unique)
// ============================================================

// Nombre maximal d'échéances pour les paiements échelonnés Stripe (abonnements à durée limitée)
function getStripeMaxPayments(product, variant) {
  if (product === 'focus-sos' && variant === '3x') return 3;
  if (product === 'site-vitrine' && variant === '5x') return 5;
  return null;
}

/**
 * Crée les écritures comptables Bexio pour un paiement Stripe encaissé.
 * Logique identique à celle utilisée avec Mollie (Manual Entries), mais avec
 * le compte caisse Stripe (1023 par défaut) et les frais réels Stripe
 * (issus du balance_transaction).
 * @param {Object} opts
 * @param {string} opts.reference - ID de référence (payment_intent / charge / invoice)
 * @param {number} opts.amountGross - Montant brut en CHF (unités)
 * @param {number} opts.amountFee - Frais Stripe en CHF (unités)
 * @param {string} opts.date - Date YYYY-MM-DD
 * @param {string} opts.description - Description de la vente
 * @param {string|null} opts.countryCode - Code pays (CH par défaut)
 * @returns {Promise<void>}
 */
async function recordStripeBexioEntries({reference, amountGross, amountFee, date, description, countryCode = 'CH'}) {
  const isSwiss = countryCode === 'CH' || countryCode === 'LI';

  // Comptes (Stripe Logic du projet de référence)
  // Caisse Stripe : 1023
  const debitAccount = process.env.BEXIO_ACCOUNT_STRIPE ? parseInt(process.env.BEXIO_ACCOUNT_STRIPE) : 1023;
  const creditAccountCH =
    process.env.BEXIO_ACCOUNT_SALES_CH ? parseInt(process.env.BEXIO_ACCOUNT_SALES_CH) : 3400;
  const creditAccountIntl =
    process.env.BEXIO_ACCOUNT_SALES_INTL ? parseInt(process.env.BEXIO_ACCOUNT_SALES_INTL) : 3410;
  const creditAccount = isSwiss ? creditAccountCH : creditAccountIntl;

  // TVA : 14 (CH 8.1%) / 4 (Intl 0% CSE) — configurable
  const taxId = isSwiss ?
    (process.env.BEXIO_TAX_ID_CH ? parseInt(process.env.BEXIO_TAX_ID_CH) : 14) :
    (process.env.BEXIO_TAX_ID_INTL ? parseInt(process.env.BEXIO_TAX_ID_INTL) : 4);

  const entryDate = date || new Date().toISOString().split('T')[0];

  // 1. Écriture de vente (montant brut)
  await bexioService.createManualEntry({
    date: entryDate,
    debit_account_id: debitAccount,
    credit_account_id: creditAccount,
    amount: amountGross,
    text: `Stripe Payment ${reference} - ${description}`,
    reference,
    tax_id: taxId,
  });

  // 2. Écriture de frais (commission Stripe) si détectée
  if (amountFee > 0) {
    const feeAccount = process.env.BEXIO_ACCOUNT_FEES ? parseInt(process.env.BEXIO_ACCOUNT_FEES) : 6941;
    await bexioService.createManualEntry({
      date: entryDate,
      debit_account_id: feeAccount,
      credit_account_id: debitAccount, // On déduit du compte Caisse Stripe
      amount: amountFee,
      text: `Commission Stripe ${reference} - ${description}`,
      reference,
      tax_id: 3, // Sans influence TVA (0%)
      tax_account_id: feeAccount,
    });
  }

  console.log(`📊 Bexio entries created for Stripe payment ${reference} (gross ${amountGross}, fee ${amountFee})`);
}

/**
 * Crée les écritures Bexio pour un PaymentIntent Stripe (charge + balance_transaction).
 * Non bloquant : les erreurs sont loggées sans faire échouer le webhook.
 * @param {Object} stripe - Instance Stripe
 * @param {string} paymentIntentId - ID du Payment Intent
 * @param {string} reference - Référence de l'écriture (généralement l'ID du PI)
 * @param {string} description - Description de la vente
 * @param {string} [date] - Date YYYY-MM-DD
 * @returns {Promise<void>}
 */
async function recordBexioForPaymentIntent(stripe, paymentIntentId, reference, description, date) {
  if (!paymentIntentId || !stripe) return;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['charges.data.balance_transaction'],
    });
    const charge = pi?.charges?.data?.[0] || null;
    const {fee, country} = getStripeFeeAndCountry(charge);
    const amountGross = pi.amount ? pi.amount / 100 : 0;
    if (amountGross > 0) {
      await recordStripeBexioEntries({
        reference: reference || paymentIntentId,
        amountGross,
        amountFee: fee,
        date: date || (pi.created ? new Date(pi.created * 1000).toISOString().split('T')[0] : undefined),
        description,
        countryCode: country,
      });
    }
  } catch (error) {
    console.error('❌ Error in Stripe Bexio integration (payment intent):', error.message);
  }
}

/**
 * Calcule la commission Stripe réelle à partir d'une charge (balance_transaction).
 * @param {Object} charge - Objet charge Stripe (expand balance_transaction)
 * @returns {{fee: number, country: string}}
 */
function getStripeFeeAndCountry(charge) {
  const balanceTx = charge?.balance_transaction;
  let fee = 0;
  if (balanceTx && typeof balanceTx === 'object' && balanceTx.fee) {
    // fee en centimes dans la devise du compte (CHF) — convertir en unités
    fee = balanceTx.fee / 100;
  }

  // Pays de la carte pour la TVA
  let country = 'CH';
  const cardCountry = charge?.payment_method_details?.card?.country;
  if (cardCountry) country = cardCountry;
  else if (charge?.billing_details?.address?.country) country = charge.billing_details.address.country;

  return {fee, country};
}

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
    'inscrit_presentiel',
    'nombre_cours_presentiel',
    'premier_cours_presentiel',
    'dernier_cours_presentiel',
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
/**
 * Convertit une valeur (Timestamp Firestore, Date, string ISO, nombre, epoch ms)
 * en objet Date JavaScript.
 * Retourne null si aucune conversion n'est possible.
 *
 * Utile notamment avant Timestamp.fromDate(), qui exige une
 * vraie Date (et plante avec « date.getTime is not a function » si on lui passe
 * un Timestamp Firestore).
 *
 * @param {*} value - Valeur à convertir
 * @returns {Date|null}
 */
function toJsDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Parse une date de série « 5 jours » stockée en propriété Mailjet.
 * Gère les formats ISO (2026-04-09T15:39:00Z), « YYYY-MM-DD HH:MM AM/PM »
 * et l'ancien format « JJ/MM/AAAA ».
 *
 * @param {*} value - Valeur à parser
 * @returns {Date|null}
 */
function parseSerieDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (str.includes('/')) {
    const [day, month, year] = str.split('/').map((p) => parseInt(p, 10));
    if (day && month && year) {
      const d = new Date(year, month - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  return toJsDate(str);
}

/**
 * Calcule les propriétés Mailjet à appliquer pour la série « 5 jours ».
 *
 * La série peut être suivie plusieurs fois, mais jamais en chevauchement :
 * - pas de série existante → on démarre une nouvelle série (debut = maintenant) ;
 * - série existante encore en cours (jours 1 à 5) → on ne réinitialise pas,
 *   la série courante se termine naturellement ;
 * - série existante terminée (au-delà du jour 5) → on relance une nouvelle série
 *   (debut = maintenant), ce qui permet au contact de refaire le parcours et à
 *   la séquence marketing 5jours→21jours de repartir depuis le début.
 *
 * @param {Object} currentProperties - Propriétés Mailjet actuelles du contact
 * @param {string} dateStr - Date ISO de départ de la (nouvelle) série
 * @returns {Object} Propriétés à appliquer (éventuellement vide)
 */
function computeSerie5joursProperties(currentProperties, dateStr) {
  const existingDebut = currentProperties['serie_5jours_debut'];
  if (!existingDebut) {
    // Pas de série existante → nouvelle série.
    return {
      'serie_5jours_debut': dateStr,
      'serie_5jours_status': 'started',
    };
  }

  // Série existante : vérifier si elle est terminée (jours 1 à 5 = en cours).
  const debutDate = parseSerieDate(existingDebut);
  if (debutDate) {
    const daysSince = Math.floor((Date.now() - debutDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 5) {
      // Série terminée → nouvelle série (le parcours peut être suivi à nouveau).
      return {
        'serie_5jours_debut': dateStr,
        'serie_5jours_status': 'started',
      };
    }
  }

  // Série en cours → ne pas réinitialiser, garantir simplement le statut démarré.
  const currentStatus = currentProperties['serie_5jours_status'];
  if (!currentStatus || currentStatus === 'cancelled') {
    return {'serie_5jours_status': 'started'};
  }
  return {};
}

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

// Email admin pour les notifications (configuré via secret Firebase ADMIN_EMAIL)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'support@fluance.io';

/**
 * Envoie une notification admin pour une nouvelle réservation confirmée
 */
async function sendBookingNotificationAdmin(booking, course, apiKey, apiSecret) {
  try {
    // Vérifier que les paramètres nécessaires sont disponibles
    if (!apiKey || !apiSecret) {
      console.warn('⚠️ Mailjet API keys not available, skipping booking admin notification');
      return;
    }

    if (!ADMIN_EMAIL) {
      console.warn('⚠️ ADMIN_EMAIL not configured, skipping booking admin notification');
      return;
    }

    const dateStr = new Date().toLocaleString('fr-FR', {
      timeZone: 'Europe/Zurich',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const amountStr = booking.amount ? `${(booking.amount / 100).toFixed(2)} CHF` : 'Gratuit';

    // Déterminer le label de paiement selon le contexte
    let paymentMethodLabel;
    if (booking.paymentMethod === 'pass' || booking.pricingOption === 'flow_pass' || booking.pricingOption === 'semester_pass') {
      if (booking.notes && (booking.notes.includes('Flow Pass') || booking.notes.includes('Pass Semestriel'))) {
        paymentMethodLabel = booking.notes;
      } else {
        paymentMethodLabel = booking.pricingOption === 'semester_pass' ? 'Pass Semestriel' : 'Flow Pass';
      }
    } else if (booking.amount === 0 || booking.pricingOption === 'trial' || booking.paymentMethod === 'Cours d\'essai gratuit') {
      paymentMethodLabel = 'Cours d\'essai gratuit';
    } else {
      const paymentMethodLabels = {
        'card': 'Carte / TWINT',
        'cash': 'Espèces sur place',
      };
      paymentMethodLabel = paymentMethodLabels[booking.paymentMethod] || booking.paymentMethod;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7A1F3D; border-bottom: 2px solid #E6B84A; padding-bottom: 10px;">
          Nouvelle réservation - Cours hebdomadaire
        </h2>
        <div style="background-color: #fdfaf6; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 5px 0;"><strong>Nom :</strong> ${booking.firstName} ${booking.lastName}</p>
          <p style="margin: 5px 0;">
            <strong>Email :</strong>
            <a href="mailto:${booking.email}" style="color: #7A1F3D;">${booking.email}</a>
          </p>
          ${booking.phone ? `<p style="margin: 5px 0;"><strong>Téléphone :</strong> ${booking.phone}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Cours :</strong> ${course?.title || booking.courseName}</p>
          <p style="margin: 5px 0;"><strong>Date :</strong> ${booking.courseDate}</p>
          <p style="margin: 5px 0;"><strong>Heure :</strong> ${booking.courseTime}</p>
          <p style="margin: 5px 0;"><strong>Lieu :</strong> ${booking.courseLocation || course?.location || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Formule :</strong> ${booking.pricingOption || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Montant :</strong> ${amountStr}</p>
          <p style="margin: 5px 0;"><strong>Mode de paiement :</strong> ${paymentMethodLabel}</p>
          ${booking.partnerCode ?
        `<p style="margin: 5px 0;"><strong>Code partenaire :</strong> ${booking.partnerCode
        } (remise: ${booking.discountPercent}%)</p>` :
        ''}
          <p style="margin: 5px 0;"><strong>Date de réservation :</strong> ${dateStr}</p>
          <p style="margin: 5px 0;"><strong>Booking ID :</strong> ${booking.bookingId}</p>
        </div>
      </div>
    `;
    const textContent = `Nouvelle réservation - Cours hebdomadaire\n\n` +
      `Nom: ${booking.firstName} ${booking.lastName}\n` +
      `Email: ${booking.email}\n` +
      `${booking.phone ? `Téléphone: ${booking.phone}\n` : ''}` +
      `Cours: ${course?.title || booking.courseName}\n` +
      `Date: ${booking.courseDate}\n` +
      `Heure: ${booking.courseTime}\n` +
      `Lieu: ${booking.courseLocation || course?.location || 'N/A'}\n` +
      `Formule: ${booking.pricingOption || 'N/A'}\n` +
      `Montant: ${amountStr}\n` +
      `Mode de paiement: ${paymentMethodLabel}\n` +
      `${booking.partnerCode ? `Code partenaire: ${booking.partnerCode} (remise: ${booking.discountPercent}%)\n` : ''}` +
      `Date de réservation: ${dateStr}\n` +
      `Booking ID: ${booking.bookingId}`;

    await sendMailjetEmail(
        ADMIN_EMAIL,
        `Nouvelle réservation : ${booking.firstName} ${booking.lastName} - ${booking.courseDate
        }`,
        htmlContent,
        textContent,
        apiKey,
        apiSecret,
        'support@actu.fluance.io',
        'Fluance - Notification Réservation',
    );
    console.log(`✅ Booking notification sent to ${ADMIN_EMAIL} for ${booking.email}`);
  } catch (error) {
    console.error('Error sending booking notification:', error.message);
    console.error('Error stack:', error.stack);
  }
}

/**
 * Envoie ou reprogramme l'email transactionnel de confirmation d'une réservation.
 * Ce message reste indépendant du double opt-in marketing.
 */
async function sendBookingConfirmationEmail(db, bookingId, booking = null, course = null) {
  let resolvedBooking = booking;
  if (!resolvedBooking) {
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw new Error(`Booking ${bookingId} not found`);
    }
    resolvedBooking = bookingDoc.data();
  }

  if (!course && resolvedBooking.courseId) {
    const courseDoc = await db.collection('courses').doc(resolvedBooking.courseId).get();
    course = courseDoc.exists ? courseDoc.data() : null;
  }

  const emailResult = await bookingService.queueBookingConfirmationEmail(
      db,
      resolvedBooking,
      course,
  );

  if (!emailResult.success) {
    throw new Error(emailResult.error || 'BOOKING_CONFIRMATION_EMAIL_FAILED');
  }

  return emailResult;
}

/**
 * Envoie une notification admin pour un achat de pass (Flow Pass ou Pass Semestriel)
 */
async function sendPassPurchaseNotificationAdmin(passData, apiKey, apiSecret) {
  try {
    // Vérifier que les paramètres nécessaires sont disponibles
    if (!apiKey || !apiSecret) {
      console.warn('⚠️ Mailjet API keys not available, skipping pass purchase admin notification');
      return;
    }

    if (!ADMIN_EMAIL) {
      console.warn('⚠️ ADMIN_EMAIL not configured, skipping pass purchase admin notification');
      return;
    }

    const dateStr = new Date().toLocaleString('fr-FR', {
      timeZone: 'Europe/Zurich',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const passTypeLabel = passData.passType === 'flow_pass' ? 'Flow Pass' : 'Pass Semestriel';
    const sessionsLabel = passData.sessionsTotal === -1 ? 'Illimité' : `${passData.sessionsTotal} séances`;
    const amountStr = passData.price ? `${(passData.price / 100).toFixed(2)} CHF` : 'N/A';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7A1F3D; border-bottom: 2px solid #E6B84A; padding-bottom: 10px;">
          Nouvel achat de pass
        </h2>
        <div style="background-color: #fdfaf6; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 5px 0;"><strong>Nom :</strong> ${passData.firstName || ''} ${passData.lastName || ''}</p>
          <p style="margin: 5px 0;">
            <strong>Email :</strong>
            <a href="mailto:${passData.email}" style="color: #7A1F3D;">${passData.email}</a>
          </p>
          ${passData.phone ? `<p style="margin: 5px 0;"><strong>Téléphone :</strong> ${passData.phone}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Type de pass :</strong> ${passTypeLabel}</p>
          <p style="margin: 5px 0;"><strong>Séances :</strong> ${sessionsLabel}</p>
          <p style="margin: 5px 0;"><strong>Montant :</strong> ${amountStr}</p>
          <p style="margin: 5px 0;"><strong>Date d'achat :</strong> ${dateStr}</p>
          <p style="margin: 5px 0;"><strong>Pass ID :</strong> ${passData.passId || 'N/A'}</p>
          ${passData.stripePaymentIntentId ? `<p style="margin: 5px 0;"><strong>Stripe Payment Intent :</strong> ${passData.stripePaymentIntentId}</p>` : ''}
          ${passData.stripeSubscriptionId ? `<p style="margin: 5px 0;"><strong>Stripe Subscription :</strong> ${passData.stripeSubscriptionId}</p>` : ''}
        </div>
      </div>
    `;
    const textContent = `Nouvel achat de pass\n\n` +
      `Nom: ${passData.firstName || ''} ${passData.lastName || ''}\n` +
      `Email: ${passData.email}\n` +
      `${passData.phone ? `Téléphone: ${passData.phone}\n` : ''}` +
      `Type de pass: ${passTypeLabel}\n` +
      `Séances: ${sessionsLabel}\n` +
      `Montant: ${amountStr}\n` +
      `Date d'achat: ${dateStr}\n` +
      `Pass ID: ${passData.passId || 'N/A'}`;

    await sendMailjetEmail(
        ADMIN_EMAIL,
        `Nouvel achat de pass : ${passTypeLabel} - ${passData.email}`,
        htmlContent,
        textContent,
        apiKey,
        apiSecret,
        'support@actu.fluance.io',
        'Fluance - Notification Achat Pass',
    );
    console.log(`✅ Pass purchase notification sent to ${ADMIN_EMAIL} for ${passData.email}`);
  } catch (error) {
    console.error('Error sending pass purchase notification:', error.message);
    console.error('Error stack:', error.stack);
  }
}

/**
 * Envoie une notification admin pour un achat de produit en ligne (21 jours, complet)
 */
async function sendOnlineProductPurchaseNotificationAdmin(purchaseData, apiKey, apiSecret) {
  try {
    // Vérifier que les paramètres nécessaires sont disponibles
    if (!apiKey || !apiSecret) {
      console.warn('⚠️ Mailjet API keys not available, skipping online purchase admin notification');
      return;
    }

    if (!ADMIN_EMAIL) {
      console.warn('⚠️ ADMIN_EMAIL not configured, skipping online purchase admin notification');
      return;
    }

    const dateStr = new Date().toLocaleString('fr-FR', {
      timeZone: 'Europe/Zurich',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const productNames = {
      '21jours': '21 jours pour un Dos en Forme',
      'complet': 'Programme Complet (Online)',
      'sos-dos-cervicales': 'SOS Dos & Cervicales',
    };

    const productLabel = productNames[purchaseData.product] || purchaseData.product;
    const amountStr = purchaseData.amount ? `${purchaseData.amount.toFixed(2)} CHF` : 'N/A';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7A1F3D; border-bottom: 2px solid #E6B84A; padding-bottom: 10px;">
          Nouvel achat de produit en ligne
        </h2>
        <div style="background-color: #fdfaf6; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 5px 0;"><strong>Nom :</strong> ${purchaseData.customerName || 'N/A'}</p>
          <p style="margin: 5px 0;">
            <strong>Email :</strong>
            <a href="mailto:${purchaseData.email}" style="color: #7A1F3D;">${purchaseData.email}</a>
          </p>
          ${purchaseData.phone ? `<p style="margin: 5px 0;"><strong>Téléphone :</strong> ${purchaseData.phone}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Produit :</strong> ${productLabel}</p>
          <p style="margin: 5px 0;"><strong>Montant :</strong> ${amountStr}</p>
          <p style="margin: 5px 0;"><strong>Date d'achat :</strong> ${dateStr}</p>
          ${purchaseData.stripeSessionId ? `<p style="margin: 5px 0;"><strong>Stripe Session :</strong> ${purchaseData.stripeSessionId}</p>` : ''}
        </div>
      </div>
    `;

    const textContent = `Nouvel achat de produit en ligne\n\n` +
      `Nom: ${purchaseData.customerName || 'N/A'}\n` +
      `Email: ${purchaseData.email}\n` +
      `Produit: ${productLabel}\n` +
      `Montant: ${amountStr}\n` +
      `Date d'achat: ${dateStr}`;

    await sendMailjetEmail(
        ADMIN_EMAIL,
        `Nouvel achat en ligne : ${productLabel} - ${purchaseData.email}`,
        htmlContent,
        textContent,
        apiKey,
        apiSecret,
        'support@actu.fluance.io',
        'Fluance - Notification Achat Online',
    );
    console.log(`✅ Online purchase notification sent to ${ADMIN_EMAIL} for ${purchaseData.email}`);
  } catch (error) {
    console.error('Error sending online purchase notification:', error.message);
  }
}

/**
 * Envoie une notification admin pour une inscription à la liste d'attente
 */
async function sendWaitlistNotificationAdmin(waitlistData, course, apiKey, apiSecret) {
  try {
    // Vérifier que les paramètres nécessaires sont disponibles
    if (!apiKey || !apiSecret) {
      console.warn('⚠️ Mailjet API keys not available, skipping waitlist admin notification');
      return;
    }

    if (!ADMIN_EMAIL) {
      console.warn('⚠️ ADMIN_EMAIL not configured, skipping waitlist admin notification');
      return;
    }

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
        <h2 style="color: #7A1F3D; border-bottom: 2px solid #E6B84A; padding-bottom: 10px;">
          Nouvelle inscription - Liste d'attente
        </h2>
        <div style="background-color: #fdfaf6; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 5px 0;"><strong>Nom :</strong> ${waitlistData.firstName} ${waitlistData.lastName}</p>
          <p style="margin: 5px 0;">
            <strong>Email :</strong>
            <a href="mailto:${waitlistData.email}" style="color: #7A1F3D;">${waitlistData.email}</a>
          </p>
          ${waitlistData.phone ? `<p style="margin: 5px 0;"><strong>Téléphone :</strong> ${waitlistData.phone}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Cours :</strong> ${course?.title || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Date :</strong> ${course?.date || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Heure :</strong> ${course?.time || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Position :</strong> ${waitlistData.position || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Date d'inscription :</strong> ${dateStr}</p>
        </div>
      </div>
    `;
    const textContent = `Nouvelle inscription - Liste d'attente\n\n` +
      `Nom: ${waitlistData.firstName} ${waitlistData.lastName}\n` +
      `Email: ${waitlistData.email}\n` +
      `${waitlistData.phone ? `Téléphone: ${waitlistData.phone}\n` : ''}` +
      `Cours: ${course?.title || 'N/A'}\n` +
      `Date: ${course?.date || 'N/A'}\n` +
      `Heure: ${course?.time || 'N/A'}\n` +
      `Position: ${waitlistData.position || 'N/A'}\n` +
      `Date d'inscription: ${dateStr}`;

    await sendMailjetEmail(
        ADMIN_EMAIL,
        `Nouvelle inscription liste d'attente : ${waitlistData.firstName} ${waitlistData.lastName}`,
        htmlContent,
        textContent,
        apiKey,
        apiSecret,
        'support@actu.fluance.io',
        'Fluance - Notification Liste d\'attente',
    );
    console.log(`✅ Waitlist notification sent to ${ADMIN_EMAIL} for ${waitlistData.email}`);
  } catch (error) {
    console.error('Error sending waitlist notification:', error.message);
    console.error('Error stack:', error.stack);
  }
}

/**
 * Envoie un email d'abandon de panier
 */
async function sendCartAbandonmentEmail(
    email,
    firstName,
    courseName,
    courseDate,
    courseTime,
    amount,
    clientSecret,
    bookingId,
    reason,
    apiKey,
    apiSecret,
) {
  try {
    const amountStr = amount ? `${(amount / 100).toFixed(2)} CHF` : 'Gratuit';
    const bookingUrl = clientSecret ?
      `https://fluance.io/presentiel/reserver/?booking=${bookingId}&retry=true` :
      `https://fluance.io/presentiel/reserver/`;

    const reasonText = reason === 'payment_failed' ?
      'Votre paiement n\'a pas pu être traité' :
      'Vous avez commencé une réservation mais ne l\'avez pas finalisée';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7A1F3D; border-bottom: 2px solid #E6B84A; padding-bottom: 10px;">
          Finalisez votre réservation
        </h2>
        <div style="background-color: #fdfaf6; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 10px 0;">Bonjour${firstName ? ' ' + firstName : ''},</p>
          <p style="margin: 10px 0;">
            ${reasonText}. Nous vous invitons à finaliser votre réservation
            pour le cours suivant :
          </p>
          <div style="background-color: white; padding: 15px; border-radius: 5px;
                      margin: 15px 0; border-left: 4px solid #E6B84A;">
            <p style="margin: 5px 0;"><strong>Cours :</strong> ${courseName}</p>
            <p style="margin: 5px 0;"><strong>Date :</strong> ${courseDate}</p>
            <p style="margin: 5px 0;"><strong>Heure :</strong> ${courseTime}</p>
            <p style="margin: 5px 0;"><strong>Montant :</strong> ${amountStr}</p>
          </div>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${bookingUrl}"
               style="display: inline-block; background-color: #E6B84A; color: #7A1F3D;
                      padding: 12px 30px; text-decoration: none; border-radius: 25px;
                      font-weight: bold; font-size: 16px;">
              Finaliser ma réservation
            </a>
          </div>
          <p style="margin: 10px 0; font-size: 14px; color: #666;">Ce lien est valable pendant 48 heures.</p>
        </div>
      </div>
    `;

    const textContent = `Finalisez votre réservation\n\n` +
      `Bonjour${firstName ? ' ' + firstName : ''},\n\n` +
      `${reasonText}. Nous vous invitons à finaliser votre réservation ` +
      `pour le cours suivant :\n\n` +
      `Cours: ${courseName}\n` +
      `Date: ${courseDate}\n` +
      `Heure: ${courseTime}\n` +
      `Montant: ${amountStr}\n\n` +
      `Finaliser ma réservation : ${bookingUrl}\n\n` +
      `Ce lien est valable pendant 48 heures.`;

    await sendMailjetEmail(
        email,
      reason === 'payment_failed' ?
        'Votre paiement n\'a pas pu être traité - Finalisez votre réservation' :
        'Finalisez votre réservation Fluance',
      htmlContent,
      textContent,
      apiKey,
      apiSecret,
      'support@actu.fluance.io',
      'Fluance',
    );
    console.log(`✅ Cart abandonment email sent to ${email} (reason: ${reason})`);
  } catch (error) {
    console.error('Error sending cart abandonment email:', error.message);
  }
}

/**
 * Envoie un email de relance panier abandonné pour les produits en ligne (21 jours).
 * Relance 1 : ~2h après la création de la session checkout.
 * Relance 2 : ~20h après (avant l'expiration Stripe à ~24h).
 *
 * @param {string} email - Email du client
 * @param {string} firstName - Prénom du client
 * @param {string} product - Produit concerné (ex: '21jours')
 * @param {number} reminderNumber - Numéro de la relance (1 ou 2)
 * @param {string} apiKey - Clé API Mailjet
 * @param {string} apiSecret - Secret API Mailjet
 */
async function sendOnlineCartAbandonmentEmail(
    email,
    firstName,
    product,
    reminderNumber,
    apiKey,
    apiSecret,
) {
  try {
    if (!apiKey || !apiSecret) {
      console.warn('⚠️ Mailjet API keys not available, skipping online cart abandonment email');
      return;
    }

    // URL de reprise : page produit (la session Stripe expire ~24h, on ne peut
    // donc pas y renvoyer directement après ce délai).
    const productUrl = 'https://fluance.io/cours-en-ligne/21-jours-mouvement/';

    const subjects = {
      1: 'Vous étiez à 2 minutes de démarrer votre défi 21 jours ?',
      2: 'On garde une place pour vous ? (21 jours pour remettre du mouvement)',
    };
    const subject = subjects[reminderNumber] || subjects[1];

    const emailHtml = loadEmailTemplate('abandon-cart-21jours', {
      firstName: firstName || '',
      reminderNumber: String(reminderNumber || 1),
      ctaUrl: productUrl,
    });

    const textContent = `Bonjour${firstName ? ' ' + firstName : ''},\n\n` +
      `Vous aviez commencé la commande du défi 21 jours pour remettre du mouvement ` +
      `(2 à 5 minutes par jour, depuis chez vous).\n\n` +
      `Si c'est toujours le bon moment pour vous, vous pouvez reprendre ` +
      `votre commande ici : ${productUrl}\n\n` +
      `À très vite,\nCédric - Fluance`;

    await sendMailjetEmail(
        email,
        subject,
        emailHtml,
        textContent,
        apiKey,
        apiSecret,
        'fluance@actu.fluance.io',
        'Cédric de Fluance',
    );
    console.log(`✅ Online cart abandonment email (${reminderNumber}) sent to ${email} for ${product}`);
  } catch (error) {
    console.error('Error sending online cart abandonment email:', error.message);
    throw error;
  }
}

/**
 * Envoie une notification admin pour une inscription à la liste d'attente des stages
 */
async function sendStagesWaitlistNotificationAdmin(email, name, region, locale, apiKey, apiSecret) {
  try {
    // Vérifier que les paramètres nécessaires sont disponibles
    if (!apiKey || !apiSecret) {
      console.warn('⚠️ Mailjet API keys not available, skipping stages waitlist admin notification');
      return;
    }

    if (!ADMIN_EMAIL) {
      console.warn('⚠️ ADMIN_EMAIL not configured, skipping stages waitlist admin notification');
      return;
    }

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
        <h2 style="color: #7A1F3D; border-bottom: 2px solid #E6B84A; padding-bottom: 10px;">
          Nouvelle inscription - Liste d'attente Stages
        </h2>
        <div style="background-color: #fdfaf6; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 5px 0;"><strong>Nom :</strong> ${name || 'N/A'}</p>
          <p style="margin: 5px 0;">
            <strong>Email :</strong>
            <a href="mailto:${email}" style="color: #7A1F3D;">${email}</a>
          </p>
          ${region ? `<p style="margin: 5px 0;"><strong>Région :</strong> ${region}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Langue :</strong> ${locale === 'en' ? 'Anglais' : 'Français'}</p>
          <p style="margin: 5px 0;"><strong>Date d'inscription :</strong> ${dateStr}</p>
        </div>
      </div>
    `;
    const textContent = `Nouvelle inscription - Liste d'attente Stages\n\n` +
      `Nom: ${name || 'N/A'}\n` +
      `Email: ${email}\n` +
      `${region ? `Région: ${region}\n` : ''}` +
      `Langue: ${locale === 'en' ? 'Anglais' : 'Français'}\n` +
      `Date d'inscription: ${dateStr}`;

    await sendMailjetEmail(
        ADMIN_EMAIL,
        `Nouvelle inscription liste d'attente stages : ${name || email}`,
        htmlContent,
        textContent,
        apiKey,
        apiSecret,
        'support@actu.fluance.io',
        'Fluance - Notification Liste d\'attente Stages',
    );
    console.log(`✅ Stages waitlist notification sent to ${ADMIN_EMAIL} for ${email}`);
  } catch (error) {
    console.error('Error sending stages waitlist notification:', error.message);
    console.error('Error stack:', error.stack);
  }
}

/**
 * Envoie une notification admin pour chaque nouvel opt-in
 */
async function sendOptInNotification(email, name, sourceOptin, apiKey, apiSecret) {
  try {
    // Vérifier que les paramètres nécessaires sont disponibles
    if (!apiKey || !apiSecret) {
      console.warn('⚠️ Mailjet API keys not available, skipping opt-in admin notification');
      return;
    }

    if (!ADMIN_EMAIL) {
      console.warn('⚠️ ADMIN_EMAIL not configured, skipping opt-in admin notification');
      return;
    }

    let sourceLabel;
    if (sourceOptin === '2pratiques') {
      sourceLabel = '2 pratiques offertes';
    } else if (sourceOptin === '5joursofferts') {
      sourceLabel = '5 jours offerts';
    } else {
      sourceLabel = sourceOptin || 'Opt-in';
    }
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
        ADMIN_EMAIL,
        subject,
        htmlContent,
        textContent,
        apiKey,
        apiSecret,
        'support@actu.fluance.io',
        'Fluance - Notification Opt-in',
    );
    console.log(`✅ Opt-in notification sent to ${ADMIN_EMAIL} for ${email} (${sourceLabel})`);
  } catch (error) {
    // Ne pas faire échouer l'opt-in si la notification échoue
    console.error('Error sending opt-in notification:', error.message);
    console.error('Error stack:', error.stack);
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
 * Email d'activation de secours (HTML minimal) utilisé si un template
 * est indisponible. Garantit qu'un client payant reçoit TOUJOURS son
 * lien de création de compte.
 */
function buildFallbackActivationEmail(registrationUrl, productLabel, expirationDays) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #7A1F3D;">Créez votre compte Fluance</h2>
      <p>Bonjour,</p>
      <p>Merci pour votre achat (${productLabel}). Pour accéder à votre espace et à votre
        contenu, créez votre compte en cliquant sur le lien ci-dessous :</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${registrationUrl}" style="background-color: #7A1F3D; color: #ffffff;
        padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Créer mon compte
        </a>
      </p>
      <p>Ce lien est valable ${expirationDays} jours.</p>
      <p>Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br/>
        <a href="${registrationUrl}">${registrationUrl}</a>
      </p>
      <p>À très vite,<br/>L'équipe Fluance</p>
    </div>
  `;
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
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: expirationDate,
    used: false,
  });

  // Générer le lien de création de compte
  const baseUrl = 'https://fluance.io';
  const registrationUrl = `${baseUrl}/creer-compte?token=${token}`;

  // Contenu de l'email
  const emailSubject = 'Créez votre compte Fluance';
  let emailHtml;
  try {
    emailHtml = loadEmailTemplate('creation-compte', {
      product: product,
      registrationUrl: registrationUrl,
      expirationDays: expirationDays.toString(),
    });
  } catch (templateError) {
    // ⚠️ Fallback : ne JAMAIS bloquer l'email d'activation d'un client payant
    // si le template est manquant. On loggue et on envoie un HTML minimal.
    console.error(
        `❌ Template 'creation-compte' indisponible, utilisation du fallback: ${templateError.message}`,
    );
    emailHtml = buildFallbackActivationEmail(registrationUrl, product, expirationDays);
  }

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
 * Crée un token pour plusieurs produits dans Firestore et envoie UN SEUL email
 * Optimisation pour les achats avec cross-sell: un seul token, un seul email, tous les produits accessibles
 * @param {string} email - Email du client
 * @param {Array<string>} products - Tableau des noms de produits
 * @param {number} expirationDays - Nombre de jours avant expiration (défaut: 30)
 * @param {string} mailjetApiKey - Clé API Mailjet (depuis les secrets)
 * @param {string} mailjetApiSecret - Secret API Mailjet (depuis les secrets)
 * @param {number} totalAmount - Montant total de l'achat en CHF
 * @param {string} customerName - Nom du client (optionnel)
 * @param {string} customerPhone - Téléphone du client (optionnel)
 * @param {string} customerAddress - Adresse du client (optionnel)
 * @param {string} langue - Langue de l'email ('fr' ou 'en')
 */
async function createTokenForMultipleProductsAndSendEmail(
    email,
    products,
    expirationDays = 30,
    mailjetApiKey,
    mailjetApiSecret,
    totalAmount = null,
    customerName = null,
    customerPhone = null,
    customerAddress = null,
    langue = 'fr',
) {
  const token = generateUniqueToken();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);

  // Stocker le token dans Firestore avec le format 'products' (array)
  await db.collection('registrationTokens').doc(token).set({
    email: email.toLowerCase().trim(),
    products: products, // Tableau de produits
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: expirationDate,
    used: false,
  });

  // Générer le lien de création de compte
  const baseUrl = 'https://fluance.io';
  const registrationUrl = `${baseUrl}/creer-compte?token=${token}`;

  // Créer une liste formatée des produits pour l'email
  const productNames = {
    '21jours': '21 jours pour un Dos en Forme',
    'sos-dos-cervicales': 'SOS Dos & Cervicales',
    'complet': 'Programme Complet',
  };

  const productList = products.map((p) => productNames[p] || p).join(' + ');

  // Contenu de l'email
  const emailSubject = 'Créez votre compte Fluance';
  let emailHtml;
  try {
    emailHtml = loadEmailTemplate('creation-compte-multiple', {
      productList: productList,
      registrationUrl: registrationUrl,
      expirationDays: expirationDays.toString(),
    });
  } catch (templateError) {
    // ⚠️ Fallback : ne JAMAIS bloquer l'email d'activation d'un client payant
    // si le template est manquant. On loggue et on envoie un HTML minimal.
    console.error(
        `❌ Template 'creation-compte-multiple' indisponible, utilisation du fallback: ${templateError.message}`,
    );
    emailHtml = buildFallbackActivationEmail(registrationUrl, productList, expirationDays);
  }

  // Envoyer l'email
  await sendMailjetEmail(email, emailSubject, emailHtml, null, mailjetApiKey, mailjetApiSecret);

  // Mettre à jour les contact properties MailJet pour les achats
  if (totalAmount !== null && totalAmount !== undefined) {
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
      const dateStr = now.toISOString();

      const currentProducts = currentProperties.produits_achetes || '';
      const productsList = currentProducts ? currentProducts.split(',').map((p) => p.trim()).filter((p) => p) : [];

      // Ajouter tous les nouveaux produits qui ne sont pas déjà dans la liste
      products.forEach((product) => {
        if (!productsList.includes(product)) {
          productsList.push(product);
        }
      });

      const currentValeur = parseFloat(currentProperties.valeur_client || '0') || 0;
      const currentNombreAchats = parseInt(currentProperties.nombre_achats || '0') || 0;

      const isFirstPurchase = !currentProperties.date_premier_achat;

      // Valider et normaliser la langue
      const langueNormalisee = (langue === 'en' || langue === 'EN') ? 'en' : 'fr';

      const updatedProperties = {
        statut: 'client',
        produits_achetes: productsList.join(','),
        date_dernier_achat: dateStr,
        valeur_client: (currentValeur + totalAmount).toFixed(2),
        nombre_achats: currentNombreAchats + 1,
        est_client: 'True',
        langue: langueNormalisee,
      };

      // Ajouter les coordonnées complémentaires si disponibles
      if (customerName) {
        const firstName = customerName.split(' ')[0];
        const lastName = customerName.split(' ').slice(1).join(' ');
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
      failureData.lastFailureAt = FieldValue.serverTimestamp();
      failureData.failureReasons = failureData.failureReasons || [];
      failureData.failureReasons.push({
        invoiceId: invoiceId,
        reason: invoice.last_payment_error?.message || 'Unknown error',
        amount: amount,
        currency: currency,
        failedAt: FieldValue.serverTimestamp(),
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
        firstFailureAt: FieldValue.serverTimestamp(),
        lastFailureAt: FieldValue.serverTimestamp(),
        isFirstPayment: isFirstPayment,
        failureReasons: [{
          invoiceId: invoiceId,
          reason: invoice.last_payment_error?.message || 'Unknown error',
          amount: amount,
          currency: currency,
          failedAt: FieldValue.serverTimestamp(),
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
        paypalRequestLink: `mailto:${ADMIN_EMAIL}?subject=Demande%20lien%20PayPal&` +
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
        paypalRequestLink: `mailto:${ADMIN_EMAIL}?subject=Demande%20lien%20PayPal&` +
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
        sentAt: FieldValue.serverTimestamp(),
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
        suspendAt: Timestamp.fromDate(suspendAt),
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
      secrets: [
        'MAILJET_API_KEY',
        'MAILJET_API_SECRET',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_SECRET_KEY',
        'BEXIO_API_TOKEN',
        'BEXIO_ACCOUNT_FEES',
      ],
    },
    async (req, res) => {
    // Vérifier la signature Stripe
      const sig = req.headers['stripe-signature'];

      // Vérification de signature STRIPE : obligatoire en production.
      // ⚠️ Le secret STRIPE_WEBHOOK_SECRET est déclaré dans les secrets de la
      // fonction : s'il est absent, c'est que l'environnement n'est pas prêt
      // → on refuse (400) plutôt que d'accepter des événements non vérifiés.
      let event;
      if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('Webhook signature or STRIPE_WEBHOOK_SECRET missing');
        return res.status(400).send('Webhook Error: missing signature or secret');
      }

      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
        event = stripe.webhooks.constructEvent(
            req.rawBody || JSON.stringify(req.body),
            sig,
            process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Gérer les événements de paiement échoué (réservations de cours)
      if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata?.bookingId;

        // Uniquement pour Fluance (system: firebase)
        if (paymentIntent.metadata?.system !== 'firebase') {
          return res.status(200).json({received: true, ignored: true, reason: 'not_fluance_system'});
        }

        if (bookingId && bookingService) {
          console.log(`❌ Payment failed for booking ${bookingId}`);
          try {
            const bookingDoc = await db.collection('bookings').doc(bookingId).get();
            if (bookingDoc.exists) {
              const booking = bookingDoc.data();
              await db.collection('bookings').doc(bookingId).update({
                status: 'payment_failed',
                paymentError: paymentIntent.last_payment_error?.message || 'Payment failed',
                paymentFailedAt: new Date(),
                updatedAt: new Date(),
                // Marquer pour relance abandon de panier (sera envoyé par la fonction scheduled)
                cartAbandonmentEmailSent: false,
              });

              // Envoyer immédiatement un email d'abandon de panier pour paiement échoué
              try {
                const courseDoc = await db.collection('courses').doc(booking.courseId).get();
                const course = courseDoc.exists ? courseDoc.data() : null;

                if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                  await sendCartAbandonmentEmail(
                      booking.email,
                      booking.firstName || '',
                      booking.courseName || course?.title || 'Cours Fluance',
                      booking.courseDate || course?.date || '',
                      booking.courseTime || course?.time || '',
                      booking.amount || 0,
                      booking.stripeClientSecret || null,
                      booking.bookingId,
                      'payment_failed',
                      process.env.MAILJET_API_KEY,
                      process.env.MAILJET_API_SECRET,
                  );

                  await db.collection('bookings').doc(bookingId).update({
                    cartAbandonmentEmailSent: true,
                    cartAbandonmentEmailSentAt: new Date(),
                  });
                }
              } catch (emailError) {
                console.error('Error sending cart abandonment email:', emailError);
              // Ne pas bloquer le processus
              }
            }
            return res.status(200).json({received: true, bookingUpdated: true});
          } catch (error) {
            console.error('Error updating booking status:', error);
          }
        }
      }

      // Session de checkout expirée (non payée sous ~24h) : clôturer le suivi
      // panier abandonné pour ne plus relancer un lien mort.
      if (event.type === 'checkout.session.expired') {
        const expiredSession = event.data.object;
        try {
          const abandonDoc = await db.collection('abandonedCheckouts')
              .doc(expiredSession.id).get();
          if (abandonDoc.exists) {
            await abandonDoc.ref.update({
              status: 'expired',
              expiredAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`🛒 Abandoned checkout marked expired: ${expiredSession.id}`);
          }
        } catch (abandonError) {
          console.error('❌ Error marking abandoned checkout expired:', abandonError.message);
        }
        return res.status(200).json({received: true, handled: 'checkout.session.expired'});
      }

      // Gérer les événements de paiement réussi
      if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
        const session = event.data.object;

        // ============================================================
        // AMÉLIORATION : Ignorer payment_intent.succeeded pour les produits en ligne
        // ============================================================
        // Pour les produits en ligne (system=firebase), on traite UNIQUEMENT checkout.session.completed
        // car cet événement a directement accès aux line_items sans avoir besoin de faire un appel API supplémentaire.
        // Cela évite les problèmes de timing où payment_intent.succeeded arrive avant que la session soit finalisée.
        if (event.type === 'payment_intent.succeeded') {
          const system = session.metadata?.system;

          // Si c'est un produit en ligne (system=firebase), on attend checkout.session.completed
          if (system === 'firebase') {
            console.log(
                `⏭️  Ignoring payment_intent.succeeded for Firebase system ` +
            `(email: ${session.receipt_email || 'N/A'})`,
            );
            console.log(
                '   Waiting for checkout.session.completed which has ' +
            'direct access to line_items',
            );
            return res.status(200).json({
              received: true,
              ignored: true,
              reason: 'waiting_for_checkout_session',
              system: 'firebase',
            });
          }
        }

        // ============================================================
        // GESTION DES RÉSERVATIONS DE COURS ET PASS
        // ============================================================
        // Vérifier si c'est une réservation de cours ou un achat de pass
        // On filtre strictement par system === 'firebase' pour éviter les collisions avec d'autres apps Stripe
        if (session.metadata?.system === 'firebase' && (session.metadata?.type === 'course_booking' || session.metadata?.passType)) {
          if (bookingService || passService) {
            const paymentIntent = session;
            const bookingId = paymentIntent.metadata?.bookingId;
            const passType = paymentIntent.metadata?.passType;
            const customerEmail = paymentIntent.metadata?.email ||
            paymentIntent.receipt_email ||
            session.customer_details?.email;

            // Cas 1: Réservation de cours simple (à l'unité)
            if (bookingId && paymentIntent.metadata?.type === 'course_booking' && bookingService) {
              console.log(`✅ Payment succeeded for booking ${bookingId}`);
              try {
                const result = await bookingService.confirmBookingPayment(
                    db,
                    bookingId,
                    paymentIntent.id || session.id,
                );
                console.log('Confirmation result:', result);

                // Comptabilité Bexio pour le paiement de la réservation
                try {
                  if (process.env.STRIPE_SECRET_KEY) {
                    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                    await recordBexioForPaymentIntent(
                        stripe,
                        paymentIntent.id || session.id,
                        paymentIntent.id || session.id,
                        `Booking ${bookingId} (${paymentIntent.metadata?.pricingOption || 'single'})`,
                    );
                  }
                } catch (bexioError) {
                  console.error('❌ Error in Stripe Bexio integration (booking):', bexioError.message);
                }

                // Envoyer notification admin pour réservation à l'unité
                try {
                  const bookingDoc = await db.collection('bookings').doc(bookingId).get();
                  if (bookingDoc.exists) {
                    const booking = bookingDoc.data();
                    const courseDoc = await db.collection('courses').doc(booking.courseId).get();
                    const course = courseDoc.exists ? courseDoc.data() : null;

                    if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                      await sendBookingNotificationAdmin(
                          booking,
                          course,
                          process.env.MAILJET_API_KEY,
                          process.env.MAILJET_API_SECRET,
                      );
                    }
                  }
                } catch (notifError) {
                  console.error('Error sending admin notification for single course booking:', notifError);
                // Ne pas bloquer le processus
                }

                // Ne retourner que s'il n'y a pas aussi un achat de pass à traiter
                if (!passType) {
                  return res.status(200).json({received: true, bookingConfirmed: true});
                }
              } catch (error) {
                console.error('Error confirming booking:', error);
              }
            }

            // Cas 2: Achat d'un Flow Pass ou Pass Semestriel
            if (passType && customerEmail && passService) {
              console.log(`✅ ${passType} purchased for ${customerEmail}`);
              try {
                const pass = await passService.createUserPass(db, customerEmail, passType, {
                  stripePaymentIntentId: paymentIntent.id || session.id,
                  firstName: paymentIntent.metadata?.firstName || '',
                  lastName: paymentIntent.metadata?.lastName || '',
                  phone: paymentIntent.metadata?.phone || '',
                });
                console.log(`✅ Pass created: ${pass.passId}`);

                // Si un courseId est présent dans les métadonnées, créer automatiquement la réservation
                const courseId = paymentIntent.metadata?.courseId || session.metadata?.courseId;
                if (courseId && bookingService) {
                  console.log(`📅 Course ID found in metadata: ${courseId} - Creating automatic booking with pass`);
                  try {
                  // Récupérer les infos du cours
                    const courseDoc = await db.collection('courses').get ? await db.collection('courses').doc(courseId).get() : null;
                    if (!courseDoc || !courseDoc.exists) {
                      console.warn(`⚠️ Course ${courseId} not found, skipping automatic booking`);
                    } else {
                      const course = courseDoc.data();

                      // Vérifier si l'utilisateur n'a pas déjà réservé ce cours
                      const existingBookingSnapshot = await db.collection('bookings')
                          .where('courseId', '==', courseId)
                          .where('email', '==', customerEmail.toLowerCase().trim())
                          .where('status', 'in', ['confirmed', 'pending', 'pending_cash'])
                          .limit(1)
                          .get();

                      let targetBookingId = null;
                      let isNewBooking = true;

                      if (!existingBookingSnapshot.empty) {
                        const existingBooking = existingBookingSnapshot.docs[0];
                        targetBookingId = existingBooking.id;

                        // Si la réservation existe déjà mais n'est pas liée à un pass, on va la mettre à jour
                        if (!existingBooking.data().passId) {
                          console.log(
                              `⚠️ User already has a booking ${targetBookingId} for ` +
                          `course ${courseId} - Linking pass to it`,
                          );
                          isNewBooking = false;
                        } else {
                          console.log(
                              `⚠️ User already has a booking ${targetBookingId} ` +
                          `ALREADY LINKED to a pass - skipping`,
                          );
                          targetBookingId = null; // Skip everything
                        }
                      } else {
                        targetBookingId = db.collection('bookings').doc().id;
                      }

                      if (targetBookingId) {
                      // Utiliser une séance du pass (sauf si illimité)
                        let sessionResult = null;
                        if (passType !== 'semester_pass' || pass.sessionsRemaining !== -1) {
                          sessionResult = await passService.usePassSession(db, pass.passId, courseId);
                        }

                        const bookingData = {
                          updatedAt: new Date(),
                          paymentMethod: 'pass',
                          pricingOption: passType,
                          passId: pass.passId,
                          notes: passType === 'semester_pass' ?
                          'Pass Semestriel' :
                          `Flow Pass (séance ${pass.sessionsTotal - (sessionResult?.sessionsRemaining || 0)
                          }/${pass.sessionsTotal})`,
                        };

                        if (isNewBooking) {
                        // Créer la réservation avec le pass
                          Object.assign(bookingData, {
                            bookingId: targetBookingId,
                            courseId: courseId,
                            courseName: course.title || '',
                            courseDate: course.date || '',
                            courseTime: course.time || '',
                            courseLocation: course.location || '',
                            email: customerEmail.toLowerCase().trim(),
                            firstName: paymentIntent.metadata?.firstName || '',
                            lastName: paymentIntent.metadata?.lastName || '',
                            phone: paymentIntent.metadata?.phone || '',
                            amount: 0,
                            currency: 'CHF',
                            status: 'confirmed',
                            createdAt: new Date(),
                            paidAt: new Date(),
                          });
                          await db.collection('bookings').doc(targetBookingId).set(bookingData);

                          // Mettre à jour le compteur de participants seulement si c'est une nouvelle réservation
                          const courseRef = db.collection('courses').doc(courseId);
                          const currentCourse = await courseRef.get();
                          const currentParticipantCount = currentCourse.data()?.participantCount || 0;
                          await courseRef.update({
                            participantCount: currentParticipantCount + 1,
                          });
                          console.log(
                              `✅ Automatic booking created: ${targetBookingId} for ` +
                          `course ${courseId} using pass ${pass.passId}`,
                          );
                        } else {
                        // Mettre à jour la réservation existante
                          await db.collection('bookings').doc(targetBookingId).update(bookingData);
                          console.log(`✅ Existing booking ${targetBookingId} linked to pass ${pass.passId}`);
                        }

                        // Envoyer email de confirmation de réservation
                        try {
                          const cancellationTokenResult = await bookingService.createCancellationToken(
                              db,
                              bookingId,
                              30,
                          );
                          const cancellationUrl = cancellationTokenResult.success ?
                          cancellationTokenResult.cancellationUrl :
                          null;

                          await db.collection('mail').add({
                            to: customerEmail,
                            template: {
                              name: 'booking-confirmation',
                              data: {
                                firstName: paymentIntent.metadata?.firstName || '',
                                courseName: course.title || '',
                                courseDate: course.date || '',
                                courseTime: course.time || '',
                                location: course.location || '',
                                bookingId: bookingId,
                                cancellationUrl: cancellationUrl,
                              },
                            },
                          });
                          console.log(`📧 Booking confirmation email sent to ${customerEmail}`);
                        } catch (bookingEmailError) {
                          console.error('Error sending booking confirmation email:', bookingEmailError);
                        }

                        // Envoyer notification admin pour la réservation
                        try {
                          if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                            await sendBookingNotificationAdmin(
                                bookingData,
                                course,
                                process.env.MAILJET_API_KEY,
                                process.env.MAILJET_API_SECRET,
                            );
                          }
                        } catch (notifError) {
                          console.error('Error sending booking admin notification:', notifError);
                        }

                        // Ajouter au Google Sheet
                        try {
                          const sheetId = process.env.GOOGLE_SHEET_ID;
                          if (!sheetId) {
                            console.warn('⚠️ GOOGLE_SHEET_ID not configured, skipping sheet update');
                          } else if (!googleService) {
                            console.warn('⚠️ GoogleService not available, skipping sheet update');
                          } else {
                            console.log(
                                `📊 Attempting to add booking to sheet: ${customerEmail} for ${course.title}`,
                            );
                            await googleService.appendUserToSheet(
                                sheetId,
                                courseId,
                                {
                                  firstName: paymentIntent.metadata?.firstName || '',
                                  lastName: paymentIntent.metadata?.lastName || '',
                                  email: customerEmail,
                                  phone: paymentIntent.metadata?.phone || '',
                                  ipAddress: '',
                                },
                                {
                                  courseName: course.title || '',
                                  courseDate: course.date || '',
                                  courseTime: course.time || '',
                                  location: course.location || '',
                                  paymentMethod: passType === 'semester_pass' ?
                                'Pass Semestriel' :
                                'Flow Pass',
                                  paymentStatus: 'Pass utilisé',
                                  amount: '0 CHF',
                                  status: 'Confirmé',
                                  bookingId: bookingId,
                                  notes: bookingData.notes,
                                  passType: passType === 'semester_pass' ?
                                'Pass Semestriel' :
                                'Flow Pass',
                                  sessionsRemaining: sessionResult?.sessionsRemaining !== undefined ?
                                `${sessionResult.sessionsRemaining}/${pass.sessionsTotal}` :
                                (passType === 'semester_pass' ? 'Illimité' : ''),
                                  paidAt: new Date(),
                                  source: 'web',
                                  isCancelled: false,
                                  isWaitlisted: false,
                                },
                            );
                            console.log(
                                `✅ Successfully added booking to sheet: ${customerEmail}`,
                            );
                          }
                        } catch (sheetError) {
                          console.error('❌ Error updating sheet:', sheetError.message);
                        // Ne pas bloquer le processus si l'ajout au sheet échoue
                        }
                      }
                    }
                  } catch (bookingError) {
                    console.error('Error creating automatic booking with pass:', bookingError);
                  // Ne pas faire échouer le processus si la réservation automatique échoue
                  }
                }

                // Envoyer email de confirmation du pass au client
                try {
                  const passConfig = passService.PASS_CONFIG[passType];
                  if (passConfig) {
                    await db.collection('mail').add({
                      to: customerEmail,
                      template: {
                        name: 'pass-purchase-confirmation',
                        data: {
                          firstName: paymentIntent.metadata?.firstName || '',
                          passType: passType === 'flow_pass' ? 'Flow Pass' : 'Pass Semestriel',
                          sessions: passConfig.sessions,
                          validityMonths: Math.floor(passConfig.validityDays / 30),
                          isUnlimited: passConfig.sessions === -1,
                          isRecurring: passConfig.isRecurring || false,
                          passId: pass.passId,
                        },
                      },
                    });
                    console.log(`📧 Pass purchase confirmation email sent to ${customerEmail}`);
                  } else {
                    console.warn(`⚠️ PASS_CONFIG not found for ${passType}`);
                  }
                } catch (emailError) {
                  console.error('Error sending pass purchase confirmation email:', emailError);
                }

                // Envoyer notification admin
                try {
                  if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                    await sendPassPurchaseNotificationAdmin(
                        {
                          ...pass,
                          passId: pass.passId,
                        },
                        process.env.MAILJET_API_KEY,
                        process.env.MAILJET_API_SECRET,
                    );
                  }
                } catch (notifError) {
                  console.error('Error sending pass purchase admin notification:', notifError);
                }

                return res.status(200).json({received: true, passCreated: true});
              } catch (error) {
                console.error('Error creating pass:', error);
              }
            }
          }
        }

        // ============================================================
        // GESTION DES PRODUITS EN LIGNE (21jours, complet, etc.)
        // ============================================================
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
        const VALID_ONLINE_PRODUCTS = ['21jours', 'complet', 'rdv-clarte', 'focus-sos', 'site-vitrine', 'diagnostic-digital'];
        if (!product || !VALID_ONLINE_PRODUCTS.includes(product)) {
          console.error(`Paiement Stripe ignoré - produit invalide: ${product}`);
          return res.status(200).json({received: true, ignored: true});
        }

        // Extraire la langue depuis les métadonnées (défaut: 'fr')
        const langue = session.metadata?.locale || session.metadata?.langue || 'fr';

        // 🛒 Panier abandonné : le paiement est finalisé, on clôture le suivi.
        try {
          const abandonDoc = await db.collection('abandonedCheckouts')
              .doc(session.id).get();
          if (abandonDoc.exists) {
            await abandonDoc.ref.update({
              status: 'completed',
              completedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`🛒 Abandoned checkout marked completed: ${session.id}`);
          }
        } catch (abandonError) {
          console.error('❌ Error marking abandoned checkout completed:', abandonError.message);
        }

        // ============================================================
        // COMPTABILITÉ BEXIO (Stripe) — écritures vente + commission
        // Non bloquant : un échec comptable ne doit pas empêcher le reste
        // ============================================================
        try {
          if (process.env.STRIPE_SECRET_KEY && session.payment_intent) {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            await recordBexioForPaymentIntent(
                stripe,
                typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id,
                session.payment_intent || session.id,
                `${product}${session.metadata?.variant ? ' ' + session.metadata.variant : ''}`,
                new Date().toISOString().split('T')[0],
            );
          }
        } catch (bexioError) {
          console.error('❌ Error in Stripe Bexio integration:', bexioError.message);
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

        // Focus SOS, Site Vitrine & Diagnostic Digital (cedricv.com) : pas d'espace membre, pas de token.
        // On loggue l'achat (audit + notification admin) pour le suivi.
        if (product === 'focus-sos' || product === 'site-vitrine' || product === 'diagnostic-digital') {
          try {
            const auditAmount = session.amount_total ? session.amount_total / 100 : 0;
            await db.collection('audit_payments').add({
              email: customerEmail.toLowerCase().trim(),
              products: [product],
              amount: auditAmount,
              currency: (session.currency || 'chf').toUpperCase(),
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent || session.id,
              status: 'success',
              timestamp: FieldValue.serverTimestamp(),
              metadata: session.metadata || {},
              system: 'firebase',
              type: 'online_product',
              gateway: 'stripe',
            });
            console.log(`📊 Audit log created for ${product} payment by ${customerEmail}`);
          } catch (auditError) {
            console.error('Error creating audit log:', auditError);
          }

          try {
            if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
              await sendOnlineProductPurchaseNotificationAdmin(
                  {
                    email: customerEmail,
                    product,
                    amount: session.amount_total ? session.amount_total / 100 : 0,
                    customerName: customerName || 'N/A',
                    phone: customerPhone || '',
                    stripeSessionId: session.id,
                  },
                  process.env.MAILJET_API_KEY,
                  process.env.MAILJET_API_SECRET,
              );
            }
          } catch (notifError) {
            console.error('Error sending admin notification:', notifError);
          }

          console.log(`Paiement ${product} réussi - Email: ${customerEmail}, Session: ${session.id}`);
          return res.status(200).json({
            received: true,
            product,
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

          // Vérifier si le produit cross-sell "SOS dos & cervicales" a été acheté
          // Cela doit être fait AVANT de créer le token pour envoyer un seul email
          const productsToCreate = [product]; // Commence avec le produit principal

          try {
            console.log(`🔍 Vérification du cross-sell pour ${customerEmail}`);
            // Récupérer les line_items de la session Stripe pour détecter les cross-sells
            let checkoutSessionId = null;

            // Déterminer l'ID de la session checkout selon le type d'événement
            if (event.type === 'checkout.session.completed') {
            // Pour checkout.session.completed, session est déjà une CheckoutSession
              checkoutSessionId = session.id;
              console.log(`📋 Événement: checkout.session.completed, Session ID: ${checkoutSessionId}`);
            } else if (event.type === 'payment_intent.succeeded') {
            // Pour payment_intent.succeeded, session est un PaymentIntent
            // Il faut récupérer la CheckoutSession depuis le PaymentIntent
              checkoutSessionId = session.metadata?.checkout_session_id;
              if (!checkoutSessionId) {
              // Essayer de trouver la session via l'API Stripe
                try {
                  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                  const sessions = await stripe.checkout.sessions.list({
                    payment_intent: session.id,
                    limit: 1,
                  });
                  if (sessions.data.length > 0) {
                    checkoutSessionId = sessions.data[0].id;
                    console.log(`📋 Session checkout trouvée via API: ${checkoutSessionId}`);
                  }
                } catch (listError) {
                  console.warn('⚠️  Impossible de trouver la session checkout:', listError.message);
                }
              } else {
                console.log(`📋 Session checkout depuis métadonnées: ${checkoutSessionId}`);
              }
            }

            if (process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined' && checkoutSessionId) {
              try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                // Récupérer la session complète avec line_items
                const fullSession = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
                  expand: ['line_items'],
                });

                console.log(`📋 Session récupérée, line_items disponibles: ${fullSession.line_items ? 'Oui' : 'Non'}`);

                // Vérifier si le price_id du cross-sell est présent dans les line_items
                if (fullSession.line_items && fullSession.line_items.data) {
                  console.log(`📦 Nombre de line_items: ${fullSession.line_items.data.length}`);
                  for (const lineItem of fullSession.line_items.data) {
                    console.log(`   - Price ID: ${lineItem.price?.id || 'N/A'}, Description: ${lineItem.description || 'N/A'}`);
                    if (lineItem.price && lineItem.price.id === STRIPE_PRICE_ID_SOS_DOS_CERVICALES) {
                      productsToCreate.push('sos-dos-cervicales');
                      console.log(`✅ Cross-sell "SOS dos & cervicales" détecté pour ${customerEmail}`);
                      break;
                    }
                  }
                } else {
                  console.warn(`⚠️  Aucun line_item trouvé dans la session ${checkoutSessionId}`);
                }
              } catch (stripeError) {
                console.error('❌ Error retrieving Stripe session line_items:', stripeError.message);
                console.error('Error stack:', stripeError.stack);

                // ⚠️ ALERTE ADMIN : Impossible de vérifier les cross-sells
                // Cela pourrait signifier qu'un client a payé pour un produit qu'il ne recevra pas !
                try {
                  await sendAdminAlert(
                      {
                        subject: '⚠️ Impossible de vérifier les cross-sells Stripe',
                        message: `Une erreur s'est produite lors de la vérification des cross-sells pour un paiement.
                    
Email client: ${customerEmail}
Session ID: ${checkoutSessionId}
Produit principal: ${product}
Erreur: ${stripeError.message}

⚠️ ATTENTION: Si le client a acheté un cross-sell, il ne l'a pas reçu !
Vérifiez manuellement le paiement dans Stripe et créez un nouveau token si nécessaire.`,
                        severity: 'high',
                        metadata: {
                          customerEmail,
                          checkoutSessionId,
                          product,
                          error: stripeError.message,
                          stack: stripeError.stack,
                        },
                      },
                      process.env.MAILJET_API_KEY,
                      process.env.MAILJET_API_SECRET,
                  );
                } catch (alertError) {
                  console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', alertError.message);
                }

              // Continuer quand même pour ne pas bloquer le paiement
              }
            } else {
              if (!checkoutSessionId) {
                console.warn('⚠️  Impossible de déterminer l\'ID de la session checkout');

                // Envoyer une alerte admin
                try {
                  await sendAdminAlert(
                      {
                        subject: '⚠️ Session checkout introuvable',
                        message: `Impossible de déterminer l'ID de la session checkout pour vérifier les cross-sells.
                    
Email client: ${customerEmail}
Produit principal: ${product}
Type d'événement: ${event.type}

⚠️ ATTENTION: Si le client a acheté un cross-sell, il ne sera pas détecté !`,
                        severity: 'warning',
                        metadata: {
                          customerEmail,
                          product,
                          eventType: event.type,
                        },
                      },
                      process.env.MAILJET_API_KEY,
                      process.env.MAILJET_API_SECRET,
                  );
                } catch (alertError) {
                  console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', alertError.message);
                }
              } else {
                console.warn('⚠️  STRIPE_SECRET_KEY non disponible, impossible de vérifier le cross-sell');
              }
            }
          } catch (crossSellError) {
          // Ne pas faire échouer le webhook si le traitement du cross-sell échoue
            console.error('❌ Error processing cross-sell:', crossSellError.message);
            console.error('Error stack:', crossSellError.stack);
          }

          // ============================================================
          // VÉRIFICATION DU MONTANT TOTAL (détection des produits manquants)
          // ============================================================
          try {
          // Calculer le montant attendu basé sur les produits détectés
            const expectedAmount = productsToCreate.reduce((total, prod) => {
              return total + (PRODUCT_PRICES[prod] || 0);
            }, 0);

            // Récupérer le montant réellement payé
            const actualAmount = session.amount_total || session.amount || 0;

            // Vérifier si le montant payé est supérieur au montant attendu
            if (actualAmount > expectedAmount) {
              const difference = actualAmount - expectedAmount;
              console.warn(
                  `⚠️ ALERTE: Montant payé (${actualAmount / 100} CHF) > ` +
              `Montant attendu (${expectedAmount / 100} CHF)`,
              );
              console.warn(`   Différence: ${difference / 100} CHF`);
              console.warn(`   Produits détectés: ${productsToCreate.join(', ')}`);
              console.warn(`   ⚠️ Des produits ont peut-être été manqués !`);

              // Envoyer une alerte admin
              await sendAdminAlert(
                  {
                    subject: '🔴 Montant payé supérieur aux produits détectés',
                    message: `Un client a payé plus que le montant des produits détectés !
Cela signifie probablement qu'un ou plusieurs produits n'ont pas été détectés.

Email client: ${customerEmail}
Montant payé: ${actualAmount / 100} CHF
Montant attendu: ${expectedAmount / 100} CHF
Différence: ${difference / 100} CHF

Produits détectés: ${productsToCreate.join(', ')}

⚠️ ACTION REQUISE:
1. Vérifiez le paiement dans Stripe Dashboard
2. Identifiez les produits manquants
3. Créez un nouveau token avec tous les produits
4. Envoyez le lien au client

Commande pour créer un nouveau token:
node create-multi-product-token.js ${customerEmail} ${productsToCreate.join(' ')} [PRODUIT_MANQUANT]`,
                    severity: 'critical',
                    metadata: {
                      customerEmail,
                      actualAmount: actualAmount / 100,
                      expectedAmount: expectedAmount / 100,
                      difference: difference / 100,
                      productsDetected: productsToCreate,
                      sessionId: session.id,
                    },
                  },
                  process.env.MAILJET_API_KEY,
                  process.env.MAILJET_API_SECRET,
              );

              // Log l'alerte dans audit_payments
              try {
                await db.collection('audit_payments').add({
                  email: customerEmail.toLowerCase().trim(),
                  products: productsToCreate,
                  amount: actualAmount / 100,
                  expectedAmount: expectedAmount / 100,
                  currency: 'CHF',
                  stripeSessionId: session.id,
                  stripePaymentIntentId: session.payment_intent || session.id,
                  status: 'error',
                  alert: true,
                  alertType: 'amount_mismatch',
                  timestamp: FieldValue.serverTimestamp(),
                  metadata: session.metadata || {},
                  system: 'firebase',
                  type: 'online_product',
                });
              } catch (auditError) {
                console.error('Error logging audit alert:', auditError);
              }
            } else if (actualAmount === expectedAmount) {
              console.log(`✅ Montant vérifié: ${actualAmount / 100} CHF = ${expectedAmount / 100} CHF`);
            } else {
            // Montant payé < montant attendu (coupon de réduction ?)
              console.log(
                  `ℹ️  Montant payé (${actualAmount / 100} CHF) < ` +
              `Montant attendu (${expectedAmount / 100} CHF)`,
              );
              console.log('   Cela peut être normal si un coupon de réduction a été appliqué');
            }
          } catch (amountCheckError) {
            console.error('❌ Erreur lors de la vérification du montant:', amountCheckError.message);
          }

          // Créer un token unique avec tous les produits et envoyer UN SEUL email
          if (productsToCreate.length > 1) {
            console.log(`📧 Envoi d'un seul email pour ${productsToCreate.length} produits: ${productsToCreate.join(', ')}`);
            await createTokenForMultipleProductsAndSendEmail(
                customerEmail,
                productsToCreate,
                30,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
                amountCHF,
                customerName,
                customerPhone,
                fullAddress,
                langue,
            );

            // Envoyer notification admin
            try {
              if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                await sendOnlineProductPurchaseNotificationAdmin(
                    {
                      email: customerEmail,
                      product: productsToCreate[0], // Produit principal
                      amount: amountCHF,
                      customerName: customerName,
                      phone: customerPhone,
                      stripeSessionId: session.id,
                    },
                    process.env.MAILJET_API_KEY,
                    process.env.MAILJET_API_SECRET,
                );
              }
            } catch (notifError) {
              console.error('Error sending admin notification for online product:', notifError);
            }

            console.log(
                `✅ Token created and single email sent to ${customerEmail} for products: ${productsToCreate.join(', ')}, total amount: ${amountCHF} CHF`,
            );
          } else {
          // Un seul produit: utiliser l'ancienne fonction
            console.log(`📧 Envoi d'un email pour le produit unique: ${product}`);
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

            // Envoyer notification admin
            try {
              if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                await sendOnlineProductPurchaseNotificationAdmin(
                    {
                      email: customerEmail,
                      product: product,
                      amount: amountCHF,
                      customerName: customerName,
                      phone: customerPhone,
                      stripeSessionId: session.id,
                    },
                    process.env.MAILJET_API_KEY,
                    process.env.MAILJET_API_SECRET,
                );
              }
            } catch (notifError) {
              console.error('Error sending admin notification for online product:', notifError);
            }

            console.log(
                `✅ Token created and email sent to ${customerEmail} for product ${product}, amount: ${amountCHF} CHF`,
            );
          }

          // ============================================================
          // AUDIT ET MONITORING
          // ============================================================
          try {
            await db.collection('audit_payments').add({
              email: customerEmail.toLowerCase().trim(),
              products: productsToCreate,
              amount: amountCHF,
              currency: 'CHF',
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent || session.id,
              status: 'success',
              timestamp: FieldValue.serverTimestamp(),
              metadata: session.metadata || {},
              system: 'firebase',
              type: 'online_product',
            });
            console.log(`📊 Audit log created for payment by ${customerEmail}`);
          } catch (auditError) {
            console.error('Error creating audit log:', auditError);
          }

          return res.status(200).json({received: true});
        } catch (error) {
          console.error('Error creating token:', error);

          // ⚠️ ALERTE ADMIN + AUDIT : un échec ici laisse un client payant
          // sans accès. On alerte immédiatement pour éviter les pertes silencieuses.
          try {
            await db.collection('audit_payments').add({
              email: (customerEmail || '').toLowerCase().trim(),
              products: [product],
              amount: (session.amount_total || 0) / 100,
              currency: 'CHF',
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent || session.id,
              status: 'error',
              error: error.message,
              timestamp: FieldValue.serverTimestamp(),
              metadata: session.metadata || {},
              system: 'firebase',
              type: 'online_product',
              gateway: 'stripe',
            });
          } catch (auditError) {
            console.error('Error logging Stripe audit error:', auditError.message);
          }

          try {
            if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
              await sendAdminAlert(
                  {
                    subject: '🔴 Paiement Stripe accepté mais accès non livré',
                    message: `Un paiement Stripe a réussi mais le traitement du produit en ligne a échoué.

Email client: ${customerEmail || 'N/A'}
Produit: ${product}
Session: ${session.id}

⚠️ ACTION REQUISE : vérifiez l'accès du client (token / document Firestore) et envoyez-lui le lien d'activation.`,
                    severity: 'high',
                    metadata: {
                      customerEmail,
                      sessionId: session.id,
                      product,
                      error: error.message,
                    },
                  },
                  process.env.MAILJET_API_KEY,
                  process.env.MAILJET_API_SECRET,
              );
            }
          } catch (alertError) {
            console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', alertError.message);
          }

          return res.status(500).send('Error processing payment');
        }
      }

      // Gérer les renouvellements d'abonnement des produits en ligne
      // (complet, rdv-clarte, focus-sos, site-vitrine) : comptabilité Bexio
      // + annulation automatique des échéances limitées (focus-sos 3x, site-vitrine 5x)
      if (event.type === 'invoice.paid') {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          // Récupérer la subscription Stripe pour lire les métadonnées
          let subscription = null;
          try {
            if (process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
              const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
              subscription = await stripe.subscriptions.retrieve(subscriptionId);
            }
          } catch (subError) {
            console.warn('Error retrieving subscription from Stripe (invoice.paid):', subError.message);
          }

          const system = subscription?.metadata?.system;
          const product = subscription?.metadata?.product;
          const variant = subscription?.metadata?.variant;

          // Seuls les abonnements Firebase (produits en ligne) sont traités ici
          if (system === 'firebase' && product) {
            // 1. Comptabilité Bexio pour la facture payée (renouvellement)
            //    ⚠️ On saute la facture de création (subscription_create) : le premier
            //    paiement est déjà comptabilisé via checkout.session.completed.
            if (invoice.billing_reason !== 'subscription_create') {
              try {
                if (invoice.payment_intent && process.env.STRIPE_SECRET_KEY) {
                  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                  await recordBexioForPaymentIntent(
                      stripe,
                      typeof invoice.payment_intent === 'string' ?
                      invoice.payment_intent :
                      invoice.payment_intent.id,
                      invoice.payment_intent || invoice.id,
                      `Renouvellement ${product}${variant ? ' ' + variant : ''}`,
                      invoice.created ? new Date(invoice.created * 1000).toISOString().split('T')[0] : undefined,
                  );
                }
              } catch (bexioError) {
                console.error('❌ Error in Stripe Bexio integration (invoice.paid):', bexioError.message);
              }
            }

            // 2. Échéances limitées (focus-sos 3x, site-vitrine 5x) :
            //    compter les paiements et annuler après le N-ième
            const maxPayments = getStripeMaxPayments(product, variant);
            if (maxPayments) {
              const countRef = db.collection('subscriptionPayments').doc(subscriptionId);
              const countDoc = await countRef.get();
              const currentCount = countDoc.exists ? (countDoc.data().paymentCount || 0) : 0;
              const newCount = currentCount + 1;
              await countRef.set({
                subscriptionId,
                product,
                variant,
                paymentCount: newCount,
                lastInvoice: invoice.id,
                lastPaymentAt: new Date(),
                updatedAt: FieldValue.serverTimestamp(),
              }, {merge: true});
              console.log(
                  `🔢 ${product} (${variant}): paiement ${newCount}/${maxPayments} ` +
                  `pour la subscription ${subscriptionId}`,
              );

              if (newCount >= maxPayments) {
                try {
                  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                  await stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true,
                  });
                  console.log(
                      `✅ Subscription ${subscriptionId} marquée pour annulation ` +
                  `(${newCount}/${maxPayments} paiements effectués)`,
                  );
                } catch (cancelError) {
                  console.error('Error scheduling subscription cancellation:', cancelError);
                }
              }
            }
          }
        }
      }

      // Gérer les événements de renouvellement d'abonnement (Pass Semestriel)
      if (event.type === 'invoice.paid' && passService) {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        const customerEmail = invoice.customer_email;

        if (subscriptionId && customerEmail) {
        // Vérifier si c'est un nouveau pass ou un renouvellement
          const existingPass = await db.collection('userPasses')
              .where('stripeSubscriptionId', '==', subscriptionId)
              .limit(1)
              .get();

          if (existingPass.empty) {
          // Nouveau Pass Semestriel
            console.log(`✅ New Semester Pass for ${customerEmail}`);
            try {
            // Récupérer la subscription depuis Stripe pour obtenir les métadonnées (courseId, etc.)
              let subscription = null;
              let courseId = null;
              let firstName = invoice.customer_name || '';
              let lastName = '';
              let phone = '';

              if (process.env.STRIPE_SECRET_KEY && typeof require !== 'undefined') {
                try {
                  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                  subscription = await stripe.subscriptions.retrieve(subscriptionId, {
                    expand: ['customer'],
                  });

                  // Si c'est un produit online (système firebase), ignorer ce bloc de gestion de Pass présentiel
                  // Cela évite de créer un "Pass Semestriel" pour un abonnement online
                  if (subscription.metadata?.system === 'firebase') {
                    console.log(`✅ Online subscription detected for ${customerEmail} - ignoring pass management`);
                    return res.status(200).json({received: true, ignored: true});
                  }

                  courseId = subscription.metadata?.courseId;
                  firstName = subscription.metadata?.firstName || firstName;
                  lastName = subscription.metadata?.lastName || '';
                  phone = subscription.metadata?.phone || '';
                } catch (stripeError) {
                  console.warn('Error retrieving subscription from Stripe:', stripeError.message);
                }
              }

              const pass = await passService.createUserPass(db, customerEmail, 'semester_pass', {
                stripeSubscriptionId: subscriptionId,
                stripePaymentIntentId: invoice.payment_intent,
                firstName: firstName,
                lastName: lastName,
                phone: phone,
              });
              console.log(`✅ Semester Pass created: ${pass.passId}`);

              // Comptabilité Bexio pour le premier paiement du Pass Semestriel
              try {
                if (invoice.payment_intent && process.env.STRIPE_SECRET_KEY) {
                  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                  await recordBexioForPaymentIntent(
                      stripe,
                      typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent.id,
                      invoice.payment_intent,
                      'Pass Semestriel (premier paiement)',
                  );
                }
              } catch (bexioError) {
                console.error('❌ Error in Stripe Bexio integration (semester pass):', bexioError.message);
              }

              // Si un courseId est présent dans les métadonnées, créer automatiquement la réservation
              if (courseId && bookingService) {
                console.log(
                    `📅 Course ID found in subscription metadata: ${courseId} - Creating automatic booking with pass`,
                );
                try {
                // Récupérer les infos du cours
                  const courseDoc = await db.collection('courses').doc(courseId).get();
                  if (!courseDoc.exists) {
                    console.warn(`⚠️ Course ${courseId} not found, skipping automatic booking`);
                  } else {
                    const course = courseDoc.data();

                    // Vérifier si l'utilisateur n'a pas déjà réservé ce cours
                    const existingBooking = await db.collection('bookings')
                        .where('courseId', '==', courseId)
                        .where('email', '==', customerEmail.toLowerCase().trim())
                        .where('status', 'in', ['confirmed', 'pending', 'pending_cash'])
                        .limit(1)
                        .get();

                    if (!existingBooking.empty) {
                      // La réservation existe déjà (créée par bookCourse avec statut 'pending')
                      // → la confirmer et la lier au pass
                      const existing = existingBooking.docs[0];
                      const existingData = existing.data();
                      console.log(
                          `✅ Confirming existing booking ${existing.id} and linking semester pass ${pass.passId}`,
                      );
                      await existing.ref.update({
                        status: 'confirmed',
                        paymentMethod: 'pass',
                        pricingOption: 'semester_pass',
                        passId: pass.passId,
                        paidAt: new Date(),
                        updatedAt: new Date(),
                        notes: 'Pass Semestriel',
                        ...(existingData.courseId ? {} : {courseId: courseId}),
                      });

                      // Mettre à jour le compteur de participants seulement si pas déjà compté
                      if (existingData.status === 'pending') {
                        const courseRef = db.collection('courses').doc(courseId);
                        const currentCourse = await courseRef.get();
                        const currentParticipantCount = currentCourse.data()?.participantCount || 0;
                        await courseRef.update({
                          participantCount: currentParticipantCount + 1,
                        });
                        console.log(
                            `✅ Participant count incremented for course ${courseId} (pending → confirmed)`,
                        );
                      }
                    } else {
                    // Pass Semestriel est illimité, pas besoin de décompter
                    // Créer la réservation avec le pass
                      const bookingId = db.collection('bookings').doc().id;
                      const bookingData = {
                        bookingId: bookingId,
                        courseId: courseId,
                        courseName: course.title || '',
                        courseDate: course.date || '',
                        courseTime: course.time || '',
                        courseLocation: course.location || '',
                        email: customerEmail.toLowerCase().trim(),
                        firstName: firstName,
                        lastName: lastName,
                        phone: phone,
                        paymentMethod: 'pass',
                        pricingOption: 'semester_pass',
                        passId: pass.passId,
                        amount: 0, // Pas de paiement supplémentaire
                        currency: 'CHF',
                        status: 'confirmed',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        paidAt: new Date(),
                        notes: 'Pass Semestriel',
                      };

                      await db.collection('bookings').doc(bookingId).set(bookingData);

                      // Mettre à jour le compteur de participants
                      const courseRef = db.collection('courses').doc(courseId);
                      const currentCourse = await courseRef.get();
                      const currentParticipantCount = currentCourse.data()?.participantCount || 0;
                      await courseRef.update({
                        participantCount: currentParticipantCount + 1,
                      });

                      console.log(
                          `✅ Automatic booking created: ${bookingId} ` +
                      `for course ${courseId} using Semester Pass ${pass.passId}`,
                      );

                      // Envoyer email de confirmation de réservation
                      try {
                        const cancellationTokenResult = await bookingService.createCancellationToken(
                            db,
                            bookingId,
                            30,
                        );
                        const cancellationUrl = cancellationTokenResult.success ?
                        cancellationTokenResult.cancellationUrl :
                        null;

                        await db.collection('mail').add({
                          to: customerEmail,
                          template: {
                            name: 'booking-confirmation',
                            data: {
                              firstName: firstName,
                              courseName: course.title || '',
                              courseDate: course.date || '',
                              courseTime: course.time || '',
                              location: course.location || '',
                              bookingId: bookingId,
                              cancellationUrl: cancellationUrl,
                            },
                          },
                        });
                        console.log(`📧 Booking confirmation email sent to ${customerEmail}`);
                      } catch (bookingEmailError) {
                        console.error('Error sending booking confirmation email:', bookingEmailError);
                      }

                      // Envoyer notification admin pour la réservation
                      try {
                        if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                          await sendBookingNotificationAdmin(
                              bookingData,
                              course,
                              process.env.MAILJET_API_KEY,
                              process.env.MAILJET_API_SECRET,
                          );
                        }
                      } catch (notifError) {
                        console.error('Error sending booking admin notification:', notifError);
                      }

                      // Ajouter au Google Sheet
                      try {
                        const sheetId = process.env.GOOGLE_SHEET_ID;
                        if (!sheetId) {
                          console.warn('⚠️ GOOGLE_SHEET_ID not configured, skipping sheet update');
                        } else if (!googleService) {
                          console.warn('⚠️ GoogleService not available, skipping sheet update');
                        } else {
                          console.log(
                              `📊 Attempting to add booking to sheet: ${customerEmail} for ${course.title}`,
                          );
                          await googleService.appendUserToSheet(
                              sheetId,
                              courseId,
                              {
                                firstName: firstName,
                                lastName: lastName,
                                email: customerEmail,
                                phone: phone,
                                ipAddress: '',
                              },
                              {
                                courseName: course.title || '',
                                courseDate: course.date || '',
                                courseTime: course.time || '',
                                location: course.location || '',
                                paymentMethod: 'Pass Semestriel',
                                paymentStatus: 'Pass utilisé',
                                amount: '0 CHF',
                                status: 'Confirmé',
                                bookingId: bookingId,
                                notes: bookingData.notes,
                                passType: 'Pass Semestriel',
                                sessionsRemaining: 'Illimité',
                                paidAt: new Date(),
                                source: 'web',
                                isCancelled: false,
                                isWaitlisted: false,
                              },
                          );
                          console.log(
                              `✅ Successfully added booking to sheet: ${customerEmail}`,
                          );
                        }
                      } catch (sheetError) {
                        console.error('❌ Error updating sheet:', sheetError.message);
                      // Ne pas bloquer le processus si l'ajout au sheet échoue
                      }
                    }
                  }
                } catch (bookingError) {
                  console.error('Error creating automatic booking with Semester Pass:', bookingError);
                // Ne pas faire échouer le processus si la réservation automatique échoue
                }
              }

              // Envoyer email de confirmation du pass au client
              try {
                const passConfig = passService.PASS_CONFIG.semester_pass;
                if (passConfig) {
                  await db.collection('mail').add({
                    to: customerEmail,
                    template: {
                      name: 'pass-purchase-confirmation',
                      data: {
                        firstName: firstName,
                        passType: 'Pass Semestriel',
                        sessions: passConfig.sessions,
                        validityMonths: Math.floor(passConfig.validityDays / 30),
                        isUnlimited: true,
                        isRecurring: true,
                        passId: pass.passId,
                      },
                    },
                  });
                  console.log(`📧 Semester Pass purchase confirmation email sent to ${customerEmail}`);
                } else {
                  console.warn('⚠️ PASS_CONFIG.semester_pass not found');
                }
              } catch (emailError) {
                console.error('Error sending Semester Pass purchase confirmation email:', emailError);
              }

              // Envoyer notification admin
              try {
                if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                  await sendPassPurchaseNotificationAdmin(
                      {
                        ...pass,
                        passId: pass.passId,
                      },
                      process.env.MAILJET_API_KEY,
                      process.env.MAILJET_API_SECRET,
                  );
                }
              } catch (notifError) {
                console.error('Error sending Semester Pass purchase admin notification:', notifError);
              }
            } catch (passError) {
              console.error('Error creating Semester Pass:', passError);
            }
          } else {
          // Renouvellement du Pass Semestriel
            console.log(`✅ Semester Pass renewed for ${customerEmail}`);
            try {
              await passService.renewSemesterPass(db, subscriptionId);

              // Comptabilité Bexio pour le renouvellement
              try {
                if (invoice.payment_intent && process.env.STRIPE_SECRET_KEY) {
                  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                  await recordBexioForPaymentIntent(
                      stripe,
                      typeof invoice.payment_intent === 'string' ?
                      invoice.payment_intent :
                      invoice.payment_intent.id,
                      invoice.payment_intent,
                      'Pass Semestriel (renouvellement)',
                  );
                }
              } catch (bexioError) {
                console.error('❌ Error in Stripe Bexio integration (semester pass renewal):', bexioError.message);
              }
            } catch (renewError) {
              console.error('Error renewing Semester Pass:', renewError);
            }
          }
          return res.status(200).json({received: true, passProcessed: true});
        }
      }

      // Gérer les événements d'annulation d'abonnement
      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const customerEmail = subscription.metadata?.email || subscription.customer_email;

        // Gérer l'annulation du Pass Semestriel
        if (passService) {
          const existingPass = await db.collection('userPasses')
              .where('stripeSubscriptionId', '==', subscription.id)
              .limit(1)
              .get();

          if (!existingPass.empty) {
            console.log(`⚠️ Semester Pass subscription cancelled: ${subscription.id}`);
            try {
              await existingPass.docs[0].ref.update({
                status: 'cancelled',
                cancelledAt: new Date(),
                updatedAt: new Date(),
              });
              return res.status(200).json({received: true, passCancelled: true});
            } catch (error) {
              console.error('Error cancelling pass:', error);
            }
          }
        }

        if (!customerEmail) {
          console.error('No email found in subscription cancellation event');
          return res.status(400).send('No email found');
        }

        // Vérifier si c'est pour le système Firebase (produits en ligne)
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
        let customerEmail;
        let product;
        let system;

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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
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

          // ⚠️ ALERTE ADMIN + AUDIT : un échec ici laisse un client payant
          // sans accès. On alerte immédiatement pour éviter les pertes silencieuses.
          try {
            await db.collection('audit_payments').add({
              email: (customerEmail || '').toLowerCase().trim(),
              products: [product],
              amount: parseFloat(resource.purchase_units?.[0]?.amount?.value) || 0,
              currency: 'CHF',
              stripeSessionId: resource.custom_id || '',
              stripePaymentIntentId: resource.id || '',
              status: 'error',
              error: error.message,
              timestamp: FieldValue.serverTimestamp(),
              metadata: resource,
              system: 'firebase',
              type: 'online_product',
              gateway: 'paypal',
            });
          } catch (auditError) {
            console.error('Error logging PayPal audit error:', auditError.message);
          }

          try {
            if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
              await sendAdminAlert(
                  {
                    subject: '🔴 Paiement PayPal accepté mais accès non livré',
                    message: `Un paiement PayPal a réussi mais le traitement du produit en ligne a échoué.

Email client: ${customerEmail || 'N/A'}
Produit: ${product}
Custom ID: ${resource.custom_id || 'N/A'}

⚠️ ACTION REQUISE : vérifiez l'accès du client (token / document Firestore) et envoyez-lui le lien d'activation.`,
                    severity: 'high',
                    metadata: {
                      customerEmail,
                      product,
                      customId: resource.custom_id,
                      error: error.message,
                    },
                  },
                  process.env.MAILJET_API_KEY,
                  process.env.MAILJET_API_SECRET,
              );
            }
          } catch (alertError) {
            console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', alertError.message);
          }

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
      secrets: [
        'STRIPE_SECRET_KEY',
        // Secrets optionnels (si configurés, ils sont prioritaires).
        // Sinon, le prix est créé automatiquement dans Stripe à la première
        // demande (auto-provisioning, voir services/stripePrices.js).
        'STRIPE_PRICE_ID_RDV_CLARTE_UNIQUE',
        'STRIPE_PRICE_ID_RDV_CLARTE_ABONNEMENT',
        'STRIPE_TAX_ENABLED',
      ],
    },
    async (request) => {
      const {product, variant, locale = 'fr', includeSosDos = false, email = null, firstName = null, lastName = null} = request.data;

      // Valider les paramètres
      const VALID_PRODUCTS = ['21jours', 'complet', 'rdv-clarte', 'focus-sos', 'site-vitrine', 'diagnostic-digital', 'flow_pass', 'semester_pass'];
      if (!product || !VALID_PRODUCTS.includes(product)) {
        throw new HttpsError('invalid-argument', `Product must be one of: ${VALID_PRODUCTS.join(', ')}`);
      }

      // Validations par produit
      const VALID_VARIANTS = {
        'complet': ['mensuel', 'trimestriel'],
        'rdv-clarte': ['unique', 'abonnement'],
        'focus-sos': ['unique', '3x'],
        'site-vitrine': ['5x'],
        'diagnostic-digital': ['unique'],
      };
      if (VALID_VARIANTS[product]) {
        const v = variant || (product === 'rdv-clarte' ? 'unique' : null);
        if (!v || !VALID_VARIANTS[product].includes(v)) {
          throw new HttpsError('invalid-argument', `Variant for "${product}" must be one of: ${VALID_VARIANTS[product].join(', ')}`);
        }
      }

      // Instancier Stripe (nécessaire pour l'auto-provisioning des prix)
      let stripe;
      try {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      } catch {
        throw new HttpsError('failed-precondition',
            'Stripe package not installed. Run: npm install stripe in functions/ directory');
      }

      // Déterminer le Price ID du produit principal
      // (auto-provisioning : créé automatiquement dans Stripe si nécessaire)
      const priceId = await ensureStripePrice(stripe, db, product, variant);

      // Déterminer le mode (payment pour one-time, subscription pour abonnements)
      const isSubscription = product === 'complet' ||
        (product === 'rdv-clarte' && variant === 'abonnement') ||
        product === 'semester_pass' ||
        (product === 'focus-sos' && variant === '3x') ||
        (product === 'site-vitrine' && variant === '5x');
      const mode = isSubscription ? 'subscription' : 'payment';

      // Line items : produit principal (+ cross-sell SOS Dos si demandé)
      const lineItems = [
        {
          price: priceId,
          quantity: 1,
        },
      ];

      // Cross-sell "SOS Dos & Cervicales" (Order Bump) — uniquement pour 21jours et complet
      if (includeSosDos && (product === '21jours' || product === 'complet')) {
        lineItems.push({
          price: STRIPE_PRICE_ID_SOS_DOS_CERVICALES,
          quantity: 1,
        });
      }

      // URLs de redirection selon le produit et la locale
      const langPrefix = locale === 'en' ? '/en' : '';
      let baseUrl; let successUrl; let cancelUrl;
      if (product === 'rdv-clarte' || product === 'focus-sos' || product === 'site-vitrine' || product === 'diagnostic-digital') {
      // Produits cedricv.com
        baseUrl = 'https://cedricv.com';
        if (product === 'site-vitrine') {
          successUrl = `${baseUrl}/merci-paiement/?session_id={CHECKOUT_SESSION_ID}`;
          cancelUrl = `${baseUrl}/paiement/site-vitrine/`;
        } else if (product === 'diagnostic-digital') {
          successUrl = `${baseUrl}${langPrefix}/confirmation` +
            `?session_id={CHECKOUT_SESSION_ID}&produit=diagnostic-digital`;
          cancelUrl = `${baseUrl}${langPrefix}/digital-manager`;
        } else {
          successUrl = `${baseUrl}${langPrefix}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
          cancelUrl = product === 'rdv-clarte' ?
            `${baseUrl}${langPrefix}/rdv/clarte` :
            `${baseUrl}${langPrefix}/accompagnement/formules/focus-sos/bdc/3x/`;
        }
      } else {
      // Produits fluance.io
        baseUrl = 'https://fluance.io';
        successUrl = `${baseUrl}${langPrefix}/success?session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${baseUrl}${langPrefix}/cancel`;
      }

      try {
        // Métadonnées communes
        const metadata = {
          system: 'firebase',
          product,
          locale: locale === 'en' ? 'en' : 'fr',
        };
        if (variant) metadata.variant = variant;
        if (includeSosDos) metadata.includeSosDos = 'true';
        if (email) metadata.email = email;
        if (firstName) metadata.firstName = firstName;
        if (lastName) metadata.lastName = lastName;

        // Créer la session Checkout
        // NOTE : pour les paiements uniques, pas de payment_method_types → Stripe
        // utilise la configuration par défaut du Dashboard (carte, Klarna, PayPal...).
        // Pour les ABONNEMENTS, on restreint explicitement les méthodes : Klarna
        // (et les autres BNPL) ne supporte PAS Checkout en mode abonnement et ne
        // fonctionne avec les abonnements qu'en facturation manuelle (send_invoice),
        // donc incompatible avec notre prélèvement automatique (charge_automatically).
        const sessionParams = {
          line_items: lineItems,
          mode: mode,
          success_url: successUrl,
          cancel_url: cancelUrl,
          // Définir la langue de l'interface Stripe Checkout
          locale: locale === 'en' ? 'en' : 'fr',
          metadata,
        };

        // Abonnements : méthodes de paiement compatibles avec les paiements
        // récurrents automatiques (card, Link, PayPal, Amazon Pay supportent les
        // abonnements ; Klarna non). SEPA exclu ici car l'abonnement est facturé
        // en CHF et SEPA ne supporte que l'EUR.
        if (mode === 'subscription') {
          sessionParams.payment_method_types = ['card', 'link', 'paypal', 'amazon_pay'];
        }

        // Email du client (nécessaire pour les abonnements — envoi des factures)
        if (email) {
          sessionParams.customer_email = email;
        }

        // TVA automatique (Stripe Tax) — uniquement pour le diagnostic digital ET
        // uniquement si la variable d'environnement STRIPE_TAX_ENABLED='true' est
        // configurée (par défaut : pas de TVA, aucun impact sur les autres produits).
        // Stripe collecte l'adresse de facturation du client et applique la TVA
        // suisse (8,1%) pour les clients suisses, et 0% / reverse charge pour les
        // clients étrangers B2B (via tax_id_collection). Le prix affiché reste HT.
        if (product === 'diagnostic-digital' && process.env.STRIPE_TAX_ENABLED === 'true') {
          sessionParams.automatic_tax = {enabled: true};
          sessionParams.tax_id_collection = {enabled: true};
        }

        // Pour les paiements uniques : métadonnées aussi sur le Payment Intent
        // (nécessaire pour les remboursements qui récupèrent les métadonnées depuis le Payment Intent)
        if (mode === 'payment') {
          sessionParams.payment_intent_data = {
            metadata,
          };
        }

        // Pour les abonnements : métadonnées aussi dans la subscription
        if (mode === 'subscription') {
          sessionParams.subscription_data = {
            metadata,
            // Période d'essai gratuite de 14 jours pour le produit "complet"
            ...(product === 'complet' ? {trial_period_days: 14} : {}),
          };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        // 🛒 Suivi panier abandonné pour le produit 21 jours : on enregistre la
        // session dès sa création pour pouvoir relancer l'email si le paiement
        // n'est pas finalisé (relances à +2h et +20h, avant expiration Stripe ~24h).
        if (product === '21jours' && email) {
          try {
            await db.collection('abandonedCheckouts').doc(session.id).set({
              sessionId: session.id,
              email: email.toLowerCase().trim(),
              firstName: firstName || '',
              product,
              variant: variant || null,
              status: 'pending',
              createdAt: FieldValue.serverTimestamp(),
              expiresAt: Timestamp.fromDate(
                  new Date(Date.now() + 24 * 60 * 60 * 1000)),
              remindersSent: 0,
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`🛒 Abandoned checkout tracked: ${session.id} (${email}, ${product})`);
          } catch (abandonError) {
            // Ne jamais bloquer le checkout si le suivi panier échoue.
            console.error('❌ Error tracking abandoned checkout:', abandonError.message);
          }
        }

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
 * Valide un code partenaire et retourne la remise applicable
 */
exports.validatePartnerCode = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      const code = req.query.code;

      if (!code) {
        return res.status(400).json({valid: false, error: 'Code is required'});
      }

      // Configuration des codes partenaires
      // Format: { code: { discountPercent: number, description: string, validFor: string[] } }
      const PARTNER_CODES = {
        'DUPLEX10': {
          discountPercent: 10,
          description: 'Remise Duplex 10%',
          validFor: ['semester_pass'], // Valide uniquement pour Pass Semestriel
        },
        'RETRAITE50': {
          discountPercent: 50,
          description: 'Remise Retraite 50%',
          validFor: ['flow_pass', 'semester_pass'], // Valide pour Flow Pass et Pass Semestriel
        },
      // Ajoutez d'autres codes ici
      // 'AUTRECODE': {
      //   discountPercent: 15,
      //   description: 'Autre remise',
      //   validFor: ['semester_pass', 'flow_pass'],
      // },
      };

      const normalizedCode = code.toUpperCase().trim();
      const partnerCode = PARTNER_CODES[normalizedCode];

      if (!partnerCode) {
        return res.json({
          valid: false,
          message: 'Code invalide',
        });
      }

      // Vérifier pour quel produit le code est valide (optionnel, peut être passé en paramètre)
      const validFor = req.query.validFor || 'semester_pass';
      if (partnerCode.validFor && !partnerCode.validFor.includes(validFor)) {
        return res.json({
          valid: false,
          message: 'Ce code n\'est pas valide pour cette formule',
        });
      }

      return res.json({
        valid: true,
        discountPercent: partnerCode.discountPercent,
        discount: partnerCode.discountPercent, // Pour compatibilité
        description: partnerCode.description,
        message: `Remise de ${partnerCode.discountPercent}% appliquée !`,
      });
    },
);

/**
 * Lien de reprise « 5 jours » (ré-engagement) — endpoint public signé.
 *
 * GET /reengage-5jours?email=...&sig=...
 *
 * - `sig` = HMAC-SHA256(REENGAGEMENT_SIGNING_SECRET, email) : permet au script
 *   d'envoi de générer des liens uniques, et évite qu'un tiers réinitialise la
 *   série d'un autre contact (anti-abus).
 * - Contact avec double opt-in confirmé → redémarre la série 5 jours (si
 *   terminée, sans chevauchement) puis redirige directement vers le jour 1.
 * - Contact sans confirmation (ex: les 113 DOI non confirmés) → redirige vers
 *   le formulaire d'inscription 5 jours avec l'email pré-rempli, pour obtenir
 *   un consentement frais (nouveau token DOI + relances existantes).
 */
exports.reengage5jours = onRequest(
    {
      region: 'europe-west1',
      secrets: ['REENGAGEMENT_SIGNING_SECRET', 'MAILJET_API_KEY', 'MAILJET_API_SECRET'],
    },
    async (req, res) => {
      try {
        const email = String(req.query.email || '').toLowerCase().trim();
        const sig = String(req.query.sig || '');
        // Prénom fourni par le script d'envoi (pré-remplissage) — purement
        // cosmétique, aucune donnée sensible : pas besoin d'être signé.
        const queryFirstname = String(req.query.firstname || '').trim().slice(0, 60);

        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !sig) {
          return res.redirect(302, 'https://fluance.io/cours-en-ligne/5jours/inscription/');
        }

        // Vérifier la signature HMAC (anti-abus)
        const secret = process.env.REENGAGEMENT_SIGNING_SECRET;
        const expected = crypto.createHmac('sha256', secret).update(email).digest('hex');
        if (sig !== expected) {
          console.warn(`⚠️ Invalid re-engagement signature for ${email}`);
          return res.redirect(302, 'https://fluance.io/cours-en-ligne/5jours/inscription/');
        }

        // Récupérer (au mieux) les propriétés Mailjet : prénom pour le pré-remplissage
        // du formulaire, et propriétés de série pour le redémarrage.
        const currentProperties = {};
        let firstname = '';
        try {
          const auth = Buffer.from(
              `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
          const propsResp = await fetch(
              `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`,
              {headers: {Authorization: `Basic ${auth}`}},
          );
          if (propsResp.ok) {
            const propsData = await propsResp.json();
            if (propsData.Data && propsData.Data.length && propsData.Data[0].Data) {
              propsData.Data[0].Data.forEach((item) => {
                if (item.Name) currentProperties[item.Name] = item.Value;
              });
            }
          }
          firstname = String(currentProperties.firstname || currentProperties.prenom || '').trim();
        } catch (propsError) {
          console.error(`❌ Erreur récupération propriétés Mailjet pour ${email}:`, propsError.message);
        }
        if (queryFirstname) firstname = queryFirstname;

        // URL du formulaire 5 jours, pré-rempli (email + prénom si connu)
        const inscriptionParams = new URLSearchParams({email});
        if (firstname) inscriptionParams.set('firstname', firstname);
        inscriptionParams.set('utm_source', 'reengagement');
        inscriptionParams.set('utm_medium', 'email');
        const inscriptionUrl = 'https://fluance.io/cours-en-ligne/5jours/inscription/?' +
          inscriptionParams.toString();

        // Vérifier le consentement : un token DOI confirmé existe pour cet email ?
        const confirmQuery = await db.collection('newsletterConfirmations')
            .where('email', '==', email)
            .limit(50)
            .get();
        const hasConsent = confirmQuery.docs.some((d) => d.data().confirmed === true);

        // Journaliser le clic (ré-engagement) — sert à cibler les relances
        // « non-cliqueurs » (wave suivante) et à mesurer la campagne.
        try {
          await db.collection('reengagementClicks').add({
            email,
            clickedAt: FieldValue.serverTimestamp(),
            target: hasConsent ? 'jour1' : 'formulaire',
          });
          console.log(`🖱️ Ré-engagement clic journalisé pour ${email} (${hasConsent ? 'jour1' : 'formulaire'})`);
        } catch (clickError) {
          console.error(`❌ Erreur journalisation clic ${email}:`, clickError.message);
        }

        if (!hasConsent) {
          console.log(`ℹ️ ${email} sans DOI confirmé → redirection formulaire (pré-rempli)`);
          return res.redirect(302, inscriptionUrl);
        }

        // Contact confirmé : redémarrer la série 5 jours (si la précédente est terminée)
        try {
          const serieUpdate = computeSerie5joursProperties(
              currentProperties,
              new Date().toISOString(),
          );
          if (Object.keys(serieUpdate).length > 0) {
            await updateMailjetContactProperties(
                email,
                serieUpdate,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );
            console.log(`🔄 Série 5 jours redémarrée pour ${email}:`, serieUpdate);
          } else {
            console.log(`ℹ️ Série 5 jours déjà en cours pour ${email}, pas de réinitialisation`);
          }
        } catch (serieError) {
          console.error(`❌ Erreur redémarrage série pour ${email}:`, serieError.message);
        }

        return res.redirect(
            302,
            'https://fluance.io/cours-en-ligne/5jours/j1/?utm_source=reengagement&utm_medium=email',
        );
      } catch (error) {
        console.error('❌ Error in reengage5jours:', error);
        return res.redirect(302, 'https://fluance.io/cours-en-ligne/5jours/inscription/');
      }
    },
);

/**
 * Vérifie le statut d'un Payment Intent Stripe
 * Utilisé pour vérifier si un paiement a réussi après redirection
 */
exports.checkPaymentStatus = onRequest(
    {
      region: 'europe-west1',
      secrets: ['STRIPE_SECRET_KEY'],
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      const paymentIntentId = req.query.payment_intent;

      if (!paymentIntentId) {
        return res.status(400).json({error: 'payment_intent is required'});
      }

      // 🔒 Rate limiting par IP (anti-énumération des Payment Intents)
      const ipLimit = await checkRateLimit(`ip:${getClientIp(req)}`, 'checkPaymentStatus', 30, 3600);
      if (ipLimit.limited) {
        return res.status(429).json({error: 'Rate limited', message: 'Trop de requêtes. Réessayez plus tard.'});
      }

      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        // Récupérer le Payment Intent
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        return res.json({
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
        });
      } catch (error) {
        console.error('Error checking payment status:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

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

      // 🔒 Rate limiting par IP (anti-énumération des sessions de paiement)
      const ipLimit = await checkRateLimit(`ip:${getClientIp(request.rawRequest)}`, 'getStripeCheckoutSession', 30, 3600);
      if (ipLimit.limited) {
        throw new HttpsError('resource-exhausted', 'Trop de requêtes. Réessayez plus tard.');
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
        } else if (product === 'focus-sos') {
          productName = 'Focus SOS BDC (3x)';
        } else if (product === 'site-vitrine') {
          productName = 'Site web vitrine (5x)';
        } else if (product === 'flow_pass') {
          productName = 'Flow Pass';
        } else if (product === 'semester_pass') {
          productName = 'Pass Semestriel';
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
 * Récupère les détails d'une réservation de cours à partir d'un PaymentIntent Stripe ou d'un bookingId
 * Utilisé pour le suivi de conversion Google Ads
 */
exports.getBookingDetails = onCall(
    {
      region: 'europe-west1',
      secrets: ['STRIPE_SECRET_KEY'],
    },
    async (request) => {
      const {paymentIntentId, bookingId} = request.data;

      let finalBookingId = bookingId;
      let paymentIntent = null;

      // 🔒 Rate limiting par IP (anti-énumération des réservations/paiements)
      const ipLimit = await checkRateLimit(`ip:${getClientIp(request.rawRequest)}`, 'getBookingDetails', 30, 3600);
      if (ipLimit.limited) {
        throw new HttpsError('resource-exhausted', 'Trop de requêtes. Réessayez plus tard.');
      }

      // Si on a un paymentIntentId, récupérer le bookingId depuis Stripe
      if (paymentIntentId) {
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

          // Vérifier que c'est bien une réservation de cours
          if (paymentIntent.metadata?.type !== 'course_booking') {
            throw new HttpsError('invalid-argument', 'This payment intent is not a course booking');
          }

          finalBookingId = paymentIntent.metadata?.bookingId;
          if (!finalBookingId) {
            throw new HttpsError('invalid-argument', 'Booking ID not found in payment intent metadata');
          }
        } catch (error) {
          console.error('Error retrieving payment intent:', error);
          if (error.type === 'StripeInvalidRequestError') {
            throw new HttpsError('not-found', `Payment Intent "${paymentIntentId}" not found`);
          }
          throw new HttpsError('internal', `Error retrieving payment intent: ${error.message}`);
        }
      }

      // Si on n'a ni paymentIntentId ni bookingId, erreur
      if (!finalBookingId) {
        throw new HttpsError('invalid-argument', 'Either paymentIntentId or bookingId is required');
      }

      try {
      // Récupérer les détails de la réservation depuis Firestore
        const bookingDoc = await db.collection('bookings').doc(finalBookingId).get();
        if (!bookingDoc.exists) {
          throw new HttpsError('not-found', 'Booking not found');
        }

        const booking = bookingDoc.data();

        // Récupérer les détails du cours
        let courseName = booking.courseName || 'Cours Fluance';
        let courseDate = booking.courseDate || '';
        let courseTime = booking.courseTime || '';

        if (booking.courseId) {
          const courseDoc = await db.collection('courses').doc(booking.courseId).get();
          if (courseDoc.exists) {
            const course = courseDoc.data();
            courseName = course.title || courseName;
            courseDate = course.date || courseDate;
            courseTime = course.time || courseTime;
          }
        }

        // Déterminer le type de produit pour le suivi
        const pricingOption = booking.pricingOption || 'single';
        let productType = 'course_booking';
        let productName = 'Réservation de cours';

        if (pricingOption === 'trial') {
          productType = 'trial';
          productName = 'Cours d\'essai';
        } else if (pricingOption === 'flow_pass') {
          productType = 'flow_pass';
          productName = 'Flow Pass';
        } else if (pricingOption === 'semester_pass') {
          productType = 'semester_pass';
          productName = 'Pass Semestriel';
        }

        // Déterminer le montant : depuis paymentIntent si disponible, sinon depuis booking
        const amount = paymentIntent && paymentIntent.amount ?
        paymentIntent.amount / 100 :
        (booking.amount ? booking.amount / 100 : 0);
        const currency = paymentIntent && paymentIntent.currency ?
        paymentIntent.currency.toUpperCase() :
        'CHF';

        return {
          success: true,
          bookingId: finalBookingId,
          paymentIntentId: paymentIntentId || null,
          product: productType,
          productName: productName,
          courseName: courseName,
          courseDate: courseDate,
          courseTime: courseTime,
          amount: amount,
          currency: currency,
          pricingOption: pricingOption,
        };
      } catch (error) {
        console.error('Error retrieving booking details:', error);
        throw new HttpsError('internal', `Error retrieving booking: ${error.message}`);
      }
    },
);

/**
 * Trigger Firestore pour envoyer des notifications admin lors de nouvelles réservations
 * Se déclenche sur toute nouvelle réservation confirmée (y compris les cours d'essai gratuits)
 */
exports.onBookingCreated = onDocumentCreated(
    {
      document: 'bookings/{bookingId}',
      region: 'europe-west1',
    },
    async (event) => {
      const bookingId = event.params.bookingId;
      const booking = event.data.data();

      console.log(`🆕 Nouvelle réservation détectée: ${bookingId}`, {
        email: booking.email,
        pricingOption: booking.pricingOption,
        status: booking.status,
        amount: booking.amount,
      });

      // Ne traiter que les réservations confirmées
      if (booking.status !== 'confirmed') {
        console.log(`⚠️ Réservation ${bookingId} non confirmée (${booking.status}), notification ignorée`);
        return;
      }

      // Vérifier que ce n'est pas une notification déjà traitée (éviter les doublons)
      if (booking.adminNotificationSent) {
        console.log(`✅ Notification admin déjà envoyée pour ${bookingId}`);
        return;
      }

      try {
      // Récupérer les détails du cours si disponible
        let course = null;
        if (booking.courseId) {
          const courseDoc = await db.collection('courses').doc(booking.courseId).get();
          if (courseDoc.exists) {
            course = courseDoc.data();
          }
        }

        // Envoyer la notification admin
        if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
          await sendBookingNotificationAdmin(
              booking,
              course,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );

          // Marquer que la notification a été envoyée pour éviter les doublons
          await db.collection('bookings').doc(bookingId).update({
            adminNotificationSent: true,
            adminNotificationSentAt: FieldValue.serverTimestamp(),
          });

          console.log(`✅ Notification admin envoyée pour la réservation ${bookingId}`);
        } else {
          console.warn('⚠️ MAILJET_API_KEY ou MAILJET_API_SECRET non configurés, notification admin ignorée');
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'envoi de la notification admin pour ${bookingId}:`, error);
      // Ne pas lever d'exception pour ne pas bloquer la création de la réservation
      }
    },
);

/**
 * Fonction pour créer manuellement un token (paiement virement, cash, etc.)
 * Requiert une authentification admin
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.createUserToken = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
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
            FieldValue.serverTimestamp(),
            purchasedAt: existingUserData.createdAt ||
            FieldValue.serverTimestamp(),
          }];
        }

        // Support both 'product' (singular) and 'products' (array) in token data
        const tokenProducts = tokenData.products || (tokenData.product ? [tokenData.product] : []);

        if (tokenProducts.length === 0) {
          throw new Error('Token has no product information');
        }

        // Ajouter tous les produits du token qui n'existent pas déjà
        const now = FieldValue.serverTimestamp();
        for (const productName of tokenProducts) {
          const productExists = products.some((p) => p.name === productName);
          if (!productExists) {
            // 🚀 Défi 21 jours : le décompte démarre au PREMIER accès à la
            // formation (started: false → getProtectedContent fixe startDate
            // au premier accès). Les autres produits démarrent dès la création.
            if (productName === '21jours') {
              products.push({
                name: productName,
                startDate: null,
                purchasedAt: now,
                started: false,
              });
            } else {
              products.push({
                name: productName,
                startDate: now,
                purchasedAt: now,
              });
            }
          }
        }

        // Créer ou mettre à jour le document utilisateur dans Firestore
        // IMPORTANT: Faire cela AVANT de marquer le token comme utilisé
        // pour éviter que le token soit marqué comme utilisé si la création échoue
        const userData = {
          email: email,
          products: products,
          product: tokenProducts[0], // Garder pour compatibilité rétroactive (premier produit)
          createdAt: existingUserData.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        // Pour le produit "21jours", ajouter aussi registrationDate pour compatibilité
        if (tokenProducts.includes('21jours') && !existingUserData.registrationDate) {
          userData.registrationDate = FieldValue.serverTimestamp();
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
          usedAt: FieldValue.serverTimestamp(),
          userId: userRecord.uid,
        });

        return {success: true, userId: userRecord.uid, email: email};
      } catch (error) {
        console.error('Error creating user:', error);
        throw new HttpsError('internal', 'Erreur lors de la création du compte');
      }
    });

/**
 * Récupère le contenu protégé APRÈS vérification serveur des droits d'accès.
 *
 * 🔒 Remplace les lectures Firestore directes du client (firebase-auth.mjs) :
 * les règles Firestore interdisent désormais la lecture de protectedContent
 * côté client ; cette fonction vérifie que l'utilisateur possède le produit
 * et respecte la progression (défi 21 jours / approche complète) AVANT de
 * renvoyer le contenu. Le contenu n'est donc plus accessible en lisant
 * Firestore directement.
 *
 * - Avec contentId : vérifie l'accès au contenu demandé et le retourne.
 * - Sans contentId : retourne la liste des contenus de tous les produits
 *   de l'utilisateur avec les informations d'accessibilité.
 * Région : europe-west1
 */
exports.getProtectedContent = onCall(
    {
      region: 'europe-west1',
    },
    async (request) => {
      const uid = request.auth && request.auth.uid;
      if (!uid) {
        throw new HttpsError('unauthenticated', 'Vous devez être connecté(e) pour accéder au contenu protégé.');
      }

      const {contentId = null} = request.data || {};

      // 1. Charger le document utilisateur (propriétaire du compte)
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Votre compte n\'a pas été trouvé dans notre système. Veuillez contacter le support.');
      }

      const userData = userDoc.data();
      let userProducts = userData.products || [];

      // Migration automatique : ancien format (product unique)
      if (userProducts.length === 0 && userData.product) {
        userProducts = [{
          name: userData.product,
          startDate: userData.registrationDate || userData.createdAt || FieldValue.serverTimestamp(),
          purchasedAt: userData.createdAt || FieldValue.serverTimestamp(),
        }];
      }

      if (userProducts.length === 0) {
        throw new HttpsError('failed-precondition', 'Votre compte n\'a pas de produit associé. Veuillez contacter le support.');
      }

      // 🚀 Défi 21 jours : le décompte démarre au PREMIER accès à la formation.
      // Si un produit 21jours est marqué `started: false`, on fixe startDate = maintenant
      // dans une transaction (une seule fois, même en cas d'onglets simultanés).
      if (userProducts.some((p) => p && p.name === '21jours' && p.started === false)) {
        const userRef = db.collection('users').doc(uid);
        try {
          await db.runTransaction(async (tx) => {
            const freshDoc = await tx.get(userRef);
            const freshData = freshDoc.data();
            const freshProducts = (freshData && freshData.products) || [];
            let changed = false;
            freshProducts.forEach((p) => {
              if (p && p.name === '21jours' && p.started === false) {
                p.started = true;
                p.startDate = new Date();
                p.firstAccessAt = new Date();
                changed = true;
              }
            });
            if (changed) {
              tx.update(userRef, {
                products: freshProducts,
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
          });
        } catch (initError) {
          // Ne pas bloquer l'accès : on loggue et on continue avec les données actuelles
          console.error('Error initializing 21jours start date:', initError);
        }
        // Recharger le document pour utiliser les valeurs fraîches
        const freshUserDoc = await userDoc.ref.get();
        const freshUserData = freshUserDoc.data() || {};
        userProducts = freshUserData.products || [];
        if (userProducts.length === 0 && freshUserData.product) {
          userProducts = [{
            name: freshUserData.product,
            startDate: freshUserData.registrationDate || freshUserData.createdAt || new Date(),
            purchasedAt: freshUserData.createdAt || new Date(),
          }];
        }
      }

      const userProduct = userProducts[0].name;
      const now = new Date();

      /**
       * Vérifie l'accès progressif (21jours : jour ; complet : semaine).
       * @returns {{accessible: boolean, daysRemaining?: number,
       *            weeksRemaining?: number, currentDay?: number, currentWeek?: number}}
       */
      function checkProgressiveAccess(productName, contentData, userProductData) {
        const startDate = userProductData.startDate && typeof userProductData.startDate.toDate === 'function' ?
          userProductData.startDate.toDate() :
          (userProductData.startDate instanceof Date ? userProductData.startDate : now);

        if (productName === '21jours' && contentData.day !== undefined) {
          const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
          const dayNumber = contentData.day;
          // Jour 0 (déroulé) accessible immédiatement ; jours 1-21 accessibles
          // à partir du jour correspondant ; jour 22 (bonus) au jour 22.
          if (dayNumber > 0 && daysSinceStart < dayNumber - 1) {
            return {
              accessible: false,
              daysRemaining: dayNumber - daysSinceStart - 1,
              currentDay: daysSinceStart + 1,
            };
          }
          return {accessible: true, currentDay: daysSinceStart + 1};
        }

        if (productName === 'complet' && contentData.week !== undefined) {
          const weeksSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24 * 7));
          const weekNumber = contentData.week;
          // Semaines 0 et 1 accessibles immédiatement ; semaines 2-14 ensuite.
          if (weekNumber > 1 && weeksSinceStart < weekNumber) {
            return {
              accessible: false,
              weeksRemaining: weekNumber - weeksSinceStart,
              currentWeek: weeksSinceStart + 1,
            };
          }
          return {accessible: true, currentWeek: weeksSinceStart + 1};
        }

        return {accessible: true};
      }

      // 2. Cas : contenu spécifique demandé
      if (contentId) {
        const contentDoc = await db.collection('protectedContent').doc(contentId).get();

        if (!contentDoc.exists) {
          return {
            success: false,
            error: 'Le contenu demandé n\'existe pas ou n\'est plus disponible.',
            errorCode: 'CONTENT_NOT_FOUND',
            suggestion: 'Essayez d\'accéder au contenu depuis la page principale de votre formation.',
          };
        }

        const contentData = contentDoc.data();
        const contentProduct = contentData.product;
        const userProductData = userProducts.find((p) => p.name === contentProduct);

        if (!userProductData) {
          return {
            success: false,
            error: 'Vous n\'avez pas accès à ce contenu. Ce contenu fait partie d\'une autre formation que celle à laquelle vous êtes inscrit(e).',
            errorCode: 'PRODUCT_MISMATCH',
            suggestion: 'Accédez au contenu depuis votre espace membre.',
          };
        }

        const access = checkProgressiveAccess(contentProduct, contentData, userProductData);
        if (!access.accessible) {
          if (contentProduct === '21jours' && access.daysRemaining !== undefined) {
            return {
              success: false,
              error: `Ce contenu sera disponible dans ${access.daysRemaining} jour${access.daysRemaining > 1 ? 's' : ''}. Vous êtes actuellement au jour ${access.currentDay} du défi de 21 jours.`,
              errorCode: 'CONTENT_NOT_AVAILABLE_YET',
              suggestion: 'Continuez à suivre le programme jour par jour. Le contenu se débloque automatiquement chaque jour.',
              daysRemaining: access.daysRemaining,
              currentDay: access.currentDay,
            };
          }
          return {
            success: false,
            error: `Ce contenu sera disponible dans ${access.weeksRemaining} semaine${access.weeksRemaining > 1 ? 's' : ''}. Vous êtes actuellement à la semaine ${access.currentWeek}.`,
            errorCode: 'CONTENT_NOT_AVAILABLE_YET',
            suggestion: 'Continuez à suivre le programme semaine par semaine. Le contenu se débloque automatiquement chaque semaine.',
            weeksRemaining: access.weeksRemaining,
            currentWeek: access.currentWeek,
          };
        }

        const result = {
          success: true,
          content: contentData.content || '',
          product: userProduct,
          // Produit réel du contenu (utilisé côté client pour le cache et l'affichage)
          contentProduct: contentProduct,
          title: contentData.title || '',
          day: contentData.day,
          commentText: contentData.commentText || null,
        };

        if (userProduct !== '21jours') {
          result.metadata = {
            createdAt: contentData.createdAt || null,
            updatedAt: contentData.updatedAt || null,
          };
        }

        return result;
      }

      // 3. Cas : liste des contenus de tous les produits de l'utilisateur
      try {
        const productsData = [];

        for (const userProductData of userProducts) {
          const productName = userProductData.name;
          const startDate = userProductData.startDate && typeof userProductData.startDate.toDate === 'function' ?
            userProductData.startDate.toDate() :
            (userProductData.startDate instanceof Date ? userProductData.startDate : now);

          let query = db.collection('protectedContent').where('product', '==', productName);

          if (productName === '21jours') {
            query = query.orderBy('day', 'asc');
          } else if (productName === 'complet') {
            query = query.orderBy('week', 'asc');
          } else {
            query = query.orderBy('createdAt', 'desc');
          }

          let contentsSnapshot;
          try {
            contentsSnapshot = await query.get();
          } catch (indexError) {
            // Si l'index est en cours de construction, essayer sans orderBy
            if (indexError.code === 'failed-precondition') {
              contentsSnapshot = await db.collection('protectedContent')
                  .where('product', '==', productName)
                  .get();
            } else {
              throw indexError;
            }
          }

          const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
          const weeksSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24 * 7));
          const contents = [];

          contentsSnapshot.forEach((doc) => {
            const data = doc.data();
            const dayNumber = data.day;
            const weekNumber = data.week;
            const access = checkProgressiveAccess(productName, data, userProductData);

            const contentObj = {
              id: doc.id,
              title: data.title || doc.id,
              content: data.content || '',
              type: data.type || null,
              day: dayNumber,
              week: weekNumber,
              commentText: data.commentText || null,
              isAccessible: access.accessible,
              daysRemaining: access.daysRemaining || null,
              weeksRemaining: access.weeksRemaining || null,
            };

            // Pour les autres produits, ajouter createdAt/updatedAt pour le tri
            if (productName !== '21jours' && productName !== 'complet') {
              contentObj.createdAt = data.createdAt || null;
              contentObj.updatedAt = data.updatedAt || null;
            }

            contents.push(contentObj);
          });

          productsData.push({
            name: productName,
            startDate: startDate.toISOString(),
            contents: contents,
            daysSinceStart: productName === '21jours' ? daysSinceStart : null,
            weeksSinceStart: productName === 'complet' ? weeksSinceStart : null,
          });
        }

        return {
          success: true,
          products: productsData,
          product: userProduct,
          daysSinceRegistration: productsData.find((p) => p.name === '21jours')?.daysSinceStart || null,
        };
      } catch (error) {
        console.error('Error loading protected content list:', error);
        if (error.code === 'failed-precondition' ||
            (error.message && error.message.includes('index is currently building'))) {
          return {
            success: false,
            error: 'Le système est en cours de mise à jour. Veuillez réessayer dans quelques minutes.',
            errorCode: 'INDEX_BUILDING',
            suggestion: 'Cette opération est temporaire. Attendez 2-3 minutes et rafraîchissez la page.',
          };
        }
        throw new HttpsError('internal', 'Erreur lors du chargement du contenu : ' + error.message);
      }
    },
);

/**
 * Crée ou répare le document Firestore pour un utilisateur existant dans Firebase Auth
 * Utile si l'utilisateur existe dans Auth mais pas dans Firestore
 * Région : europe-west1
 */
exports.repairUserDocument = onCall(
    {
      region: 'europe-west1',
      cors: true,
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
    },
    async (request) => {
      const {email, product = null} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      try {
        const normalizedEmail = email.toLowerCase().trim();

        // 🔒 Sécurité : l'appelant doit être authentifié et ne peut réparer
        // QUE son propre compte. Les admins (claim custom `admin: true`)
        // peuvent réparer n'importe quel compte et spécifier un produit.
        const callerUid = request.auth && request.auth.uid;
        if (!callerUid) {
          throw new HttpsError('unauthenticated', 'Authentification requise');
        }
        const isAdmin = !!(request.auth.token && request.auth.token.admin);

        const adminAuth = getAuth();

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

        // Seul le propriétaire du compte (ou un admin) peut réparer ce document
        if (!isAdmin && userRecord.uid !== callerUid) {
          throw new HttpsError('permission-denied',
              'Vous ne pouvez réparer que votre propre compte.');
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
        if (isAdmin && product) {
        // Seul un admin peut spécifier un produit. Pour un utilisateur
        // régulier, le produit est TOUJOURS détecté depuis Mailjet afin
        // d'empêcher l'auto-octroi d'accès payant (produits payants).
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
        const now = FieldValue.serverTimestamp();
        const productsArray = detectedProducts.map((prod) => {
          // 🚀 Défi 21 jours : démarre au premier accès à la formation
          if (prod === '21jours') {
            return {name: prod, startDate: null, purchasedAt: now, started: false};
          }
          return {name: prod, startDate: now, purchasedAt: now};
        });

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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
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
      let emails;
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
      secrets: [
        'MAILJET_API_KEY',
        'MAILJET_API_SECRET',
        'TURNSTILE_SECRET_KEY',
        'ADMIN_EMAIL',
      ],
      cors: true, // Autoriser CORS pour toutes les origines
    },
    async (request) => {
      const {email, name, turnstileToken, locale = 'fr'} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      // 🔒 Anti-spam : rate limiting par IP et par email
      const clientIp = getClientIp(request.rawRequest);
      const ipLimit = await checkRateLimit(`ip:${clientIp}`, 'subscribeNewsletter', 10, 3600);
      if (ipLimit.limited) {
        throw new HttpsError('resource-exhausted',
            `Trop de demandes. Réessayez dans ${ipLimit.retryAfterSeconds} s.`);
      }
      const emailLimit = await checkRateLimit(email.toLowerCase().trim(), 'subscribeNewsletter', 3, 3600);
      if (emailLimit.limited) {
        throw new HttpsError('resource-exhausted',
            'Trop de demandes pour cette adresse. Réessayez plus tard.');
      }

      // 🔒 Turnstile : vérification OBLIGATOIRE pour toute requête publique.
      // Les anciens paramètres client isLocalhost / turnstileSkipped permettaient
      // de contourner la protection anti-bot : ils sont supprimés. Le statut
      // localhost est désormais déterminé côté serveur (IP privée).
      const isLocal = isPrivateIp(clientIp);
      if (!isLocal) {
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
        if (!turnstileSecret) {
          // Fail-closed : ne jamais accepter une inscription sans protection
          throw new HttpsError('failed-precondition', 'Bot protection is not configured');
        }
        if (!turnstileToken) {
          throw new HttpsError('invalid-argument', 'Turnstile verification required');
        }
        try {
          // Valider le token avec Cloudflare Turnstile
          const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstileToken,
              remoteip: clientIp,
            }),
          });

          const turnstileResult = await turnstileResponse.json();

          if (!turnstileResult.success) {
            console.error('Turnstile verification failed:', turnstileResult);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }

          // 🔒 Bonnes pratiques 2026 : vérifier l'action (lier le token au
          // formulaire) et le hostname (domaine de rendu du widget).
          if (turnstileResult.action !== 'newsletter-subscribe') {
            console.error('Turnstile action mismatch:', turnstileResult.action);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }
          const verifiedHostname = String(turnstileResult.hostname || '').toLowerCase();
          if (!ALLOWED_TURNSTILE_HOSTNAMES.includes(verifiedHostname)) {
            console.error('Turnstile hostname mismatch:', verifiedHostname);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }
        } catch (error) {
          if (error instanceof HttpsError) {
            throw error;
          }
          console.error('Error verifying Turnstile token:', error);
          throw new HttpsError('internal', 'Error verifying bot protection');
        }
      } else {
        console.log('Skipping Turnstile verification for local/private IP:', clientIp);
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
          createdAt: FieldValue.serverTimestamp(),
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
              'fluance@actu.fluance.io',
              'Cédric de Fluance',
          );

          emailSent = true;
          console.log(`✅ Confirmation email sent successfully to ${contactData.Email}`);
        } catch (err) {
          emailError = `Exception: ${err.message}`;
          console.error('Exception sending confirmation email:', emailError);
          console.error('Stack trace:', err.stack);
        }

        // Envoyer une notification admin pour le nouvel opt-in
        try {
          await sendOptInNotification(
              contactData.Email,
              name || '',
              '2pratiques',
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );
        } catch (notifError) {
          console.error('Error sending opt-in admin notification (2pratiques):', notifError);
        // Ne pas faire échouer l'opt-in si la notification échoue
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
 * Inscription à la liste d'attente pour les prochains stages
 * Cette fonction est publique (pas besoin d'authentification admin)
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.subscribeToStagesWaitingList = onCall(
    {
      region: 'europe-west1',
      secrets: [
        'MAILJET_API_KEY',
        'MAILJET_API_SECRET',
        'TURNSTILE_SECRET_KEY',
        'ADMIN_EMAIL',
      ],
      cors: true, // Autoriser CORS pour toutes les origines
    },
    async (request) => {
      const {email, name, region, turnstileToken, locale = 'fr'} = request.data;

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

      // 🔒 Anti-spam : rate limiting par IP et par email
      const clientIp = getClientIp(request.rawRequest);
      const ipLimit = await checkRateLimit(`ip:${clientIp}`, 'subscribeStagesWaitlist', 10, 3600);
      if (ipLimit.limited) {
        throw new HttpsError('resource-exhausted',
            `Trop de demandes. Réessayez dans ${ipLimit.retryAfterSeconds} s.`);
      }
      const emailLimit = await checkRateLimit(email.toLowerCase().trim(), 'subscribeStagesWaitlist', 3, 3600);
      if (emailLimit.limited) {
        throw new HttpsError('resource-exhausted',
            'Trop de demandes pour cette adresse. Réessayez plus tard.');
      }

      // 🔒 Turnstile : vérification OBLIGATOIRE pour toute requête publique.
      // Les anciens paramètres client isLocalhost / turnstileSkipped permettaient
      // de contourner la protection anti-bot : ils sont supprimés.
      const isLocal = isPrivateIp(clientIp);
      if (!isLocal) {
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
        if (!turnstileSecret) {
          throw new HttpsError('failed-precondition', 'Bot protection is not configured');
        }
        if (!turnstileToken) {
          throw new HttpsError('invalid-argument', 'Turnstile verification required');
        }
        try {
          // Valider le token avec Cloudflare Turnstile
          const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstileToken,
              remoteip: clientIp,
            }),
          });

          const turnstileResult = await turnstileResponse.json();

          if (!turnstileResult.success) {
            console.error('Turnstile verification failed:', turnstileResult);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }

          // 🔒 Bonnes pratiques 2026 : vérifier l'action et le hostname.
          if (turnstileResult.action !== 'stages-waitlist') {
            console.error('Turnstile action mismatch:', turnstileResult.action);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }
          const verifiedHostname = String(turnstileResult.hostname || '').toLowerCase();
          if (!ALLOWED_TURNSTILE_HOSTNAMES.includes(verifiedHostname)) {
            console.error('Turnstile hostname mismatch:', verifiedHostname);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }
        } catch (error) {
          if (error instanceof HttpsError) {
            throw error;
          }
          console.error('Error verifying Turnstile token:', error);
          throw new HttpsError('internal', 'Error verifying bot protection');
        }
      } else {
        console.log('Skipping Turnstile verification for local/private IP:', clientIp);
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
          createdAt: FieldValue.serverTimestamp(),
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
        const confirmationUrl = `${baseUrl}/confirm?email=${encodeURIComponent(contactData.Email)}` +
        `&token=${confirmationToken}&redirect=stages`;

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
          `Pour finaliser votre inscription et être informé(e) en priorité dès que les prochains ` +
          `stages seront annoncés, il vous suffit de confirmer votre adresse email en cliquant ` +
          `sur ce lien :\n\n` +
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
              'fluance@actu.fluance.io',
              'Cédric de Fluance',
          );

          emailSent = true;
          console.log(`✅ Confirmation email sent successfully to ${contactData.Email}`);
        } catch (err) {
          emailError = `Exception: ${err.message}`;
          console.error('Exception sending confirmation email:', emailError);
          console.error('Stack trace:', err.stack);
        }

        // Envoyer notification admin pour inscription liste d'attente stages
        try {
          if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
            await sendStagesWaitlistNotificationAdmin(
                contactData.Email,
                name || '',
                region || '',
                locale,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );
          }
        } catch (notifError) {
          console.error('Error sending stages waitlist admin notification:', notifError);
        // Ne pas bloquer le processus
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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
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
          throw new HttpsError(
              'deadline-exceeded',
              'Ce lien de confirmation a expiré. Votre réservation reste inchangée. Demandez simplement un nouveau lien.',
          );
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
          confirmedAt: FieldValue.serverTimestamp(),
        });

        if (tokenData.siteSource || tokenData.blogSource || tokenData.formulaireSource) {
          await blogLeadHub.helpers.logLeadEvent('optin_confirmed', {
            site_source: tokenData.siteSource || '',
            blog_source: tokenData.blogSource || '',
            formulaire_source: tokenData.formulaireSource || '',
            email,
            token_id: token,
          });
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

        // Mise à jour générique pour tous les opt-ins centralisés
        if (tokenData.siteSource || tokenData.blogSource || tokenData.formulaireSource) {
          try {
            const reminderCount = Array.isArray(tokenData.rappelStagesEnvoyes) ?
              tokenData.rappelStagesEnvoyes.length :
              (tokenData.nombreRelancesDoi || 0);

            const currentSourceOptin = currentProperties.source_optin || '';
            const sourceOptinListBase = currentSourceOptin ?
              currentSourceOptin.split(',').map((s) => s.trim()).filter((s) => s) :
              [];
            const sourceOptinList = tokenData.sourceOptin &&
              !sourceOptinListBase.includes(tokenData.sourceOptin) ?
                [...sourceOptinListBase, tokenData.sourceOptin] :
                sourceOptinListBase;

            const genericProperties = {
              site_source: tokenData.siteSource || currentProperties.site_source || '',
              blog_source: tokenData.blogSource || currentProperties.blog_source || '',
              formulaire_source: tokenData.formulaireSource || currentProperties.formulaire_source || '',
              url_source: tokenData.urlSource || currentProperties.url_source || '',
              type_optin: 'newsletter',
              statut_consentement: 'consenti',
              date_consentement: dateStr,
              statut_double_optin: 'confirme',
              date_double_optin: dateStr,
              nombre_relances_doi: String(reminderCount),
              langue_source: tokenData.locale || currentProperties.langue_source || 'fr',
              lead_magnet_source:
                tokenData.leadMagnetSource || currentProperties.lead_magnet_source || '',
              interets_declares:
                currentProperties.interets_declares ||
                (tokenData.siteSource ?
                  (blogLeadHub.helpers.SITE_CONFIGS[tokenData.siteSource]?.interestLabel || '') :
                  ''),
              statut: currentProperties.statut || 'prospect',
              est_client: currentProperties.est_client || 'False',
            };

            if (sourceOptinList.length > 0) {
              genericProperties.source_optin = sourceOptinList.join(',');
            }

            if (tokenData.name) {
              genericProperties.prenom = capitalizeName(tokenData.name);
              genericProperties.firstname = capitalizeName(tokenData.name);
            }

            if (!currentProperties.date_optin) {
              genericProperties.date_optin = dateStr;
            }

            await updateMailjetContactProperties(
                email.toLowerCase().trim(),
                genericProperties,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );
          } catch (error) {
            console.error('Error updating generic blog opt-in properties:', error);
          }
        }

        // Si c'est une confirmation pour les 5 jours, mettre à jour le statut de la série
        if (tokenData.sourceOptin === '5joursofferts') {
          try {
            // Nouvelle série si aucune n'est en cours : on réinitialise
            // serie_5jours_debut uniquement quand la précédente est terminée
            // (jours 1 à 5), pour permettre de suivre le parcours plusieurs fois
            // sans chevauchement.
            const serieUpdate = computeSerie5joursProperties(currentProperties, dateStr);
            if (Object.keys(serieUpdate).length > 0) {
              await updateMailjetContactProperties(
                  email.toLowerCase().trim(),
                  serieUpdate,
                  process.env.MAILJET_API_KEY,
                  process.env.MAILJET_API_SECRET,
              );
              console.log(`Updated serie_5jours properties for ${email}:`, serieUpdate);
            } else {
              console.log(`Serie 5jours déjà en cours pour ${email}, pas de réinitialisation`);
            }
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

        // Gérer la confirmation pour les inscriptions aux cours en présentiel
        if (tokenData.sourceOptin === 'presentiel') {
          try {
          // Valider et normaliser la langue
            const langue = 'fr'; // Présentiel uniquement en français pour l'instant

            // Vérifier s'il y a une réservation en attente liée à cette confirmation
            if (tokenData.bookingId) {
              try {
                const bookingDoc = await db.collection('bookings').doc(tokenData.bookingId).get();
                if (bookingDoc.exists) {
                  const booking = bookingDoc.data();
                  const courseDoc = await db.collection('courses').doc(booking.courseId).get();
                  const course = courseDoc.exists ? courseDoc.data() : null;
                  if (!booking.bookingConfirmationEmailSent) {
                    await sendBookingConfirmationEmail(
                        db,
                        tokenData.bookingId,
                        booking,
                        course,
                    );
                    console.log(`📧 Course confirmation email sent to ${email} after opt-in confirmation`);
                  }
                }
              } catch (bookingError) {
                console.error('Error sending course confirmation email:', bookingError);
              // Ne pas bloquer la confirmation si l'email échoue
              }
            }

            // Compter le nombre de cours pour ce contact
            const courseCountQuery = await db.collection('presentielRegistrations')
                .where('email', '==', email.toLowerCase().trim())
                .get();
            const nombreCours = courseCountQuery.size;

            // Récupérer les dates des cours
            let premierCours = null;
            let dernierCours = null;
            if (nombreCours > 0) {
              const allCourses = courseCountQuery.docs
                  .map((doc) => doc.data())
                  .filter((d) => d.courseDate)
                  .sort((a, b) => {
                    const dateA = a.courseDate.split('/').reverse().join('-');
                    const dateB = b.courseDate.split('/').reverse().join('-');
                    return dateA.localeCompare(dateB);
                  });
              if (allCourses.length > 0) {
                premierCours = allCourses[0].courseDate;
                dernierCours = allCourses[allCourses.length - 1].courseDate;
              }
            }

            const properties = {
              inscrit_presentiel: 'True',
              nombre_cours_presentiel: nombreCours.toString(),
              langue: langue,
            };

            if (premierCours) {
              properties.premier_cours_presentiel = premierCours;
            }
            if (dernierCours) {
              properties.dernier_cours_presentiel = dernierCours;
            }

            // Ajouter 'presentiel' à source_optin
            const currentSourceOptin = currentProperties.source_optin || '';
            const sourceOptinListBase = currentSourceOptin ?
            currentSourceOptin.split(',').map((s) => s.trim()).filter((s) => s) : [];
            const sourceOptinList = sourceOptinListBase.includes('presentiel') ?
            sourceOptinListBase :
            [...sourceOptinListBase, 'presentiel'];

            properties.source_optin = sourceOptinList.join(',');

            // Définir le statut comme prospect si pas déjà client
            if (!currentProperties.statut || currentProperties.statut === 'prospect') {
              properties.statut = 'prospect';
            }

            // Définir date_optin si pas déjà définie
            if (!currentProperties.date_optin) {
              properties.date_optin = dateStr;
            }

            // Définir est_client si pas déjà défini
            if (!currentProperties.est_client) {
              properties.est_client = 'False';
            }

            await updateMailjetContactProperties(
                email.toLowerCase().trim(),
                properties,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );
            console.log('📋 MailJet contact properties update completed for confirmed presentiel:', email);
          } catch (error) {
            console.error('Error updating presentiel properties:', error);
          // Ne pas faire échouer la confirmation si la mise à jour des propriétés échoue
          }
        }

        return {
          success: true,
          message: 'Email confirmed successfully',
          email: email,
          sourceOptin: tokenData.sourceOptin || null,
          redirectUrl: tokenData.redirectUrl || null,
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
      secrets: [
        'MAILJET_API_KEY',
        'MAILJET_API_SECRET',
        'TURNSTILE_SECRET_KEY',
        'ADMIN_EMAIL',
      ],
      cors: true,
    },
    async (request) => {
      const {email, name, turnstileToken, locale = 'fr'} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      // 🔒 Anti-spam : rate limiting par IP et par email
      const clientIp = getClientIp(request.rawRequest);
      const ipLimit = await checkRateLimit(`ip:${clientIp}`, 'subscribe5Days', 10, 3600);
      if (ipLimit.limited) {
        throw new HttpsError('resource-exhausted',
            `Trop de demandes. Réessayez dans ${ipLimit.retryAfterSeconds} s.`);
      }
      const emailLimit = await checkRateLimit(email.toLowerCase().trim(), 'subscribe5Days', 3, 3600);
      if (emailLimit.limited) {
        throw new HttpsError('resource-exhausted',
            'Trop de demandes pour cette adresse. Réessayez plus tard.');
      }

      // 🔒 Turnstile : vérification OBLIGATOIRE pour toute requête publique.
      // Le paramètre client isLocalhost permettait de contourner la protection :
      // le statut localhost est désormais déterminé côté serveur (IP privée).
      const isLocal = isPrivateIp(clientIp);
      if (!isLocal) {
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
        if (!turnstileSecret) {
          throw new HttpsError('failed-precondition', 'Bot protection is not configured');
        }
        if (!turnstileToken) {
          throw new HttpsError('invalid-argument', 'Turnstile verification required');
        }
        try {
          const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstileToken,
              remoteip: clientIp,
            }),
          });

          const turnstileResult = await turnstileResponse.json();

          if (!turnstileResult.success) {
            console.error('Turnstile verification failed:', turnstileResult);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }

          // 🔒 Bonnes pratiques 2026 : vérifier l'action et le hostname.
          if (turnstileResult.action !== 'newsletter-5jours') {
            console.error('Turnstile action mismatch:', turnstileResult.action);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }
          const verifiedHostname = String(turnstileResult.hostname || '').toLowerCase();
          if (!ALLOWED_TURNSTILE_HOSTNAMES.includes(verifiedHostname)) {
            console.error('Turnstile hostname mismatch:', verifiedHostname);
            throw new HttpsError('permission-denied', 'Bot verification failed. Please try again.');
          }
        } catch (error) {
          if (error instanceof HttpsError) {
            throw error;
          }
          console.error('Error verifying Turnstile token:', error);
          throw new HttpsError('internal', 'Error verifying bot protection');
        }
      } else {
        console.log('Skipping Turnstile verification for local/private IP:', clientIp);
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
          createdAt: FieldValue.serverTimestamp(),
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
        // Une nouvelle série ne démarre que si la précédente est terminée
        // (jours 1 à 5 = en cours → pas de réinitialisation, pas de chevauchement).
        Object.assign(properties, computeSerie5joursProperties(currentProperties, dateStr));

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
              'fluance@actu.fluance.io',
              'Cédric de Fluance',
          );

          emailSent = true;
          console.log(`✅ Confirmation email sent successfully to ${contactData.Email}`);
        } catch (err) {
          emailError = `Exception: ${err.message}`;
          console.error('Exception sending confirmation email:', emailError);
          console.error('Stack trace:', err.stack);
        }

        // Envoyer une notification admin pour le nouvel opt-in
        try {
          await sendOptInNotification(
              contactData.Email,
              name || '',
              '5joursofferts',
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );
        } catch (notifError) {
          console.error('Error sending opt-in admin notification (5joursofferts):', notifError);
        // Ne pas faire échouer l'opt-in si la notification échoue
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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      cors: true,
    },
    async (request) => {
      const {email} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      // 🔒 Anti-bombardement : rate limiting par IP et par email
      const clientIp = getClientIp(request.rawRequest);
      const ipLimit = await checkRateLimit(`ip:${clientIp}`, 'passwordReset', 10, 3600);
      if (ipLimit.limited) {
        throw new HttpsError('resource-exhausted',
            `Trop de demandes. Réessayez dans ${ipLimit.retryAfterSeconds} s.`);
      }
      const emailLimit = await checkRateLimit(email.toLowerCase().trim(), 'passwordReset', 3, 3600);
      if (emailLimit.limited) {
        throw new HttpsError('resource-exhausted',
            'Trop de demandes pour cette adresse. Réessayez plus tard.');
      }

      try {
        const normalizedEmail = email.toLowerCase().trim();
        const adminAuth = getAuth();

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
          `${ADMIN_EMAIL}.\n\n` +
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
          createdAt: FieldValue.serverTimestamp(),
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
        const adminAuth = getAuth();
        const userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.updateUser(userRecord.uid, {password: newPassword});

        // Marquer le token comme utilisé
        await db.collection('passwordResetTokens').doc(token).update({
          used: true,
          usedAt: FieldValue.serverTimestamp(),
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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL', 'WEB_API_KEY'],
      cors: true,
    },
    async (request) => {
      const {email} = request.data;

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      const normalizedEmail = email.toLowerCase().trim();

      try {
      // Utiliser getAuth() directement pour éviter les problèmes d'initialisation
        const adminAuth = getAuth();

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
          `${ADMIN_EMAIL}.\n\n` +
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
        const generatedLink = await adminAuth.generateSignInWithEmailLink(
            normalizedEmail,
            {
              url: 'https://fluance.io/connexion-membre',
              handleCodeInApp: true,
            },
        );

        // Patch : Remplacer la clé API potentiellement incorrecte/expirée par la nouvelle
        // L'Admin SDK utilise la clé du projet GCP par défaut, qui peut être l'ancienne
        const signInLink = generatedLink.replace(/apiKey=[^&]+/, `apiKey=${process.env.WEB_API_KEY}`);

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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
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

          if (userData.isDemo === true) {
            console.log(`⏭️ Demo user ${email} (${userId}) skipped`);
            emailsSkipped++;
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
            try {
              console.log(`🔄 Migrating user ${userId} from old format`);
              // ⚠️ Ne PAS passer un Timestamp Firestore directement à
              // Timestamp.fromDate() : cela plante avec
              // « date.getTime is not a function » et faisait échouer toute la
              // fonction quotidienne (bug 2025-12 → 2026-08).
              const startDate = toJsDate(userData.registrationDate) ||
                toJsDate(userData.createdAt) ||
                new Date();
              const purchasedAt = toJsDate(userData.createdAt) || startDate;
              products.push({
                name: userData.product,
                startDate: Timestamp.fromDate(startDate),
                purchasedAt: Timestamp.fromDate(purchasedAt),
              });
              // Persister la migration (idempotent) pour ne plus repasser par ce chemin.
              await userDoc.ref.update({
                products,
                updatedAt: FieldValue.serverTimestamp(),
              });
              console.log(`✅ User ${userId} migrated from old format and persisted`);
            } catch (migrationError) {
              // Un utilisateur corrompu ne doit jamais bloquer toute la séquence.
              console.error(`❌ Migration error for user ${userId}:`, migrationError);
              errors++;
            }
          }

          // Traiter chaque produit de l'utilisateur
          for (const product of products) {
            if (!product.name || !product.startDate) {
              console.warn(`⚠️ User ${userId} has invalid product data:`, product);
              continue;
            }

            const productName = product.name;
            const startDate = typeof product.startDate.toDate === 'function' ?
              product.startDate.toDate() :
              toJsDate(product.startDate);
            if (!startDate || isNaN(startDate.getTime())) {
              console.warn(`⚠️ User ${userId} product ${productName} has invalid startDate, skipping`);
              continue;
            }
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
                    sentAt: FieldValue.serverTimestamp(),
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
                        sentAt: FieldValue.serverTimestamp(),
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
                    sentAt: FieldValue.serverTimestamp(),
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
                      sentAt: FieldValue.serverTimestamp(),
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
                        sentAt: FieldValue.serverTimestamp(),
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
                          sentAt: FieldValue.serverTimestamp(),
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
                        sentAt: FieldValue.serverTimestamp(),
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
                          sentAt: FieldValue.serverTimestamp(),
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
                  '<a href="https://fluance.io/#reseaux-sociaux">cette page</a>.</p>' +
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
                    sentAt: FieldValue.serverTimestamp(),
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
                      '<a href="https://fluance.io/#reseaux-sociaux">cette page</a>.</p>' +
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
                        sentAt: FieldValue.serverTimestamp(),
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

        // Alerte admin en cas d'erreurs (ex: un utilisateur corrompu) pour ne
        // plus laisser une séquence silencieusement cassée pendant des mois.
        if (errors > 0) {
          try {
            await sendAdminAlert(
                {
                  subject: 'Séquence emails Fluance : erreurs lors de l\'exécution',
                  message: `La séquence quotidienne s'est terminée avec des erreurs.\n\n` +
                    `Emails envoyés (clients) : ${emailsSent}\n` +
                    `Emails marketing : ${marketingEmailsSent}\n` +
                    `Emails réseaux sociaux : ${socialEmailsSent}\n` +
                    `Emails ignorés : ${emailsSkipped + marketingEmailsSkipped}\n` +
                    `Erreurs : ${errors}\n\n` +
                    `Consultez les logs Cloud Functions pour le détail.`,
                  severity: 'high',
                  metadata: {emailsSent, marketingEmailsSent, socialEmailsSent, errors},
                },
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );
          } catch (alertError) {
            console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', alertError.message);
          }
        }

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

        // Alerte admin critique : la séquence ne doit plus jamais échouer en silence.
        try {
          await sendAdminAlert(
              {
                subject: '🚨 Échec critique : séquence emails Fluance',
                message: `La fonction sendNewContentEmails a échoué.\n\n` +
                  `Erreur : ${error.message}\n\n` +
                  `Consultez les logs Cloud Functions.`,
                severity: 'critical',
                metadata: {error: error.message, stack: error.stack},
              },
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );
        } catch (alertError) {
          console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', alertError.message);
        }

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
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      region: 'europe-west1',
    },
    async (_event) => {
      console.log('🔍 Starting scheduled job for pending subscription suspensions');
      const now = Timestamp.now();
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
              suspendedAt: FieldValue.serverTimestamp(),
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
                'fluance@actu.fluance.io',
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

const {
  buildBlogOpsSummaries,
  ensureBlogSummary,
  resolvePendingDigestSummary,
  applyLeadEventToSummary,
  applyContactFormToSummary,
  buildOpsFooterLinks,
  formatOpsDigestHtml,
  formatOpsDigestText,
  formatOpsAlertHtml,
  formatOpsAlertText,
} = require('./blogOpsReporting');

const BLOG_OPS_ALERT_COLLECTION = 'journal_alertes_ops';
const BLOG_OPS_DIGEST_COLLECTION = 'digest_ops_history';
const BLOG_OPS_SITE_IDS = Object.keys(blogLeadHub.helpers.SITE_CONFIGS || {});

async function sendBlogOpsAlert({alertType, siteSource = 'global', windowStart, windowEnd, count, lines, mailjetApiKey, mailjetApiSecret}) {
  const windowKey = windowStart.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const alertId = `${alertType}__${siteSource}__${windowKey}`;
  const alertRef = db.collection(BLOG_OPS_ALERT_COLLECTION).doc(alertId);
  const existing = await alertRef.get();
  if (existing.exists) {
    return false;
  }

  const siteLabel = blogLeadHub.helpers.SITE_CONFIGS[siteSource]?.siteLabel || siteSource;
  const title = `Alerte ops blogs - ${siteLabel} - ${alertType}`;
  const footerLinks = buildOpsFooterLinks('sendBlogLeadOpsAlerts');

  await sendMailjetEmail(
      ADMIN_EMAIL,
      title,
      formatOpsAlertHtml({title, lines, footerLinks}),
      formatOpsAlertText({title, lines, footerLinks}),
      mailjetApiKey,
      mailjetApiSecret,
      'support@actu.fluance.io',
      'Support de Fluance',
  );

  await alertRef.set({
    alert_type: alertType,
    site_source: siteSource,
    count,
    lines,
    window_start: Timestamp.fromDate(windowStart),
    window_end: Timestamp.fromDate(windowEnd),
    sent_at: FieldValue.serverTimestamp(),
  });

  return true;
}

/**
 * Collecte les statistiques ops des blogs sur une fenetre glissante.
 * Partagee entre le rapport quotidien des soucis et le digest mensuel.
 */
async function collectBlogOpsStats(now, windowDays) {
  const since = new Date(now.getTime() - (windowDays * 24 * 60 * 60 * 1000));
  const sinceTs = Timestamp.fromDate(since);
  const summaries = buildBlogOpsSummaries(blogLeadHub.helpers.SITE_CONFIGS || {});

  const [leadEventsSnapshot, contactSnapshot, pendingSnapshot] = await Promise.all([
    db.collection('journal_evenements_leads').where('createdAt', '>=', sinceTs).get(),
    db.collection('journal_formulaires_contact').where('createdAt', '>=', sinceTs).get(),
    db.collection('newsletterConfirmations').where('confirmed', '==', false).get(),
  ]);

  const criticalErrors = [];

  leadEventsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const summary = ensureBlogSummary(summaries, data.site_source, data.blog_source);
    applyLeadEventToSummary(data, summary, criticalErrors);
  });

  contactSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const summary = ensureBlogSummary(summaries, data.site_source, data.blog_source);
    applyContactFormToSummary(data, summary);
  });

  let pendingTotal = 0;
  pendingSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const expiresAt = data.expiresAt?.toDate?.();
    if (expiresAt && expiresAt > now) {
      const pendingSummary = resolvePendingDigestSummary(data);
      const summary = ensureBlogSummary(
          summaries,
          pendingSummary.siteId,
          pendingSummary.blogSource,
          pendingSummary.label,
      );
      summary.pending++;
      pendingTotal++;
    }
  });

  return {summaries, criticalErrors, pendingTotal};
}

/**
 * Verifications de fraicheur pour le digest mensuel:
 * - les rapports quotidiens ont-ils bien tourne sur la periode ?
 * - un site connu a-t-il recu zero opt-in alors que les autres en ont ?
 * Distingue "tout va bien" de "telemetrie cassée" pour eviter les faux negatifs.
 * Retourne une liste de messages d'avertissement a afficher dans le digest.
 */
async function buildOpsFreshnessWarnings(now, windowDays, summaries) {
  const warnings = [];
  const since = new Date(now.getTime() - (windowDays * 24 * 60 * 60 * 1000));

  let dailyReports = 0;
  try {
    const historySnapshot = await db.collection(BLOG_OPS_DIGEST_COLLECTION)
        .where('sent_at', '>=', Timestamp.fromDate(since))
        .get();
    historySnapshot.docs.forEach((doc) => {
      const type = doc.data().type;
      // Les traces d'avant le champ `type` etaient des rapports quotidiens
      if (!type || type === 'issue_report') {
        dailyReports++;
      }
    });
  } catch (error) {
    console.error('❌ Error reading digest history for freshness check:', error.message);
    warnings.push('Historique des rapports quotidiens illisible: telemetrie possiblement incomplete.');
    return warnings;
  }

  if (dailyReports < Math.floor(windowDays * 0.7)) {
    warnings.push(
        `Seulement ${dailyReports} rapports quotidiens sur ${windowDays} jours attendus: ` +
        'executions planifiees ou telemetrie possiblement incompletes.',
    );
  }

  const knownSummaries = Object.values(summaries)
      .filter((item) => BLOG_OPS_SITE_IDS.includes(item.siteId));
  const totalOptins = knownSummaries.reduce((sum, item) => sum + item.optins, 0);

  if (totalOptins === 0) {
    warnings.push(
        'Aucun opt-in capture sur l\'ensemble des blogs sur la periode: ' +
        'trafic anormalement bas ou capture cassee.',
    );
  } else {
    knownSummaries.forEach((item) => {
      if (item.optins === 0) {
        warnings.push(`${item.label}: aucun opt-in capture sur la periode alors que d'autres blogs en ont recu.`);
      }
    });
  }

  return warnings;
}

/**
 * Rapport quotidien des soucis (8h, Europe/Zurich).
 * N'envoie un e-mail QUE si des problemes critiques ont ete detectes
 * sur les dernieres 24h (echecs Mailjet, erreurs internes).
 * Aucun e-mail si tout fonctionne normalement.
 */
exports.sendBlogLeadsIssueReport = onSchedule(
    {
      schedule: '0 8 * * *',
      timeZone: 'Europe/Zurich',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      region: 'europe-west1',
    },
    async (_event) => {
      const now = new Date();
      const mailjetApiKey = process.env.MAILJET_API_KEY;
      const mailjetApiSecret = process.env.MAILJET_API_SECRET;

      const {summaries, criticalErrors, pendingTotal} = await collectBlogOpsStats(now, 1);

      const dateLabel = now.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Europe/Zurich',
      });

      const title = 'Soucis leads blogs (24h)';

      let sent = false;
      let sendError = null;
      if (criticalErrors.length === 0) {
        console.log('✅ No critical issues in the last 24h, skipping issue report email');
      } else {
        try {
          await sendMailjetEmail(
              ADMIN_EMAIL,
              `${title} - ${dateLabel}`,
              formatOpsDigestHtml({
                title,
                dateLabel,
                summaries,
                criticalErrors,
                pendingTotal,
                footerLinks: buildOpsFooterLinks('sendBlogLeadsIssueReport'),
              }),
              formatOpsDigestText({
                title,
                dateLabel,
                summaries,
                criticalErrors,
                pendingTotal,
                footerLinks: buildOpsFooterLinks('sendBlogLeadsIssueReport'),
              }),
              mailjetApiKey,
              mailjetApiSecret,
              'support@actu.fluance.io',
              'Support de Fluance',
          );
          sent = true;
        } catch (error) {
          sendError = error.message;
          console.error('❌ Failed to send issue report email:', error.message);
        }
      }

      // La trace est ecrite meme en cas d'echec d'envoi, pour garder une piste d'audit
      await db.collection(BLOG_OPS_DIGEST_COLLECTION).add({
        type: 'issue_report',
        sent,
        send_error: sendError,
        sent_at: FieldValue.serverTimestamp(),
        date_label: dateLabel,
        pending_total: pendingTotal,
        summaries,
        critical_errors: criticalErrors,
      });

      if (sendError) {
        throw new Error(`Issue report email could not be sent: ${sendError}`);
      }
    },
);

/**
 * Digest mensuel des leads blogs (8h le 1er de chaque mois, Europe/Zurich).
 * Resume complet des 30 derniers jours, envoye systematiquement.
 */
exports.sendBlogLeadsMonthlyDigest = onSchedule(
    {
      schedule: '0 8 1 * *',
      timeZone: 'Europe/Zurich',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      region: 'europe-west1',
    },
    async (_event) => {
      const now = new Date();
      const mailjetApiKey = process.env.MAILJET_API_KEY;
      const mailjetApiSecret = process.env.MAILJET_API_SECRET;

      const {summaries, criticalErrors, pendingTotal} = await collectBlogOpsStats(now, 30);

      // Controle de fraicheur: distinguer "rien a signaler" d'une telemetrie cassee
      const warnings = await buildOpsFreshnessWarnings(now, 30, summaries);

      const dateLabel = now.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Zurich',
      });

      const title = 'Digest mensuel leads blogs (30 derniers jours)';

      let sent = false;
      let sendError = null;
      try {
        await sendMailjetEmail(
            ADMIN_EMAIL,
            `${title} - ${dateLabel}`,
            formatOpsDigestHtml({
              title,
              dateLabel,
              summaries,
              criticalErrors,
              pendingTotal,
              warnings,
              introLabel: 'des 30 derniers jours',
              footerLinks: buildOpsFooterLinks('sendBlogLeadsMonthlyDigest'),
            }),
            formatOpsDigestText({
              title,
              dateLabel,
              summaries,
              criticalErrors,
              pendingTotal,
              warnings,
              footerLinks: buildOpsFooterLinks('sendBlogLeadsMonthlyDigest'),
            }),
            mailjetApiKey,
            mailjetApiSecret,
            'support@actu.fluance.io',
            'Support de Fluance',
        );
        sent = true;
      } catch (error) {
        sendError = error.message;
        console.error('❌ Failed to send monthly digest email:', error.message);
      }

      // La trace est ecrite meme en cas d'echec d'envoi, pour garder une piste d'audit
      await db.collection(BLOG_OPS_DIGEST_COLLECTION).add({
        type: 'monthly_digest',
        sent,
        send_error: sendError,
        sent_at: FieldValue.serverTimestamp(),
        date_label: dateLabel,
        pending_total: pendingTotal,
        summaries,
        critical_errors: criticalErrors,
        warnings,
      });

      if (sendError) {
        throw new Error(`Monthly digest email could not be sent: ${sendError}`);
      }
    },
);

/**
 * Purge quotidienne des journaux ops (04:30, Europe/Zurich).
 * Supprime par lots les documents au-dela de leur duree de retention
 * pour eviter une croissance non bornee des collections.
 *
 * Timeout volontairement a 300s (contre 60s par defaut): permet de rattraper
 * un stock de documents si la fonction n'a pas tourne pendant un temps.
 * L'execution s'arrete des que les collections sont propres (facturation
 * au temps reel uniquement). Voir docs/leads-architecture.md (Retention).
 */
exports.cleanupOpsJournals = onSchedule(
    {
      schedule: '30 4 * * *',
      timeZone: 'Europe/Zurich',
      secrets: [],
      region: 'europe-west1',
      timeoutSeconds: 300,
    },
    async (_event) => {
      const now = new Date();
      const retentionPolicies = [
        {collection: 'journal_evenements_leads', field: 'createdAt', days: 90},
        {collection: 'journal_formulaires_contact', field: 'createdAt', days: 180},
        {collection: 'journal_alertes_ops', field: 'sent_at', days: 180},
        {collection: 'digest_ops_history', field: 'sent_at', days: 365},
      ];

      for (const {collection, field, days} of retentionPolicies) {
        const cutoff = Timestamp.fromDate(new Date(now.getTime() - (days * 24 * 60 * 60 * 1000)));
        let deleted = 0;

        try {
          // Boucle par lots pour ne pas charger toute la collection en memoire
          let hasMore = true;
          while (hasMore) {
            const snapshot = await db.collection(collection)
                .where(field, '<', cutoff)
                .limit(400)
                .get();

            if (snapshot.empty) {
              hasMore = false;
              break;
            }

            const batch = db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            deleted += snapshot.size;
          }
          console.log(`🧹 ${collection}: ${deleted} document(s) purge(s) (>${days} jours, champ ${field})`);
        } catch (error) {
          console.error(`❌ Error purging ${collection}:`, error.message);
        }
      }
    },
);

exports.sendBlogLeadOpsAlerts = onSchedule(
    {
      schedule: '*/15 * * * *',
      timeZone: 'Europe/Zurich',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      region: 'europe-west1',
    },
    async (_event) => {
      const now = new Date();
      const since15m = new Date(now.getTime() - (15 * 60 * 1000));
      const since1h = new Date(now.getTime() - (60 * 60 * 1000));
      const mailjetApiKey = process.env.MAILJET_API_KEY;
      const mailjetApiSecret = process.env.MAILJET_API_SECRET;

      const [leadEvents15m, leadEvents1h, contacts1h] = await Promise.all([
        db.collection('journal_evenements_leads')
            .where('createdAt', '>=', Timestamp.fromDate(since15m))
            .get(),
        db.collection('journal_evenements_leads')
            .where('createdAt', '>=', Timestamp.fromDate(since1h))
            .get(),
        db.collection('journal_formulaires_contact')
            .where('createdAt', '>=', Timestamp.fromDate(since1h))
            .get(),
      ]);

      const serverErrorsBySite = {};
      const turnstileFailuresBySite = {};
      const mailjetFailures = [];

      leadEvents15m.docs.forEach((doc) => {
        const data = doc.data();
        const siteSource = data.site_source || 'global';
        if (['capture_lead_internal_error', 'send_contact_internal_error', 'doi_reminder_processing_error'].includes(data.type_evenement)) {
          serverErrorsBySite[siteSource] = (serverErrorsBySite[siteSource] || 0) + 1;
        }
        if (['mailjet_send_failed_optin', 'mailjet_send_failed_contact', 'mailjet_send_failed_doi_reminder'].includes(data.type_evenement)) {
          mailjetFailures.push(data);
        }
      });

      leadEvents1h.docs.forEach((doc) => {
        const data = doc.data();
        const siteSource = data.site_source || 'global';
        if (data.type_evenement === 'turnstile_failed_optin') {
          turnstileFailuresBySite[siteSource] = (turnstileFailuresBySite[siteSource] || 0) + 1;
        }
      });

      contacts1h.docs.forEach((doc) => {
        const data = doc.data();
        const siteSource = data.site_source || 'global';
        if (data.statut === 'echec_turnstile') {
          turnstileFailuresBySite[siteSource] = (turnstileFailuresBySite[siteSource] || 0) + 1;
        }
      });

      for (const [siteSource, count] of Object.entries(serverErrorsBySite)) {
        if (count >= 5) {
          await sendBlogOpsAlert({
            alertType: 'server-errors-15m',
            siteSource,
            windowStart: since15m,
            windowEnd: now,
            count,
            lines: [`${count} erreurs serveur sur les 15 dernieres minutes pour ${siteSource}.`],
            mailjetApiKey,
            mailjetApiSecret,
          });
        }
      }

      for (const [siteSource, count] of Object.entries(turnstileFailuresBySite)) {
        if (count > 10) {
          await sendBlogOpsAlert({
            alertType: 'turnstile-failures-1h',
            siteSource,
            windowStart: since1h,
            windowEnd: now,
            count,
            lines: [`${count} echecs Turnstile sur la derniere heure pour ${siteSource}.`],
            mailjetApiKey,
            mailjetApiSecret,
          });
        }
      }

      for (const failure of mailjetFailures) {
        await sendBlogOpsAlert({
          alertType: failure.type_evenement,
          siteSource: failure.site_source || 'global',
          windowStart: since15m,
          windowEnd: now,
          count: 1,
          lines: [
            `Echec Mailjet detecte pour ${failure.email || 'email inconnu'}.`,
            `Evenement: ${failure.type_evenement}.`,
            `Detail: ${failure.error_message || 'sans detail'}.`,
          ],
          mailjetApiKey,
          mailjetApiSecret,
        });
      }
    },
);

/**
 * Fonction scheduled pour envoyer des relances aux opt-ins non confirmés
 * S'exécute quotidiennement à 9h (Europe/Paris)
 * Envoie jusqu'à deux relances: J+1 puis J+5
 */
exports.sendOptInReminders = onSchedule(
    {
      schedule: '0 9 * * *', // Tous les jours à 9h
      timeZone: 'Europe/Paris',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
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
      // Récupérer tous les opt-ins non confirmés
        const unconfirmedQuery = await db.collection('newsletterConfirmations')
            .where('confirmed', '==', false)
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
            const sentStages = Array.isArray(tokenData.rappelStagesEnvoyes) ?
              tokenData.rappelStagesEnvoyes :
              [];
            const reminderStage = blogLeadHub.helpers.getReminderStage(daysSinceCreation, sentStages);
            if (!reminderStage) continue;

            const email = tokenData.email;
            const name = tokenData.name || '';
            const sourceOptin = tokenData.sourceOptin || '2pratiques';
            const siteConfig = tokenData.siteSource ?
              blogLeadHub.helpers.SITE_CONFIGS[tokenData.siteSource] :
              null;

            let confirmationUrl = tokenData.siteSource ?
              blogLeadHub.helpers.buildConfirmationUrl({
                id: tokenId,
                email,
              }) :
              `https://fluance.io/confirm?email=${encodeURIComponent(email)}&token=${tokenId}`;

            // Formater la date d'expiration pour l'email
            const expirationDateStr = blogLeadHub.helpers.formatExpirationDate(expiresAt);
            let emailSubject = `Un dernier clic pour recevoir vos contenus${name ? ' ' + name : ''}`;
            let emailHtml;
            let emailText;

            if (siteConfig) {
              emailSubject = `Rappel: confirmez votre adresse pour recevoir votre ressource${name ? `, ${name}` : ''}`;
              emailHtml = blogLeadHub.helpers.buildOptInEmailHtml(
                  siteConfig,
                  name,
                  confirmationUrl,
                  true,
                  expirationDateStr,
              );
              emailText = blogLeadHub.helpers.buildOptInEmailText(
                  siteConfig,
                  name,
                  confirmationUrl,
                  expirationDateStr,
              );
            } else {
              // Déterminer le contenu de l'opt-in pour le message
              let optinContent = 'vos contenus Fluance offerts';
              let redirectParam = '2pratiques';
              if (sourceOptin === '5joursofferts') {
                optinContent = 'vos 5 pratiques Fluance offertes';
                redirectParam = '5joursofferts';
              } else if (sourceOptin === '2pratiques') {
                optinContent = 'vos 2 pratiques Fluance offertes';
              }
              confirmationUrl =
                `https://fluance.io/confirm?email=${encodeURIComponent(email)}` +
                `&token=${tokenId}&redirect=${redirectParam}`;
              const inscriptionText = 'inscrit·e';
              emailHtml = loadEmailTemplate('relance-confirmation-optin', {
                firstName: name || '',
                inscriptionText: inscriptionText,
                optinContent: optinContent,
                confirmationUrl: confirmationUrl,
                expirationDate: expirationDateStr,
              });
              emailText = `Bonjour${name ? ' ' + name : ''},\n\n` +
                `Il y a quelques jours, vous vous êtes ${inscriptionText} ` +
                `pour recevoir ${optinContent} de Fluance.\n\n` +
                `Pour finaliser votre inscription et recevoir vos contenus, ` +
                `il vous suffit de confirmer votre adresse email en cliquant sur ce lien :\n\n` +
                `${confirmationUrl}\n\n` +
                `Ce lien est valide jusqu'au ${expirationDateStr}.\n\n` +
                `Si vous n'avez pas demandé cette inscription, vous pouvez ignorer cet email. ` +
                `Vous ne recevrez plus de relances.`;
            }

            await sendMailjetEmail(
                email,
                emailSubject,
                emailHtml,
                emailText,
                mailjetApiKey,
                mailjetApiSecret,
                blogLeadHub.helpers.NEWSLETTER_FROM_EMAIL,
                blogLeadHub.helpers.NEWSLETTER_FROM_NAME,
            ).catch(async (mailjetError) => {
              if (siteConfig) {
                await blogLeadHub.helpers.logLeadEvent('mailjet_send_failed_doi_reminder', {
                  site_source: tokenData.siteSource || '',
                  blog_source: tokenData.blogSource || '',
                  formulaire_source: tokenData.formulaireSource || '',
                  email,
                  token_id: tokenId,
                  stage_rappel: reminderStage,
                  error_message: (mailjetError.message || 'unknown').slice(0, 1000),
                });
              }
              throw mailjetError;
            });

            const updatedReminderStages = [...sentStages, reminderStage].sort((a, b) => a - b);

            // Marquer la relance comme envoyée
            await db.collection('newsletterConfirmations').doc(tokenId).update({
              reminderSent: true,
              reminderSentAt: FieldValue.serverTimestamp(),
              rappelStagesEnvoyes: updatedReminderStages,
              nombreRelancesDoi: updatedReminderStages.length,
            });

            if (siteConfig) {
              try {
                await updateMailjetContactProperties(
                    email.toLowerCase().trim(),
                    {
                      date_derniere_relance_doi: new Date().toISOString(),
                      nombre_relances_doi: String(updatedReminderStages.length),
                    },
                    process.env.MAILJET_API_KEY,
                    process.env.MAILJET_API_SECRET,
                );
              } catch (mailjetError) {
                console.error(`❌ Error updating Mailjet reminder properties for ${email}:`, mailjetError);
              }

              await blogLeadHub.helpers.logLeadEvent('doi_reminder_sent', {
                site_source: tokenData.siteSource || '',
                blog_source: tokenData.blogSource || '',
                formulaire_source: tokenData.formulaireSource || '',
                email,
                token_id: tokenId,
                stage_rappel: reminderStage,
              });
            }

            remindersSent++;
            console.log(
                `✅ Reminder sent to ${email} ` +
                `(${sourceOptin}, ${daysSinceCreation} days after signup, stage ${reminderStage})`,
            );
          } catch (error) {
            errors++;
            if (doc.data()?.siteSource || doc.data()?.blogSource || doc.data()?.formulaireSource) {
              await blogLeadHub.helpers.logLeadEvent('doi_reminder_processing_error', {
                site_source: doc.data().siteSource || '',
                blog_source: doc.data().blogSource || '',
                formulaire_source: doc.data().formulaireSource || '',
                email: doc.data().email || '',
                token_id: doc.id,
                error_message: (error.message || 'unknown').slice(0, 1000),
              });
            }
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


/**
 * Enregistre une inscription à un cours en présentiel (appelé par Google Apps Script)
 * Gère le double opt-in pour les nouveaux contacts et l'historique des inscriptions
 * Région : europe-west1 (Belgique)
 * Utilise les secrets Firebase pour Mailjet
 */
exports.registerPresentielCourse = onRequest(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'PRESENTIEL_API_KEY'],
      cors: true,
    },
    async (req, res) => {
    // Vérifier la méthode HTTP
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }

      const {email, name, courseName, courseDate, courseTime, apiKey} = req.body;

      // Vérification simple de l'API key (à remplacer par une vraie clé secrète)
      const expectedApiKey = process.env.PRESENTIEL_API_KEY;
      if (!expectedApiKey || apiKey !== expectedApiKey) {
        console.error('Invalid or missing API key for registerPresentielCourse');
        return res.status(401).json({success: false, error: 'Unauthorized'});
      }

      // Validation des paramètres requis
      if (!email) {
        return res.status(400).json({success: false, error: 'Email is required'});
      }

      // Valider le format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({success: false, error: 'Invalid email format'});
      }

      const normalizedEmail = email.toLowerCase().trim();

      try {
        const auth = Buffer.from(
            `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`,
        ).toString('base64');

        // S'assurer que les contact properties existent
        await ensureMailjetContactProperties(
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_API_SECRET,
        );

        // Vérifier si le contact a déjà une confirmation (confirmée ou en attente) pour le présentiel
        const existingConfirmation = await db.collection('newsletterConfirmations')
            .where('email', '==', normalizedEmail)
            .where('sourceOptin', 'in', ['presentiel', 'presentiel_compte'])
            .limit(1)
            .get();

        let isAlreadyConfirmed = false;
        let hasPendingConfirmation = false;

        if (!existingConfirmation.empty) {
          const confirmationData = existingConfirmation.docs[0].data();
          isAlreadyConfirmed = confirmationData.confirmed === true;
          hasPendingConfirmation = !isAlreadyConfirmed;
        }

        // Enregistrer l'inscription au cours dans Firestore
        const registrationData = {
          email: normalizedEmail,
          name: name || '',
          courseName: courseName || 'Cours Fluance',
          courseDate: courseDate || null,
          courseTime: courseTime || null,
          registeredAt: FieldValue.serverTimestamp(),
          source: 'fluance',
        };

        await db.collection('presentielRegistrations').add(registrationData);
        console.log(`📝 Course registration saved for ${normalizedEmail}: ${courseName} on ${courseDate}`);

        // Compter le nombre de cours pour ce contact
        const courseCountQuery = await db.collection('presentielRegistrations')
            .where('email', '==', normalizedEmail)
            .get();
        const nombreCours = courseCountQuery.size;

        // Récupérer la date du premier cours
        let premierCours = courseDate;
        let dernierCours = courseDate;
        if (nombreCours > 1) {
          const allCourses = courseCountQuery.docs
              .map((doc) => doc.data())
              .filter((d) => d.courseDate)
              .sort((a, b) => {
                const dateA = a.courseDate.split('/').reverse().join('-');
                const dateB = b.courseDate.split('/').reverse().join('-');
                return dateA.localeCompare(dateB);
              });
          if (allCourses.length > 0) {
            premierCours = allCourses[0].courseDate;
            dernierCours = allCourses[allCourses.length - 1].courseDate;
          }
        }

        // Mettre à jour les propriétés MailJet
        const properties = {
          inscrit_presentiel: 'True',
          nombre_cours_presentiel: nombreCours.toString(),
          dernier_cours_presentiel: dernierCours || new Date().toISOString().split('T')[0],
        };

        if (nombreCours === 1) {
          properties.premier_cours_presentiel = premierCours ||
          new Date().toISOString().split('T')[0];
        }

        // Si le contact est nouveau (pas de confirmation en attente ni confirmée), préparer le double opt-in
        if (!isAlreadyConfirmed && !hasPendingConfirmation) {
        // Vérifier si le contact existe dans MailJet
          let contactExists = false;
          try {
            const checkUrl = `https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(normalizedEmail)}`;
            const checkResponse = await fetch(checkUrl, {
              method: 'GET',
              headers: {'Authorization': `Basic ${auth}`},
            });
            contactExists = checkResponse.ok;
          } catch {
            console.log('Contact does not exist in MailJet, will create it');
          }

          // Créer le contact s'il n'existe pas
          if (!contactExists) {
            const createUrl = 'https://api.mailjet.com/v3/REST/contact';
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
              },
              body: JSON.stringify({
                Email: normalizedEmail,
                IsExcludedFromCampaigns: false,
                Name: name || '',
              }),
            });

            if (!createResponse.ok) {
              const errorText = await createResponse.text();
              console.error('Error creating MailJet contact:', errorText);
            } else {
              console.log(`✅ MailJet contact created: ${normalizedEmail}`);
            }
          }

          // Ajouter à la liste MailJet
          const listId = '10524140';
          try {
            const addToListUrl = 'https://api.mailjet.com/v3/REST/listrecipient';
            await fetch(addToListUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
              },
              body: JSON.stringify({
                IsUnsubscribed: false,
                ContactAlt: normalizedEmail,
                ListID: parseInt(listId, 10),
              }),
            });
          } catch {
            console.log('Contact may already be in list');
          }

          // Générer un token de confirmation
          const confirmationToken = generateUniqueToken();
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + 7);

          // Stocker le token dans Firestore
          await db.collection('newsletterConfirmations').doc(confirmationToken).set({
            email: normalizedEmail,
            name: name || '',
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: expirationDate,
            confirmed: false,
            reminderSent: false,
            sourceOptin: 'presentiel',
            courseName: courseName || 'Cours Fluance',
            courseDate: courseDate || null,
          });

          // Envoyer l'email de confirmation
          const baseUrl = 'https://fluance.io';
          const confirmationUrl = `${baseUrl}/confirm?email=${encodeURIComponent(normalizedEmail)}` +
          `&token=${confirmationToken}&redirect=presentiel`;

          // Générer l'URL Google Calendar
          let calendarUrl = '';
          if (courseDate && courseTime) {
            try {
            // Parser la date DD/MM/YYYY et l'heure HH:MM
              const [day, month, year] = courseDate.split('/');
              const [hours, minutes] = courseTime.split(':');

              // Date de début (format: YYYYMMDDTHHMMSS)
              const startDate = `${year}${month}${day}T${hours}${minutes}00`;

              // Date de fin (45 minutes plus tard)
              const startTime = new Date(
                  parseInt(year), parseInt(month) - 1, parseInt(day),
                  parseInt(hours), parseInt(minutes),
              );
              startTime.setMinutes(startTime.getMinutes() + 45);
              const endYear = startTime.getFullYear();
              const endMonth = String(startTime.getMonth() + 1).padStart(2, '0');
              const endDay = String(startTime.getDate()).padStart(2, '0');
              const endHours = String(startTime.getHours()).padStart(2, '0');
              const endMinutes = String(startTime.getMinutes()).padStart(2, '0');
              const endDate = `${endYear}${endMonth}${endDay}T${endHours}${endMinutes}00`;

              const calendarTitle = encodeURIComponent(courseName || 'Cours Fluance');
              const calendarLocation = encodeURIComponent('le duplex danse & bien-être, Rte de Chantemerle 58d, 1763 Granges-Paccot, Suisse');
              const calendarDetails = encodeURIComponent('Cours Fluance - le mouvement qui éveille et apaise\n\nTenue : vêtements confortables\nPlus d\'infos : https://fluance.io/presentiel/cours-hebdomadaires/');

              calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
              `&text=${calendarTitle}` +
              `&dates=${startDate}/${endDate}` +
              `&details=${calendarDetails}` +
              `&location=${calendarLocation}`;
            } catch (e) {
              console.error('Error generating calendar URL:', e);
            }
          }

          const emailSubject = `Dernière étape${name ? ' ' + name : ''} : confirmez votre inscription au cours`;

          const emailHtml = loadEmailTemplate('confirmation-presentiel', {
            firstName: name || '',
            courseName: courseName || 'Cours Fluance',
            courseDate: courseDate || '',
            courseTime: courseTime || '',
            confirmationUrl: confirmationUrl,
            calendarUrl: calendarUrl || 'https://fluance.io/presentiel/cours-hebdomadaires/',
          });

          const emailText = `Bonjour${name ? ' ' + name : ''},\n\n` +
          `Merci pour votre inscription au cours "${courseName || 'Cours Fluance'}"` +
          `${courseDate ? ' du ' + courseDate : ''}${courseTime ? ' à ' + courseTime : ''} !\n\n` +
          `Votre réservation est bien enregistrée. Pour confirmer votre adresse email ` +
          `et faciliter les prochains échanges, veuillez cliquer sur ce lien :\n\n` +
          `${confirmationUrl}\n\n` +
          `Ce lien est valide pendant 7 jours.\n\n` +
          `À très bientôt en cours !\n\n` +
          `Cédric de Fluance`;

          await sendMailjetEmail(
              normalizedEmail,
              emailSubject,
              emailHtml,
              emailText,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
              'fluance@actu.fluance.io',
              'Cédric de Fluance',
          );

          console.log(`📧 Confirmation email sent to ${normalizedEmail} for presentiel course`);

          // Mettre à jour les propriétés (en attente de confirmation)
          properties.source_optin = 'presentiel';
          properties.statut = 'prospect';
          properties.est_client = 'False';
          properties.langue = 'fr';

          await updateMailjetContactProperties(
              normalizedEmail,
              properties,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );

          return res.json({
            success: true,
            isNewContact: true,
            confirmationEmailSent: true,
            message: 'New contact - confirmation email sent',
            email: normalizedEmail,
            nombreCours: nombreCours,
          });
        } else if (hasPendingConfirmation) {
        // Confirmation en attente - mettre à jour les propriétés mais pas d'email
          console.log(`📝 Contact ${normalizedEmail} has pending confirmation - updating properties only`);

          await updateMailjetContactProperties(
              normalizedEmail,
              properties,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );

          return res.json({
            success: true,
            isNewContact: false,
            confirmationEmailSent: false,
            pendingConfirmation: true,
            message: 'Confirmation pending - registration recorded',
            email: normalizedEmail,
            nombreCours: nombreCours,
          });
        } else {
        // Contact déjà confirmé - mettre à jour uniquement les propriétés
          console.log(`📝 Existing confirmed contact ${normalizedEmail} - updating properties only`);

          // Récupérer les propriétés actuelles pour ne pas écraser source_optin
          const currentProperties = {};
          try {
            const contactDataUrl =
            `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(normalizedEmail)}`;
            const getResponse = await fetch(contactDataUrl, {
              method: 'GET',
              headers: {'Authorization': `Basic ${auth}`},
            });

            if (getResponse.ok) {
              const getData = await getResponse.json();
              if (getData.Data && getData.Data.length > 0 && getData.Data[0].Data) {
                const data = getData.Data[0].Data;
                if (Array.isArray(data)) {
                  data.forEach((item) => {
                    if (item.Name && item.Value !== undefined) {
                      currentProperties[item.Name] = item.Value;
                    }
                  });
                }
              }
            }
          } catch (error) {
            console.log('Error fetching current properties:', error.message);
          }

          // Ajouter 'presentiel' à source_optin si pas déjà présent
          const currentSourceOptin = currentProperties.source_optin || '';
          const sourceOptinList = currentSourceOptin ?
          currentSourceOptin.split(',').map((s) => s.trim()).filter((s) => s) : [];
          if (!sourceOptinList.includes('presentiel')) {
            sourceOptinList.push('presentiel');
            properties.source_optin = sourceOptinList.join(',');
          }

          await updateMailjetContactProperties(
              normalizedEmail,
              properties,
              process.env.MAILJET_API_KEY,
              process.env.MAILJET_API_SECRET,
          );

          return res.json({
            success: true,
            isNewContact: false,
            confirmationEmailSent: false,
            message: 'Existing contact - registration recorded',
            email: normalizedEmail,
            nombreCours: nombreCours,
          });
        }
      } catch (error) {
        console.error('Error in registerPresentielCourse:', error);
        return res.status(500).json({
          success: false,
          error: 'Internal server error: ' + error.message,
        });
      }
    },
);

// =============================================================================
// SYSTÈME DE RÉSERVATION DE COURS
// =============================================================================

// Import des services de réservation
let googleService;
let bookingService;
let passService;

try {
  googleService = require('./services/googleService').googleService;
  bookingService = require('./services/bookingService');
  passService = require('./services/passService');
} catch (e) {
  console.warn('Booking services not loaded:', e.message);
}

/**
 * Gère le double opt-in pour une réservation de cours
 * @param {Object} db - Instance Firestore
 * @param {string} email - Email de l'utilisateur
 * @param {string} firstName - Prénom
 * @param {string} courseId - ID du cours
 * @param {string} bookingId - ID de la réservation
 */
async function handleDoubleOptInForBooking(db, email, firstName, courseId, bookingId) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const mailjetApiKey = process.env.MAILJET_API_KEY;
    const mailjetApiSecret = process.env.MAILJET_API_SECRET;

    if (!mailjetApiKey || !mailjetApiSecret) {
      console.warn('MailJet credentials not available, skipping double opt-in');
      return {status: 'skipped_missing_credentials'};
    }

    // Vérifier si une confirmation existe déjà
    const existingConfirmation = await db.collection('newsletterConfirmations')
        .where('email', '==', normalizedEmail)
        .where('sourceOptin', 'in', ['presentiel', 'presentiel_compte'])
        .get();

    const now = new Date();
    if (!existingConfirmation.empty) {
      for (const doc of existingConfirmation.docs) {
        const confirmationData = doc.data();
        if (confirmationData.confirmed === true) {
          return {status: 'already_confirmed'};
        }

        const expiresAt = confirmationData.expiresAt?.toDate ?
          confirmationData.expiresAt.toDate() :
          (confirmationData.expiresAt ? new Date(confirmationData.expiresAt) : null);

        if (expiresAt && now <= expiresAt) {
          return {
            status: 'active_token_exists',
            token: doc.id,
            expiresAt: expiresAt,
          };
        }
      }
    }

    // Récupérer les infos du cours
    const courseDoc = await db.collection('courses').doc(courseId).get();
    const course = courseDoc.exists ? courseDoc.data() : null;

    // Vérifier si le contact existe dans MailJet
    const auth = Buffer.from(`${mailjetApiKey}:${mailjetApiSecret}`).toString('base64');
    let contactExists = false;
    try {
      const checkUrl = `https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(normalizedEmail)}`;
      const checkResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: {'Authorization': `Basic ${auth}`},
      });
      contactExists = checkResponse.ok;
    } catch {
      console.log('Contact does not exist in MailJet, will create it');
    }

    // Créer le contact s'il n'existe pas
    if (!contactExists) {
      const createUrl = 'https://api.mailjet.com/v3/REST/contact';
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({
          Email: normalizedEmail,
          IsExcludedFromCampaigns: false,
          Name: firstName || '',
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Error creating MailJet contact:', errorText);
      } else {
        console.log(`✅ MailJet contact created: ${normalizedEmail}`);
      }
    }

    // Générer un token de confirmation
    const confirmationToken = generateUniqueToken();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);

    // Stocker le token dans Firestore
    await db.collection('newsletterConfirmations').doc(confirmationToken).set({
      email: normalizedEmail,
      name: firstName || '',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expirationDate,
      confirmed: false,
      reminderSent: false,
      sourceOptin: 'presentiel',
      courseId: courseId,
      bookingId: bookingId,
      courseName: course?.title || 'Cours Fluance',
      courseDate: course?.date || null,
    });

    // Envoyer l'email de confirmation
    const baseUrl = 'https://fluance.io';
    const confirmationUrl = `${baseUrl}/confirm?email=${encodeURIComponent(normalizedEmail)}` +
      `&token=${confirmationToken}&redirect=presentiel`;

    // Générer l'URL Google Calendar si disponible
    let calendarUrl = '';
    if (course?.date && course?.time) {
      try {
        // Parser la date DD/MM/YYYY et l'heure HH:MM (dans le fuseau horaire Europe/Zurich)
        const [day, month, year] = course.date.split('/');
        const [hours, minutes] = course.time.split(':');

        // Créer une date dans le fuseau horaire Europe/Zurich
        // Format ISO pour Google Calendar: YYYYMMDDTHHMMSS avec timezone
        const startDate = `${year}${month}${day}T${hours}${minutes}00`;

        // Pour calculer la fin, créer une date locale en Europe/Zurich
        // On utilise une approche simple : ajouter 45 minutes
        const startTime = new Date(
            parseInt(year), parseInt(month) - 1, parseInt(day),
            parseInt(hours), parseInt(minutes),
        );
        startTime.setMinutes(startTime.getMinutes() + 45);
        const endYear = startTime.getFullYear();
        const endMonth = String(startTime.getMonth() + 1).padStart(2, '0');
        const endDay = String(startTime.getDate()).padStart(2, '0');
        const endHours = String(startTime.getHours()).padStart(2, '0');
        const endMinutes = String(startTime.getMinutes()).padStart(2, '0');
        const endDate = `${endYear}${endMonth}${endDay}T${endHours}${endMinutes}00`;

        const calendarTitle = encodeURIComponent(course.title || 'Cours Fluance');
        const calendarLocation = encodeURIComponent(course.location || 'le duplex danse & bien-être, Rte de Chantemerle 58d, 1763 Granges-Paccot, Suisse');
        const calendarDetails = encodeURIComponent('Cours Fluance - le mouvement qui éveille et apaise\n\nTenue : vêtements confortables\nPlus d\'infos : https://fluance.io/presentiel/cours-hebdomadaires/');

        calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
          `&text=${calendarTitle}` +
          `&dates=${startDate}/${endDate}` +
          `&details=${calendarDetails}` +
          `&location=${calendarLocation}`;
      } catch (e) {
        console.error('Error generating calendar URL:', e);
      }
    }

    const emailSubject = `Dernière étape${firstName ? ' ' + firstName : ''} : confirmez votre réservation`;

    const emailHtml = loadEmailTemplate('confirmation-presentiel', {
      firstName: firstName || '',
      courseName: course?.title || 'Cours Fluance',
      courseDate: course?.date || '',
      courseTime: course?.time || '',
      confirmationUrl: confirmationUrl,
      calendarUrl: calendarUrl || 'https://fluance.io/presentiel/cours-hebdomadaires/',
    });

    const emailText = `Bonjour${firstName ? ' ' + firstName : ''},\n\n` +
      `Merci pour votre réservation au cours "${course?.title || 'Cours Fluance'}"` +
      `${course?.date ? ' du ' + course.date : ''}${course?.time ? ' à ' + course.time : ''} !\n\n` +
      `Votre réservation est bien enregistrée. Pour confirmer votre adresse email ` +
      `et faciliter les prochains échanges, veuillez cliquer sur ce lien :\n\n` +
      `${confirmationUrl}\n\n` +
      `Ce lien est valide pendant 7 jours.\n\n` +
      `À très bientôt en cours !\n\n` +
      `Cédric de Fluance`;

    await sendMailjetEmail(
        normalizedEmail,
        emailSubject,
        emailHtml,
        emailText,
        mailjetApiKey,
        mailjetApiSecret,
        'fluance@actu.fluance.io',
        'Cédric de Fluance',
    );

    console.log(`📧 Double opt-in email sent to ${normalizedEmail} for course booking`);

    // Mettre à jour les propriétés MailJet (en attente de confirmation)
    await updateMailjetContactProperties(
        normalizedEmail,
        {
          inscrit_presentiel: 'True',
          source_optin: 'presentiel',
          statut: 'prospect',
          est_client: 'False',
        },
        mailjetApiKey,
        mailjetApiSecret,
    );
    return {
      status: 'email_sent',
      token: confirmationToken,
      expiresAt: expirationDate,
    };
  } catch (error) {
    console.error('Error handling double opt-in for booking:', error);
    // Ne pas bloquer la réservation en cas d'erreur
    return {status: 'error', error: error.message};
  }
}

exports.resendBookingOptInConfirmation = onCall(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      cors: true,
    },
    async (request) => {
      const {email} = request.data || {};

      if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
      }

      const normalizedEmail = email.toLowerCase().trim();
      const bookingsSnapshot = await db.collection('bookings')
          .where('email', '==', normalizedEmail)
          .get();

      if (bookingsSnapshot.empty) {
        throw new HttpsError('not-found', 'Aucune réservation trouvée pour cet email');
      }

      const candidateBookings = bookingsSnapshot.docs
          .map((doc) => doc.data())
          .filter((booking) => ['pending', 'pending_cash', 'confirmed'].includes(booking.status));

      if (candidateBookings.length === 0) {
        throw new HttpsError('not-found', 'Aucune réservation active trouvée pour cet email');
      }

      candidateBookings.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      const latestBooking = candidateBookings[0];
      const result = await handleDoubleOptInForBooking(
          db,
          normalizedEmail,
          latestBooking.firstName || '',
          latestBooking.courseId,
          latestBooking.bookingId,
      );

      if (result?.status === 'already_confirmed') {
        return {
          success: true,
          status: 'already_confirmed',
          message: 'Adresse déjà confirmée',
        };
      }

      if (result?.status === 'active_token_exists') {
        return {
          success: true,
          status: 'active_token_exists',
          message: 'Un lien actif a déjà été envoyé',
        };
      }

      if (result?.status === 'email_sent') {
        return {
          success: true,
          status: 'email_sent',
          message: 'Un nouveau lien de confirmation a été envoyé',
        };
      }

      throw new HttpsError(
          'internal',
          result?.error || 'Impossible de renvoyer le lien de confirmation',
      );
    },
);

/**
 * Envoie un rappel par email 1 jour avant chaque cours
 * S'exécute quotidiennement à 9h (Europe/Zurich)
 *
 * Note: Si vous obtenez une erreur Eventarc, utilisez sendCourseRemindersManual
 * qui est une fonction HTTP callable
 */
exports.sendCourseReminders = onSchedule(
    {
      schedule: '0 9 * * *', // Tous les jours à 9h
      timeZone: 'Europe/Zurich',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      region: 'europe-west1',
    },
    async (_event) => {
      return await sendCourseRemindersLogic();
    },
);

/**
 * Envoie un email de suivi le lendemain d'un cours d'essai offert
 * S'exécute quotidiennement à 10h (Europe/Zurich)
 */
exports.sendTrialFollowUps = onSchedule(
    {
      schedule: '0 10 * * *', // Tous les jours à 10h
      timeZone: 'Europe/Zurich',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      region: 'europe-west1',
    },
    async (_event) => {
      return await sendTrialFollowUpsLogic();
    },
);

/**
 * Version HTTP manuelle de sendTrialFollowUps
 */
exports.sendTrialFollowUpsManual = onRequest(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      cors: true,
    },
    async (req, res) => {
    // Vérification basique de sécurité
      const apiKey = req.query.apiKey || req.headers['x-api-key'];
      const expectedKey = process.env.COURSE_REMINDERS_API_KEY;

      if (expectedKey && apiKey !== expectedKey) {
        return res.status(403).json({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      try {
        const result = await sendTrialFollowUpsLogic();
        return res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error('Error in sendTrialFollowUpsManual:', error);
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    },
);

/**
 * Version HTTP manuelle de sendCourseReminders
 * Utilisez cette fonction si sendCourseReminders échoue à cause d'Eventarc
 * Peut être appelée manuellement ou via un cron externe (ex: cron-job.org)
 */
exports.sendCourseRemindersManual = onRequest(
    {
      region: 'europe-west1',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      cors: true,
    },
    async (req, res) => {
    // Vérification basique de sécurité (optionnel : ajouter une clé API)
      const apiKey = req.query.apiKey || req.headers['x-api-key'];
      const expectedKey = process.env.COURSE_REMINDERS_API_KEY;

      if (expectedKey && apiKey !== expectedKey) {
        return res.status(403).json({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      try {
        const result = await sendCourseRemindersLogic();
        return res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error('Error in sendCourseRemindersManual:', error);
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    },
);

/**
 * Logique partagée pour envoyer les rappels de cours
 */
async function sendCourseRemindersLogic() {
  console.log('📧 Starting course reminders logic');
  const mailjetApiKey = process.env.MAILJET_API_KEY;
  const mailjetApiSecret = process.env.MAILJET_API_SECRET;

  if (!mailjetApiKey || !mailjetApiSecret) {
    console.error('❌ Mailjet credentials not configured');
    return {
      remindersSent: 0,
      errors: 0,
      message: 'Mailjet credentials not configured',
    };
  }

  try {
    // Calculer la date de demain (1 jour avant)
    const now = Timestamp.now();
    const tomorrow = new Date(now.toDate());
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const tomorrowStartTimestamp = Timestamp.fromDate(tomorrow);
    const tomorrowEndTimestamp = Timestamp.fromDate(tomorrowEnd);

    console.log(`🔍 Looking for courses on ${tomorrow.toISOString().split('T')[0]}`);

    // Récupérer tous les cours qui ont lieu demain
    const coursesSnapshot = await db.collection('courses')
        .where('startTime', '>=', tomorrowStartTimestamp)
        .where('startTime', '<=', tomorrowEndTimestamp)
        .where('status', '==', 'active')
        .get();

    if (coursesSnapshot.empty) {
      console.log('✅ No courses tomorrow, no reminders to send');
      return {
        remindersSent: 0,
        errors: 0,
        message: 'No courses tomorrow',
      };
    }

    console.log(`📋 Found ${coursesSnapshot.size} course(s) tomorrow`);

    let remindersSent = 0;
    let errors = 0;

    for (const courseDoc of coursesSnapshot.docs) {
      const course = courseDoc.data();
      const courseId = courseDoc.id;

      try {
        // Récupérer toutes les réservations confirmées pour ce cours
        const bookingsSnapshot = await db.collection('bookings')
            .where('courseId', '==', courseId)
            .where('status', 'in', ['confirmed', 'pending_cash'])
            .get();

        if (bookingsSnapshot.empty) {
          console.log(`⏭️  No bookings for course ${courseId}, skipping`);
          continue;
        }

        console.log(`📧 Sending reminders for ${bookingsSnapshot.size} booking(s) for course: ${course.title}`);

        for (const bookingDoc of bookingsSnapshot.docs) {
          const booking = bookingDoc.data();
          const email = booking.email.toLowerCase().trim();

          // Vérifier si un rappel a déjà été envoyé
          const reminderKey = `reminder_sent_${courseId}`;
          if (booking[reminderKey]) {
            console.log(`⏭️  Reminder already sent for booking ${bookingDoc.id}, skipping`);
            continue;
          }

          // Vérifier que l'utilisateur a confirmé son opt-in
          const confirmationSnapshot = await db.collection('newsletterConfirmations')
              .where('email', '==', email)
              .where('sourceOptin', 'in', ['presentiel', 'presentiel_compte'])
              .where('confirmed', '==', true)
              .limit(1)
              .get();

          if (confirmationSnapshot.empty) {
            console.log(`⏭️  User ${email} has not confirmed opt-in, skipping reminder`);
            continue;
          }

          // Générer l'URL Google Calendar
          let calendarUrl = '';
          if (course.date && course.time) {
            try {
              const [day, month, year] = course.date.split('/');
              const [hours, minutes] = course.time.split(':');
              const startDate = `${year}${month}${day}T${hours}${minutes}00`;
              const startTime = new Date(
                  parseInt(year), parseInt(month) - 1, parseInt(day),
                  parseInt(hours), parseInt(minutes),
              );
              startTime.setMinutes(startTime.getMinutes() + 45);
              const endYear = startTime.getFullYear();
              const endMonth = String(startTime.getMonth() + 1).padStart(2, '0');
              const endDay = String(startTime.getDate()).padStart(2, '0');
              const endHours = String(startTime.getHours()).padStart(2, '0');
              const endMinutes = String(startTime.getMinutes()).padStart(2, '0');
              const endDate = `${endYear}${endMonth}${endDay}T${endHours}${endMinutes}00`;

              const calendarTitle = encodeURIComponent(course.title || 'Cours Fluance');
              const calendarLocation = encodeURIComponent(course.location || 'le duplex danse & bien-être, Rte de Chantemerle 58d, 1763 Granges-Paccot, Suisse');
              const calendarDetails = encodeURIComponent('Cours Fluance - le mouvement qui éveille et apaise\n\nTenue : vêtements confortables\nPlus d\'infos : https://fluance.io/presentiel/cours-hebdomadaires/');

              calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
                `&text=${calendarTitle}` +
                `&dates=${startDate}/${endDate}` +
                `&details=${calendarDetails}` +
                `&location=${calendarLocation}`;
            } catch (e) {
              console.error('Error generating calendar URL:', e);
            }
          }

          // Préparer l'email de rappel
          const emailSubject = `Rappel : Votre cours Fluance demain${booking.firstName ? ' ' + booking.firstName : ''} !`;

          const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; ` +
            `max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #648ED8; padding: 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Rappel : Votre cours Fluance demain</h1>
                  </div>
                  <div style="background-color: #ffffff; padding: 20px;">
                    <p>Bonjour${booking.firstName ? ' ' + booking.firstName : ''},</p>
                    <p>Ceci est un rappel amical : vous avez un cours Fluance <strong>demain</strong> !</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                      <p style="margin: 5px 0;"><strong>📅 Cours :</strong> ${course.title || 'Cours Fluance'}</p>
                      <p style="margin: 5px 0;"><strong>📆 Date :</strong> ${course.date || ''}</p>
                      <p style="margin: 5px 0;"><strong>🕐 Heure :</strong> ${course.time || ''}</p>
                      <p style="margin: 5px 0;"><strong>📍 Lieu :</strong> ${course.location || 'le duplex danse & bien-être, Rte de Chantemerle 58d, 1763 Granges-Paccot'}</p>
                    </div>
                    ${calendarUrl ? `
                    <p style="text-align: center; margin: 20px 0;">
                      <a href="${calendarUrl}" ` +
              `style="background-color: #E6B84A; color: #0f172a; ` +
              `padding: 15px 30px; text-decoration: none; border-radius: 5px; ` +
              `font-weight: bold; display: inline-block;">
                        Ajouter à mon calendrier
                      </a>
                    </p>
                    ` : ''}
                    <p><strong>Informations pratiques :</strong></p>
                    <ul>
                      <li><strong>Tenue :</strong> Vêtements confortables permettant le mouvement</li>
                      <li><strong>Transport :</strong> Bus n°9 et 10, ` +
            `arrêt Granges-Paccot, Chantemerle (+1min à pied)</li>
                      <li><strong>Parking :</strong> Zones bleues et blanches disponibles (disque nécessaire)</li>
                    </ul>
                    <p>Nous avons hâte de vous voir demain !</p>
                    <p>À très bientôt,<br>Cédric de Fluance</p>
                  </div>
                </body>
                </html>
              `;

          const emailText = `Bonjour${booking.firstName ? ' ' + booking.firstName : ''},\n\n` +
            `Ceci est un rappel amical : vous avez un cours Fluance demain !\n\n` +
            `📅 Cours : ${course.title || 'Cours Fluance'}\n` +
            `📆 Date : ${course.date || ''}\n` +
            `🕐 Heure : ${course.time || ''}\n` +
            `📍 Lieu : ${course.location || 'le duplex danse & bien-être, Rte de Chantemerle 58d, 1763 Granges-Paccot'}\n\n` +
            `Informations pratiques :\n` +
            `- Tenue : Vêtements confortables permettant le mouvement\n` +
            `- Transport : Bus n°9 et 10, arrêt Granges-Paccot, Chantemerle (+1min à pied)\n` +
            `- Parking : Zones bleues et blanches disponibles (disque nécessaire)\n\n` +
            `Nous avons hâte de vous voir demain !\n\n` +
            `À très bientôt,\nCédric de Fluance`;

          // Envoyer l'email via Mailjet
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

          // Marquer le rappel comme envoyé dans la réservation
          await bookingDoc.ref.update({
            [reminderKey]: FieldValue.serverTimestamp(),
          });

          remindersSent++;
          console.log(`✅ Reminder sent to ${email} for course ${courseId}`);
        }
      } catch (courseError) {
        errors++;
        console.error(`❌ Error processing course ${courseId}:`, courseError);
      }
    }

    console.log(`✅ Course reminders job completed: ${remindersSent} sent, ${errors} errors`);

    return {
      remindersSent,
      errors,
      message: `Sent ${remindersSent} reminder(s), ${errors} error(s)`,
    };
  } catch (error) {
    console.error('❌ Error in sendCourseRemindersLogic:', error);
    throw error;
  }
}

/**
 * Logique pour envoyer les emails de suivi après un cours d'essai
 */
async function sendTrialFollowUpsLogic() {
  console.log('📧 Starting trial follow-up emails logic');

  try {
    // Calculer la date d'hier
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Formater en DD/MM/YYYY (format utilisé dans Firestore pour courseDate)
    const day = String(yesterday.getDate()).padStart(2, '0');
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const year = yesterday.getFullYear();
    const yesterdayStr = `${day}/${month}/${year}`;

    console.log(`🔍 Looking for trial bookings on ${yesterdayStr}`);

    // Récupérer les réservations d'essai d'hier qui sont confirmées
    const bookingsSnapshot = await db.collection('bookings')
        .where('courseDate', '==', yesterdayStr)
        .where('pricingOption', '==', 'trial')
        .where('status', 'in', ['confirmed', 'pending_cash'])
        .get();

    if (bookingsSnapshot.empty) {
      console.log('✅ No trial bookings yesterday');
      return {sent: 0};
    }

    console.log(`📋 Found ${bookingsSnapshot.size} trial booking(s) to check`);

    let sentCount = 0;

    for (const bookingDoc of bookingsSnapshot.docs) {
      const booking = bookingDoc.data();
      const email = booking.email.toLowerCase().trim();

      // Éviter les doublons
      if (booking.trialFollowUpSent) {
        console.log(`⏭️  Follow-up already sent for booking ${bookingDoc.id}, skipping`);
        continue;
      }

      // Vérifier que l'utilisateur a confirmé son opt-in (GDPR)
      const confirmationSnapshot = await db.collection('newsletterConfirmations')
          .where('email', '==', email)
          .where('sourceOptin', 'in', ['presentiel', 'presentiel_compte'])
          .where('confirmed', '==', true)
          .limit(1)
          .get();

      if (confirmationSnapshot.empty) {
        console.log(`⏭️  User ${email} has not confirmed opt-in, skipping follow-up`);
        continue;
      }

      try {
        // Envoyer l'email via la collection 'mail' (extension Trigger Email)
        await db.collection('mail').add({
          to: booking.email,
          template: {
            name: 'trial-follow-up',
            data: {
              firstName: booking.firstName || '',
            },
          },
        });

        // Marquer comme envoyé
        await bookingDoc.ref.update({
          trialFollowUpSent: true,
          trialFollowUpSentAt: FieldValue.serverTimestamp(),
        });

        sentCount++;
        console.log(`✅ Trial follow-up sent to ${booking.email}`);
      } catch (error) {
        console.error(`❌ Error sending follow-up to ${booking.email}:`, error);
      }
    }

    console.log(`✅ Trial follow-up job completed: ${sentCount} sent`);
    return {sent: sentCount};
  } catch (error) {
    console.error('❌ Error in sendTrialFollowUpsLogic:', error);
    throw error;
  }
}

/**
 * Synchronise le calendrier Google avec Firestore
 * Exécuté toutes les 30 minutes
 */
/**
 * Fonction scheduled pour envoyer les emails d'abandon de panier
 * Vérifie les réservations en attente (pending) et les paiements échoués
 * et envoie un email de relance après 1 heure
 */
exports.sendCartAbandonmentEmails = onSchedule(
    {
      schedule: 'every 1 hours', // Toutes les heures
      timeZone: 'Europe/Zurich',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      region: 'europe-west1',
    },
    async (_event) => {
      try {
        console.log('🛒 Starting cart abandonment email check...');

        if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_API_SECRET) {
          console.warn('⚠️ Mailjet credentials not configured, skipping cart abandonment emails');
          return;
        }

        const now = new Date();

        let emailsSent = 0;
        let errors = 0;

        // 1. Réservations en attente (pending) créées il y a plus d'1 heure mais moins de 48h
        const pendingBookings = await db.collection('bookings')
            .where('status', '==', 'pending')
            .get();

        for (const doc of pendingBookings.docs) {
          const booking = doc.data();
          const createdAt = booking.createdAt?.toDate ?
          booking.createdAt.toDate() :
          new Date(booking.createdAt);

          // Vérifier que c'est entre 1h et 48h
          const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
          if (hoursSinceCreation < 1 || hoursSinceCreation > 48) {
            continue;
          }

          // Vérifier qu'on n'a pas déjà envoyé un email
          if (booking.cartAbandonmentEmailSent) {
            continue;
          }

          try {
            const courseDoc = await db.collection('courses').doc(booking.courseId).get();
            const course = courseDoc.exists ? courseDoc.data() : null;

            await sendCartAbandonmentEmail(
                booking.email,
                booking.firstName || '',
                booking.courseName || course?.title || 'Cours Fluance',
                booking.courseDate || course?.date || '',
                booking.courseTime || course?.time || '',
                booking.amount || 0,
                booking.stripeClientSecret || null,
                booking.bookingId,
                'incomplete',
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );

            await doc.ref.update({
              cartAbandonmentEmailSent: true,
              cartAbandonmentEmailSentAt: new Date(),
            });

            emailsSent++;
            console.log(`✅ Cart abandonment email sent for booking ${booking.bookingId}`);
          } catch (error) {
            errors++;
            console.error(`❌ Error sending cart abandonment email for booking ${booking.bookingId}:`, error);
          }
        }

        // 2. Paiements échoués (payment_failed) créés il y a plus d'1 heure mais moins de 48h
        const failedBookings = await db.collection('bookings')
            .where('status', '==', 'payment_failed')
            .get();

        for (const doc of failedBookings.docs) {
          const booking = doc.data();
          const paymentFailedAt = booking.paymentFailedAt?.toDate ?
          booking.paymentFailedAt.toDate() :
          (booking.updatedAt?.toDate ?
            booking.updatedAt.toDate() :
            new Date(booking.updatedAt));

          // Vérifier que c'est entre 1h et 48h
          const hoursSinceFailure = (now - paymentFailedAt) / (1000 * 60 * 60);
          if (hoursSinceFailure < 1 || hoursSinceFailure > 48) {
            continue;
          }

          // Vérifier qu'on n'a pas déjà envoyé un email
          if (booking.cartAbandonmentEmailSent) {
            continue;
          }

          try {
            const courseDoc = await db.collection('courses').doc(booking.courseId).get();
            const course = courseDoc.exists ? courseDoc.data() : null;

            await sendCartAbandonmentEmail(
                booking.email,
                booking.firstName || '',
                booking.courseName || course?.title || 'Cours Fluance',
                booking.courseDate || course?.date || '',
                booking.courseTime || course?.time || '',
                booking.amount || 0,
                booking.stripeClientSecret || null,
                booking.bookingId,
                'payment_failed',
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );

            await doc.ref.update({
              cartAbandonmentEmailSent: true,
              cartAbandonmentEmailSentAt: new Date(),
            });

            emailsSent++;
            console.log(`✅ Cart abandonment email sent for failed payment ${booking.bookingId}`);
          } catch (error) {
            errors++;
            console.error(`❌ Error sending cart abandonment email for failed payment ${booking.bookingId}:`, error);
          }
        }

        // 3. Paniers abandonnés produits en ligne (21 jours)
        // Relance 1 : ~2h après création de la session · Relance 2 : ~20h
        // (avant expiration de la session Stripe à ~24h).
        const abandonedCheckouts = await db.collection('abandonedCheckouts')
            .where('status', '==', 'pending')
            .get();

        for (const doc of abandonedCheckouts.docs) {
          const record = doc.data();
          const createdAt = record.createdAt?.toDate ?
            record.createdAt.toDate() :
            new Date(record.createdAt);

          const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
          if (hoursSinceCreation > 24) {
            // Session Stripe expirée (ou record orphelin) : on clôture.
            try {
              await doc.ref.update({
                status: 'expired',
                expiredAt: new Date(),
                updatedAt: new Date(),
              });
            } catch (expireError) {
              console.error(`❌ Error expiring abandoned checkout ${doc.id}:`, expireError.message);
            }
            continue;
          }

          const remindersSent = record.remindersSent || 0;
          let shouldSend = false;
          if (remindersSent === 0 && hoursSinceCreation >= 2) {
            shouldSend = true;
          } else if (remindersSent === 1 && hoursSinceCreation >= 20) {
            shouldSend = true;
          }
          if (!shouldSend) continue;

          try {
            await sendOnlineCartAbandonmentEmail(
                record.email,
                record.firstName || '',
                record.product || '21jours',
                remindersSent + 1,
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_API_SECRET,
            );

            await doc.ref.update({
              remindersSent: remindersSent + 1,
              lastReminderAt: new Date(),
              updatedAt: new Date(),
            });

            emailsSent++;
            console.log(
                `✅ Cart abandonment email sent for online product ${record.product} ` +
                `to ${record.email} (relance ${remindersSent + 1})`);
          } catch (error) {
            errors++;
            console.error(`❌ Error sending cart abandonment email for online checkout ${doc.id}:`, error);
          }
        }

        console.log(`✅ Cart abandonment check completed: ${emailsSent} email(s) sent, ${errors} error(s)`);
        return {success: true, emailsSent, errors};
      } catch (error) {
        console.error('❌ Error in sendCartAbandonmentEmails:', error);
        return {success: false, error: error.message};
      }
    },
);

/**
 * Fonction scheduled pour envoyer les emails de promotion (sommeil et somatique)
 * S'exécute quotidiennement à 8h (Europe/Paris)
 * Envoie :
 * - Email sommeil : novembre et février (une fois par mois)
 * - Email somatique : basé sur des triggers (45 jours après téléchargement, etc.)
 */
exports.sendPromotionalEmails = onSchedule(
    {
      schedule: '0 8 * * *', // Tous les jours à 8h
      timeZone: 'Europe/Paris',
      secrets: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      region: 'europe-west1',
    },
    async (_event) => {
      console.log('📧 Starting scheduled promotional emails job');
      const now = new Date();
      const mailjetApiKey = process.env.MAILJET_API_KEY;
      const mailjetApiSecret = process.env.MAILJET_API_SECRET;

      if (!mailjetApiKey || !mailjetApiSecret) {
        console.error('❌ Mailjet credentials not configured');
        return;
      }

      try {
        const currentMonth = now.getMonth() + 1; // 1-12 (janvier = 1, février = 2, novembre = 11)
        const currentDay = now.getDate();
        const isNovember = currentMonth === 11;
        const isFebruary = currentMonth === 2;

        // Email sommeil : envoyer une fois par mois
        // Novembre : le 2 (évite la Toussaint le 1er)
        // Février : le 1er (milieu d'hiver, fatigue accumulée)
        const shouldSendSleepEmail =
        (isNovember && currentDay === 2) ||
        (isFebruary && currentDay === 1);

        let sleepEmailsSent = 0;
        let somatiqueEmailsSent = 0;
        let somatiqueRelanceEmailsSent = 0;
        let somatiqueSeasonalEmailsSent = 0;
        let errors = 0;

        // Récupérer tous les contacts Mailjet
        const auth = Buffer.from(`${mailjetApiKey}:${mailjetApiSecret}`).toString('base64');
        const contactListUrl = 'https://api.mailjet.com/v3/REST/contact';
        const listResponse = await fetch(contactListUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        });

        if (!listResponse.ok) {
          console.warn('⚠️ Could not fetch Mailjet contacts for promotional emails');
          return;
        }

        const listData = await listResponse.json();
        const contacts = listData.Data || [];
        console.log(`📊 Found ${contacts.length} contacts to check`);

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

            // Récupérer le prénom
            const firstName = properties.firstname || contact.Name || '';

            // Vérifier que ce n'est pas un client (ne pas envoyer aux clients)
            const estClient = properties.est_client === 'True' || properties.est_client === true;
            const produitsAchetes = properties.produits_achetes || '';

            if (estClient || produitsAchetes.includes('21jours') || produitsAchetes.includes('complet')) {
            // C'est un client, on skip
              continue;
            }

            // 1. EMAIL SOMMEIL (saisonnier : novembre, février)
            if (shouldSendSleepEmail) {
              const emailSentDocId =
              `promotion_sommeil_${currentMonth}_${now.getFullYear()}_${email.toLowerCase().trim()}`;
              const emailSentDoc = await db.collection('contentEmailsSent')
                  .doc(emailSentDocId).get();

              if (!emailSentDoc.exists) {
                const emailSubject = 'Se réveiller à 2h du matin ne signifie pas que vous êtes cassé·e';
                const emailHtml = loadEmailTemplate('promotion-complet-sommeil', {
                  firstName: firstName || '',
                });

                await sendMailjetEmail(
                    email,
                    emailSubject,
                    emailHtml,
                    `${emailSubject}\n\nDécouvrez Fluance : https://fluance.io/cours-en-ligne/approche-fluance-complete/`,
                    mailjetApiKey,
                    mailjetApiSecret,
                    'fluance@actu.fluance.io',
                    'Cédric de Fluance',
                );

                await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                  email: email,
                  type: 'promotion_sommeil',
                  month: currentMonth,
                  year: now.getFullYear(),
                  sentAt: FieldValue.serverTimestamp(),
                });

                console.log(`✅ Sleep promotional email sent to ${email}`);
                sleepEmailsSent++;
              }
            }

            // 2. EMAIL SOMATIQUE (basé sur triggers)
            const sourceOptin = properties.source_optin || '';
            const dateOptin = properties.date_optin;

            // Trigger 1 : 45 jours après téléchargement des 2 pratiques (si non converti)
            if (sourceOptin.includes('2pratiques') && dateOptin) {
              let optinDate;
              if (dateOptin.includes('/')) {
                const [day, month, year] = dateOptin.split('/');
                optinDate = new Date(year, month - 1, day);
              } else if (dateOptin.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/i)) {
                const parts = dateOptin.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) (AM|PM)$/i);
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
                  optinDate = new Date(dateOptin);
                }
              } else {
                optinDate = new Date(dateOptin);
              }

              if (!isNaN(optinDate.getTime())) {
                const daysSinceOptin = Math.floor((now - optinDate) / (1000 * 60 * 60 * 24));

                // Envoyer l'email principal entre J+45 et J+50 (fenêtre de 5 jours)
                if (daysSinceOptin >= 45 && daysSinceOptin <= 50) {
                  const emailSentDocId = `promotion_somatique_principal_${email.toLowerCase().trim()}`;
                  const emailSentDoc = await db.collection('contentEmailsSent')
                      .doc(emailSentDocId).get();

                  if (!emailSentDoc.exists) {
                    const emailSubject = 'Quand votre corps vous dit qu\'il en a assez';
                    const emailHtml = loadEmailTemplate('promotion-complet-somatique', {
                      firstName: firstName || '',
                    });

                    await sendMailjetEmail(
                        email,
                        emailSubject,
                        emailHtml,
                        `${emailSubject}\n\nDécouvrez Fluance : https://fluance.io/cours-en-ligne/approche-fluance-complete/`,
                        mailjetApiKey,
                        mailjetApiSecret,
                        'fluance@actu.fluance.io',
                        'Cédric de Fluance',
                    );

                    await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                      email: email,
                      type: 'promotion_somatique_principal',
                      daysSinceOptin: daysSinceOptin,
                      sentAt: FieldValue.serverTimestamp(),
                    });

                    console.log(`✅ Somatique promotional email (principal) sent to ${email}`);
                    somatiqueEmailsSent++;
                  }
                }

                // Envoyer la relance J+8 après l'email principal (donc J+53 à J+58)
                if (daysSinceOptin >= 53 && daysSinceOptin <= 58) {
                // Vérifier que l'email principal a été envoyé
                  const principalEmailSentDocId = `promotion_somatique_principal_${email.toLowerCase().trim()}`;
                  const principalEmailSent = await db.collection('contentEmailsSent')
                      .doc(principalEmailSentDocId).get();

                  if (principalEmailSent.exists) {
                    const emailSentDocId = `promotion_somatique_relance_${email.toLowerCase().trim()}`;
                    const emailSentDoc = await db.collection('contentEmailsSent')
                        .doc(emailSentDocId).get();

                    if (!emailSentDoc.exists) {
                      const emailSubject = 'Bouger à partir de son ressenti';
                      const emailHtml = loadEmailTemplate('promotion-complet-somatique-relance', {
                        firstName: firstName || '',
                      });

                      await sendMailjetEmail(
                          email,
                          emailSubject,
                          emailHtml,
                          `${emailSubject}\n\nDécouvrez Fluance : https://fluance.io/cours-en-ligne/approche-fluance-complete/`,
                          mailjetApiKey,
                          mailjetApiSecret,
                          'fluance@actu.fluance.io',
                          'Cédric de Fluance',
                      );

                      await db.collection('contentEmailsSent').doc(emailSentDocId).set({
                        email: email,
                        type: 'promotion_somatique_relance',
                        daysSinceOptin: daysSinceOptin,
                        sentAt: FieldValue.serverTimestamp(),
                      });

                      console.log(`✅ Somatique promotional email (relance) sent to ${email}`);
                      somatiqueRelanceEmailsSent++;
                    }
                  }
                }
              }
            }

            // 3. EMAIL SOMATIQUE SAISONNIER (relance pour non-convertis)
            // En novembre et février, 2-3 semaines après l'email sommeil (vers le 15-21)
            // Priorité : l'email sommeil est envoyé le 1er, l'email somatique suit 2-3 semaines après
            const isSomatiqueSeasonalWindow =
            (isNovember || isFebruary) && currentDay >= 15 && currentDay <= 21;

            if (isSomatiqueSeasonalWindow) {
            // Vérifier si le contact a déjà téléchargé les 2 pratiques
              if (sourceOptin.includes('2pratiques') && dateOptin) {
              // Vérifier d'abord si l'email sommeil a été envoyé ce mois-ci
                const sleepEmailSentDocId =
                `promotion_sommeil_${currentMonth}_${now.getFullYear()}_${email.toLowerCase().trim()}`;
                const sleepEmailSent = await db.collection('contentEmailsSent')
                    .doc(sleepEmailSentDocId).get();

                // Ne pas envoyer si l'email sommeil n'a pas été envoyé ce mois (priorité à l'email sommeil)
                if (!sleepEmailSent.exists) {
                // L'email sommeil n'a pas été envoyé ce mois, on skip
                // (peut arriver si le contact n'était pas dans la liste le 1er du mois)
                  continue;
                }

                // Vérifier que le contact n'est toujours pas client (vérification à nouveau au cas où)
                const estClientNow = properties.est_client === 'True' || properties.est_client === true;
                const produitsAchetesNow = properties.produits_achetes || '';
                if (estClientNow || produitsAchetesNow.includes('21jours') || produitsAchetesNow.includes('complet')) {
                // Le contact est devenu client entre temps, on skip
                  continue;
                }

                let optinDate;
                if (dateOptin.includes('/')) {
                  const [day, month, year] = dateOptin.split('/');
                  optinDate = new Date(year, month - 1, day);
                } else if (dateOptin.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/i)) {
                  const parts = dateOptin.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) (AM|PM)$/i);
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
                    optinDate = new Date(dateOptin);
                  }
                } else {
                  optinDate = new Date(dateOptin);
                }

                if (!isNaN(optinDate.getTime())) {
                  const daysSinceOptin = Math.floor((now - optinDate) / (1000 * 60 * 60 * 24));

                  // Envoyer uniquement si :
                  // - Plus de 60 jours depuis le téléchargement
                  //   (pour éviter doublon avec trigger principal)
                  // - N'a pas reçu l'email somatique principal récemment
                  //   (ou l'a reçu il y a plus de 30 jours)
                  if (daysSinceOptin >= 60) {
                    const principalEmailSentDocId = `promotion_somatique_principal_${email.toLowerCase().trim()}`;
                    const principalEmailSent = await db.collection('contentEmailsSent')
                        .doc(principalEmailSentDocId).get();

                    // Si l'email principal a été envoyé, vérifier qu'il date de plus de 30 jours
                    let shouldSendSeasonal = false;
                    if (!principalEmailSent.exists) {
                    // N'a jamais reçu l'email principal, on peut envoyer la version saisonnière
                      shouldSendSeasonal = true;
                    } else {
                      const principalSentAt = principalEmailSent.data().sentAt?.toDate();
                      if (principalSentAt) {
                        const daysSincePrincipal = Math.floor(
                            (now - principalSentAt) / (1000 * 60 * 60 * 24),
                        );
                        // Envoyer seulement si l'email principal date de plus de 30 jours
                        shouldSendSeasonal = daysSincePrincipal >= 30;
                      }
                    }

                    if (shouldSendSeasonal) {
                      const emailSentDocId =
                      `promotion_somatique_seasonal_${currentMonth}_` +
                      `${now.getFullYear()}_${email.toLowerCase().trim()}`;
                      const emailSentDoc = await db.collection('contentEmailsSent')
                          .doc(emailSentDocId).get();

                      if (!emailSentDoc.exists) {
                        const emailSubject = 'Quand votre corps vous dit qu\'il en a assez';
                        const emailHtml = loadEmailTemplate('promotion-complet-somatique', {
                          firstName: firstName || '',
                        });

                        await sendMailjetEmail(
                            email,
                            emailSubject,
                            emailHtml,
                            `${emailSubject}\n\nDécouvrez Fluance : https://fluance.io/cours-en-ligne/approche-fluance-complete/`,
                            mailjetApiKey,
                            mailjetApiSecret,
                            'fluance@actu.fluance.io',
                            'Cédric de Fluance',
                        );

                        await db.collection('contentEmailsSent')
                            .doc(emailSentDocId).set({
                              email: email,
                              type: 'promotion_somatique_seasonal',
                              month: currentMonth,
                              year: now.getFullYear(),
                              daysSinceOptin: daysSinceOptin,
                              sentAt: FieldValue.serverTimestamp(),
                            });

                        console.log(
                            `✅ Seasonal somatique promotional email sent to ${email} ` +
                        `(2-3 weeks after sleep email)`,
                        );
                        somatiqueSeasonalEmailsSent++;
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error(`❌ Error processing contact ${email}:`, error.message);
            errors++;
          }
        }

        console.log(
            `✅ Promotional emails job completed: ` +
        `${sleepEmailsSent} sleep email(s), ` +
        `${somatiqueEmailsSent} somatique principal, ` +
        `${somatiqueRelanceEmailsSent} somatique relance, ` +
        `${somatiqueSeasonalEmailsSent} somatique seasonal, ` +
        `${errors} error(s)`,
        );

        return {
          success: true,
          sleepEmailsSent,
          somatiqueEmailsSent,
          somatiqueRelanceEmailsSent,
          somatiqueSeasonalEmailsSent,
          errors,
        };
      } catch (error) {
        console.error('❌ Error in sendPromotionalEmails:', error);
        return {success: false, error: error.message};
      }
    },
);

exports.syncPlanning = onSchedule(
    {
      schedule: 'every 30 minutes',
      region: 'europe-west1',
      secrets: ['GOOGLE_SERVICE_ACCOUNT', 'GOOGLE_CALENDAR_ID'],
    },
    async (_event) => {
      if (!googleService) {
        console.error('GoogleService not available');
        return;
      }

      const calendarId = process.env.GOOGLE_CALENDAR_ID;
      if (!calendarId) {
        console.error('GOOGLE_CALENDAR_ID not configured');
        return;
      }

      try {
        const result = await googleService.syncCalendarToFirestore(db, calendarId);
        console.log(`📅 Sync completed: ${result.synced} synced, ${result.deleted} deleted, ${result.errors} errors`);
      } catch (error) {
        console.error('Error syncing calendar:', error);
      }
    },
);

/**
 * Synchronise manuellement le calendrier (pour tests)
 */
exports.syncPlanningManual = onRequest(
    {
      region: 'europe-west1',
      secrets: ['GOOGLE_SERVICE_ACCOUNT', 'GOOGLE_CALENDAR_ID'],
      cors: true,
    },
    async (req, res) => {
      if (!googleService) {
        return res.status(500).json({error: 'GoogleService not available'});
      }

      const calendarId = process.env.GOOGLE_CALENDAR_ID;
      if (!calendarId) {
        return res.status(500).json({error: 'GOOGLE_CALENDAR_ID not configured'});
      }

      try {
        const result = await googleService.syncCalendarToFirestore(db, calendarId);
        return res.json({
          success: true,
          synced: result.synced,
          deleted: result.deleted,
          errors: result.errors,
        });
      } catch (error) {
        console.error('Error syncing calendar:', error);
        const errorMessage = error.message || 'Unknown error';

        // Message d'aide spécifique pour les erreurs JSON
        let helpMessage = '';
        if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
          helpMessage = ' See CORRIGER_SECRET_GOOGLE_SERVICE_ACCOUNT.md for help.';
        }

        return res.status(500).json({
          error: errorMessage + helpMessage,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
      }
    },
);

/**
 * Retourne le statut d'un cours (places disponibles)
 * Utilisé par le frontend pour affichage temps réel
 */
exports.getCourseStatus = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      if (!bookingService) {
        return res.status(500).json({error: 'Booking service not available'});
      }

      const courseId = req.query.courseId || req.body.courseId;

      if (!courseId) {
        return res.status(400).json({error: 'courseId is required'});
      }

      try {
        const status = await bookingService.getCourseAvailability(db, courseId);
        return res.json(status);
      } catch (error) {
        console.error('Error getting course status:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

/**
 * Cache mémoire court pour les listes de cours disponibles.
 * Le frontend interroge getAvailableCourses toutes les 30 s ; la disponibilité
 * change rarement en deçà de cette fenêtre. Ce cache évite de re-solliciter
 * Firestore à chaque requête (et limite l'impact des démarrages à froid).
 */
const COURSES_CACHE_TTL_MS = 20 * 1000;
const coursesCache = new Map(); // clé -> {expiresAt, payload}

function readCoursesCache(key) {
  const entry = coursesCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.payload;
  }
  return null;
}

function writeCoursesCache(key, payload) {
  coursesCache.set(key, {
    expiresAt: Date.now() + COURSES_CACHE_TTL_MS,
    payload: payload,
  });
  // Nettoyage simple : éviter une croissance illimitée de la Map
  if (coursesCache.size > 20) {
    for (const [k, v] of coursesCache) {
      if (v.expiresAt <= Date.now()) {
        coursesCache.delete(k);
      }
    }
  }
}

/**
 * Liste tous les cours disponibles
 */
exports.getAvailableCourses = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      // Les cours changent sans nouvelle publication du site (synchronisation
      // Google Calendar). Empêcher un cache HTTP de servir une liste périmée.
      res.set('Cache-Control', 'no-store');

      try {
        const cached = readCoursesCache('getAvailableCourses');
        if (cached) {
          return res.json(cached);
        }

        const now = Timestamp.now();

        const coursesSnapshot = await db.collection('courses')
            .where('startTime', '>=', now)
            .where('status', '==', 'active')
            .orderBy('startTime', 'asc')
            .limit(100)
            .get();

        const courseDocs = coursesSnapshot.docs;
        const courseIds = courseDocs.map((doc) => doc.id);

        // Compter les participants en une passe groupée (max 30 IDs par requête
        // Firestore) au lieu d'une requête par cours (problème N+1).
        // Un seul filtre `in` sur courseId : la combinaison de deux filtres
        // `in` (courseId x statut) dépasserait la limite Firestore de 30
        // disjonctions. Le filtre de statut est appliqué en mémoire.
        const participantCounts = new Map(courseIds.map((id) => [id, 0]));
        const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending_cash'];
        for (let i = 0; i < courseIds.length; i += 30) {
          const chunk = courseIds.slice(i, i + 30);
          if (chunk.length === 0) continue;
          const bookingsSnapshot = await db.collection('bookings')
              .where('courseId', 'in', chunk)
              .get();
          bookingsSnapshot.docs.forEach((bookingDoc) => {
            const booking = bookingDoc.data();
            if (booking.courseId && participantCounts.has(booking.courseId) &&
                ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
              participantCounts.set(booking.courseId,
                  participantCounts.get(booking.courseId) + 1);
            }
          });
        }

        const courses = courseDocs.map((doc) => {
          const course = doc.data();
          const participantCount = participantCounts.get(doc.id) || 0;
          const spotsRemaining = course.maxCapacity - participantCount;

          return {
            id: doc.id,
            title: course.title,
            date: course.date,
            time: course.time,
            location: course.location,
            maxCapacity: course.maxCapacity,
            spotsRemaining: spotsRemaining,
            isFull: spotsRemaining <= 0,
            price: course.price || 25,
          };
        });

        const payload = {
          success: true,
          courses: courses,
        };
        writeCoursesCache('getAvailableCourses', payload);

        return res.json(payload);
      } catch (error) {
        console.error('Error getting courses:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

/**
 * Endpoint santé léger pour discovery agent/API catalog
 */
exports.apiStatus = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      return res.json({
        ok: true,
        service: 'fluance-booking-api',
        timestamp: new Date().toISOString(),
        endpoints: [
          '/api/courses',
          '/api/course-status',
          '/api/pass-status',
          '/api/bookings',
          '/api/send-contact-email',
        ],
      });
    },
);

/**
 * Vérifie si un utilisateur a un pass actif (Flow Pass ou Semestriel)
 * Appelé par le frontend pour afficher le statut avant réservation
 */
exports.checkUserPass = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      if (!passService) {
        return res.status(500).json({error: 'Pass service not available'});
      }

      const email = req.query.email || req.body.email;

      if (!email) {
        return res.status(400).json({error: 'email is required'});
      }

      // 🔒 Anti-énumération : rate limiting par IP et par email
      const ipLimit = await checkRateLimit(`ip:${getClientIp(req)}`, 'checkUserPass', 30, 3600);
      if (ipLimit.limited) {
        return res.status(429).json({error: 'Rate limited', message: 'Trop de requêtes. Réessayez plus tard.'});
      }
      const emailLimit = await checkRateLimit(email.toLowerCase().trim(), 'checkUserPass', 15, 3600);
      if (emailLimit.limited) {
        return res.status(429).json({error: 'Rate limited', message: 'Trop de requêtes. Réessayez plus tard.'});
      }

      try {
        const result = await passService.checkUserPass(db, email);
        return res.json(result);
      } catch (error) {
        console.error('Error checking user pass:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

/**
 * Traite une réservation de cours
 * Gère la transaction atomique et la création du paiement
 * Supporte les pass existants (Flow Pass, Semestriel)
 */
exports.bookCourse = onRequest(
    {
      region: 'europe-west1',
      secrets: [
        'STRIPE_SECRET_KEY',
        'STRIPE_PRICE_ID_SEMESTER_PASS',
        'GOOGLE_SHEET_ID',
        'GOOGLE_SERVICE_ACCOUNT',
        'MAILJET_API_KEY',
        'MAILJET_API_SECRET',
        'ADMIN_EMAIL',
      ],
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      try {
        console.log('📦 bookCourse request body:', JSON.stringify(req.body));
        console.log('🔍 Checking services... bookingService:', !!bookingService, 'passService:', !!passService);
        if (!bookingService) {
          console.error('❌ bookingService is missing!');
          return res.status(500).json({error: 'Booking service not available'});
        }

        if (req.method !== 'POST') {
          return res.status(405).json({error: 'Method not allowed'});
        }

        const {
          courseId,
          email,
          firstName,
          lastName,
          phone,
          paymentMethod,
          pricingOption,
          usePass, // true si l'utilisateur veut utiliser son pass existant
          passId, // ID du pass à utiliser (optionnel)
        } = req.body;

        // Validation
        if (!courseId || !email) {
          return res.status(400).json({
            error: 'Missing required fields',
            required: ['courseId', 'email'],
          });
        }

        // Validation des champs obligatoires
        if (!firstName || !lastName) {
          return res.status(400).json({
            error: 'Missing required fields',
            required: ['firstName', 'lastName'],
            message: 'Le prénom et le nom sont obligatoires',
          });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // 🔒 Anti-spam / anti-abus : rate limiting par IP et par email
        const clientIp = getClientIp(req);
        const ipLimit = await checkRateLimit(`ip:${clientIp}`, 'bookCourse', 30, 3600);
        if (ipLimit.limited) {
          return res.status(429).json({
            success: false,
            error: 'RATE_LIMITED',
            message: `Trop de réservations. Réessayez dans ${ipLimit.retryAfterSeconds} s.`,
          });
        }
        const emailLimit = await checkRateLimit(normalizedEmail, 'bookCourse', 10, 3600);
        if (emailLimit.limited) {
          return res.status(429).json({
            success: false,
            error: 'RATE_LIMITED',
            message: 'Trop de réservations pour cette adresse. Réessayez plus tard.',
          });
        }

        // 🔒 Utilisation d'un pass : authentification Firebase OBLIGATOIRE.
        // Empêche d'utiliser/consommer le pass d'un autre utilisateur en
        // connaissant simplement son email (IDOR). Le pass est associé à
        // l'email du compte authentifié.
        if (usePass) {
          const idToken = await verifyIdToken(req);
          if (!idToken) {
            return res.status(401).json({
              success: false,
              error: 'AUTH_REQUIRED',
              message: 'Connectez-vous pour utiliser votre pass.',
            });
          }
          const tokenEmail = (idToken.email || '').toLowerCase().trim();
          if (!tokenEmail || tokenEmail !== normalizedEmail) {
            return res.status(403).json({
              success: false,
              error: 'EMAIL_MISMATCH',
              message: 'Ce pass est associé à un autre compte. Vérifiez l\'email utilisé.',
            });
          }
        }

        // Initialiser Stripe
        let stripe = null;
        if (process.env.STRIPE_SECRET_KEY) {
          stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        }

        const userData = {
          email: normalizedEmail,
          firstName: firstName || '',
          lastName: lastName || '',
          phone: phone || '',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
          userAgent: req.headers['user-agent'] || '',
        };

        // ============================================================
        // GESTION DES PASS EXISTANTS
        // ============================================================

        // Si l'utilisateur veut utiliser son pass
        if (usePass && passService) {
          const passStatus = await passService.checkUserPass(db, normalizedEmail);

          if (!passStatus.hasActivePass) {
            return res.status(400).json({
              success: false,
              error: 'NO_ACTIVE_PASS',
              message: passStatus.message || 'Vous n\'avez pas de pass actif',
            });
          }

          const activePass = passStatus.pass;
          const targetPassId = passId || activePass.passId;

          // Vérifier la disponibilité du cours
          const courseDoc = await db.collection('courses').doc(courseId).get();
          if (!courseDoc.exists) {
            return res.status(404).json({error: 'Course not found'});
          }
          const course = courseDoc.data();

          // Vérifier les places disponibles
          const bookingsSnapshot = await db.collection('bookings')
              .where('courseId', '==', courseId)
              .where('status', 'in', ['confirmed', 'pending_cash'])
              .get();

          const participantCount = bookingsSnapshot.size;
          if (participantCount >= course.maxCapacity) {
          // Ajouter à la liste d'attente
            const waitlistData = {
              courseId: courseId,
              email: normalizedEmail,
              firstName: userData.firstName,
              lastName: userData.lastName,
              phone: userData.phone,
              status: 'waiting',
              passId: targetPassId,
              createdAt: new Date(),
            };
            const waitlistRef = await db.collection('waitlist').add(waitlistData);

            // Envoyer notification admin pour liste d'attente
            try {
              const courseDoc = await db.collection('courses').doc(courseId).get();
              const course = courseDoc.exists ? courseDoc.data() : null;
              if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                await sendWaitlistNotificationAdmin(
                    waitlistData,
                    course,
                    process.env.MAILJET_API_KEY,
                    process.env.MAILJET_API_SECRET,
                );
              }
            } catch (notifError) {
              console.error('Error sending waitlist admin notification:', notifError);
            // Ne pas bloquer le processus
            }

            return res.json({
              success: true,
              status: 'waitlisted',
              waitlistId: waitlistRef.id,
              message: 'Le cours est complet. Vous avez été ajouté à la liste d\'attente.',
            });
          }

          // Vérifier si déjà inscrit
          const existingBooking = await db.collection('bookings')
              .where('courseId', '==', courseId)
              .where('email', '==', normalizedEmail)
              .where('status', 'in', ['confirmed', 'pending_cash', 'pending'])
              .limit(1)
              .get();

          if (!existingBooking.empty) {
            return res.status(400).json({
              success: false,
              error: 'ALREADY_BOOKED',
              message: 'Vous êtes déjà inscrit à ce cours.',
            });
          }

          // Utiliser une séance du pass (sauf si illimité)
          let sessionResult = null;
          if (activePass.passType !== 'semester_pass' || activePass.sessionsRemaining !== -1) {
            sessionResult = await passService.usePassSession(db, targetPassId, courseId);
          }

          // Créer la réservation (confirmée directement, pas de paiement)
          const bookingId = db.collection('bookings').doc().id;
          const bookingData = {
            bookingId: bookingId,
            courseId: courseId,
            courseName: course.title,
            courseDate: course.date,
            courseTime: course.time,
            courseLocation: course.location,
            email: normalizedEmail,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: userData.phone,
            paymentMethod: 'pass',
            pricingOption: activePass.passType,
            passId: targetPassId,
            amount: 0, // Pas de paiement
            currency: 'CHF',
            status: 'confirmed',
            createdAt: new Date(),
            updatedAt: new Date(),
            paidAt: new Date(),
            notes: activePass.passType === 'semester_pass' ?
            'Pass Semestriel' :
            `Flow Pass (séance ${activePass.sessionsTotal - (sessionResult?.sessionsRemaining || 0)
            }/${activePass.sessionsTotal})`,
          };

          await db.collection('bookings').doc(bookingId).set(bookingData);

          // Mettre à jour le compteur de participants
          await db.collection('courses').doc(courseId).update({
            participantCount: participantCount + 1,
          });

          // Ajouter au Google Sheet
          try {
            const sheetId = process.env.GOOGLE_SHEET_ID;
            if (!sheetId) {
              console.warn('⚠️ GOOGLE_SHEET_ID not configured, skipping sheet update');
            } else if (!googleService) {
              console.warn('⚠️ GoogleService not available, skipping sheet update');
            } else {
              console.log(`📊 Attempting to add booking to sheet: ${userData.email} for ${course.title}`);
              await googleService.appendUserToSheet(
                  sheetId,
                  courseId,
                  userData,
                  {
                    courseName: course.title,
                    courseDate: course.date,
                    courseTime: course.time,
                    location: course.location || '',
                    paymentMethod: activePass.passType === 'semester_pass' ? 'Pass Semestriel' : 'Flow Pass',
                    paymentStatus: 'Pass utilisé',
                    amount: '0 CHF',
                    status: 'Confirmé',
                    bookingId: bookingId,
                    notes: bookingData.notes,
                    passType: activePass.passType === 'semester_pass' ? 'Pass Semestriel' : 'Flow Pass',
                    sessionsRemaining: sessionResult?.sessionsRemaining !== undefined ? `${sessionResult.sessionsRemaining}/${activePass.sessionsTotal}` : (activePass.passType === 'semester_pass' ? 'Illimité' : ''),
                    paidAt: new Date(),
                    source: 'web',
                    isCancelled: false,
                    isWaitlisted: false,
                  },
              );
              console.log(
                  `✅ Successfully added booking to sheet: ${userData.email}`,
              );
            }
          } catch (sheetError) {
            console.error('❌ Error updating sheet:', sheetError.message);
            console.error('❌ Sheet error details:', {
              message: sheetError.message,
              code: sheetError.code,
              stack: sheetError.stack,
            });
          }

          // Envoyer email de confirmation
          try {
          // Créer un token de désinscription
            const cancellationTokenResult =
            await bookingService.createCancellationToken(db, bookingId, 30);
            const cancellationUrl = cancellationTokenResult.success ?
            cancellationTokenResult.cancellationUrl :
            null;

            await db.collection('mail').add({
              to: normalizedEmail,
              template: {
                name: 'booking-confirmation',
                data: {
                  firstName: userData.firstName,
                  courseName: course.title,
                  courseDate: course.date,
                  courseTime: course.time,
                  location: course.location,
                  bookingId: bookingId,
                  passType: activePass.passType,
                  sessionsRemaining: sessionResult?.sessionsRemaining ?? -1,
                  cancellationUrl: cancellationUrl,
                },
              },
            });
          } catch (emailError) {
            console.error('Error sending email:', emailError);
          }

          // Envoyer notification admin pour réservation avec pass
          try {
            const bookingDoc = await db.collection('bookings').doc(bookingId).get();
            const booking = bookingDoc.exists ? bookingDoc.data() : null;
            if (booking && process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
              await sendBookingNotificationAdmin(
                  booking,
                  course,
                  process.env.MAILJET_API_KEY,
                  process.env.MAILJET_API_SECRET,
              );
            }
          } catch (notifError) {
            console.error('Error sending admin notification:', notifError);
          // Ne pas bloquer le processus
          }

          return res.json({
            success: true,
            status: 'confirmed',
            bookingId: bookingId,
            usedPass: true,
            passType: activePass.passType,
            sessionsRemaining: sessionResult?.sessionsRemaining ?? -1,
            message: activePass.passType === 'semester_pass' ?
            'Réservation confirmée avec votre Pass Semestriel !' :
            `Réservation confirmée ! Il vous reste ${sessionResult?.sessionsRemaining
            } séance(s) sur votre Flow Pass.`,
          });
        }

        // ============================================================
        // NOUVELLE RÉSERVATION AVEC PAIEMENT
        // ============================================================

        // Récupérer le code partenaire si fourni
        const partnerCode = req.body.partnerCode || null;
        console.log('🏁 Calling processBooking with:', {
          courseId,
          email: userData.email,
          paymentMethod,
          pricingOption,
          partnerCode,
          stripeExists: !!stripe,
        });

        const result = await bookingService.processBooking(
            db,
            stripe,
            courseId,
            userData,
            paymentMethod || 'card',
            pricingOption || 'single',
            partnerCode, // Code partenaire pour remise
            req.body.origin || 'https://fluance.io', // Inject Origin
        );
        console.log('✅ processBooking finished successfully');

        // Si paiement espèces, ajouter au Google Sheet et envoyer email
        if (result.success && result.status === 'confirmed_pending_cash') {
          try {
            const sheetId = process.env.GOOGLE_SHEET_ID;
            if (!sheetId) {
              console.warn('⚠️ GOOGLE_SHEET_ID not configured, skipping sheet update');
            } else if (!googleService) {
              console.warn('⚠️ GoogleService not available, skipping sheet update');
            } else {
              const courseDoc = await db.collection('courses').doc(courseId).get();
              const course = courseDoc.data();

              console.log(`📊 Attempting to add cash booking to sheet: ${userData.email}`);
              await googleService.appendUserToSheet(
                  sheetId,
                  courseId,
                  userData,
                  {
                    courseName: course?.title || '',
                    courseDate: course?.date || '',
                    courseTime: course?.time || '',
                    location: course?.location || '',
                    paymentMethod: 'Espèces',
                    paymentStatus: 'À régler sur place',
                    amount: (course?.price || 25) + ' CHF',
                    status: 'Confirmé (espèces)',
                    bookingId: result.bookingId,
                    notes: 'Paiement en espèces à régler sur place',
                    paidAt: null, // Pas encore payé
                    source: 'web',
                    isCancelled: false,
                    isWaitlisted: false,
                  },
              );
              console.log(`✅ Successfully added cash booking to sheet: ${userData.email}`);
            }
          } catch (sheetError) {
            console.error('❌ Error updating sheet for cash booking:', sheetError.message);
            console.error('❌ Sheet error details:', {
              message: sheetError.message,
              code: sheetError.code,
            });
          }

          try {
            const bookingDoc = await db.collection('bookings').doc(result.bookingId).get();
            const booking = bookingDoc.exists ? bookingDoc.data() : null;
            const courseDoc = await db.collection('courses').doc(courseId).get();
            const course = courseDoc.exists ? courseDoc.data() : null;

            if (booking) {
              try {
                await sendBookingConfirmationEmail(db, result.bookingId, booking, course);
                console.log(`📧 Confirmation email sent to ${normalizedEmail} for cash booking`);
              } catch (emailError) {
                console.error('Error sending confirmation email:', emailError);
              }

              if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                try {
                  await sendBookingNotificationAdmin(
                      booking,
                      course,
                      process.env.MAILJET_API_KEY,
                      process.env.MAILJET_API_SECRET,
                  );
                } catch (notifError) {
                  console.error('Error sending admin notification:', notifError);
                }
              }
            }

            await handleDoubleOptInForBooking(
                db,
                normalizedEmail,
                userData.firstName || '',
                courseId,
                result.bookingId,
            );
          } catch (optInError) {
            console.error('Error handling post-booking emails:', optInError);
          }
        } else if (result.success && result.status === 'pending_payment') {
        // Pour les paiements en ligne, vérifier le double opt-in
        // L'email de confirmation sera envoyé après paiement réussi via webhook
          const existingConfirmation = await db.collection('newsletterConfirmations')
              .where('email', '==', normalizedEmail)
              .where('sourceOptin', 'in', ['presentiel', 'presentiel_compte'])
              .limit(1)
              .get();

          const isConfirmed = !existingConfirmation.empty &&
          existingConfirmation.docs[0].data().confirmed === true;

          if (!isConfirmed) {
          // Nouveau contact : déclencher double opt-in
            await handleDoubleOptInForBooking(
                db,
                normalizedEmail,
                userData.firstName || '',
                courseId,
                result.bookingId,
            );
          }
        } else if (result.success && result.status === 'confirmed') {
        // Cours gratuit (essai) : ajouter au Google Sheet et gérer les emails
          try {
            const sheetId = process.env.GOOGLE_SHEET_ID;
            if (!sheetId) {
              console.warn('⚠️ GOOGLE_SHEET_ID not configured, skipping sheet update');
            } else if (!googleService) {
              console.warn('⚠️ GoogleService not available, skipping sheet update');
            } else {
              const courseDoc = await db.collection('courses').doc(courseId).get();
              const course = courseDoc.data();

              console.log(`📊 Attempting to add free trial booking to sheet: ${normalizedEmail}`);
              await googleService.appendUserToSheet(
                  sheetId,
                  courseId,
                  userData,
                  {
                    courseName: course?.title || '',
                    courseDate: course?.date || '',
                    courseTime: course?.time || '',
                    location: course?.location || '',
                    paymentMethod: 'Cours d\'essai gratuit',
                    paymentStatus: 'Confirmé',
                    amount: '0 CHF',
                    status: 'Confirmé (essai gratuit)',
                    bookingId: result.bookingId,
                    notes: 'Cours d\'essai gratuit - première séance',
                    paidAt: new Date(), // Confirmé immédiatement
                    source: 'web',
                    isCancelled: false,
                    isWaitlisted: false,
                  },
              );
              console.log(`✅ Successfully added free trial booking to Google Sheet for ${normalizedEmail}`);
            }
          } catch (sheetError) {
            console.error('❌ Error updating sheet for free trial:', sheetError.message);
            console.error('❌ Sheet error details:', {
              message: sheetError.message,
              code: sheetError.code,
            });
          }

          try {
            const bookingDoc = await db.collection('bookings').doc(result.bookingId).get();
            const booking = bookingDoc.exists ? bookingDoc.data() : null;
            const courseDoc = await db.collection('courses').doc(courseId).get();
            const course = courseDoc.exists ? courseDoc.data() : null;

            if (booking) {
              try {
                await sendBookingConfirmationEmail(db, result.bookingId, booking, course);
                console.log(`📧 Confirmation email sent to ${normalizedEmail} for free trial booking`);
              } catch (emailError) {
                console.error('Error sending confirmation email:', emailError);
              }

              if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                try {
                  await sendBookingNotificationAdmin(
                      booking,
                      course,
                      process.env.MAILJET_API_KEY,
                      process.env.MAILJET_API_SECRET,
                  );
                } catch (notifError) {
                  console.error('Error sending admin notification:', notifError);
                }
              }
            }

            await handleDoubleOptInForBooking(
                db,
                normalizedEmail,
                userData.firstName || '',
                courseId,
                result.bookingId,
            );
          } catch (postBookingError) {
            console.error('Error handling free trial booking emails:', postBookingError);
          }
        }

        return res.json(result);
      } catch (error) {
        console.error('🔥 bookCourse CRITICAL ERROR:', error.message);
        console.error('🔥 Stack trace:', error.stack);
        return res.status(500).json({
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          type: 'CRITICAL_INTERNAL_ERROR',
        });
      }
    },
);

/**
 * Note: La logique de webhook pour les réservations de cours et pass
 * a été fusionnée dans webhookStripe pour simplifier la gestion.
 * Cette fonction a été supprimée - tout est géré dans webhookStripe.
 */
/* exports.stripeBookingWebhook = onRequest(
    {
      region: 'europe-west1',
      secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT'],
    },
    async (req, res) => {
      if (!bookingService) {
        return res.status(500).send('Booking service not available');
      }

      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!stripeSecretKey || !webhookSecret) {
        console.error('Stripe secrets not configured');
        return res.status(500).send('Stripe not configured');
      }

      const stripe = require('stripe')(stripeSecretKey);
      const sig = req.headers['stripe-signature'];

      let event;
      try {
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            webhookSecret,
        );
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Gérer les événements
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          const bookingId = paymentIntent.metadata?.bookingId;
          const passType = paymentIntent.metadata?.passType;
          const customerEmail = paymentIntent.metadata?.email ||
              paymentIntent.receipt_email;

          // Cas 1: Réservation de cours simple
          if (bookingId && paymentIntent.metadata?.type === 'course_booking') {
            console.log(`✅ Payment succeeded for booking ${bookingId}`);
            const result = await bookingService.confirmBookingPayment(
                db,
                bookingId,
                paymentIntent.id,
            );
            console.log('Confirmation result:', result);

            // Envoyer notification admin pour réservation confirmée
            try {
              const bookingDoc = await db.collection('bookings').doc(bookingId).get();
              if (bookingDoc.exists) {
                const booking = bookingDoc.data();
                const courseDoc = await db.collection('courses').doc(booking.courseId).get();
                const course = courseDoc.exists ? courseDoc.data() : null;

                if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                  await sendBookingNotificationAdmin(
                      booking,
                      course,
                      process.env.MAILJET_API_KEY,
                      process.env.MAILJET_API_SECRET,
                  );
                }
              }
            } catch (notifError) {
              console.error('Error sending admin notification:', notifError);
              // Ne pas bloquer le processus
            }

                // Envoyer notification admin pour réservation confirmée
                try {
                  const bookingDoc = await db.collection('bookings').doc(bookingId).get();
                  if (bookingDoc.exists) {
                    const booking = bookingDoc.data();
                    const courseDoc = await db.collection('courses').doc(booking.courseId).get();
                    const course = courseDoc.exists ? courseDoc.data() : null;

                    if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                      await sendBookingNotificationAdmin(
                          booking,
                          course,
                          process.env.MAILJET_API_KEY,
                          process.env.MAILJET_API_SECRET,
                      );
                    }
                  }
                } catch (notifError) {
                  console.error('Error sending admin notification:', notifError);
                  // Ne pas bloquer le processus
                }
          }

          // Cas 2: Achat d'un Flow Pass
          if (passType === 'flow_pass' && customerEmail && passService) {
            console.log(`✅ Flow Pass purchased for ${customerEmail}`);
            try {
              const pass = await passService.createUserPass(db, customerEmail, 'flow_pass', {
                stripePaymentIntentId: paymentIntent.id,
                firstName: paymentIntent.metadata?.firstName || '',
                lastName: paymentIntent.metadata?.lastName || '',
                phone: paymentIntent.metadata?.phone || '',
              });
              console.log(`✅ Flow Pass created: ${pass.passId}`);

              // Envoyer email de confirmation
              await db.collection('mail').add({
                to: customerEmail,
                template: {
                  name: 'pass-purchase-confirmation',
                  data: {
                    firstName: paymentIntent.metadata?.firstName || '',
                    passType: 'Flow Pass',
                    sessions: 10,
                    validityMonths: 12,
                    passId: pass.passId,
                  },
                },
              });
            } catch (passError) {
              console.error('Error creating Flow Pass:', passError);
            }
          }
          break;
        }

        case 'checkout.session.completed': {
          const session = event.data.object;
          const passType = session.metadata?.passType;
          const customerEmail = session.customer_details?.email ||
              session.customer_email ||
              session.metadata?.email;

          // Achat d'un Pass via Checkout Session
          if (passType && customerEmail && passService) {
            console.log(`✅ ${passType} purchased via Checkout for ${customerEmail}`);

            if (passType === 'flow_pass') {
              try {
                const pass = await passService.createUserPass(db, customerEmail, 'flow_pass', {
                  stripePaymentIntentId: session.payment_intent,
                  firstName: session.metadata?.firstName || session.customer_details?.name || '',
                  lastName: session.metadata?.lastName || '',
                  phone: session.customer_details?.phone || '',
                });
                console.log(`✅ Flow Pass created: ${pass.passId}`);
              } catch (passError) {
                console.error('Error creating Flow Pass:', passError);
              }
            }
          }
          break;
        }

        case 'invoice.paid': {
          // Gestion des abonnements (Pass Semestriel)
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;
          const customerEmail = invoice.customer_email;

          if (subscriptionId && passService) {
            // Vérifier si c'est un nouveau pass ou un renouvellement
            const existingPass = await db.collection('userPasses')
                .where('stripeSubscriptionId', '==', subscriptionId)
                .limit(1)
                .get();

            if (existingPass.empty) {
              // Nouveau Pass Semestriel
              console.log(`✅ New Semester Pass for ${customerEmail}`);
              try {
                const pass = await passService.createUserPass(db, customerEmail, 'semester_pass', {
                  stripeSubscriptionId: subscriptionId,
                  stripePaymentIntentId: invoice.payment_intent,
                  firstName: invoice.customer_name || '',
                });
                console.log(`✅ Semester Pass created: ${pass.passId}`);

                // Envoyer email de confirmation
                await db.collection('mail').add({
                  to: customerEmail,
                  template: {
                    name: 'pass-purchase-confirmation',
                    data: {
                      firstName: invoice.customer_name || '',
                      passType: 'Pass Semestriel',
                      sessions: -1, // Illimité
                      validityMonths: 6,
                      isRecurring: true,
                    },
                  },
                });
              } catch (passError) {
                console.error('Error creating Semester Pass:', passError);
              }
            } else {
              // Renouvellement du Pass Semestriel
              console.log(`✅ Semester Pass renewed for ${customerEmail}`);
              try {
                await passService.renewSemesterPass(db, subscriptionId);
              } catch (renewError) {
                console.error('Error renewing Semester Pass:', renewError);
              }
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          // Annulation de l'abonnement (Pass Semestriel)
          const subscription = event.data.object;
          console.log(`⚠️ Subscription cancelled: ${subscription.id}`);

          if (passService) {
            try {
              await passService.cancelSemesterPass(db, subscription.id);
            } catch (cancelError) {
              console.error('Error cancelling Semester Pass:', cancelError);
            }
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;
          const bookingId = paymentIntent.metadata?.bookingId;

          if (bookingId) {
            console.log(`❌ Payment failed for booking ${bookingId}`);
            // Mettre à jour le statut de la réservation
            await db.collection('bookings').doc(bookingId).update({
              status: 'payment_failed',
              paymentError: paymentIntent.last_payment_error?.message || 'Payment failed',
              updatedAt: new Date(),
            });
          }
          break;
        }

        case 'charge.dispute.created': {
          const dispute = event.data.object;
          console.log('⚠️ Dispute created:', dispute.id);
          // Loguer pour traitement manuel
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return res.json({received: true});
    },
); */

/**
 * Annule une réservation
 */
exports.cancelCourseBooking = onRequest(
    {
      region: 'europe-west1',
      secrets: ['STRIPE_SECRET_KEY'],
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      if (!bookingService) {
        return res.status(500).json({error: 'Booking service not available'});
      }

      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
      }

      const {bookingId, email, reason} = req.body;

      if (!bookingId || !email) {
        return res.status(400).json({error: 'bookingId and email are required'});
      }

      // 🔒 Sécurité : authentification Firebase requise et email du compte
      // authentifié obligatoirement égal à celui de la réservation.
      // (Empêche l'annulation d'une réservation en connaissant seulement
      // email + bookingId.)
      const idToken = await verifyIdToken(req);
      if (!idToken) {
        return res.status(401).json({error: 'Authentication required'});
      }
      const tokenEmail = (idToken.email || '').toLowerCase().trim();
      if (!tokenEmail || tokenEmail !== email.toLowerCase().trim()) {
        return res.status(403).json({error: 'Email does not match authenticated account'});
      }

      // Vérifier que l'email correspond à la réservation
      const bookingDoc = await db.collection('bookings').doc(bookingId).get();
      if (!bookingDoc.exists) {
        return res.status(404).json({error: 'Booking not found'});
      }

      const booking = bookingDoc.data();
      if (booking.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({error: 'Email does not match booking'});
      }

      let stripe = null;
      if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      }

      try {
        const result = await bookingService.cancelBooking(db, stripe, bookingId, reason);
        return res.json(result);
      } catch (error) {
        console.error('Error cancelling booking:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

/**
 * Récupère les réservations d'un utilisateur
 */
exports.getUserBookings = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      const email = req.query.email || req.body.email;

      if (!email) {
        return res.status(400).json({error: 'email is required'});
      }

      // 🔒 Anti-énumération : rate limiting par IP et par email
      const ipLimit = await checkRateLimit(`ip:${getClientIp(req)}`, 'getUserBookings', 20, 3600);
      if (ipLimit.limited) {
        return res.status(429).json({error: 'Rate limited', message: 'Trop de requêtes. Réessayez plus tard.'});
      }
      const emailLimit = await checkRateLimit(email.toLowerCase().trim(), 'getUserBookings', 10, 3600);
      if (emailLimit.limited) {
        return res.status(429).json({error: 'Rate limited', message: 'Trop de requêtes. Réessayez plus tard.'});
      }

      try {
        const bookingsSnapshot = await db.collection('bookings')
            .where('email', '==', email.toLowerCase())
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const bookings = bookingsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
        }));

        return res.json({
          success: true,
          bookings: bookings,
        });
      } catch (error) {
        console.error('Error getting user bookings:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

/**
 * Récupère la position d'un utilisateur dans la liste d'attente
 */
exports.getWaitlistPosition = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      if (!bookingService) {
        return res.status(500).json({error: 'Booking service not available'});
      }

      const email = req.query.email || req.body.email;
      const courseId = req.query.courseId || req.body.courseId;

      if (!email || !courseId) {
        return res.status(400).json({error: 'email and courseId are required'});
      }

      // 🔒 Rate limiting par IP
      const ipLimit = await checkRateLimit(`ip:${getClientIp(req)}`, 'getWaitlistPosition', 20, 3600);
      if (ipLimit.limited) {
        return res.status(429).json({error: 'Rate limited', message: 'Trop de requêtes. Réessayez plus tard.'});
      }

      try {
        const result = await bookingService.getWaitlistPosition(db, email, courseId);
        return res.json(result);
      } catch (error) {
        console.error('Error getting waitlist position:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

/**
 * Retire un utilisateur de la liste d'attente
 */
exports.removeFromWaitlist = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      if (!bookingService) {
        return res.status(500).json({error: 'Booking service not available'});
      }

      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
      }

      const {waitlistId, email} = req.body;

      if (!waitlistId || !email) {
        return res.status(400).json({error: 'waitlistId and email are required'});
      }

      // 🔒 Rate limiting par IP et par email
      const ipLimit = await checkRateLimit(`ip:${getClientIp(req)}`, 'removeFromWaitlist', 20, 3600);
      if (ipLimit.limited) {
        return res.status(429).json({error: 'Rate limited', message: 'Trop de requêtes. Réessayez plus tard.'});
      }
      const emailLimit = await checkRateLimit(email.toLowerCase().trim(), 'removeFromWaitlist', 10, 3600);
      if (emailLimit.limited) {
        return res.status(429).json({error: 'Rate limited', message: 'Trop de requêtes. Réessayez plus tard.'});
      }

      try {
        const result = await bookingService.removeFromWaitlist(db, waitlistId, email);
        return res.json(result);
      } catch (error) {
        console.error('Error removing from waitlist:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

/**
 * Transfère une réservation vers un autre cours (sans remboursement)
 */
exports.transferCourseBooking = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      if (!bookingService) {
        return res.status(500).json({error: 'Booking service not available'});
      }

      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
      }

      const {bookingId, newCourseId, email} = req.body;

      if (!bookingId || !newCourseId || !email) {
        return res.status(400).json({error: 'bookingId, newCourseId and email are required'});
      }

      try {
        const result = await bookingService.transferBooking(db, bookingId, newCourseId, email);
        return res.json(result);
      } catch (error) {
        console.error('Error transferring booking:', error);
        return res.status(500).json({error: error.message});
      }
    },
);

/**
 * Désinscription via token (depuis email)
 * Valide le token et redirige vers la page de choix de nouveau cours
 */
exports.cancelBookingByToken = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      if (!bookingService) {
        return res.status(500).json({error: 'Booking service not available'});
      }

      const token = req.query.token || req.body.token;

      if (!token) {
        return res.status(400).json({error: 'Token is required'});
      }

      try {
      // Valider le token
        const tokenValidation = await bookingService.validateCancellationToken(db, token);

        if (!tokenValidation.success) {
        // Rediriger vers une page d'erreur
          const errorMessages = {
            'TOKEN_NOT_FOUND': 'Ce lien de désinscription n\'existe pas ou a déjà été utilisé.',
            'TOKEN_ALREADY_USED': 'Ce lien de désinscription a déjà été utilisé.',
            'TOKEN_EXPIRED': 'Ce lien de désinscription a expiré. Veuillez contacter le support.',
            'BOOKING_NOT_FOUND': 'La réservation associée à ce lien n\'existe plus.',
            'ALREADY_CANCELLED': 'Cette réservation a déjà été annulée.',
          };

          const errorMessage = errorMessages[tokenValidation.error] || 'Une erreur est survenue.';
          return res.redirect(`https://fluance.io/presentiel/desinscription?error=${encodeURIComponent(errorMessage)}`);
        }

        // Annuler la réservation
        const cancelResult = await bookingService.cancelBooking(db, null, tokenValidation.bookingId, 'Désinscription via email');

        if (!cancelResult.success) {
          return res.redirect(`https://fluance.io/presentiel/desinscription?error=${encodeURIComponent('Impossible d\'annuler la réservation.')}`);
        }

        // Marquer le token comme utilisé
        await bookingService.markCancellationTokenAsUsed(db, token);

        // 🔒 Créer un token de transfert à usage unique (24h) : l'URL ne
        // contient plus bookingId + email (IDOR), le serveur dérive
        // la réservation et l'email depuis le token.
        const transferToken = await bookingService.createTransferToken(
            db,
            tokenValidation.bookingId,
            tokenValidation.email,
            24,
        );

        // Rediriger vers la page de choix de nouveau cours avec le token
        return res.redirect(`https://fluance.io/presentiel/choisir-cours?token=${transferToken}&cancelled=true`);
      } catch (error) {
        console.error('Error cancelling booking by token:', error);
        return res.redirect(`https://fluance.io/presentiel/desinscription?error=${encodeURIComponent('Une erreur est survenue lors de la désinscription.')}`);
      }
    },
);

/**
 * Récupère la réservation annulée associée à un token de transfert
 * (usage unique, émis après désinscription). Remplace la recherche par
 * email + bookingId (anti-IDOR) : l'email et le bookingId sont dérivés
 * du token côté serveur.
 */
exports.getTransferBooking = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      const token = req.query.token || req.body.token;
      if (!token) {
        return res.status(400).json({success: false, error: 'TOKEN_REQUIRED'});
      }

      // 🔒 Rate limiting par IP
      const ipLimit = await checkRateLimit(`ip:${getClientIp(req)}`, 'getTransferBooking', 20, 3600);
      if (ipLimit.limited) {
        return res.status(429).json({success: false, error: 'RATE_LIMITED'});
      }

      try {
        const validation = await bookingService.validateTransferToken(db, token);
        if (!validation.success) {
          return res.status(403).json({success: false, error: validation.error});
        }

        const bookingDoc = await db.collection('bookings').doc(validation.bookingId).get();
        if (!bookingDoc.exists) {
          return res.status(404).json({success: false, error: 'BOOKING_NOT_FOUND'});
        }

        const booking = bookingDoc.data();
        return res.json({
          success: true,
          booking: {
            bookingId: validation.bookingId,
            email: validation.email,
            courseId: booking.courseId || null,
            courseName: booking.courseName || 'Cours Fluance',
            courseDate: booking.courseDate || '',
            courseTime: booking.courseTime || '',
            location: booking.courseLocation || '',
          },
        });
      } catch (error) {
        console.error('Error getting transfer booking:', error);
        return res.status(500).json({success: false, error: error.message});
      }
    },
);

/**
 * Transfère une réservation vers un autre cours à partir d'un token de
 * transfert à usage unique (anti-IDOR : bookingId et email dérivés du token).
 */
exports.transferCourseBookingByToken = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
      }

      const {token, newCourseId} = req.body;
      if (!token || !newCourseId) {
        return res.status(400).json({success: false, error: 'token and newCourseId are required'});
      }

      // 🔒 Rate limiting par IP
      const ipLimit = await checkRateLimit(`ip:${getClientIp(req)}`, 'transferBookingToken', 20, 3600);
      if (ipLimit.limited) {
        return res.status(429).json({success: false, error: 'RATE_LIMITED'});
      }

      try {
        const validation = await bookingService.validateTransferToken(db, token);
        if (!validation.success) {
          return res.status(403).json({success: false, error: validation.error});
        }

        const result = await bookingService.transferBooking(
            db,
            validation.bookingId,
            newCourseId,
            validation.email,
        );

        if (result.success) {
          // Usage unique : le token ne peut être réutilisé qu'une seule fois
          await bookingService.markTransferTokenAsUsed(db, token);
        }

        return res.json(result);
      } catch (error) {
        console.error('Error transferring booking by token:', error);
        return res.status(500).json({success: false, error: error.message});
      }
    },
);

/**
 * Récupère les cours disponibles pour transfert (après désinscription)
 */
exports.getAvailableCoursesForTransfer = onRequest(
    {
      region: 'europe-west1',
      cors: ALLOWED_WEB_ORIGINS,
    },
    async (req, res) => {
      try {
        const excludeCourseId = req.query.excludeCourseId || req.body.excludeCourseId;

        const cacheKey = `getAvailableCoursesForTransfer:${excludeCourseId || 'all'}`;
        const cached = readCoursesCache(cacheKey);
        if (cached) {
          return res.json(cached);
        }

        const now = Timestamp.now();

        const query = db.collection('courses')
            .where('startTime', '>=', now)
            .where('status', '==', 'active')
            .orderBy('startTime', 'asc')
            .limit(20);

        const coursesSnapshot = await query.get();

        const courseDocs = coursesSnapshot.docs
            .filter((doc) => !(excludeCourseId && doc.id === excludeCourseId));
        const courseIds = courseDocs.map((doc) => doc.id);

        // Compter les participants en une passe groupée (max 30 IDs par requête)
        // Un seul filtre `in` sur courseId : la combinaison de deux filtres
        // `in` (courseId x statut) dépasserait la limite Firestore de 30
        // disjonctions. Le filtre de statut est appliqué en mémoire.
        const participantCounts = new Map(courseIds.map((id) => [id, 0]));
        const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending_cash'];
        for (let i = 0; i < courseIds.length; i += 30) {
          const chunk = courseIds.slice(i, i + 30);
          if (chunk.length === 0) continue;
          const bookingsSnapshot = await db.collection('bookings')
              .where('courseId', 'in', chunk)
              .get();
          bookingsSnapshot.docs.forEach((bookingDoc) => {
            const booking = bookingDoc.data();
            if (booking.courseId && participantCounts.has(booking.courseId) &&
                ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
              participantCounts.set(booking.courseId,
                  participantCounts.get(booking.courseId) + 1);
            }
          });
        }

        const courses = courseDocs.map((doc) => {
          const course = doc.data();
          const participantCount = participantCounts.get(doc.id) || 0;
          const spotsRemaining = course.maxCapacity - participantCount;

          return {
            id: doc.id,
            title: course.title,
            date: course.date,
            time: course.time,
            location: course.location,
            maxCapacity: course.maxCapacity,
            spotsRemaining: spotsRemaining,
            isFull: spotsRemaining <= 0,
            price: course.price || 25,
          };
        });

        const payload = {
          success: true,
          courses: courses,
        };
        writeCoursesCache(cacheKey, payload);

        return res.json(payload);
      } catch (error) {
        console.error('Error getting courses for transfer:', error);
        return res.status(500).json({error: error.message});
      }
    },
);
/**
 * Récupère les statistiques de santé de l'automatisation (Monitoring)
 * Utilisé par le mini-dashboard de monitoring
 */
exports.getHealthStats = onCall(
    {
      region: 'europe-west1',
      secrets: ['ADMIN_EMAIL'],
    },
    async (request) => {
      // 🔒 Sécurité : accès réservé aux admins (claim custom `admin: true`)
      if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError('permission-denied', 'Admin access required');
      }

      const days = Math.min(Math.max(parseInt(request.data && request.data.days, 10) || 7, 1), 90);

      try {
        const now = new Date();
        const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        // 1. Récupérer les derniers logs d'audit
        const auditSnapshot = await db.collection('audit_payments')
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp', 'desc')
            .get();

        const logs = auditSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate().toISOString(),
        }));

        // 2. Calculer le taux d'activation des tokens
        const tokensSnapshot = await db.collection('registrationTokens')
            .where('createdAt', '>=', startDate)
            .get();

        const totalTokens = tokensSnapshot.size;
        const usedTokens = tokensSnapshot.docs.filter((d) => d.data().used).length;
        const activationRate = totalTokens > 0 ? (usedTokens / totalTokens) * 100 : 0;

        // 3. Récupérer les alertes (montants discordants)
        // Note: On pourrait aussi loguer spécifiquement les alertes dans audit_payments
        const alerts = logs.filter((l) => l.alert === true);

        return {
          success: true,
          stats: {
            periodDays: days,
            totalPaymentsDetected: logs.length,
            totalTokensCreated: totalTokens,
            usedTokens: usedTokens,
            activationRate: activationRate.toFixed(1) + '%',
            unactivatedCount: totalTokens - usedTokens,
          },
          recentLogs: logs.slice(0, 10),
          alerts: alerts,
        };
      } catch (error) {
        console.error('Error fetching health stats:', error);
        throw new HttpsError('internal', 'Erreur lors de la récupération des stats');
      }
    },
);


/**
 * ============================================================
 * ⚠️ TRANSITION MOLLIE (à supprimer définitivement plus tard)
 * ============================================================
 * Ces fonctions ne servent qu'à traiter les ABONNEMENTS MOLLIE
 * encore actifs (ex: site-vitrine 5x avec échéances restantes,
 * abonnements complet / rdv-clarte / focus-sos / semester_pass
 * créés avant le retour à Stripe). Mollie continue de prélever
 * automatiquement ces abonnements : ces webhooks assurent la
 * comptabilité Bexio et les renouvellements de pass pendant la
 * transition.
 *
 * ➜ À supprimer une fois que TOUS les abonnements Mollie
 *   existants sont terminés (plus aucun prélèvement attendu).
 *   Aucun NOUVEAU paiement Mollie n'est créé : les boutons de
 *   paiement du frontend utilisent Stripe (createStripeCheckoutSession).
 * ============================================================
 */
/**
 * Webhook Mollie (v2 HTTP)
 * Reçoit les notifications de Mollie, accuse réception immédiatement (200 OK),
 * et publie un message Pub/Sub pour le traitement asynchrone.
 */
exports.webhookMollie = onRequest(
    {
      region: 'europe-west1',
      cors: true, // Accepter les requêtes de Mollie
    },
    async (req, res) => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      // Mollie envoie l'ID du paiement dans le corps (x-www-form-urlencoded)
      // id=tr_WDqYK6vllg
      let paymentId = req.body?.id;
      if (!paymentId && req.rawBody) {
        try {
          const params = new URLSearchParams(req.rawBody.toString('utf8'));
          paymentId = params.get('id');
        } catch (e) {
          console.warn('⚠️ Failed to parse Mollie webhook raw body:', e);
        }
      }

      if (!paymentId) {
        console.warn('⚠️ Mollie webhook received without payment ID');
        return res.status(400).send('No payment ID');
      }

      try {
        console.log(`🔔 Mollie webhook received for payment ${paymentId}`);

        // Publier un message sur le topic Pub/Sub pour traitement asynchrone
        // Cela permet de répondre immédiatement à Mollie pour éviter les timeouts
        const dataBuffer = Buffer.from(JSON.stringify({paymentId}));

        await pubSubClient
            .topic('process-mollie-payment')
            .publishMessage({data: dataBuffer});

        console.log(`✅ Message published to process-mollie-payment for ${paymentId}`);

        // Répondre 200 OK immédiatement
        return res.status(200).send('OK');
      } catch (error) {
        console.error('❌ Error processing Mollie webhook:', error);
        // Même en cas d'erreur de publication, on essaie de ne pas bloquer Mollie
        // Mais si on ne peut pas traiter, Mollie réessaiera plus tard si on renvoie 500
        return res.status(500).send('Internal Server Error');
      }
    },
);

/**
 * Traitement asynchrone des paiements Mollie (v2 Pub/Sub)
 * Déclenché par le topic 'process-mollie-payment'
 */
exports.processMolliePayment = onMessagePublished(
    {
      topic: 'process-mollie-payment',
      region: 'europe-west1',
      secrets: ['MOLLIE_API_KEY', 'BEXIO_API_TOKEN', 'GOOGLE_SERVICE_ACCOUNT', 'GOOGLE_SHEET_ID_SALES', 'BEXIO_ACCOUNT_DEBIT', 'BEXIO_ACCOUNT_CREDIT', 'BEXIO_ACCOUNT_FEES', 'MAILJET_API_KEY', 'MAILJET_API_SECRET', 'ADMIN_EMAIL'],
      // Timeout plus long pour les opérations externes
      timeoutSeconds: 300,
    },
    async (event) => {
      let processedRef = null;
      let shouldProcess = false;
      try {
      // 1. Extraire les données du message
        const messageData = event.data.message.json;
        const {paymentId} = messageData;

        if (!paymentId) {
          console.error('❌ No paymentId in Pub/Sub message');
          return;
        }

        console.log(`🚀 Processing Mollie payment ${paymentId} started`);

        // Idempotence guard: avoid double-processing for the same Mollie payment
        processedRef = db.collection('processedPayments').doc(`mollie_${paymentId}`);
        shouldProcess = await db.runTransaction(async (transaction) => {
          const snap = await transaction.get(processedRef);
          if (snap.exists) {
            const status = snap.data()?.status;
            if (status === 'completed' || status === 'processing') {
              return false;
            }
          }
          transaction.set(processedRef, {
            gateway: 'mollie',
            paymentId: paymentId,
            status: 'processing',
            createdAt: new Date(),
            updatedAt: new Date(),
          }, {merge: true});
          return true;
        });

        if (!shouldProcess) {
          console.log(`ℹ️ Payment ${paymentId} already processed or in progress, skipping`);
          return;
        }

        // 2. Récupérer les détails du paiement chez Mollie
        const payment = await mollieService.getPayment(paymentId);
        console.log(`💰 Payment status for ${paymentId}: ${payment.status}`);

        // On ne traite que les paiements réussis (paid)
        // Mollie peut envoyer des webhooks pour 'open', 'expired', 'failed', etc.
        if (payment.status !== 'paid') {
          console.log(`ℹ️ Payment ${paymentId} is ${payment.status}, skipping processing`);
          if (processedRef) {
            await processedRef.set({
              status: 'ignored',
              reason: `status_${payment.status}`,
              updatedAt: new Date(),
            }, {merge: true});
          }
          return;
        }


        const metadata = payment.metadata || {};

        // Ne traiter que les paiements explicitement taggés Fluance
        if (metadata.system !== 'firebase') {
          console.log(`ℹ️ Payment ${paymentId} ignored (metadata.system missing or invalid)`);
          if (processedRef) {
            await processedRef.set({
              status: 'ignored',
              reason: 'missing_system_metadata',
              updatedAt: new Date(),
            }, {merge: true});
          }
          return;
        }

        let mollieSubscriptionId = null;

        // 3. Logique Bexio (Manual Entry - Stripe Logic)
        try {
        // Determine Country for VAT
        // Priority: Metadata -> Payment Locale -> Default CH
          let countryCode = 'CH';
          if (metadata.country) {
            countryCode = metadata.country;
          } else if (payment.details?.countryCode) {
            countryCode = payment.details.countryCode;
          } else if (payment.locale) {
          // e.g. fr_CH, de_DE
            const parts = payment.locale.split('_');
            if (parts.length > 1) countryCode = parts[1];
          }

          const isSwiss = countryCode === 'CH' || countryCode === 'LI'; // Liechtenstein uses Swiss VAT usually

          // Accounts Config
          // Defaults based on "Stripe Logic" from reference project
          // Caisse: 1023 (Stripe) -> Here we use 1027 (Mollie) or whatever variable provided
          const debitAccount = process.env.BEXIO_ACCOUNT_MOLLIE ? parseInt(process.env.BEXIO_ACCOUNT_MOLLIE) : 1027;

          // Sales: 3400 (CH) / 3410 (Intl)
          const creditAccountCH = process.env.BEXIO_ACCOUNT_SALES_CH ?
          parseInt(process.env.BEXIO_ACCOUNT_SALES_CH) :
          3400;
          const creditAccountIntl = process.env.BEXIO_ACCOUNT_SALES_INTL ?
          parseInt(process.env.BEXIO_ACCOUNT_SALES_INTL) :
          3410;
          const creditAccount = isSwiss ? creditAccountCH : creditAccountIntl;

          // Taxes: 14 (CH 8.1%) / 3 (Intl 0%) - Note: Tax IDs might change over time, 14 is typical for 8.1%
          // Reference project: 8.1% -> 14. 0% -> 3.
          const taxId = isSwiss ? 14 : 3;

          const amountGross = parseFloat(payment.amount.value);
          const amountSettlement = payment.settlementAmount ? parseFloat(payment.settlementAmount.value) : amountGross;
          const amountFee = Math.round((amountGross - amountSettlement) * 100) / 100;

          console.log(`📊 Booking Manual Entry: Gross ${amountGross}, Net ${amountSettlement}, ` +
          `Fee ${amountFee}, Country ${countryCode}, TaxID ${taxId}`);

          // 1. Écriture de Vente (Montant Brut)
          // On utilise le montant Brut pour le CA (Suisse et International)
          await bexioService.createManualEntry({
            date: payment.paidAt ? payment.paidAt.split('T')[0] : new Date().toISOString().split('T')[0],
            debit_account_id: debitAccount,
            credit_account_id: creditAccount,
            amount: amountGross,
            text: `Mollie Payment ${paymentId} - ${payment.description}`,
            reference: paymentId,
            tax_id: taxId,
          });

          // 2. Écriture de Commission (Frais Mollie)
          // On crée une écriture séparée si des frais sont détectés
          if (amountFee > 0) {
            const feeAccount = process.env.BEXIO_ACCOUNT_FEES ? parseInt(process.env.BEXIO_ACCOUNT_FEES) : 6941;
            console.log(`📊 Booking Fee Entry: Amount ${amountFee}, Account ${feeAccount}`);

            await bexioService.createManualEntry({
              date: payment.paidAt ? payment.paidAt.split('T')[0] : new Date().toISOString().split('T')[0],
              debit_account_id: feeAccount,
              credit_account_id: debitAccount, // On déduit du compte Caisse Mollie
              amount: amountFee,
              text: `Commission Mollie ${paymentId} - ${payment.description}`,
              reference: paymentId,
              tax_id: 3, // Sans influence TVA (0%)
              tax_account_id: feeAccount,
            });
          }
        } catch (bexioError) {
          console.error('❌ Error in Bexio integration:', bexioError);
        }

        // 3b. Gestion des abonnements (Subscription Creation)
        // Découplé de Bexio: un échec comptable ne doit jamais empêcher
        // la création d'une souscription récurrente.
        if (metadata.type === 'subscription_first' && payment.customerId) {
          try {
            console.log(`🔄 Creating subscription for payment ${paymentId} (Customer: ${payment.customerId})`);

            let interval = '1 month'; // Default
            let times = undefined;
            if (metadata.variant === 'trimestriel') interval = '3 months';
            else if (metadata.product === 'semester_pass') interval = '6 months';
            else if (metadata.product === 'focus-sos' && metadata.variant === '3x') {
              interval = '1 month';
              times = 2; // 2 prélèvements restants après le 1er paiement
            } else if (metadata.product === 'site-vitrine' && metadata.variant === '5x') {
              interval = '1 month';
              times = 4; // 4 prélèvements restants après le 1er paiement (= 5 total)
            }

            const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
            const startDate = new Date(paidAt);

            if (interval === '1 month') startDate.setMonth(startDate.getMonth() + 1);
            else if (interval === '3 months') startDate.setMonth(startDate.getMonth() + 3);
            else if (interval === '6 months') startDate.setMonth(startDate.getMonth() + 6);

            const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const mandates = await mollieService.listMandates(payment.customerId);
            const activeMandates = Array.from(mandates || []).filter((mandate) =>
              mandate && (mandate.status === 'valid' || mandate.status === 'pending'),
            );

            if (activeMandates.length === 0) {
              const subscriptionError = new Error(
                  `No valid Mollie mandate found for customer ${payment.customerId}. ` +
                  `First payment method was ${payment.method || 'unknown'}`,
              );
              subscriptionError.code = 'missing_mandate';
              throw subscriptionError;
            }

            const subscriptionData = {
              customerId: payment.customerId,
              amount: payment.amount, // { value: "10.00", currency: "CHF" }
              interval: interval,
              startDate: startDateStr,
              description: `Abonnement ${metadata.product} (${interval}) ${paymentId.slice(-8)}`,
              webhookUrl: `https://europe-west1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/webhookMollie`,
              metadata: {
                ...metadata,
                type: 'subscription_renewal', // Marquer les futurs paiements comme renouvellements
              },
            };

            if (times !== undefined) {
              subscriptionData.times = times;
            }

            const subscription = await mollieService.createSubscription(subscriptionData);

            mollieSubscriptionId = subscription.id;
            console.log(`✅ Subscription created successfully for ${payment.customerId} ` +
            `(ID: ${mollieSubscriptionId}) starting ${startDateStr}`);
          } catch (subError) {
            console.error('❌ Error creating subscription:', subError);
            try {
              await db.collection('mollieSubscriptionIssues').doc(paymentId).set({
                paymentId,
                customerId: payment.customerId,
                paymentMethod: payment.method || null,
                product: metadata.product || null,
                variant: metadata.variant || null,
                email: metadata.email || null,
                issue: 'subscription_creation_failed',
                error: subError?.message || 'unknown_error',
                createdAt: FieldValue.serverTimestamp(),
              }, {merge: true});

              if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                await sendAdminAlert(
                    {
                      subject: 'Echec creation subscription Mollie',
                      message:
                      `Le paiement ${paymentId} a bien ete encaisse, mais la souscription ` +
                      `Mollie n'a pas pu etre creee.\n\n` +
                      `Produit: ${metadata.product || 'n/a'}\n` +
                      `Variant: ${metadata.variant || 'n/a'}\n` +
                      `Email: ${metadata.email || 'n/a'}\n` +
                      `Customer: ${payment.customerId}\n` +
                      `Methode de paiement: ${payment.method || 'unknown'}\n` +
                      `Erreur: ${subError?.message || 'unknown_error'}`,
                      severity: 'critical',
                      metadata: {
                        paymentId,
                        customerId: payment.customerId,
                        paymentMethod: payment.method || null,
                        product: metadata.product || null,
                        variant: metadata.variant || null,
                        error: subError?.message || 'unknown_error',
                      },
                    },
                    process.env.MAILJET_API_KEY,
                    process.env.MAILJET_API_SECRET,
                );
              }
            } catch (alertError) {
              console.error('❌ Error recording Mollie subscription issue:', alertError);
            }
            // On continue car le paiement a réussi, mais l'abo a échoué (à monitorer)
          }
        }

        // 3c. Échéances limitées — annulation explicite de sécurité (site-vitrine 5x, focus-sos 3x)
        // ⚠️ Mollie dispose normalement d'un arrêt automatique via le paramètre `times`
        // (le subscription a été créé avec times: 4 pour site-vitrine / times: 2 pour focus-sos).
        // Ce bloc est un filet de sécurité : quand le dernier renouvellement attendu est
        // encaissé, on annule explicitement l'abonnement côté Mollie pour être certain
        // qu'aucun prélèvement supplémentaire n'aura lieu.
        if (metadata.type === 'subscription_renewal' &&
            (metadata.product === 'site-vitrine' || metadata.product === 'focus-sos') &&
            payment.subscriptionId) {
          try {
            // Nombre total de paiements (1er paiement + renouvellements)
            const maxPayments = metadata.product === 'site-vitrine' ? 5 : 3;
            // Renouvellements attendus via l'abonnement (le 1er paiement a déjà eu lieu)
            const maxRenewals = maxPayments - 1;

            const countRef = db.collection('subscriptionPayments').doc(`mollie_${payment.subscriptionId}`);
            const countDoc = await countRef.get();
            const currentCount = countDoc.exists ? (countDoc.data().paymentCount || 0) : 0;
            const newCount = currentCount + 1;

            await countRef.set({
              gateway: 'mollie',
              subscriptionId: payment.subscriptionId,
              product: metadata.product,
              variant: metadata.variant || null,
              paymentCount: newCount,
              maxPayments,
              lastPayment: paymentId,
              lastPaymentAt: new Date(),
              updatedAt: FieldValue.serverTimestamp(),
            }, {merge: true});

            console.log(
                `🔢 Mollie ${metadata.product} (${metadata.variant || '?'}): renouvellement ` +
            `${newCount}/${maxRenewals} pour la subscription ${payment.subscriptionId}`,
            );

            if (newCount >= maxRenewals) {
              try {
                await mollieService.cancelSubscription(payment.customerId, payment.subscriptionId);
                console.log(
                    `✅ Abonnement Mollie ${payment.subscriptionId} annulé après ` +
                `${newCount} renouvellement(s) (${maxPayments} paiements au total)`,
                );
              } catch (cancelError) {
                // 404 = déjà annulé automatiquement par Mollie (times atteint) → OK
                console.warn(
                    `⚠️ Annulation explicite Mollie ${payment.subscriptionId} impossible ` +
                `(déjà arrêté par Mollie ?): ${cancelError.message}`,
                );
              }
            }
          } catch (countError) {
            console.error('❌ Error counting Mollie renewal:', countError);
          }
        }

        // 4. Logique Google Sheets
        try {
          const sheetId = process.env.GOOGLE_SHEET_ID_SALES;
          if (sheetId && googleService) {
            console.log(`📝 Todo: Add to Google Sheet ${sheetId} (Implement addGenericTransaction logic)`);
          }
        } catch (sheetError) {
          console.error('❌ Error in Google Sheets integration:', sheetError);
        }

        // 4b. Produits en ligne (Online Products) - Envoi d'email et Audit
        if (metadata.type === 'order' || metadata.type === 'subscription_first') {
          // Si c'est un produit en ligne (focus-sos, complet, 21jours etc)
          const isOnlineProduct = metadata.product === 'focus-sos' || metadata.product === 'complet' || metadata.product === '21jours';

          if (isOnlineProduct && metadata.email) {
            console.log(`📦 Processing online product ${metadata.product} for ${metadata.email}`);
            try {
              const amountCHF = parseFloat(payment.amount.value);
              const customerEmail = metadata.email;
              const customerName = `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim();
              const customerPhone = metadata.phone || '';
              const langue = metadata.locale === 'en' ? 'en' : 'fr';

              const productsToCreate = [metadata.product];
              if (metadata.includeSosDos === 'true' || metadata.includeSosDos === true) {
                productsToCreate.push('sos-dos-cervicales');
              }

              if (productsToCreate.length > 1) {
                console.log(`📧 Envoi d'un seul email pour ${productsToCreate.length} produits: ${productsToCreate.join(', ')}`);
                await createTokenForMultipleProductsAndSendEmail(
                    customerEmail,
                    productsToCreate,
                    30,
                    process.env.MAILJET_API_KEY,
                    process.env.MAILJET_API_SECRET,
                    amountCHF,
                    customerName,
                    customerPhone,
                    '', // address
                    langue,
                );
              } else {
                console.log(`📧 Envoi d'un email pour le produit unique: ${metadata.product}`);
                await createTokenAndSendEmail(
                    customerEmail,
                    metadata.product,
                    30,
                    process.env.MAILJET_API_KEY,
                    process.env.MAILJET_API_SECRET,
                    amountCHF,
                    customerName,
                    customerPhone,
                    '', // address
                    langue,
                );
              }

              // Notification Admin
              if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                await sendOnlineProductPurchaseNotificationAdmin(
                    {
                      email: customerEmail,
                      product: metadata.product,
                      amount: amountCHF,
                      customerName: customerName,
                      phone: customerPhone,
                      stripeSessionId: paymentId, // Using Mollie Payment ID
                    },
                    process.env.MAILJET_API_KEY,
                    process.env.MAILJET_API_SECRET,
                );
              }

              // Audit
              await db.collection('audit_payments').add({
                email: customerEmail.toLowerCase().trim(),
                products: productsToCreate,
                amount: amountCHF,
                currency: 'CHF',
                stripeSessionId: paymentId,
                stripePaymentIntentId: paymentId,
                status: 'success',
                timestamp: FieldValue.serverTimestamp(),
                metadata: metadata,
                system: 'firebase',
                type: 'online_product',
                gateway: 'mollie',
              });
              console.log(`📊 Audit log created for Mollie payment by ${customerEmail}`);
            } catch (onlineError) {
              console.error('❌ Error processing online product for Mollie:', onlineError);

              // ⚠️ ALERTE ADMIN + AUDIT : un échec ici laisse un client payant
              // sans accès (ex. template email manquant). Il ne doit JAMAIS
              // rester silencieux : on alerte l'équipe et on trace l'erreur.
              try {
                await db.collection('audit_payments').add({
                  email: (metadata.email || '').toLowerCase().trim(),
                  products: [metadata.product],
                  amount: parseFloat(payment.amount ? payment.amount.value : 0) || 0,
                  currency: 'CHF',
                  stripeSessionId: paymentId,
                  stripePaymentIntentId: paymentId,
                  status: 'error',
                  error: onlineError.message,
                  timestamp: FieldValue.serverTimestamp(),
                  metadata: metadata,
                  system: 'firebase',
                  type: 'online_product',
                  gateway: 'mollie',
                });
                console.log(`📊 Audit error log created for Mollie payment by ${metadata.email || 'N/A'}`);
              } catch (auditError) {
                console.error('❌ Error logging Mollie audit error:', auditError.message);
              }

              try {
                if (process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET) {
                  await sendAdminAlert(
                      {
                        subject: '🔴 Paiement Mollie accepté mais accès non livré',
                        message: `Un paiement Mollie a réussi mais le traitement du produit en ligne a échoué.

Email client: ${metadata.email || 'N/A'}
Produit: ${metadata.product || 'N/A'}
Montant: ${payment.amount ? payment.amount.value : '?'} ${payment.amount ? payment.amount.currency : ''}
Paiement Mollie: ${paymentId}

⚠️ ACTION REQUISE : vérifiez l'accès du client (token / document Firestore) et envoyez-lui le lien d'activation.`,
                        severity: 'high',
                        metadata: {
                          customerEmail: metadata.email,
                          paymentId,
                          product: metadata.product,
                          error: onlineError.message,
                        },
                      },
                      process.env.MAILJET_API_KEY,
                      process.env.MAILJET_API_SECRET,
                  );
                }
              } catch (alertError) {
                console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', alertError.message);
              }
            }
          }
        }

        // 5. Confirmer la réservation (Booking) si applicable
        if (payment.metadata && payment.metadata.bookingId) {
          const bookingId = payment.metadata.bookingId;
          console.log(`🎫 Confirming Booking ${bookingId} for Payment ${paymentId}`);
          try {
          // Utilise bookingService global
            await bookingService.confirmBookingPayment(db, bookingId, paymentId);
            console.log(`✅ Booking ${bookingId} confirmed`);
          } catch (bookingError) {
            console.error(`❌ Error confirming booking ${bookingId}:`, bookingError);
          // Ne pas bloquer, on a déjà logué
          }
        }

        // 6. Gestion des Pass (Flow Pass & Semester Pass)
        // On détecte si c'est un achat de pass via les métadonnées
        const isFlowPassPurchase = (metadata.passType === 'flow_pass' || metadata.product === 'flow_pass') && metadata.type !== 'subscription_renewal';
        const isSemesterPassPurchase = (metadata.product === 'semester_pass') && (metadata.type === 'subscription_first' || metadata.type === 'semester_pass');
        const isRenewal = metadata.type === 'subscription_renewal' || !!payment.subscriptionId;

        if (isRenewal && passService) {
          const subscriptionId = payment.subscriptionId || metadata.subscriptionId;
          if (subscriptionId) {
            console.log(`🔄 Processing renewal for subscription ${subscriptionId}`);
            try {
              await passService.renewSemesterPass(db, subscriptionId);
              console.log(`✅ Semester Pass renewed for subscription ${subscriptionId}`);
            } catch (renewError) {
              console.error('❌ Error renewing pass:', renewError);
            }
          }
        } else if ((isFlowPassPurchase || isSemesterPassPurchase) && passService) {
          try {
          // Vérifier si le pass a déjà été créé pour ce paiement (idempotence)
          // On utilise le paymentId comme référence unique
            const passSnapshot = await db.collection('userPasses')
                .where('molliePaymentId', '==', paymentId)
                .limit(1)
                .get();

            if (passSnapshot.empty) {
              console.log(`🎟️ Creating ${isFlowPassPurchase ? 'Flow Pass' : 'Semester Pass'} for ${metadata.email}`);

              const passType = isFlowPassPurchase ? 'flow_pass' : 'semester_pass';
              const config = passService.PASS_CONFIG[passType];

              const pass = await passService.createUserPass(db, metadata.email, passType, {
                firstName: metadata.firstName || '',
                lastName: metadata.lastName || '',
                phone: metadata.phone || '',
                molliePaymentId: paymentId,
                // Note: stripeSubscriptionId est utilisé pour stocker l'ID Mollie sub_... pour les renouvellements
                stripeSubscriptionId: mollieSubscriptionId || payment.subscriptionId || null,
                // Note: stripePaymentIntentId est utilisé comme champ générique pour l'ID de transaction
                stripePaymentIntentId: paymentId,
              });

              console.log(`✅ Pass created: ${pass.passId}`);

              // Envoyer l'e-mail de confirmation spécifique au pass via l'extension Firebase
              await db.collection('mail').add({
                to: metadata.email,
                template: {
                  name: 'pass-purchase-confirmation',
                  data: {
                    firstName: metadata.firstName || '',
                    passType: config.name,
                    isUnlimited: config.sessions === -1,
                    sessions: config.sessions,
                    validityMonths: Math.round(config.validityDays / 30),
                    isRecurring: config.isRecurring,
                    passId: pass.passId,
                  },
                },
              });
              console.log(`📧 Pass confirmation email queued for ${metadata.email}`);
            } else {
              console.log(`ℹ️ Pass already exists for payment ${paymentId}, skipping creation`);
            }
          } catch (passError) {
            console.error('❌ Error in pass creation logic:', passError);
          }
        }

        console.log(`✅ Processing Mollie payment ${paymentId} completed`);
        if (processedRef) {
          await processedRef.set({
            status: 'completed',
            updatedAt: new Date(),
          }, {merge: true});
        }
      } catch (error) {
        console.error('❌ Error in processMolliePayment:', error);
        if (processedRef && shouldProcess) {
          try {
            await processedRef.set({
              status: 'failed',
              error: error?.message || 'unknown_error',
              updatedAt: new Date(),
            }, {merge: true});
          } catch (e) {
            console.error('❌ Error updating processedPayments status:', e);
          }
        }
      }
    },
);
