/**
 * Script pour vérifier les accès d'un utilisateur après un paiement
 * Usage: node scripts/check-payment-access.js [paymentIntentId] [email]
 * 
 * Ce script vérifie :
 * 1. Le Payment Intent dans Stripe
 * 2. Les tokens créés dans Firestore (registrationTokens)
 * 3. Les accès utilisateur dans Firestore (users)
 * 4. Les emails envoyés (collection mail)
 * 
 * Exemple: node scripts/check-payment-access.js pi_3SqSgp2Esx6PN6y10v3Jvfwg
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialiser Firebase Admin
try {
  if (!admin.apps.length) {
    const possiblePaths = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.join(__dirname, '../functions/serviceAccountKey.json'),
      path.join(__dirname, '../new-project-service-account.json'),
    ];

    let serviceAccountPath = null;
    for (const possiblePath of possiblePaths) {
      if (possiblePath && fs.existsSync(possiblePath)) {
        serviceAccountPath = possiblePath;
        break;
      }
    }

    if (serviceAccountPath) {
      console.log(`📁 Utilisation du service account : ${serviceAccountPath}`);
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'fluance-protected-content',
      });
    } else {
      admin.initializeApp({
        projectId: 'fluance-protected-content',
      });
    }
  }
} catch (e) {
  console.error('❌ Erreur initialisation Firebase:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function checkPaymentAccess(paymentIntentId, email = null) {
  console.log(`🔍 Vérification des accès pour le paiement: ${paymentIntentId}\n`);

  try {
    // 1. Vérifier le Payment Intent dans Stripe
    let stripe = null;
    let paymentIntent = null;
    let customerEmail = email;

    // Essayer de charger la clé Stripe depuis les secrets Firebase ou .env
    if (!process.env.STRIPE_SECRET_KEY) {
      // Essayer de charger depuis .env
      const envPath = path.join(__dirname, '../functions/.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/STRIPE_SECRET_KEY=(.+)/);
        if (match) {
          process.env.STRIPE_SECRET_KEY = match[1].trim();
        }
      }
    }

    if (process.env.STRIPE_SECRET_KEY) {
      try {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['charges.data.customer', 'customer'],
        });

        console.log('═'.repeat(100));
        console.log('📋 DÉTAILS DU PAYMENT INTENT:\n');
        console.log(`   Payment Intent ID: ${paymentIntent.id}`);
        console.log(`   Statut: ${paymentIntent.status}`);
        console.log(`   Montant: ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`);
        console.log(`   Métadonnées:`);
        console.log(`     - system: ${paymentIntent.metadata?.system || '❌ MANQUANT'}`);
        console.log(`     - product: ${paymentIntent.metadata?.product || '❌ MANQUANT'}`);

        if (paymentIntent.metadata?.product) {
          console.log(`     ✅ Produit principal: ${paymentIntent.metadata.product}`);
        }

        // Vérifier les line items pour le cross-sell
        if (paymentIntent.invoice) {
          const invoice = await stripe.invoices.retrieve(paymentIntent.invoice, {
            expand: ['lines.data.price.product'],
          });
          console.log(`\n   Invoice ID: ${invoice.id}`);
          console.log(`   Line items:`);
          invoice.lines.data.forEach((line, index) => {
            console.log(`     ${index + 1}. ${line.description || 'N/A'}`);
            console.log(`        Price ID: ${line.price?.id || 'N/A'}`);
            console.log(`        Amount: ${(line.amount / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`);
          });
        }

        // Vérifier la session checkout pour les line items
        let checkoutSession = null;
        if (paymentIntent.metadata?.checkout_session_id) {
          checkoutSession = await stripe.checkout.sessions.retrieve(
            paymentIntent.metadata.checkout_session_id,
            { expand: ['line_items'] },
          );
        } else {
          // Chercher la session checkout qui utilise ce payment intent
          try {
            const sessions = await stripe.checkout.sessions.list({
              payment_intent: paymentIntentId,
              limit: 1,
            });
            if (sessions.data.length > 0) {
              checkoutSession = await stripe.checkout.sessions.retrieve(
                sessions.data[0].id,
                { expand: ['line_items'] },
              );
            }
          } catch (sessionError) {
            // Ignorer l'erreur
          }
        }

        if (checkoutSession) {
          console.log(`\n   Checkout Session ID: ${checkoutSession.id}`);
          console.log(`   Line items:`);
          if (checkoutSession.line_items?.data) {
            checkoutSession.line_items.data.forEach((item, index) => {
              console.log(`     ${index + 1}. ${item.description || 'N/A'}`);
              console.log(`        Price ID: ${item.price?.id || 'N/A'}`);
              console.log(`        Amount: ${(item.amount_total / 100).toFixed(2)} ${checkoutSession.currency.toUpperCase()}`);
              if (item.price?.id === 'price_1SeWdF2Esx6PN6y1XlbpIObG') {
                console.log(`        ✅ Cross-sell SOS dos & cervicales détecté`);
              }
            });
          } else {
            console.log(`     (Aucun line item disponible)`);
          }
        } else {
          console.log(`\n   ⚠️  Aucune session checkout trouvée pour ce Payment Intent`);
        }

        // Récupérer l'email depuis plusieurs sources
        customerEmail = paymentIntent.metadata?.email ||
          paymentIntent.receipt_email ||
          customerEmail;

        // Essayer depuis les charges
        if (!customerEmail && paymentIntent.charges?.data?.length > 0) {
          const charge = paymentIntent.charges.data[0];
          customerEmail = charge.billing_details?.email ||
            charge.receipt_email ||
            customerEmail;
        }

        // Essayer depuis le customer
        if (!customerEmail && paymentIntent.customer) {
          let customer;
          if (typeof paymentIntent.customer === 'string') {
            customer = await stripe.customers.retrieve(paymentIntent.customer);
          } else {
            customer = paymentIntent.customer;
          }
          customerEmail = customer.email || customerEmail;
        }

        // Essayer aussi depuis la session checkout (si pas déjà récupérée)
        if (!customerEmail && checkoutSession) {
          customerEmail = checkoutSession.customer_details?.email ||
            checkoutSession.customer_email ||
            customerEmail;
        }

        if (customerEmail) {
          console.log(`   Email client: ${customerEmail}\n`);
        }
      } catch (stripeError) {
        console.warn(`⚠️  Impossible de récupérer le Payment Intent depuis Stripe: ${stripeError.message}`);
        if (stripeError.message.includes('No such payment_intent')) {
          console.error('   ❌ Payment Intent non trouvé dans Stripe');
        }
        console.log('   (Vérification uniquement dans Firestore)\n');
      }
    } else {
      console.warn('⚠️  STRIPE_SECRET_KEY non disponible. Impossible de vérifier le Payment Intent dans Stripe.');
      console.log('   (Vérification uniquement dans Firestore)\n');
    }

    // Si l'email n'a pas été trouvé depuis Stripe, chercher dans Firestore
    if (!customerEmail) {
      console.log('🔍 Recherche de l\'email dans Firestore...\n');
      // Chercher dans les tokens avec ce paymentIntentId
      const tokensWithPayment = await db.collection('registrationTokens')
        .where('paymentIntentId', '==', paymentIntentId)
        .limit(1)
        .get();

      if (!tokensWithPayment.empty) {
        customerEmail = tokensWithPayment.docs[0].data().email;
        console.log(`   ✅ Email trouvé dans Firestore: ${customerEmail}\n`);
      } else {
        // Chercher dans les users avec ce paymentIntentId dans les produits
        const usersQuery = await db.collection('users')
          .where('products', 'array-contains-any', [
            { paymentIntentId: paymentIntentId },
          ])
          .limit(1)
          .get();

        if (!usersQuery.empty) {
          customerEmail = usersQuery.docs[0].id;
          console.log(`   ✅ Email trouvé dans Firestore: ${customerEmail}\n`);
        }
      }
    }

    if (!customerEmail) {
      console.error('❌ Email non trouvé. Veuillez le fournir en paramètre.');
      console.log('   Usage: node scripts/check-payment-access.js [paymentIntentId] [email]');
      console.log('\n   Exemple avec email:');
      console.log('   node scripts/check-payment-access.js pi_3SqSgp2Esx6PN6y10v3Jvfwg christianebruderer@example.com');
      process.exit(1);
    }

    const normalizedEmail = customerEmail.toLowerCase().trim();
    console.log(`\n   Email client: ${normalizedEmail}\n`);

    // 2. Vérifier les tokens dans Firestore
    console.log('═'.repeat(100));
    console.log('🔑 TOKENS D\'ACCÈS (registrationTokens):\n');

    const tokensQuery = await db.collection('registrationTokens')
      .where('email', '==', normalizedEmail)
      .get();

    if (tokensQuery.empty) {
      console.log('   ❌ Aucun token trouvé pour cet email\n');
    } else {
      console.log(`   ✅ ${tokensQuery.size} token(s) trouvé(s):\n`);
      tokensQuery.forEach((doc, index) => {
        const token = doc.data();
        console.log(`   ${index + 1}. Token ID: ${doc.id}`);
        console.log(`      - Produit: ${token.product || '❌ MANQUANT'}`);
        console.log(`      - Créé le: ${token.createdAt?.toDate ? token.createdAt.toDate().toLocaleString('fr-FR') : 'N/A'}`);
        console.log(`      - Expire le: ${token.expiresAt?.toDate ? token.expiresAt.toDate().toLocaleString('fr-FR') : 'N/A'}`);
        console.log(`      - Utilisé: ${token.used ? 'Oui' : 'Non'}`);
        if (token.amount) {
          console.log(`      - Montant: ${(token.amount / 100).toFixed(2)} CHF`);
        }
        console.log('');
      });
    }

    // 3. Vérifier les accès utilisateur dans Firestore
    console.log('═'.repeat(100));
    console.log('👤 ACCÈS UTILISATEUR (users):\n');

    let userData = null;
    let targetDocId = normalizedEmail;
    try {
      const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
      targetDocId = userRecord.uid;
    } catch (e) {
      // Utilisateur non trouvé dans Auth, on continue avec l'email comme ID (fallback)
    }

    const userDoc = await db.collection('users').doc(targetDocId).get();
    if (!userDoc.exists) {
      console.log(`   ❌ Aucun document utilisateur trouvé (ID: ${targetDocId})\n`);
    } else {
      userData = userDoc.data();
      console.log('   ✅ Document utilisateur trouvé:\n');
      console.log(`      - Email: ${userData.email || normalizedEmail}`);
      console.log(`      - Nom: ${userData.name || 'N/A'}`);
      console.log(`      - Produit (ancien format): ${userData.product || 'Aucun'}`);

      if (userData.products && Array.isArray(userData.products)) {
        console.log(`      - Produits (nouveau format):`);
        userData.products.forEach((prod, index) => {
          if (prod && typeof prod === 'object') {
            console.log(`        ${index + 1}. ${prod.name || 'N/A'}`);
            console.log(`           - Créé le: ${prod.createdAt?.toDate ? prod.createdAt.toDate().toLocaleString('fr-FR') : 'N/A'}`);
            if (prod.amount) {
              console.log(`           - Montant: ${(prod.amount / 100).toFixed(2)} CHF`);
            }
          } else {
            console.log(`        ${index + 1}. ${prod || 'N/A'}`);
          }
        });
      } else {
        console.log(`      - Produits (nouveau format): Aucun`);
      }
      console.log('');
    }

    // 4. Vérifier les emails envoyés
    console.log('═'.repeat(100));
    console.log('📧 EMAILS ENVOYÉS (collection mail):\n');

    // Requête sans orderBy pour éviter l'erreur d'index
    const mailQuery = await db.collection('mail')
      .where('to', '==', normalizedEmail)
      .limit(20)
      .get();

    if (mailQuery.empty) {
      console.log('   ❌ Aucun email trouvé\n');
    } else {
      console.log(`   ✅ ${mailQuery.size} email(s) trouvé(s):\n`);
      // Trier manuellement par date de création (plus récent en premier)
      const sortedMails = mailQuery.docs.sort((a, b) => {
        const dateA = a.data().createdAt?.toDate ? a.data().createdAt.toDate().getTime() : 0;
        const dateB = b.data().createdAt?.toDate ? b.data().createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      }).slice(0, 10); // Prendre les 10 plus récents

      sortedMails.forEach((doc, index) => {
        const mail = doc.data();
        console.log(`   ${index + 1}. Template: ${mail.template?.name || 'N/A'}`);
        console.log(`      - Créé le: ${mail.createdAt?.toDate ? mail.createdAt.toDate().toLocaleString('fr-FR') : 'N/A'}`);
        if (mail.template?.data?.product) {
          console.log(`      - Produit: ${mail.template.data.product}`);
        }
        console.log('');
      });
    }

    // 5. Résumé
    console.log('═'.repeat(100));
    console.log('📊 RÉSUMÉ:\n');

    const has21jours = tokensQuery.docs.some((doc) => doc.data().product === '21jours') ||
      (userData?.products && userData.products.some((p) =>
        (typeof p === 'object' ? p.name : p) === '21jours',
      ));

    const hasSosDos = tokensQuery.docs.some((doc) => doc.data().product === 'sos-dos-cervicales') ||
      (userData?.products && userData.products.some((p) =>
        (typeof p === 'object' ? p.name : p) === 'sos-dos-cervicales',
      ));

    console.log(`   ✅ Accès 21 jours: ${has21jours ? 'OUI' : '❌ NON'}`);
    console.log(`   ✅ Accès SOS dos & cervicales: ${hasSosDos ? 'OUI' : '❌ NON'}`);
    console.log(`   📧 Emails envoyés: ${mailQuery.size > 0 ? 'OUI' : '❌ NON'}`);
    console.log('');

    if (!has21jours || !hasSosDos) {
      console.log('⚠️  PROBLÈME DÉTECTÉ:');
      if (!has21jours) {
        console.log('   - L\'accès au produit "21jours" n\'a pas été créé');
      }
      if (!hasSosDos) {
        console.log('   - L\'accès au produit "sos-dos-cervicales" n\'a pas été créé');
      }
      console.log('\n   💡 Solutions possibles:');
      console.log('   1. Vérifier que le webhook Stripe a bien été reçu');
      console.log('   2. Vérifier les métadonnées du Payment Intent (system: firebase, product: 21jours)');
      console.log('   3. Vérifier que le cross-sell a été détecté dans le webhook');
      console.log('   4. Créer manuellement les accès si nécessaire');
    } else {
      console.log('✅ Tout semble correct ! Les deux produits ont été créés avec succès.');
    }

    console.log('\n' + '═'.repeat(100));

  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Exécuter
const paymentIntentId = process.argv[2];
const email = process.argv[3];

if (!paymentIntentId) {
  console.log('❌ Usage: node scripts/check-payment-access.js [paymentIntentId] [email]\n');
  console.log('Exemple:');
  console.log('  node scripts/check-payment-access.js pi_3SqSgp2Esx6PN6y10v3Jvfwg');
  console.log('  node scripts/check-payment-access.js pi_3SqSgp2Esx6PN6y10v3Jvfwg christianebruderer@example.com');
  process.exit(1);
}

checkPaymentAccess(paymentIntentId, email)
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
