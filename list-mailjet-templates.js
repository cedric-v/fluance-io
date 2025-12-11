#!/usr/bin/env node

/**
 * Script pour lister tous les templates MailJet
 * Usage: node list-mailjet-templates.js
 */

const https = require('https');

// Les clés API MailJet doivent être dans les variables d'environnement
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;

if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
  console.error('❌ Erreur: Les variables d\'environnement MAILJET_API_KEY et MAILJET_API_SECRET doivent être définies');
  console.log('\nPour définir les variables d\'environnement:');
  console.log('export MAILJET_API_KEY="votre_cle_api"');
  console.log('export MAILJET_API_SECRET="votre_secret_api"');
  console.log('\nOu utilisez Firebase Secrets:');
  console.log('export MAILJET_API_KEY=$(firebase functions:secrets:access MAILJET_API_KEY)');
  console.log('export MAILJET_API_SECRET=$(firebase functions:secrets:access MAILJET_API_SECRET)');
  process.exit(1);
}

// Encoder les credentials pour l'authentification Basic
const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');

console.log('\n🔍 Recherche des templates MailJet...\n');

// Fonction pour récupérer les templates avec pagination
function getTemplates(page = 0, limit = 100) {
  return new Promise((resolve, reject) => {
    const url = `/v3/REST/template?Limit=${limit}&Offset=${page * limit}&Sort=ID+DESC`;
    
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
async function listTemplates() {
  try {
    let allTemplates = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await getTemplates(page);
      
      if (response.Data && response.Data.length > 0) {
        allTemplates = allTemplates.concat(response.Data);
        console.log(`📄 Récupéré ${response.Data.length} templates (page ${page + 1})...`);
        
        // Vérifier s'il y a plus de templates
        if (response.Data.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`\n✅ Total: ${allTemplates.length} templates trouvés\n`);
    console.log('='.repeat(80));
    console.log('📧 TEMPLATES MAILJET');
    console.log('='.repeat(80));

    // Trier par ID
    allTemplates.sort((a, b) => b.ID - a.ID);

    // Afficher les templates
    allTemplates.forEach((template, index) => {
      console.log(`\n${index + 1}. Template ID: ${template.ID}`);
      console.log('─'.repeat(80));
      console.log(`   Nom: ${template.Name || '(sans nom)'}`);
      console.log(`   Créé le: ${template.CreatedAt || '(non disponible)'}`);
      console.log(`   Dernière modification: ${template.LastUpdatedAt || '(non disponible)'}`);
      console.log(`   Propriétaire: ${template.OwnerType || '(non disponible)'}`);
      console.log(`   Catégorie: ${template.Category || '(non disponible)'}`);
      
      // Vérifier si c'est le template utilisé dans le code
      if (template.ID === 7571938) {
        console.log('   ⭐ C\'EST LE TEMPLATE UTILISÉ DANS LE CODE (ID 7571938)');
      }
    });

    // Rechercher spécifiquement le template 7571938
    console.log('\n' + '='.repeat(80));
    console.log('🔍 RECHERCHE DU TEMPLATE 7571938');
    console.log('='.repeat(80));
    
    const template7571938 = allTemplates.find(t => t.ID === 7571938);
    
    if (template7571938) {
      console.log('\n✅ Template 7571938 trouvé !');
      console.log('─'.repeat(80));
      console.log(`Nom: ${template7571938.Name || '(sans nom)'}`);
      console.log(`Créé le: ${template7571938.CreatedAt || '(non disponible)'}`);
      console.log(`Dernière modification: ${template7571938.LastUpdatedAt || '(non disponible)'}`);
      console.log(`Propriétaire: ${template7571938.OwnerType || '(non disponible)'}`);
      console.log(`Catégorie: ${template7571938.Category || '(non disponible)'}`);
      console.log('\n💡 Pour voir ce template dans MailJet Dashboard:');
      console.log(`   https://app.mailjet.com/template/${template7571938.ID}`);
    } else {
      console.log('\n❌ Template 7571938 NON TROUVÉ');
      console.log('   Le template n\'existe pas ou n\'est pas accessible avec votre compte.');
      console.log('   Vérifiez que vous utilisez le bon compte MailJet.');
    }

    // Afficher les templates récents (derniers 10)
    console.log('\n' + '='.repeat(80));
    console.log('📋 DERNIERS TEMPLATES CRÉÉS (10)');
    console.log('='.repeat(80));
    
    const recentTemplates = allTemplates
      .sort((a, b) => {
        const dateA = a.CreatedAt ? new Date(a.CreatedAt) : new Date(0);
        const dateB = b.CreatedAt ? new Date(b.CreatedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, 10);

    recentTemplates.forEach((template, index) => {
      console.log(`\n${index + 1}. ID: ${template.ID} - ${template.Name || '(sans nom)'}`);
      console.log(`   Créé le: ${template.CreatedAt || '(non disponible)'}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('💡 Pour voir un template dans MailJet Dashboard:');
    console.log('   https://app.mailjet.com/template/TEMPLATE_ID');
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
listTemplates();
