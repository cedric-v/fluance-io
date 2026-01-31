/**
 * Service de notifications admin pour les alertes critiques
 * Envoie des emails à l'admin en cas de problème détecté
 */

const ADMIN_EMAIL = 'cedricjourney@gmail.com';

/**
 * Envoie une alerte à l'admin via Mailjet
 * @param {Object} params - Paramètres de l'alerte
 * @param {string} params.subject - Sujet de l'email
 * @param {string} params.message - Message détaillé
 * @param {string} params.severity - Niveau de sévérité (info, warning, high, critical)
 * @param {Object} params.metadata - Métadonnées additionnelles
 * @param {string} mailjetApiKey - Clé API Mailjet
 * @param {string} mailjetApiSecret - Secret API Mailjet
 */
async function sendAdminAlert(params, mailjetApiKey, mailjetApiSecret) {
  const {subject, message, severity = 'info', metadata = {}} = params;

  // Icônes selon la sévérité
  const severityIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    high: '🔴',
    critical: '🚨',
  };

  const icon = severityIcons[severity] || 'ℹ️';

  // Construire le message HTML
  const htmlMessage = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f44336; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .header.warning { background: #ff9800; }
        .header.info { background: #2196F3; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .metadata { background: #fff; padding: 15px; margin-top: 15px; border-left: 4px solid #2196F3; }
        .metadata h3 { margin-top: 0; color: #2196F3; }
        .metadata pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header ${severity}">
          <h1>${icon} ${subject}</h1>
        </div>
        <div class="content">
          <p><strong>Niveau de sévérité:</strong> ${severity.toUpperCase()}</p>
          <p><strong>Date:</strong> ${new Date().toISOString()}</p>
          <hr>
          <div style="white-space: pre-wrap;">${message}</div>
          
          ${Object.keys(metadata).length > 0 ? `
            <div class="metadata">
              <h3>📋 Métadonnées</h3>
              <pre>${JSON.stringify(metadata, null, 2)}</pre>
            </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>Alerte automatique - Fluance.io</p>
          <p>Ne pas répondre à cet email</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textMessage = `
${icon} ${subject}

Niveau de sévérité: ${severity.toUpperCase()}
Date: ${new Date().toISOString()}

${message}

${Object.keys(metadata).length > 0 ? `
Métadonnées:
${JSON.stringify(metadata, null, 2)}
` : ''}

---
Alerte automatique - Fluance.io
  `.trim();

  try {
    // Envoyer l'email via Mailjet
    const auth = Buffer.from(`${mailjetApiKey}:${mailjetApiSecret}`).toString('base64');

    const response = await fetch('https://api.mailjet.com/v3.1/send', {
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
              Name: 'Fluance Alert System',
            },
            To: [
              {
                Email: ADMIN_EMAIL,
                Name: 'Admin',
              },
            ],
            Subject: `${icon} ${subject}`,
            TextPart: textMessage,
            HTMLPart: htmlMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', errorData);
      return {success: false, error: errorData};
    }

    console.log(`✅ Alerte admin envoyée: ${subject}`);
    return {success: true};
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'alerte admin:', error.message);
    return {success: false, error: error.message};
  }
}

module.exports = {
  sendAdminAlert,
  ADMIN_EMAIL,
};
