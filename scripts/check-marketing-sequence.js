#!/usr/bin/env node
/**
 * Script de diagnostic pour vérifier pourquoi des contacts ne reçoivent pas
 * la séquence marketing après opt-in "2 pratiques".
 *
 * Usage:
 *   export MAILJET_API_KEY="..."
 *   export MAILJET_API_SECRET="..."
 *   node scripts/check-marketing-sequence.js email1@example.com email2@example.com
 */

const https = require('https');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;

if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
  console.error('❌ Erreur: MAILJET_API_KEY et MAILJET_API_SECRET doivent être définis');
  process.exit(1);
}

const emails = process.argv.slice(2);

if (emails.length === 0) {
  console.error('Usage: node scripts/check-marketing-sequence.js email1@example.com email2@example.com');
  process.exit(1);
}

const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_API_SECRET}`).toString('base64');

function fetchMailjet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function checkContact(email) {
  console.log(`\n📧 Vérification de ${email}...`);
  console.log('─'.repeat(60));

  const normalizedEmail = email.toLowerCase().trim();
  const contactDataUrl =
    `https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(normalizedEmail)}`;

  try {
    const contactDataResult = await fetchMailjet(contactDataUrl);

    if (!contactDataResult.Data || contactDataResult.Data.length === 0) {
      console.log('❌ Contact non trouvé dans Mailjet');
      return;
    }

    const contactData = contactDataResult.Data[0];
    if (!contactData.Data) {
      console.log('❌ Aucune propriété trouvée pour ce contact');
      return;
    }

    // Parser les propriétés
    let properties = {};
    if (Array.isArray(contactData.Data)) {
      contactData.Data.forEach((item) => {
        if (item.Name && item.Value !== undefined) {
          properties[item.Name] = item.Value;
        }
      });
    } else if (typeof contactData.Data === 'object') {
      properties = contactData.Data;
    }

    console.log('\n📋 Propriétés Mailjet:');
    console.log(JSON.stringify(properties, null, 2));

    // Vérifications spécifiques
    const sourceOptin = properties.source_optin || '';
    const estClient = properties.est_client === 'True' || properties.est_client === true;
    const produitsAchetes = properties.produits_achetes || '';
    const dateOptin = properties.date_optin || null;
    const has5jours = sourceOptin.includes('5joursofferts');
    const serie5joursDebut = properties.serie_5jours_debut || null;

    console.log('\n🔍 Analyse:');
    console.log(`  - source_optin: "${sourceOptin}"`);
    console.log(`  - est_client: ${estClient}`);
    console.log(`  - produits_achetes: "${produitsAchetes}"`);
    console.log(`  - date_optin: ${dateOptin || 'NON DÉFINIE ❌'}`);
    console.log(`  - has5jours: ${has5jours}`);
    console.log(`  - serie_5jours_debut: ${serie5joursDebut || 'NON DÉFINIE'}`);

    // Calculer les jours depuis l'opt-in
    if (dateOptin) {
      let optinDate;
      if (dateOptin.includes('/')) {
        const [day, month, year] = dateOptin.split('/');
        optinDate = new Date(year, month - 1, day);
      } else {
        optinDate = new Date(dateOptin);
      }

      const now = new Date();
      const daysSinceOptin = Math.floor((now - optinDate) / (1000 * 60 * 60 * 24));
      const currentDay = daysSinceOptin + 1;

      console.log(`  - Jours depuis opt-in: ${daysSinceOptin} (currentDay = ${currentDay})`);

      // Vérifier les conditions pour SCÉNARIO 1
      console.log('\n📊 Vérification SCÉNARIO 1 (2pratiques → 5jours J+1):');
      const shouldSendScenario1 =
        sourceOptin.includes('2pratiques') && !has5jours && currentDay === 2;
      console.log(`  - sourceOptin.includes('2pratiques'): ${sourceOptin.includes('2pratiques')}`);
      console.log(`  - !has5jours: ${!has5jours}`);
      console.log(`  - currentDay === 2: ${currentDay === 2}`);
      console.log(`  - ✅ Devrait envoyer: ${shouldSendScenario1 ? 'OUI' : 'NON ❌'}`);

      if (!shouldSendScenario1 && sourceOptin.includes('2pratiques')) {
        console.log('\n⚠️  Raisons pour lesquelles l\'email n\'est pas envoyé:');
        if (has5jours) {
          console.log('  - Le contact est déjà inscrit aux 5 jours');
        }
        if (currentDay !== 2) {
          console.log(`  - Le jour actuel est ${currentDay}, pas 2 (J+1)`);
          if (currentDay < 2) {
            console.log('    → L\'email sera envoyé demain');
          } else {
            console.log('    → L\'email aurait dû être envoyé il y a ' + (currentDay - 2) + ' jour(s)');
          }
        }
      }
    } else {
      console.log('\n❌ Pas de date_optin → Le contact sera ignoré par la séquence marketing');
    }

    // Vérifier si le contact est filtré trop tôt
    if (estClient || produitsAchetes.includes('21jours') || produitsAchetes.includes('complet')) {
      console.log('\n⚠️  ATTENTION: Ce contact est marqué comme CLIENT');
      console.log('  → Il sera ignoré par la séquence marketing (ligne 3232 du code)');
      console.log('  → Vérifiez si c\'est correct ou si c\'est une erreur');
    }
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 Diagnostic séquence marketing pour contacts Mailjet\n');

  for (const email of emails) {
    await checkContact(email);
  }

  console.log('\n✅ Diagnostic terminé');
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
