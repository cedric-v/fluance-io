#!/usr/bin/env node

/**
 * Script pour vérifier le statut d'un contact dans MailJet
 * Usage: node check-mailjet-contact.js EMAIL
 */

const https = require('https');

// Récupérer l'email depuis les arguments de ligne de commande
const email = process.argv[2];

if (!email) {
  console.error('❌ Erreur: Veuillez fournir un email');
  console.log('Usage: node check-mailjet-contact.js EMAIL');
  console.log('Exemple: node check-mailjet-contact.js c.vonlanthen@gmail.com');
  process.exit(1);
}

// Les clés API MailJet doivent être dans les variables d'environnement
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;

if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
  console.error('❌ Erreur: Les variables d\'environnement MAILJET_API_KEY et MAILJET_API_SECRET doivent être définies');
  console.log('\nPour définir les variables d\'environnement:');
  console.log('export MAILJET_API_KEY="votre_cle_api"');
  console.log('export MAILJET_API_SECRET="votre_secret_api"');
  console.log('\nOu utilisez Firebase Secrets:');
  console.log('firebase functions:secrets:access MAILJET_API_KEY');
  console.log('firebase functions:secrets:access MAILJET_API_SECRET');
  process.exit(1);
}

// Encoder les credentials pour l'authentification Basic
const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');

// URL de l'API MailJet pour récupérer un contact
const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
const url = `https://api.mailjet.com/v3/REST/contact/${encodedEmail}`;

console.log(`\n🔍 Vérification du contact: ${email}\n`);

// Faire la requête à l'API MailJet
const options = {
  hostname: 'api.mailjet.com',
  path: `/v3/REST/contact/${encodedEmail}`,
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
        
        if (response.Data && response.Data.length > 0) {
          const contact = response.Data[0];
          
          console.log('✅ Contact trouvé dans MailJet\n');
          console.log('📧 Informations du contact:');
          console.log('─'.repeat(50));
          console.log(`Email: ${contact.Email}`);
          console.log(`Nom: ${contact.Name || '(non défini)'}`);
          console.log(`Créé le: ${contact.CreatedAt || '(non disponible)'}`);
          console.log(`Dernière mise à jour: ${contact.DeliveredCount || '(non disponible)'}`);
          console.log(`Exclu des campagnes: ${contact.IsExcludedFromCampaigns ? 'Oui ❌' : 'Non ✅'}`);
          
          // Statut d'opt-in
          console.log('\n📬 Statut d\'opt-in:');
          console.log('─'.repeat(50));
          
          if (contact.IsOptInPending !== undefined) {
            if (contact.IsOptInPending === false) {
              console.log('✅ IsOptInPending: false (Contact confirmé - double opt-in complété)');
            } else {
              console.log('⏳ IsOptInPending: true (En attente de confirmation)');
            }
          } else {
            console.log('⚠️  IsOptInPending: (non défini dans la réponse)');
          }
          
          // Vérifier les listes
          console.log('\n📋 Listes MailJet:');
          console.log('─'.repeat(50));
          if (contact.Exclusions && contact.Exclusions.length > 0) {
            console.log('Listes d\'exclusion:', contact.Exclusions);
          } else {
            console.log('Aucune exclusion trouvée');
          }
          
          // Informations supplémentaires
          console.log('\n📊 Statistiques:');
          console.log('─'.repeat(50));
          console.log(`Emails délivrés: ${contact.DeliveredCount || 0}`);
          console.log(`Emails ouverts: ${contact.OpenedCount || 0}`);
          console.log(`Emails cliqués: ${contact.ClickedCount || 0}`);
          console.log(`Emails rejetés: ${contact.BouncedCount || 0}`);
          console.log(`Emails marqués comme spam: ${contact.SpamComplaintCount || 0}`);
          console.log(`Emails non abonnés: ${contact.UnsubscribedCount || 0}`);
          
          console.log('\n' + '='.repeat(50));
          console.log('💡 Interprétation:');
          console.log('─'.repeat(50));
          if (contact.IsOptInPending === false) {
            console.log('✅ Le contact a confirmé son inscription (double opt-in complété)');
            console.log('   Le contact peut recevoir des emails marketing.');
          } else if (contact.IsOptInPending === true) {
            console.log('⏳ Le contact est en attente de confirmation');
            console.log('   Le contact doit cliquer sur le lien de confirmation dans l\'email.');
          } else {
            console.log('⚠️  Le statut d\'opt-in n\'est pas clairement défini');
            console.log('   Cela peut signifier que le contact a été créé sans double opt-in requis.');
          }
          console.log('='.repeat(50) + '\n');
          
        } else {
          console.log('❌ Contact non trouvé dans MailJet');
          console.log('   Le contact n\'existe pas encore dans votre compte MailJet.');
        }
      } catch (error) {
        console.error('❌ Erreur lors du parsing de la réponse:', error.message);
        console.log('Réponse brute:', data);
      }
    } else if (res.statusCode === 404) {
      console.log('❌ Contact non trouvé dans MailJet');
      console.log('   Le contact n\'existe pas encore dans votre compte MailJet.');
      console.log('   Vérifiez que l\'email est correct et que le contact a été créé.');
    } else {
      console.error(`❌ Erreur API MailJet: ${res.statusCode}`);
      try {
        const errorData = JSON.parse(data);
        console.error('Détails:', JSON.stringify(errorData, null, 2));
      } catch {
        console.error('Réponse brute:', data);
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erreur de connexion:', error.message);
  process.exit(1);
});

req.end();
