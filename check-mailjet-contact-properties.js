#!/usr/bin/env node

/**
 * Script pour vérifier les contact properties MailJet d'un contact
 * Usage: node check-mailjet-contact-properties.js EMAIL
 */

const https = require('https');

// Récupérer l'email depuis les arguments de ligne de commande
const email = process.argv[2];

if (!email) {
  console.error('❌ Erreur: Veuillez fournir un email');
  console.log('Usage: node check-mailjet-contact-properties.js EMAIL');
  console.log('Exemple: node check-mailjet-contact-properties.js c.vonlanthen+5prati@gmail.com');
  process.exit(1);
}

// Les clés API MailJet doivent être dans les variables d'environnement
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;

if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
  console.error('❌ Erreur: Les variables d\'environnement MAILJET_API_KEY et MAILJET_API_SECRET doivent être définies');
  console.log('\nPour définir les variables d\'environnement:');
  console.log('export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)');
  console.log('export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)');
  process.exit(1);
}

// Encoder les credentials pour l'authentification Basic
const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');

console.log(`\n🔍 Vérification des contact properties pour: ${email}\n`);

// Fonction pour récupérer les contact properties
function getContactProperties(email) {
  return new Promise((resolve, reject) => {
    const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
    const url = `/v3/REST/contactdata/${encodedEmail}`;

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
        } else if (res.statusCode === 404) {
          resolve(null); // Contact properties n'existent pas encore
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
async function checkContactProperties() {
  try {
    const response = await getContactProperties(email);

    if (!response || !response.Data || response.Data.length === 0) {
      console.log('❌ Aucune contact property trouvée pour ce contact');
      console.log('   Les properties n\'ont pas encore été définies.');
      console.log('\n💡 Cela peut signifier que:');
      console.log('   - L\'opt-in a été fait avant le déploiement de la fonction');
      console.log('   - La fonction updateMailjetContactProperties n\'a pas été appelée');
      console.log('   - Une erreur s\'est produite lors de la mise à jour');
      return;
    }

    const contactData = response.Data[0];
    const properties = contactData.Data || {};

    console.log('✅ Contact properties trouvées\n');
    console.log('='.repeat(80));
    console.log('📋 CONTACT PROPERTIES MAILJET');
    console.log('='.repeat(80));

    // Afficher toutes les properties
    if (Object.keys(properties).length === 0) {
      console.log('\n⚠️  Aucune property définie');
    } else {
      console.log('\nProperties définies:');
      console.log('─'.repeat(80));

      // Properties attendues
      const expectedProperties = [
        'statut',
        'source_optin',
        'date_optin',
        'produits_achetes',
        'date_premier_achat',
        'date_dernier_achat',
        'valeur_client',
        'nombre_achats',
        'est_client',
      ];

      expectedProperties.forEach((prop) => {
        const value = properties[prop];
        if (value !== undefined && value !== null && value !== '') {
          console.log(`${prop}: ${value}`);
        } else {
          console.log(`${prop}: (non défini)`);
        }
      });

      // Afficher les autres properties si présentes
      const otherProperties = Object.keys(properties).filter((p) => !expectedProperties.includes(p));
      if (otherProperties.length > 0) {
        console.log('\nAutres properties:');
        otherProperties.forEach((prop) => {
          console.log(`${prop}: ${properties[prop]}`);
        });
      }
    }

    // Vérification spécifique
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VÉRIFICATION');
    console.log('='.repeat(80));

    if (properties.statut) {
      console.log(`\n✅ statut: ${properties.statut}`);
    } else {
      console.log('\n❌ statut: NON DÉFINI');
    }

    if (properties.source_optin) {
      console.log(`✅ source_optin: ${properties.source_optin}`);
      if (properties.source_optin.includes('5joursofferts')) {
        console.log('   ⭐ Contient "5joursofferts" - OK');
      } else {
        console.log('   ⚠️  Ne contient pas "5joursofferts"');
      }
    } else {
      console.log('\n❌ source_optin: NON DÉFINI');
    }

    if (properties.date_optin) {
      console.log(`✅ date_optin: ${properties.date_optin}`);
    } else {
      console.log('\n❌ date_optin: NON DÉFINI');
    }

    if (properties.est_client) {
      console.log(`✅ est_client: ${properties.est_client}`);
      if (properties.est_client === 'False') {
        console.log('   ⭐ Correct pour un prospect');
      }
    } else {
      console.log('\n❌ est_client: NON DÉFINI');
    }

    console.log('\n' + '='.repeat(80));
    console.log('💡 Pour voir les properties dans MailJet Dashboard:');
    console.log('   https://app.mailjet.com/contacts');
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
checkContactProperties();
