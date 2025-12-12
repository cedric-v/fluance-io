#!/usr/bin/env node

/**
 * Script pour ajouter des contacts dans Mailjet avec les propriétés appropriées
 * 
 * Usage: node scripts/add-mailjet-contacts.js
 * 
 * Prérequis:
 * - Variables d'environnement MAILJET_API_KEY et MAILJET_API_SECRET
 * - Liste Mailjet ID: 10524140
 */

const https = require('https');

// Récupérer les clés API depuis les variables d'environnement
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;

if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
  console.error('❌ Erreur: Les variables d\'environnement MAILJET_API_KEY et MAILJET_API_SECRET doivent être définies');
  console.log('\nPour définir les variables d\'environnement:');
  console.log('export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)');
  console.log('export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)');
  process.exit(1);
}

const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');
const LIST_ID = 10524140; // Liste Mailjet principale

// Charger les contacts depuis un fichier de configuration (non versionné)
const fs = require('fs');
const path = require('path');
const CONTACTS_CONFIG_PATH = path.join(__dirname, 'mailjet-contacts-config.json');

let contacts = [];

if (fs.existsSync(CONTACTS_CONFIG_PATH)) {
  try {
    const configData = fs.readFileSync(CONTACTS_CONFIG_PATH, 'utf8');
    contacts = JSON.parse(configData);
    console.log(`✅ ${contacts.length} contact(s) chargé(s) depuis la configuration\n`);
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture de ${CONTACTS_CONFIG_PATH}:`, error.message);
    console.error('\n💡 Créez le fichier avec la structure suivante:');
    console.error(JSON.stringify([
      {
        name: 'Nom',
        email: 'email@example.com',
        product: '21jours', // ou 'complet'
        dateAchat: 'DD/MM/YYYY',
        montant: '19.00'
      }
    ], null, 2));
    process.exit(1);
  }
} else {
  console.error(`❌ Fichier de configuration introuvable: ${CONTACTS_CONFIG_PATH}`);
  console.error('\n💡 Créez le fichier mailjet-contacts-config.json avec la structure suivante:');
  console.error(JSON.stringify([
    {
      name: 'Nom',
      email: 'email@example.com',
      product: '21jours', // ou 'complet'
      dateAchat: 'DD/MM/YYYY',
      montant: '19.00'
    }
  ], null, 2));
  process.exit(1);
}

// Fonction pour faire une requête HTTPS
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Fonction pour mettre à jour le nom du contact (champ Name standard)
async function updateContactName(email, name) {
  if (!name) return;

  const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
  const options = {
    hostname: 'api.mailjet.com',
    path: `/v3/REST/contact/${encodedEmail}`,
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  };

  const data = {
    Email: email.toLowerCase().trim(),
    Name: name,
  };

  try {
    await makeRequest(options, data);
  } catch (error) {
    // Ne pas bloquer si la mise à jour du nom échoue
    console.log(`   ⚠️  Impossible de mettre à jour le nom du contact: ${error.message}`);
  }
}

// Fonction pour ajouter un contact à la liste Mailjet
async function addContactToList(email, listId) {
  const options = {
    hostname: 'api.mailjet.com',
    path: `/v3/REST/contactslist/${listId}/managecontact`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  };

  const data = {
    Email: email.toLowerCase().trim(),
    Action: 'addnoforce',
  };

  try {
    const response = await makeRequest(options, data);
    return response;
  } catch (error) {
    if (error.message.includes('HTTP 400') && error.message.includes('already exists')) {
      console.log(`   ⚠️  Contact déjà dans la liste`);
      return { success: true, alreadyExists: true };
    }
    throw error;
  }
}

// Fonction pour mettre à jour les propriétés d'un contact
async function updateContactProperties(email, properties) {
  const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
  const url = `/v3/REST/contactdata/${encodedEmail}`;

  // Récupérer les propriétés actuelles
  let currentProperties = {};
  try {
    const getOptions = {
      hostname: 'api.mailjet.com',
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    };
    const getResponse = await makeRequest(getOptions);
    if (getResponse.Data && getResponse.Data.length > 0) {
      const contactData = getResponse.Data[0];
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
  } catch (error) {
    // Contact properties n'existent pas encore, c'est normal
    console.log(`   📋 Aucune propriété existante trouvée`);
  }

  // Fusionner les nouvelles propriétés avec les existantes
  const updatedProperties = {...currentProperties, ...properties};

  // Convertir en format Mailjet (tableau Name/Value)
  const dataArray = Object.keys(updatedProperties).map((key) => ({
    Name: key,
    Value: String(updatedProperties[key]),
  }));

  const updateOptions = {
    hostname: 'api.mailjet.com',
    path: url,
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  };

  const updateData = {
    Data: dataArray,
  };

  try {
    const response = await makeRequest(updateOptions, updateData);
    return response;
  } catch (error) {
    throw error;
  }
}

// Fonction principale
async function addContacts() {
  console.log('🚀 Ajout des contacts dans Mailjet...\n');

  for (const contact of contacts) {
    try {
      console.log(`\n📧 Traitement: ${contact.name} (${contact.email})`);
      console.log(`   Produit: ${contact.product}`);

      // Ajouter le contact à la liste
      console.log(`   📋 Ajout à la liste ${LIST_ID}...`);
      await addContactToList(contact.email, LIST_ID);
      console.log(`   ✅ Contact ajouté à la liste`);

      // Mettre à jour le nom du contact (champ Name standard)
      if (contact.name) {
        console.log(`   📋 Mise à jour du nom du contact...`);
        await updateContactName(contact.email, contact.name);
        console.log(`   ✅ Nom du contact mis à jour`);
      }

      // Préparer les propriétés
      const properties = {
        statut: 'client',
        produits_achetes: contact.product,
        est_client: 'True',
        nombre_achats: '1',
        valeur_client: contact.montant,
      };

      // Ajouter le prénom si disponible
      if (contact.name) {
        properties.firstname = contact.name;
      }

      if (contact.dateAchat) {
        // Convertir le format JJ/MM/AAAA en format ISO (YYYY-MM-DD)
        const dateParts = contact.dateAchat.split('/');
        if (dateParts.length === 3) {
          const day = dateParts[0].padStart(2, '0');
          const month = dateParts[1].padStart(2, '0');
          const year = dateParts[2];
          // Format ISO: YYYY-MM-DD
          const isoDate = `${year}-${month}-${day}`;
          // Mailjet attend le format ISO complet avec heure (ou juste la date)
          // Utiliser toISOString() pour avoir le format complet
          const dateObj = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
          const dateStr = dateObj.toISOString();
          properties.date_premier_achat = dateStr;
          properties.date_dernier_achat = dateStr;
        } else {
          console.error(`   ⚠️  Format de date invalide: ${contact.dateAchat} (attendu: JJ/MM/AAAA)`);
        }
      }

      // Mettre à jour les propriétés
      console.log(`   📋 Mise à jour des propriétés...`);
      await updateContactProperties(contact.email, properties);
      console.log(`   ✅ Propriétés mises à jour`);

      console.log(`   ✅ ${contact.name} configuré avec succès!`);

    } catch (error) {
      console.error(`   ❌ Erreur pour ${contact.name}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Traitement terminé!');
  console.log('='.repeat(80));
  console.log('\n💡 Pour vérifier les contacts dans Mailjet:');
  console.log('   https://app.mailjet.com/contacts');
  console.log('\n💡 Pour vérifier les propriétés d\'un contact:');
  console.log('   node check-mailjet-contact-properties.js EMAIL');
}

// Exécuter
addContacts()
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
