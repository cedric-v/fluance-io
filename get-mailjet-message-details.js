#!/usr/bin/env node

/**
 * Script pour récupérer les détails d'un message MailJet par son ID
 * Usage: node get-mailjet-message-details.js MESSAGE_ID
 */

const https = require('https');

// Récupérer le message ID depuis les arguments de ligne de commande
const messageId = process.argv[2];

if (!messageId) {
  console.error('❌ Erreur: Veuillez fournir un message ID');
  console.log('Usage: node get-mailjet-message-details.js MESSAGE_ID');
  console.log('Exemple: node get-mailjet-message-details.js GAcbpCBha4');
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

console.log(`\n🔍 Recherche des détails du message: ${messageId}\n`);

// Fonction pour récupérer les détails d'un message via l'API v3.1 (Send API)
function getMessageDetailsV31(messageId) {
  return new Promise((resolve, reject) => {
    const url = `/v3.1/send/${messageId}`;
    
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

// Fonction pour récupérer les détails d'un message via l'API REST
function getMessageDetailsREST(messageId) {
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

// Fonction pour rechercher le message par ID dans l'historique
function searchMessageById(messageId) {
  return new Promise((resolve, reject) => {
    // Essayer de trouver le message dans l'historique récent
    const url = `/v3/REST/message?Limit=1000&Sort=ArrivedAt+DESC`;
    
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
            // Chercher le message par ID (peut être dans différents champs)
            const found = response.Data?.find(m => 
              m.ID === messageId || 
              m.MessageID === messageId ||
              m.CampaignID === messageId ||
              String(m.ID).includes(messageId) ||
              String(m.MessageID).includes(messageId)
            );
            resolve(found || null);
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
async function getMessageDetails() {
  try {
    console.log('🔍 Tentative 1: Recherche via API REST...\n');
    
    // Essayer d'abord avec l'API REST
    try {
      const restResult = await getMessageDetailsREST(messageId);
      if (restResult.Data && restResult.Data.length > 0) {
        const message = restResult.Data[0];
        displayMessageDetails(message, 'API REST');
        return;
      }
    } catch (error) {
      console.log(`⚠️  API REST: ${error.message}\n`);
    }

    console.log('🔍 Tentative 2: Recherche dans l\'historique...\n');
    
    // Chercher dans l'historique
    try {
      const found = await searchMessageById(messageId);
      if (found) {
        displayMessageDetails(found, 'Historique');
        return;
      }
    } catch (error) {
      console.log(`⚠️  Recherche historique: ${error.message}\n`);
    }

    console.log('❌ Message non trouvé via l\'API');
    console.log('\n💡 Solutions alternatives:');
    console.log('   1. Vérifier le message ID dans MailJet Dashboard:');
    console.log(`      https://app.mailjet.com/statistics/email`);
    console.log('   2. Le message ID peut être différent selon le contexte');
    console.log('   3. Utiliser l\'historique des emails du contact:');
    console.log('      node check-mailjet-email-history.js EMAIL');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Fonction pour afficher les détails du message
function displayMessageDetails(message, source) {
  console.log('='.repeat(80));
  console.log(`✅ MESSAGE TROUVÉ (via ${source})`);
  console.log('='.repeat(80));
  console.log('\n📧 Informations du message:');
  console.log('─'.repeat(80));
  
  // Afficher tous les champs disponibles
  Object.keys(message).forEach(key => {
    const value = message[key];
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'object') {
        console.log(`${key}: ${JSON.stringify(value, null, 2)}`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
  });

  // Informations spécifiques importantes
  console.log('\n' + '='.repeat(80));
  console.log('🔍 INFORMATIONS CLÉS');
  console.log('='.repeat(80));
  
  if (message.TemplateID) {
    console.log(`\n📋 Template ID: ${message.TemplateID}`);
    if (message.TemplateID === 7571938) {
      console.log('   ⭐ C\'EST LE TEMPLATE ATTENDU (7571938)');
    } else {
      console.log(`   ⚠️  Ce n'est PAS le template attendu (attendu: 7571938, trouvé: ${message.TemplateID})`);
    }
    console.log(`   💡 Voir le template: https://app.mailjet.com/template/${message.TemplateID}`);
  } else {
    console.log('\n⚠️  Template ID: NON DISPONIBLE');
    console.log('   L\'API ne retourne pas toujours le TemplateID pour les emails transactionnels');
  }
  
  if (message.Subject) {
    console.log(`\n📝 Sujet: ${message.Subject}`);
  }
  
  if (message.SenderEmail || message.FromEmail) {
    console.log(`\n📤 Expéditeur: ${message.SenderEmail || message.FromEmail}`);
  }
  
  if (message.RecipientEmail || message.ToEmail) {
    console.log(`\n📥 Destinataire: ${message.RecipientEmail || message.ToEmail}`);
  }
  
  if (message.ArrivedAt || message.CreatedAt) {
    console.log(`\n📅 Date: ${message.ArrivedAt || message.CreatedAt}`);
  }
  
  if (message.State || message.Status) {
    console.log(`\n📊 Statut: ${message.State || message.Status}`);
  }

  // Variables du template si disponibles
  if (message.Variables) {
    console.log(`\n🔧 Variables du template:`);
    console.log(JSON.stringify(message.Variables, null, 2));
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 Pour voir les détails complets dans MailJet Dashboard:');
  console.log('   https://app.mailjet.com/statistics/email');
  console.log('='.repeat(80) + '\n');
}

// Exécuter
getMessageDetails();
