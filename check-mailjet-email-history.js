#!/usr/bin/env node

/**
 * Script pour vérifier l'historique des emails envoyés à un contact
 * Usage: node check-mailjet-email-history.js EMAIL
 */

const https = require('https');

// Récupérer l'email depuis les arguments de ligne de commande
const email = process.argv[2];

if (!email) {
  console.error('❌ Erreur: Veuillez fournir un email');
  console.log('Usage: node check-mailjet-email-history.js EMAIL');
  console.log('Exemple: node check-mailjet-email-history.js c.vonlanthen@gmail.com');
  process.exit(1);
}

// Les clés API MailJet doivent être dans les variables d'environnement
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;

if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
  console.error('❌ Erreur: Les variables d\'environnement MAILJET_API_KEY et MAILJET_API_SECRET doivent être définies');
  process.exit(1);
}

// Encoder les credentials pour l'authentification Basic
const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');

console.log(`\n🔍 Recherche de l'historique des emails pour: ${email}\n`);

// Fonction pour récupérer l'historique des messages
function getMessageHistory(email, limit = 50) {
  return new Promise((resolve, reject) => {
    const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
    const url = `/v3/REST/message?ContactAlt=${encodedEmail}&Limit=${limit}&Sort=ArrivedAt+DESC`;
    
    const options = {
      hostname: 'api.mailjet.com',
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Erreur parsing: ${error.message}`));
          }
        } else {
          reject(new Error(`Erreur API: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Fonction pour récupérer les détails d'un message
function getMessageDetails(messageId) {
  return new Promise((resolve, reject) => {
    const url = `/v3/REST/message/${messageId}`;
    
    const options = {
      hostname: 'api.mailjet.com',
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Erreur parsing: ${error.message}`));
          }
        } else {
          reject(new Error(`Erreur API: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Fonction principale
async function checkEmailHistory() {
  try {
    const history = await getMessageHistory(email);
    
    if (!history.Data || history.Data.length === 0) {
      console.log('❌ Aucun email trouvé pour ce contact');
      return;
    }

    console.log(`✅ ${history.Data.length} email(s) trouvé(s)\n`);
    console.log('='.repeat(80));
    console.log('📧 HISTORIQUE DES EMAILS');
    console.log('='.repeat(80));

    // Trier par date (plus récent en premier)
    history.Data.sort((a, b) => {
      const dateA = a.ArrivedAt ? new Date(a.ArrivedAt) : new Date(0);
      const dateB = b.ArrivedAt ? new Date(b.ArrivedAt) : new Date(0);
      return dateB - dateA;
    });

    for (let i = 0; i < history.Data.length; i++) {
      const message = history.Data[i];
      
      console.log(`\n${i + 1}. Email ID: ${message.ID}`);
      console.log('─'.repeat(80));
      console.log(`   Arrivé le: ${message.ArrivedAt || '(non disponible)'}`);
      console.log(`   Statut: ${message.State || '(non disponible)'}`);
      console.log(`   Campagne ID: ${message.CampaignID || '(non disponible)'}`);
      console.log(`   Template ID: ${message.TemplateID || '(non disponible)'}`);
      
      // Vérifier si c'est le template de confirmation
      if (message.TemplateID === 7571938) {
        console.log('   ⭐ C\'EST LE TEMPLATE DE CONFIRMATION (ID 7571938)');
      }
      
      // Récupérer plus de détails si c'est un template
      if (message.TemplateID) {
        try {
          const details = await getMessageDetails(message.ID);
          if (details.Data && details.Data.length > 0) {
            const messageDetails = details.Data[0];
            console.log(`   Sujet: ${messageDetails.Subject || '(non disponible)'}`);
            console.log(`   Expéditeur: ${messageDetails.SenderEmail || '(non disponible)'}`);
            console.log(`   Destinataire: ${messageDetails.RecipientEmail || '(non disponible)'}`);
            
            // Afficher les variables du template si disponibles
            if (messageDetails.Variables) {
              console.log(`   Variables du template: ${JSON.stringify(messageDetails.Variables)}`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Impossible de récupérer les détails: ${error.message}`);
        }
      }
    }

    // Rechercher spécifiquement les emails avec le template 7571938
    console.log('\n' + '='.repeat(80));
    console.log('🔍 RECHERCHE DES EMAILS AVEC TEMPLATE 7571938');
    console.log('='.repeat(80));
    
    const confirmationEmails = history.Data.filter(m => m.TemplateID === 7571938);
    
    if (confirmationEmails.length > 0) {
      console.log(`\n✅ ${confirmationEmails.length} email(s) trouvé(s) avec le template 7571938\n`);
      confirmationEmails.forEach((email, index) => {
        console.log(`${index + 1}. Email ID: ${email.ID}`);
        console.log(`   Arrivé le: ${email.ArrivedAt || '(non disponible)'}`);
        console.log(`   Statut: ${email.State || '(non disponible)'}`);
      });
    } else {
      console.log('\n❌ Aucun email trouvé avec le template 7571938');
      console.log('   Cela peut signifier que:');
      console.log('   - Le template n\'a pas été utilisé');
      console.log('   - MailJet a utilisé un autre template ou un fallback');
      console.log('   - L\'email a été envoyé avec un autre template ID');
    }

    // Afficher les templates utilisés
    console.log('\n' + '='.repeat(80));
    console.log('📋 TEMPLATES UTILISÉS DANS LES EMAILS');
    console.log('='.repeat(80));
    
    const templateIds = [...new Set(history.Data
      .filter(m => m.TemplateID)
      .map(m => m.TemplateID))];
    
    if (templateIds.length > 0) {
      templateIds.forEach((templateId, index) => {
        const count = history.Data.filter(m => m.TemplateID === templateId).length;
        console.log(`${index + 1}. Template ID: ${templateId} (utilisé ${count} fois)`);
        if (templateId === 7571938) {
          console.log('   ⭐ C\'EST LE TEMPLATE ATTENDU');
        } else {
          console.log('   ⚠️  Ce n\'est PAS le template attendu (7571938)');
        }
      });
    } else {
      console.log('Aucun template ID trouvé dans les emails');
    }

    console.log('\n' + '='.repeat(80));
    console.log('💡 Pour voir les détails dans MailJet Dashboard:');
    console.log('   https://app.mailjet.com/statistics/email');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Exécuter
checkEmailHistory();
