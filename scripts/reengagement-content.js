#!/usr/bin/env node

/**
 * Contenu partagé de la campagne de ré-engagement « 5 jours » (segment A/B)
 * et générateur de lien signé vers l'endpoint reengage5jours.
 *
 * Utilisé par :
 *  - scripts/send-reengagement-preview.js  (prévisualisation de validation)
 *  - scripts/send-reengagement-campaign.js (envoi segmenté réel)
 */

const crypto = require('crypto');

/**
 * Lien signé « reprise 5 jours ». La signature couvre l'email (anti-abus).
 * Le prénom est un simple paramètre de pré-remplissage (non signé).
 *
 * @param {string} email - Email du destinataire
 * @param {string} firstname - Prénom (pré-remplissage du formulaire)
 * @returns {string} URL https://api.fluance.io/reengage-5jours?...
 */
function buildReengageUrl(email, firstname) {
  const secret = process.env.REENGAGEMENT_SIGNING_SECRET;
  if (!secret) {
    throw new Error('REENGAGEMENT_SIGNING_SECRET requis pour générer le lien signé');
  }
  const normalized = email.toLowerCase().trim();
  const sig = crypto.createHmac('sha256', secret).update(normalized).digest('hex');
  const params = new URLSearchParams({email: normalized, sig});
  if (firstname) params.set('firstname', firstname);
  return `https://api.fluance.io/reengage-5jours?${params.toString()}`;
}

function wrapHtml(title, body) {
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

function button(link, label) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${link}" style="display:inline-block;background-color:#E6B84A;color:#0f172a;padding:14px 32px;border-radius:25px;font-weight:bold;font-size:16px;text-decoration:none;">${label}</a>
  </div>`;
}

/**
 * Email A — ré-engagement des contacts au double opt-in confirmé.
 * Objectif : relancer vers les 5 jours offerts (1 clic → jour 1).
 */
function buildEmailA(firstName, ctaUrl) {
  const name = firstName || '';
  return {
    subject: `${name}, vos 5 jours offerts vous attendent toujours`,
    text: `Bonjour ${name},

Il y a quelques semaines, vous vous êtes inscrit·e pour recevoir les 5 jours de pratiques Fluance : 5 minutes par jour pour relâcher les tensions, libérer le dos et retrouver un calme intérieur.

Avec la rentrée qui approche, c'est le moment idéal pour poser une habitude simple, sans pression, sans matériel, depuis chez vous. Et bonne nouvelle : votre place est toujours là.

Recevoir mes 5 jours offerts : ${ctaUrl}

Pas besoin d'être souple ni sportif·ve. Juste l'envie de vous offrir quelques minutes pour vous.

À très vite,
Cédric
Fluance : le mouvement qui éveille et apaise`,
    html: wrapHtml(
        '5 jours pour libérer les tensions',
        `<p>Bonjour ${name},</p>
      <p>Il y a quelques semaines, vous vous êtes inscrit·e pour recevoir les <strong>5 jours de pratiques Fluance</strong> : <strong>5 minutes par jour pour relâcher les tensions, libérer le dos et retrouver un calme intérieur.</strong></p>
      <p>Avec la rentrée qui approche, c'est le moment idéal pour poser une habitude simple, sans pression, sans matériel, depuis chez vous. Et bonne nouvelle : <strong>votre place est toujours là.</strong></p>
      ${button(ctaUrl, 'Recevoir mes 5 jours offerts')}
      <p>Pas besoin d'être souple ni sportif·ve. Juste l'envie de vous offrir quelques minutes pour vous.</p>
      <p>À très vite,<br>Cédric</p>`,
    ),
  };
}

/**
 * Email B — contacts sans double opt-in confirmé : cadeau + nouvelle confirmation.
 * Le bénéfice est mis en avant dès l'intro (contacts « froids », mois sans contact).
 */
function buildEmailB(firstName, ctaUrl) {
  const name = firstName || '';
  return {
    subject: `${name}, votre cadeau vous attend. Il reste une confirmation`,
    text: `Bonjour ${name},

Vous vous étiez inscrit·e pour recevoir les 5 jours de pratiques Fluance offerts, et votre cadeau est prêt.

5 minutes par jour, pendant 5 jours, pour libérer les tensions de votre dos et apaiser votre mental.

Pour le recevoir, il ne reste qu'une petite étape : confirmer votre adresse email. C'est ce qui garantit que le cadeau arrive bien entre vos mains.

Confirmer et recevoir mon cadeau : ${ctaUrl}

À très vite,
Cédric
Fluance : le mouvement qui éveille et apaise`,
    html: wrapHtml(
        'Votre cadeau vous attend',
        `<p>Bonjour ${name},</p>
      <p>Vous vous étiez inscrit·e pour recevoir les <strong>5 jours de pratiques Fluance offerts</strong>, et votre cadeau est prêt.</p>
      <p><strong>5 minutes par jour, pendant 5 jours, pour libérer les tensions de votre dos et apaiser votre mental.</strong></p>
      <p>Pour le recevoir, il ne reste qu'une petite étape : <strong>confirmer votre adresse email</strong>. C'est ce qui garantit que le cadeau arrive bien entre vos mains.</p>
      ${button(ctaUrl, 'Confirmer et recevoir mon cadeau')}
      <p>À très vite,<br>Cédric</p>`,
    ),
  };
}

/**
 * Email C — relance J+14 pour les non-cliqueurs (segment A).
 * Angle : rappel doux, la place est toujours là, angle rentrée.
 */
function buildEmailC(firstName, ctaUrl) {
  const name = firstName || '';
  return {
    subject: `${name}, on garde une place pour vous ? (5 jours offerts)`,
    text: `Bonjour ${name},

Il y a deux semaines, je vous proposais de recevoir les 5 jours de pratiques Fluance offerts : 5 minutes par jour, pendant 5 jours, pour libérer les tensions de votre dos et apaiser votre mental.

Si vous n'avez pas encore eu le moment d'y jeter un œil, sachez que votre place est toujours là. Et avec la rentrée qui approche, c'est une excellente occasion de commencer en douceur.

Recevoir mes 5 jours offerts : ${ctaUrl}

À très vite,
Cédric
Fluance : le mouvement qui éveille et apaise`,
    html: wrapHtml(
        'Toujours une place pour vous',
        `<p>Bonjour ${name},</p>
      <p>Il y a deux semaines, je vous proposais de recevoir les <strong>5 jours de pratiques Fluance offerts</strong> : <strong>5 minutes par jour, pendant 5 jours, pour libérer les tensions de votre dos et apaiser votre mental.</strong></p>
      <p>Si vous n'avez pas encore eu le moment d'y jeter un œil, sachez que <strong>votre place est toujours là</strong>. Et avec la rentrée qui approche, c'est une excellente occasion de commencer en douceur.</p>
      ${button(ctaUrl, 'Recevoir mes 5 jours offerts')}
      <p>À très vite,<br>Cédric</p>`,
    ),
  };
}

module.exports = {buildReengageUrl, buildEmailA, buildEmailB, buildEmailC};
