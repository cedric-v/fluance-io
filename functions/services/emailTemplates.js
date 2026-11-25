/**
 * Email Templates - Rendu des templates HTML transactionnels
 *
 * Les templates MJML (src/emails/*.mjml) sont compilés vers
 * functions/emails/*.html par `npm run build:email-templates`
 * (hook predeploy de firebase.json).
 *
 * Ce module centralise le chargement + l'interpolation `{{variable}}`
 * pour que les fonctions Cloud et les services métier partagent la même
 * implémentation (une seule source de vérité).
 */

const fs = require('fs');
const path = require('path');

/**
 * Charge un template HTML et remplace les variables `{{clé}}`.
 * @param {string} templateName - Nom du fichier sans extension (ex: 'booking-confirmation')
 * @param {Object} variables - Variables à interpoler
 * @returns {string} HTML prêt à l'envoi
 */
function loadEmailTemplate(templateName, variables = {}) {
  const templatePath = path.join(__dirname, '..', 'emails', `${templateName}.html`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}.html`);
  }

  let html = fs.readFileSync(templatePath, 'utf8');

  // Remplacer les variables au format {{variable}}
  Object.keys(variables).forEach((key) => {
    const value = variables[key] === null || variables[key] === undefined ? '' : variables[key];

    // Cas 1 : Avec espace avant (ex: "Bonjour {{firstName}}," -> "Bonjour Cédric," ou "Bonjour,")
    const regexWithSpace = new RegExp(`\\s+\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regexWithSpace, value ? ` ${value}` : '');

    // Cas 2 : Sans espace avant (ex: href="{{confirmationUrl}}" -> href="https://...")
    const regexWithoutSpace = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regexWithoutSpace, value);
  });

  // Nettoyer les placeholders non remplacés (évite les "{{..." dans un email)
  html = html.replace(/\{\{[\w]+\}\}/g, '');

  return html;
}

module.exports = {loadEmailTemplate};
