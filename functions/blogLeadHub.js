const {onRequest} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');

const db = admin.firestore();

const DEFAULT_LIST_ID = 10524140;
const CONTACT_INTERNAL_TO = 'support@fluance.io';
const NEWSLETTER_FROM_EMAIL = 'fluance@actu.fluance.io';
const NEWSLETTER_FROM_NAME = 'Cédric de Fluance';
const TRANSACTIONAL_FROM_EMAIL = 'support@actu.fluance.io';
const TRANSACTIONAL_FROM_NAME = 'Support de Fluance';
const CENTRAL_PRIVACY_URL = 'https://fluance.io/mentions-legales/';
const CONFIRM_BASE_URL = 'https://fluance.io/confirm';
const DOI_EXPIRATION_DAYS = 7;
const DOI_REMINDER_STEPS = [1, 5];

const SITE_CONFIGS = {
  'techniquesdemeditation': {
    siteId: 'techniquesdemeditation',
    blogSource: 'techniquesdemeditation.com',
    siteLabel: 'Techniques de Méditation',
    legalLinkLabel: 'Techniques de Méditation',
    origins: [
      'https://techniquesdemeditation.com',
      'https://www.techniquesdemeditation.com',
      'http://localhost:8080',
    ],
    turnstileSecretEnv: 'TURNSTILE_SECRET_KEY_TDM',
    finalGiftUrl: 'https://techniquesdemeditation.com/confirmation-inscription-cadeau-fiche-pratique/',
    leadMagnetSource: 'fiche_pratique_calme_interieur',
    promiseText: 'une fiche pratique et des emails de Fluance autour de la méditation, du calme intérieur et de la présence.',
    emailIntro:
      'Vous vous êtes inscrit depuis Techniques de Méditation pour recevoir une fiche pratique et rejoindre une relation éditoriale portée par Fluance autour de la méditation et de la présence.',
    interestLabel: 'meditation',
  },
  'vie-explosive': {
    siteId: 'vie-explosive',
    blogSource: 'vie-explosive.fr',
    siteLabel: 'Vie Explosive',
    legalLinkLabel: 'Vie Explosive',
    origins: [
      'https://vie-explosive.fr',
      'https://www.vie-explosive.fr',
      'http://localhost:8080',
    ],
    turnstileSecretEnv: 'TURNSTILE_SECRET_KEY_VIE_EXPLOSIVE',
    finalGiftUrl: 'https://vie-explosive.fr/dl-ressources/',
    leadMagnetSource: 'ressources_vie_explosive',
    promiseText: 'des ressources offertes et des emails de Fluance autour de l’élan, du changement, de la confiance et du passage à l’action.',
    emailIntro:
      'Vous vous êtes inscrit depuis Vie Explosive pour recevoir vos ressources offertes et rejoindre une relation éditoriale portée par Fluance autour du changement, de la confiance et de l’élan de vie.',
    interestLabel: 'developpement_personnel',
  },
  'devperso': {
    siteId: 'devperso',
    blogSource: 'developpementpersonnel.org',
    siteLabel: 'Développement Personnel',
    legalLinkLabel: 'DéveloppementPersonnel.org',
    origins: [
      'https://developpementpersonnel.org',
      'https://www.developpementpersonnel.org',
      'https://devperso.org',
      'https://www.devperso.org',
      'http://localhost:8080',
    ],
    turnstileSecretEnv: 'TURNSTILE_SECRET_KEY_DEVPERSO',
    finalGiftUrl: 'https://developpementpersonnel.org/telechargez-votre-cadeau-de-bienvenue/',
    leadMagnetSource: 'meilleur_du_developpement_personnel',
    promiseText: 'votre ressource demandée et des emails de Fluance autour du développement personnel, de la psychologie et de la transformation intérieure.',
    emailIntro:
      'Vous vous êtes inscrit depuis DéveloppementPersonnel.org pour recevoir votre cadeau de bienvenue et rejoindre une relation éditoriale portée par Fluance autour du développement personnel et de la transformation intérieure.',
    interestLabel: 'developpement_personnel',
  },
};

const ROOT_ALLOWED_ORIGINS = Array.from(
    new Set(Object.values(SITE_CONFIGS).flatMap((site) => site.origins)),
);

const MIN_CONTACT_FORM_FILL_MS = 3000;
const MAX_CONTACT_FORM_AGE_MS = 1000 * 60 * 60 * 12;

function hostnameMatchesSite(hostname, site) {
  const normalizedHostname = String(hostname || '').toLowerCase();
  if (!normalizedHostname || !site) return false;

  return site.origins.some((allowedOrigin) => {
    try {
      return new URL(allowedOrigin).hostname.toLowerCase() === normalizedHostname;
    } catch {
      return false;
    }
  });
}

function getSiteConfig({siteId, origin}) {
  let hostname = '';

  if (origin) {
    try {
      hostname = new URL(origin).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  if (siteId && SITE_CONFIGS[siteId]) {
    const site = SITE_CONFIGS[siteId];
    if (hostname && !hostnameMatchesSite(hostname, site)) {
      return null;
    }
    return site;
  }

  if (hostname) {
    return Object.values(SITE_CONFIGS).find((site) => {
      return hostnameMatchesSite(hostname, site);
    }) || null;
  }

  return null;
}

function buildCorsHeaders(origin) {
  const allowedOrigin = ROOT_ALLOWED_ORIGINS.includes(origin) ?
    origin :
    ROOT_ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  };
}

function sendJson(response, payload, status, corsHeaders) {
  response.set({
    'Content-Type': 'application/json',
    ...corsHeaders,
  });
  return response.status(status).json(payload);
}

function getHeader(request, name) {
  const lowerName = String(name || '').toLowerCase();
  return request.get?.(name) || request.headers?.[lowerName] || '';
}

function getFormValue(request, key) {
  if (request.body && typeof request.body === 'object' && !Array.isArray(request.body)) {
    return request.body[key];
  }

  if (typeof request.body === 'string') {
    const params = new URLSearchParams(request.body);
    return params.get(key);
  }

  return undefined;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeName(name) {
  return String(name || '').trim();
}

function capitalizeName(name) {
  if (!name) return '';

  return name
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function truncate(value, maxLength) {
  return String(value || '').slice(0, maxLength);
}

function getMailjetAuth(apiKey, apiSecret) {
  return Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
}

async function ensureMailjetProperties(apiKey, apiSecret) {
  const auth = getMailjetAuth(apiKey, apiSecret);
  const properties = [
    'site_source',
    'blog_source',
    'formulaire_source',
    'url_source',
    'type_optin',
    'statut_consentement',
    'date_consentement',
    'statut_double_optin',
    'date_double_optin',
    'date_derniere_relance_doi',
    'nombre_relances_doi',
    'langue_source',
    'lead_magnet_source',
    'prenom',
    'interets_declares',
    'source_optin',
    'date_optin',
    'statut',
    'est_client',
    'firstname',
  ];

  for (const property of properties) {
    try {
      const response = await fetch('https://api.mailjet.com/v3/REST/contactmetadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({
          Name: property,
          Datatype: 'str',
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        if (!(response.status === 400 && responseText.includes('already exists'))) {
          console.error(`❌ [blogLeadHub] Error creating Mailjet property ${property}:`, responseText);
        }
      }
    } catch (error) {
      console.error(`❌ [blogLeadHub] Exception creating Mailjet property ${property}:`, error.message);
    }
  }
}

async function fetchMailjetContactProperties(email, apiKey, apiSecret) {
  const auth = getMailjetAuth(apiKey, apiSecret);
  const response = await fetch(
      `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      },
  );

  if (!response.ok) {
    return {};
  }

  const responseData = await response.json();
  if (!responseData.Data || responseData.Data.length === 0) {
    return {};
  }

  const currentData = responseData.Data[0]?.Data;
  if (!currentData) {
    return {};
  }

  if (Array.isArray(currentData)) {
    const mapped = {};
    currentData.forEach((item) => {
      if (item.Name && item.Value !== undefined) {
        mapped[item.Name] = item.Value;
      }
    });
    return mapped;
  }

  if (typeof currentData === 'object') {
    return currentData;
  }

  return {};
}

async function updateMailjetContactProperties(email, properties, apiKey, apiSecret) {
  const auth = getMailjetAuth(apiKey, apiSecret);
  const currentProperties = await fetchMailjetContactProperties(email, apiKey, apiSecret);
  const mergedProperties = {...currentProperties, ...properties};
  const dataArray = Object.keys(mergedProperties).map((key) => ({
    Name: key,
    Value: String(mergedProperties[key]),
  }));

  const response = await fetch(
      `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({
          Data: dataArray,
        }),
      },
  );

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Mailjet contactdata error: ${response.status} - ${responseText}`);
  }
}

async function ensureMailjetContact(email, name, apiKey, apiSecret) {
  const auth = getMailjetAuth(apiKey, apiSecret);
  const contactUrl = `https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(email)}`;
  const payload = {
    Email: email,
    IsExcludedFromCampaigns: false,
  };

  if (name) {
    payload.Name = name;
  }

  const existingResponse = await fetch(contactUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (existingResponse.ok) {
    if (name) {
      await fetch(contactUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify(payload),
      });
    }
    return;
  }

  const createResponse = await fetch('https://api.mailjet.com/v3/REST/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  });

  if (!createResponse.ok) {
    const responseText = await createResponse.text();
    throw new Error(`Mailjet contact error: ${createResponse.status} - ${responseText}`);
  }
}

async function addContactToMailjetList(email, listId, apiKey, apiSecret) {
  const auth = getMailjetAuth(apiKey, apiSecret);
  const response = await fetch('https://api.mailjet.com/v3/REST/listrecipient', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify({
      IsUnsubscribed: false,
      ContactAlt: email,
      ListID: listId,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    if (!(response.status === 400 && responseText.includes('already'))) {
      throw new Error(`Mailjet listrecipient error: ${response.status} - ${responseText}`);
    }
  }
}

async function sendMailjetEmail(params) {
  const {
    to,
    subject,
    htmlContent,
    textContent,
    apiKey,
    apiSecret,
    fromEmail,
    fromName,
    replyToEmail,
    replyToName,
  } = params;

  const auth = getMailjetAuth(apiKey, apiSecret);
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

  if (replyToEmail) {
    body.Messages[0].ReplyTo = {
      Email: replyToEmail,
      Name: replyToName || replyToEmail,
    };
  }

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Mailjet send error: ${response.status} - ${responseText}`);
  }
}

async function verifyTurnstile(token, secret, remoteIp) {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      secret,
      response: token,
      remoteip: remoteIp || '',
    }),
  });

  return response.json();
}

async function logLeadEvent(eventType, payload) {
  await db.collection('journal_evenements_leads').add({
    type_evenement: eventType,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...payload,
  });
}

async function logContactSubmission(payload) {
  await db.collection('journal_formulaires_contact').add({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...payload,
  });
}

function buildConfirmationUrl(token) {
  return `${CONFIRM_BASE_URL}?email=${encodeURIComponent(token.email)}&token=${token.id}`;
}

function escapeHtml(value) {
  return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

function buildOptInEmailHtml(site, name, confirmationUrl, isReminder = false, expirationLabel = '') {
  const escapedName = escapeHtml(name || '');
  const introTitle = isReminder ?
    'Un dernier clic pour recevoir votre ressource' :
    'Confirmez votre inscription';
  const introText = isReminder ?
    `Vous avez demandé ${site.leadMagnetSource.replaceAll('_', ' ')} via ${site.siteLabel}. ` +
      `Fluance centralise cet envoi et les prochains emails associés.` :
    site.emailIntro;
  const reminderLine = isReminder ?
    `<p style="margin:0 0 16px;color:#3E3A35;">Ce lien reste valable jusqu’au ${escapeHtml(expirationLabel)}.</p>` :
    '';
  const eyebrowStyle =
    'margin:0 0 10px;color:#7A1F3D;font-size:12px;font-weight:700;' +
    'letter-spacing:0.08em;text-transform:uppercase;';
  const buttonStyle =
    'display:inline-block;background:#E6B84A;color:#7A1F3D;text-decoration:none;' +
    'padding:14px 22px;border-radius:999px;font-weight:700;';

  return `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f6f3ef;font-family:Arial,sans-serif;color:#3E3A35;">
    <div style="max-width:620px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:18px;padding:36px 30px;box-shadow:0 8px 28px rgba(0,0,0,0.07);">
        <p style="${eyebrowStyle}">${escapeHtml(site.siteLabel)} x Fluance</p>
        <h1 style="margin:0 0 18px;font-size:30px;line-height:1.2;color:#2D2A26;">${introTitle}</h1>
        <p style="margin:0 0 16px;color:#3E3A35;">Bonjour${escapedName ? ` ${escapedName}` : ''},</p>
        <p style="margin:0 0 16px;color:#3E3A35;">${introText}</p>
        <p style="margin:0 0 16px;color:#3E3A35;">
          En confirmant votre adresse email, vous recevrez bien ${escapeHtml(site.promiseText)}
        </p>
        ${reminderLine}
        <div style="margin:28px 0;text-align:center;">
          <a href="${confirmationUrl}" style="${buttonStyle}">
            Je confirme mon adresse email
          </a>
        </div>
        <p style="margin:0 0 14px;color:#6A645D;font-size:14px;">
          Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.
        </p>
        <p style="margin:0;color:#6A645D;font-size:14px;">
          Politique de confidentialité:
          <a href="${CENTRAL_PRIVACY_URL}" style="color:#7A1F3D;">${CENTRAL_PRIVACY_URL}</a>
        </p>
      </div>
    </div>
  </body>
</html>`.trim();
}

function buildOptInEmailText(site, name, confirmationUrl, expirationLabel = '') {
  return [
    `Bonjour${name ? ` ${name}` : ''},`,
    '',
    site.emailIntro,
    '',
    `En confirmant votre adresse email, vous recevrez ${site.promiseText}`,
    '',
    `Confirmez ici : ${confirmationUrl}`,
    expirationLabel ? `Ce lien reste valable jusqu’au ${expirationLabel}.` : 'Ce lien reste valable 7 jours.',
    '',
    `Politique de confidentialité : ${CENTRAL_PRIVACY_URL}`,
  ].join('\n');
}

function buildContactEmailHtml(site, payload) {
  const eyebrowStyle =
    'margin:0 0 10px;color:#7A1F3D;font-size:12px;font-weight:700;' +
    'letter-spacing:0.08em;text-transform:uppercase;';

  return `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f6f3ef;font-family:Arial,sans-serif;color:#3E3A35;">
    <div style="max-width:720px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:18px;padding:36px 30px;box-shadow:0 8px 28px rgba(0,0,0,0.07);">
        <p style="${eyebrowStyle}">Nouveau message blog</p>
        <h1 style="margin:0 0 22px;font-size:30px;line-height:1.2;color:#2D2A26;">${escapeHtml(site.siteLabel)}</h1>
        <p style="margin:0 0 10px;"><strong>Nom :</strong> ${escapeHtml(payload.name)}</p>
        <p style="margin:0 0 10px;"><strong>Email :</strong> ${escapeHtml(payload.email)}</p>
        <p style="margin:0 0 10px;"><strong>Sujet :</strong> ${escapeHtml(payload.subject || '(sans sujet)')}</p>
        <p style="margin:0 0 10px;"><strong>Site source :</strong> ${escapeHtml(site.blogSource)}</p>
        <p style="margin:0 0 10px;">
          <strong>URL source :</strong> ${escapeHtml(payload.optinUrl || payload.referer || '')}
        </p>
        <div
          style="margin-top:24px;padding:20px;background:#faf7f3;border-radius:12px;white-space:pre-wrap;"
        >${escapeHtml(payload.message)}</div>
      </div>
    </div>
  </body>
</html>`.trim();
}

function getReminderStage(daysSinceCreation, sentStages) {
  const dueStages = DOI_REMINDER_STEPS
      .filter((stage) => daysSinceCreation >= stage && !sentStages.includes(stage))
      .sort((a, b) => b - a);

  if (dueStages.length > 0) {
    return dueStages[0];
  }

  return null;
}

async function createOrReuseConfirmationToken({
  email,
  name,
  site,
  formName,
  optinUrl,
}) {
  const snapshot = await db.collection('newsletterConfirmations')
      .where('email', '==', email)
      .get();

  const now = new Date();
  const reusableDoc = snapshot.docs
      .map((doc) => ({id: doc.id, ...doc.data()}))
      .find((item) => {
        if (item.confirmed) {
          return false;
        }

        if (item.blogSource !== site.blogSource) {
          return false;
        }

        if (!item.expiresAt || typeof item.expiresAt.toDate !== 'function') {
          return false;
        }

        return item.expiresAt.toDate() > now;
      });

  if (reusableDoc) {
    return reusableDoc;
  }

  const tokenId = generateToken();
  const expiresAt = new Date(now.getTime());
  expiresAt.setDate(expiresAt.getDate() + DOI_EXPIRATION_DAYS);

  const createdToken = {
    id: tokenId,
    email,
    name,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
    confirmed: false,
    sourceOptin: `blog_${site.siteId}`,
    siteSource: site.siteId,
    blogSource: site.blogSource,
    formulaireSource: formName,
    urlSource: optinUrl,
    redirectUrl: site.finalGiftUrl,
    leadMagnetSource: site.leadMagnetSource,
    locale: 'fr',
    rappelStagesEnvoyes: [],
    nombreRelancesDoi: 0,
    legalPolicyUrl: CENTRAL_PRIVACY_URL,
  };

  await db.collection('newsletterConfirmations').doc(tokenId).set(createdToken);

  return {
    id: tokenId,
    ...createdToken,
    expiresAt: {
      toDate: () => expiresAt,
    },
  };
}

function formatExpirationDate(expiresAt) {
  const expirationDate = expiresAt && typeof expiresAt.toDate === 'function' ?
    expiresAt.toDate() :
    expiresAt;
  const date = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zurich',
  });
}

function buildPendingMailjetProperties({site, formName, optinUrl, name, existingProperties}) {
  const nowIso = new Date().toISOString();
  const currentSourceOptin = String(existingProperties.source_optin || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  if (!currentSourceOptin.includes(`blog_${site.siteId}`)) {
    currentSourceOptin.push(`blog_${site.siteId}`);
  }

  const properties = {
    site_source: site.siteId,
    blog_source: site.blogSource,
    formulaire_source: formName,
    url_source: optinUrl,
    type_optin: 'newsletter',
    statut_consentement: 'en_attente',
    statut_double_optin: 'en_attente',
    langue_source: 'fr',
    lead_magnet_source: site.leadMagnetSource,
    interets_declares: site.interestLabel,
    source_optin: currentSourceOptin.join(','),
    statut: existingProperties.statut || 'prospect',
    est_client: existingProperties.est_client || 'False',
  };

  if (!existingProperties.date_optin) {
    properties.date_optin = nowIso;
  }

  if (name) {
    properties.prenom = capitalizeName(name);
    properties.firstname = capitalizeName(name);
  }

  return properties;
}

exports.captureLead = onRequest(
    {
      region: 'europe-west1',
      cors: true,
      secrets: [
        'MAILJET_API_KEY',
        'MAILJET_API_SECRET',
        'MAILJET_LIST_ID',
        'TURNSTILE_SECRET_KEY_TDM',
        'TURNSTILE_SECRET_KEY_VIE_EXPLOSIVE',
        'TURNSTILE_SECRET_KEY_DEVPERSO',
      ],
    },
    async (request, response) => {
      const origin = getHeader(request, 'Origin');
      const corsHeaders = buildCorsHeaders(origin);

      if (request.method === 'OPTIONS') {
        response.set(corsHeaders);
        return response.status(204).send('');
      }

      if (request.method !== 'POST') {
        return sendJson(response, {success: false, error: 'Method Not Allowed'}, 405, corsHeaders);
      }

      try {
        const email = normalizeEmail(getFormValue(request, 'email'));
        const name = normalizeName(
            getFormValue(request, 'prenom') ||
            getFormValue(request, 'name') ||
            getFormValue(request, 'firstname') ||
            getFormValue(request, 'first_name'),
        );
        const formName = truncate(
            getFormValue(request, 'form-name') || getFormValue(request, 'form_name') || 'newsletter',
            120,
        );
        const siteId = truncate(getFormValue(request, 'site_id') || '', 80);
        const redirectUrl = String(getFormValue(request, 'redirect_url') || '');
        const botField = getFormValue(request, 'bot-field');
        const turnstileToken = String(getFormValue(request, 'cf-turnstile-response') || '');
        const optinUrl = String(
            getFormValue(request, 'optin_url') ||
            getFormValue(request, 'url') ||
            getHeader(request, 'Referer') ||
            '',
        );
        const site = getSiteConfig({siteId, origin});

        if (!site) {
          return sendJson(response, {success: false, error: 'Site non reconnu'}, 400, corsHeaders);
        }

        if (botField) {
          await logLeadEvent('bot_honeypot_optin', {
            site_source: site.siteId,
            blog_source: site.blogSource,
            formulaire_source: formName,
            email,
          });
          return sendJson(response, {success: true, message: 'Requête filtrée'}, 200, corsHeaders);
        }

        if (!email) {
          return sendJson(response, {success: false, error: 'Email requis'}, 400, corsHeaders);
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return sendJson(response, {success: false, error: 'Format d’email invalide'}, 400, corsHeaders);
        }

        if (!turnstileToken) {
          return sendJson(response, {success: false, error: 'Jeton de sécurité manquant'}, 400, corsHeaders);
        }

        const turnstileSecret = process.env[site.turnstileSecretEnv];
        if (!turnstileSecret) {
          return sendJson(response, {success: false, error: 'Secret Turnstile manquant'}, 500, corsHeaders);
        }

        const turnstileResult = await verifyTurnstile(
            turnstileToken,
            turnstileSecret,
            getHeader(request, 'x-forwarded-for') || '',
        );

        if (!turnstileResult.success) {
          console.warn('⚠️ [blogLeadHub] Turnstile opt-in verification failed', {
            siteId: site.siteId,
            blogSource: site.blogSource,
            formName,
            errorCodes: turnstileResult['error-codes'] || [],
            hostname: turnstileResult.hostname || '',
            action: turnstileResult.action || '',
            cdata: turnstileResult.cdata || '',
          });
          await logLeadEvent('turnstile_failed_optin', {
            site_source: site.siteId,
            blog_source: site.blogSource,
            formulaire_source: formName,
            email,
            details: turnstileResult['error-codes'] || [],
          });

          return sendJson(response, {
            success: false,
            error: 'Échec de la vérification de sécurité. Veuillez réessayer.',
          }, 403, corsHeaders);
        }

        const mailjetApiKey = process.env.MAILJET_API_KEY;
        const mailjetApiSecret = process.env.MAILJET_API_SECRET;
        const listId = parseInt(process.env.MAILJET_LIST_ID || `${DEFAULT_LIST_ID}`, 10);

        await ensureMailjetProperties(mailjetApiKey, mailjetApiSecret);
        await ensureMailjetContact(email, name, mailjetApiKey, mailjetApiSecret);
        await addContactToMailjetList(email, listId, mailjetApiKey, mailjetApiSecret);

        const existingProperties = await fetchMailjetContactProperties(
            email,
            mailjetApiKey,
            mailjetApiSecret,
        );
        const pendingProperties = buildPendingMailjetProperties({
          site,
          formName,
          optinUrl,
          name,
          existingProperties,
        });
        await updateMailjetContactProperties(
            email,
            pendingProperties,
            mailjetApiKey,
            mailjetApiSecret,
        );

        const token = await createOrReuseConfirmationToken({
          email,
          name,
          site,
          formName,
          optinUrl,
        });
        const confirmationUrl = buildConfirmationUrl(token);
        const expirationLabel = formatExpirationDate(token.expiresAt);

        await sendMailjetEmail({
          to: email,
          subject: `Dernière étape pour recevoir votre ressource${name ? `, ${name}` : ''}`,
          htmlContent: buildOptInEmailHtml(site, name, confirmationUrl, false, expirationLabel),
          textContent: buildOptInEmailText(site, name, confirmationUrl, expirationLabel),
          apiKey: mailjetApiKey,
          apiSecret: mailjetApiSecret,
          fromEmail: NEWSLETTER_FROM_EMAIL,
          fromName: NEWSLETTER_FROM_NAME,
        }).catch(async (error) => {
          await logLeadEvent('mailjet_send_failed_optin', {
            site_source: site.siteId,
            blog_source: site.blogSource,
            formulaire_source: formName,
            email,
            error_message: truncate(error.message || 'unknown', 1000),
          });
          throw error;
        });

        await logLeadEvent('optin_capture_success', {
          site_source: site.siteId,
          blog_source: site.blogSource,
          formulaire_source: formName,
          email,
          url_source: optinUrl,
          redirection_initiale: redirectUrl || '',
          redirection_finale: site.finalGiftUrl,
          token_id: token.id,
        });

        return sendJson(response, {
          success: true,
          message: 'Confirmation envoyée',
          redirect: redirectUrl || null,
        }, 200, corsHeaders);
      } catch (error) {
        console.error('❌ [blogLeadHub] captureLead error:', error);
        try {
          await logLeadEvent('capture_lead_internal_error', {
            site_source: truncate(getFormValue(request, 'site_id') || '', 80),
            blog_source: '',
            formulaire_source: truncate(
                getFormValue(request, 'form-name') || getFormValue(request, 'form_name') || '',
                120,
            ),
            email: normalizeEmail(getFormValue(request, 'email')),
            error_message: truncate(error.message || 'unknown', 1000),
          });
        } catch (logError) {
          console.error('❌ [blogLeadHub] captureLead error logging failed:', logError);
        }
        return sendJson(response, {
          success: false,
          error: 'Une erreur est survenue. Veuillez réessayer plus tard.',
        }, 500, buildCorsHeaders(getHeader(request, 'Origin')));
      }
    },
);

exports.sendContactEmail = onRequest(
    {
      region: 'europe-west1',
      cors: true,
      secrets: [
        'MAILJET_API_KEY',
        'MAILJET_API_SECRET',
        'TURNSTILE_SECRET_KEY_TDM',
        'TURNSTILE_SECRET_KEY_VIE_EXPLOSIVE',
        'TURNSTILE_SECRET_KEY_DEVPERSO',
      ],
    },
    async (request, response) => {
      const origin = getHeader(request, 'Origin');
      const corsHeaders = buildCorsHeaders(origin);

      if (request.method === 'OPTIONS') {
        response.set(corsHeaders);
        return response.status(204).send('');
      }

      if (request.method !== 'POST') {
        return sendJson(response, {success: false, error: 'Method Not Allowed'}, 405, corsHeaders);
      }

      try {
        const email = normalizeEmail(getFormValue(request, 'email'));
        const name = normalizeName(
            getFormValue(request, 'name') ||
            getFormValue(request, 'prenom') ||
            getFormValue(request, 'firstname') ||
            getFormValue(request, 'first_name'),
        );
        const subject = truncate(getFormValue(request, 'subject') || getFormValue(request, 'sujet') || '', 200);
        const message = truncate(getFormValue(request, 'message') || '', 5000);
        const siteId = truncate(getFormValue(request, 'site_id') || '', 80);
        const redirectUrl = String(getFormValue(request, 'redirect_url') || '');
        const contactStartedAt = Number(getFormValue(request, 'contact_started_at') || 0);
        const turnstileToken = String(getFormValue(request, 'cf-turnstile-response') || '');
        const site = getSiteConfig({siteId, origin});
        const optinUrl = String(getFormValue(request, 'optin_url') || getHeader(request, 'Referer') || '');

        if (!site) {
          return sendJson(response, {success: false, error: 'Site non reconnu'}, 400, corsHeaders);
        }

        const honeypotValues = [
          getFormValue(request, 'bot-field'),
          getFormValue(request, 'website'),
          getFormValue(request, 'company'),
          getFormValue(request, 'url'),
        ];
        const hasFilledHoneypot = honeypotValues.some((value) => String(value || '').trim() !== '');

        if (hasFilledHoneypot) {
          await logContactSubmission({
            site_source: site.siteId,
            blog_source: site.blogSource,
            email,
            nom: name,
            sujet: subject,
            message,
            statut: 'filtre_honeypot',
          });
          return sendJson(response, {success: true, message: 'Requête filtrée'}, 200, corsHeaders);
        }

        if (Number.isFinite(contactStartedAt) && contactStartedAt > 0) {
          const elapsedMs = Date.now() - contactStartedAt;
          if (elapsedMs >= 0 && elapsedMs < MIN_CONTACT_FORM_FILL_MS) {
            await logContactSubmission({
              site_source: site.siteId,
              blog_source: site.blogSource,
              email,
              nom: name,
              sujet: subject,
              message,
              statut: 'filtre_trop_rapide',
              details: {elapsedMs},
            });
            return sendJson(response, {success: true, message: 'Requête filtrée'}, 200, corsHeaders);
          }

          if (elapsedMs > MAX_CONTACT_FORM_AGE_MS) {
            await logContactSubmission({
              site_source: site.siteId,
              blog_source: site.blogSource,
              email,
              nom: name,
              sujet: subject,
              message,
              statut: 'filtre_formulaire_perime',
              details: {elapsedMs},
            });
            return sendJson(response, {success: true, message: 'Requête filtrée'}, 200, corsHeaders);
          }
        }

        if (!email || !message) {
          return sendJson(response, {success: false, error: 'Email et message requis'}, 400, corsHeaders);
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return sendJson(response, {success: false, error: 'Format d’email invalide'}, 400, corsHeaders);
        }

        if ((message.match(/https?:\/\//g) || []).length > 3) {
          return sendJson(response, {success: false, error: 'Trop de liens dans le message'}, 400, corsHeaders);
        }

        if (!turnstileToken) {
          return sendJson(response, {success: false, error: 'Jeton de sécurité manquant'}, 400, corsHeaders);
        }

        const turnstileSecret = process.env[site.turnstileSecretEnv];
        if (!turnstileSecret) {
          return sendJson(response, {success: false, error: 'Secret Turnstile manquant'}, 500, corsHeaders);
        }

        const turnstileResult = await verifyTurnstile(
            turnstileToken,
            turnstileSecret,
            getHeader(request, 'x-forwarded-for') || '',
        );

        if (!turnstileResult.success) {
          console.warn('⚠️ [blogLeadHub] Turnstile contact verification failed', {
            siteId: site.siteId,
            blogSource: site.blogSource,
            email,
            errorCodes: turnstileResult['error-codes'] || [],
            hostname: turnstileResult.hostname || '',
            action: turnstileResult.action || '',
            cdata: turnstileResult.cdata || '',
          });
          await logContactSubmission({
            site_source: site.siteId,
            blog_source: site.blogSource,
            email,
            nom: name,
            sujet: subject,
            message,
            statut: 'echec_turnstile',
            details: turnstileResult['error-codes'] || [],
          });

          return sendJson(response, {
            success: false,
            error: 'Échec de la vérification de sécurité. Veuillez réessayer.',
          }, 403, corsHeaders);
        }

        if (!hostnameMatchesSite(turnstileResult.hostname || '', site)) {
          console.warn('⚠️ [blogLeadHub] Turnstile hostname mismatch for contact form', {
            siteId: site.siteId,
            blogSource: site.blogSource,
            email,
            hostname: turnstileResult.hostname || '',
          });
          await logContactSubmission({
            site_source: site.siteId,
            blog_source: site.blogSource,
            email,
            nom: name,
            sujet: subject,
            message,
            statut: 'echec_turnstile_hostname',
            details: {hostname: turnstileResult.hostname || ''},
          });
          return sendJson(response, {
            success: false,
            error: 'Échec de la vérification de sécurité. Veuillez réessayer.',
          }, 403, corsHeaders);
        }

        const mailjetApiKey = process.env.MAILJET_API_KEY;
        const mailjetApiSecret = process.env.MAILJET_API_SECRET;

        await sendMailjetEmail({
          to: CONTACT_INTERNAL_TO,
          subject: `[${site.siteLabel}] ${subject || 'Nouveau message de contact'}`,
          htmlContent: buildContactEmailHtml(site, {
            name,
            email,
            subject,
            message,
            optinUrl,
            referer: getHeader(request, 'Referer') || '',
          }),
          textContent: `${site.siteLabel}\nNom: ${name}\nEmail: ${email}\nSujet: ${subject}\n\n${message}`,
          apiKey: mailjetApiKey,
          apiSecret: mailjetApiSecret,
          fromEmail: TRANSACTIONAL_FROM_EMAIL,
          fromName: TRANSACTIONAL_FROM_NAME,
          replyToEmail: email,
          replyToName: name || email,
        }).catch(async (error) => {
          await logLeadEvent('mailjet_send_failed_contact', {
            site_source: site.siteId,
            blog_source: site.blogSource,
            formulaire_source: 'contact',
            email,
            error_message: truncate(error.message || 'unknown', 1000),
          });
          throw error;
        });

        await logContactSubmission({
          site_source: site.siteId,
          blog_source: site.blogSource,
          email,
          nom: name,
          sujet: subject,
          message,
          statut: 'envoye',
          url_source: optinUrl,
          ip_source: getHeader(request, 'x-forwarded-for') || '',
          user_agent: truncate(getHeader(request, 'User-Agent') || '', 500),
        });

        return sendJson(response, {
          success: true,
          message: 'Message envoyé',
          redirect: redirectUrl || null,
        }, 200, corsHeaders);
      } catch (error) {
        console.error('❌ [blogLeadHub] sendContactEmail error:', error);
        try {
          await logLeadEvent('send_contact_internal_error', {
            site_source: truncate(getFormValue(request, 'site_id') || '', 80),
            blog_source: '',
            formulaire_source: 'contact',
            email: normalizeEmail(getFormValue(request, 'email')),
            error_message: truncate(error.message || 'unknown', 1000),
          });
        } catch (logError) {
          console.error('❌ [blogLeadHub] sendContactEmail error logging failed:', logError);
        }
        return sendJson(response, {
          success: false,
          error: 'Une erreur est survenue. Veuillez réessayer plus tard.',
        }, 500, buildCorsHeaders(getHeader(request, 'Origin')));
      }
    },
);

module.exports.helpers = {
  CONTACT_INTERNAL_TO,
  NEWSLETTER_FROM_EMAIL,
  NEWSLETTER_FROM_NAME,
  TRANSACTIONAL_FROM_EMAIL,
  TRANSACTIONAL_FROM_NAME,
  CENTRAL_PRIVACY_URL,
  DOI_REMINDER_STEPS,
  formatExpirationDate,
  buildConfirmationUrl,
  buildOptInEmailHtml,
  buildOptInEmailText,
  SITE_CONFIGS,
  fetchMailjetContactProperties,
  updateMailjetContactProperties,
  sendMailjetEmail,
  logLeadEvent,
  logContactSubmission,
  getReminderStage,
};
