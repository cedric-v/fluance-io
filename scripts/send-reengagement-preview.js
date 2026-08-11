#!/usr/bin/env node

/**
 * Envoie un aperçu (validation) des 2 emails de ré-engagement à l'adresse indiquée.
 * Usage :
 *   export MAILJET_API_KEY="..."
 *   export MAILJET_API_SECRET="..."
 *   node scripts/send-reengagement-preview.js [email]   # défaut : cedric@fluance.io
 */

const https = require('https');
const crypto = require('crypto');

const RECIPIENT = process.argv[2] || 'cedric@fluance.io';
const NAME = 'Cédric'; // Prénom d'exemple pour la prévisualisation

const API_KEY = process.env.MAILJET_API_KEY;
const API_SECRET = process.env.MAILJET_API_SECRET;
if (!API_KEY || !API_SECRET) {
  console.error('❌ MAILJET_API_KEY et MAILJET_API_SECRET requis');
  process.exit(1);
}

// Lien signé « reprise 5 jours » : l'endpoint vérifie le consentement puis
// redirige vers le jour 1 (DOI confirmé) ou le formulaire pré-rempli (sinon).
function buildReengageUrl(email) {
  const secret = process.env.REENGAGEMENT_SIGNING_SECRET;
  if (!secret) {
    console.error('❌ REENGAGEMENT_SIGNING_SECRET requis pour générer le lien signé');
    process.exit(1);
  }
  const sig = crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex');
  return `https://api.fluance.io/reengage-5jours?email=${encodeURIComponent(email.toLowerCase().trim())}&sig=${sig}`;
}

const CTA_A = buildReengageUrl(RECIPIENT);
const CTA_B = CTA_A; // Même lien : l'endpoint aiguille selon le consentement

function button(link, label) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${link}" style="display:inline-block;background-color:#E6B84A;color:#0f172a;padding:14px 32px;border-radius:25px;font-weight:bold;font-size:16px;text-decoration:none;">${label}</a>
  </div>`;
}

function wrap(title, body) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background-color:#648ED8;padding:20px;border-radius:6px 6px 0 0;">
      <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;text-align:center;">${title}</p>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;font-size:16px;line-height:1.65;color:#333333;">
      ${body}
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#666666;">
      Cédric<br>Fluance : le mouvement qui éveille et apaise<br>
      <a href="https://fluance.io" style="color:#648ED8;">fluance.io</a>
    </div>
  </div>
</body>
</html>`;
}

const emailA = {
  Subject: `${NAME}, vos 5 jours offerts vous attendent toujours`,
  TextPart: `Bonjour ${NAME},

Il y a quelques semaines, vous vous êtes inscrit·e pour recevoir les 5 jours de pratiques Fluance : 5 minutes par jour pour relâcher les tensions, libérer le dos et retrouver un calme intérieur.

Avec la rentrée qui approche, c'est le moment idéal pour poser une habitude simple, sans pression, sans matériel, depuis chez vous. Et bonne nouvelle : votre place est toujours là.

Recevoir mes 5 jours offerts : ${CTA_A}

Pas besoin d'être souple ni sportif·ve. Juste l'envie de vous offrir quelques minutes pour vous.

À très vite,
Cédric
Fluance : le mouvement qui éveille et apaise`,
  HTMLPart: wrap(
      '5 jours pour libérer les tensions',
      `<p>Bonjour ${NAME},</p>
      <p>Il y a quelques semaines, vous vous êtes inscrit·e pour recevoir les <strong>5 jours de pratiques Fluance</strong> : <strong>5 minutes par jour pour relâcher les tensions, libérer le dos et retrouver un calme intérieur.</strong></p>
      <p>Avec la rentrée qui approche, c'est le moment idéal pour poser une habitude simple, sans pression, sans matériel, depuis chez vous. Et bonne nouvelle : <strong>votre place est toujours là.</strong></p>
      ${button(CTA_A, 'Recevoir mes 5 jours offerts')}
      <p>Pas besoin d'être souple ni sportif·ve. Juste l'envie de vous offrir quelques minutes pour vous.</p>
      <p>À très vite,<br>Cédric</p>`,
  ),
};

const emailB = {
  Subject: `${NAME}, votre cadeau vous attend. Il reste une confirmation`,
  TextPart: `Bonjour ${NAME},

Vous vous étiez inscrit·e pour recevoir les 5 jours de pratiques Fluance offerts, et votre cadeau est prêt.

5 minutes par jour, pendant 5 jours, pour libérer les tensions de votre dos et apaiser votre mental.

Pour le recevoir, il ne reste qu'une petite étape : confirmer votre adresse email. C'est ce qui garantit que le cadeau arrive bien entre vos mains.

Confirmer et recevoir mon cadeau : ${CTA_B}

À très vite,
Cédric
Fluance : le mouvement qui éveille et apaise`,
  HTMLPart: wrap(
      'Votre cadeau vous attend',
      `<p>Bonjour ${NAME},</p>
      <p>Vous vous étiez inscrit·e pour recevoir les <strong>5 jours de pratiques Fluance offerts</strong>, et votre cadeau est prêt.</p>
      <p><strong>5 minutes par jour, pendant 5 jours, pour libérer les tensions de votre dos et apaiser votre mental.</strong></p>
      <p>Pour le recevoir, il ne reste qu'une petite étape : <strong>confirmer votre adresse email</strong>. C'est ce qui garantit que le cadeau arrive bien entre vos mains.</p>
      ${button(CTA_B, 'Confirmer et recevoir mon cadeau')}
      <p>À très vite,<br>Cédric</p>`,
  ),
};

function sendMail(emailData, label) {
  return new Promise((resolve, reject) => {
    const payload = {
      Messages: [{
        From: {Email: 'fluance@actu.fluance.io', Name: 'Cédric de Fluance'},
        To: [{Email: RECIPIENT, Name: NAME}],
        Subject: emailData.Subject,
        TextPart: emailData.TextPart,
        HTMLPart: emailData.HTMLPart,
      }],
    };
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.mailjet.com',
      path: '/v3.1/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Basic ${Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64')}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${label} envoyé à ${RECIPIENT}`);
          resolve();
        } else {
          console.error(`❌ ${label} échec (${res.statusCode}): ${data.slice(0, 300)}`);
          reject(new Error(`${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  await sendMail(emailA, 'Email A (ré-engagement 227 confirmés)');
  await sendMail(emailB, 'Email B (cadeau + confirmation 113 non confirmés)');
  console.log('\nVérifie ta boîte mail : les 2 emails de validation sont en route.');
})().catch((e) => {
  console.error('Erreur fatale :', e.message);
  process.exit(1);
});
