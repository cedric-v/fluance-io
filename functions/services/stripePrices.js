/**
 * Stripe Prices — auto-provisioning des produits et prix.
 *
 * Les produits/prix sont créés automatiquement dans Stripe à la première
 * demande (aucune création manuelle dans le dashboard Stripe nécessaire).
 *
 * Ordre de résolution d'un Price ID :
 *   1. Secret Firebase déjà configuré (`STRIPE_PRICE_ID_<KEY>`) — priorité,
 *      pour réutiliser un prix existant déjà référencé.
 *   2. Price ID hardcodé (produits fluance.io historiques).
 *   3. Cache Firestore (collection `stripePrices`, document par clé).
 *   4. Auto-provisioning : création produit + prix dans Stripe (idempotent),
 *      puis mise en cache dans Firestore.
 *
 * Idempotence : produit créé avec un ID personnalisé (`fluance_<key>`) et
 * prix créé avec une clé d'idempotence Stripe (`fluance_price_<key>`), ce qui
 * évite les doublons même en cas de course (deux appels simultanés).
 */

// Définitions des prix (montants en centimes CHF)
const PRICE_DEFINITIONS = {
  '21jours': {
    name: 'Fluance : 21 jours pour remettre du mouvement',
    description: 'Parcours de 21 mini-séries de pratiques Fluance, simples et libératrices',
    amount: 1900, // 19 CHF
    existingPriceId: 'price_1SdZ2X2Esx6PN6y1wnkrLfSu',
  },
  'sos-dos-cervicales': {
    name: 'Fluance : SOS Dos & Cervicales',
    description: 'Programme ciblé SOS Dos & Cervicales (cross-sell)',
    amount: 1700, // 17 CHF
    existingPriceId: 'price_1SeWdF2Esx6PN6y1XlbpIObG',
  },
  'complet_mensuel': {
    name: 'Fluance en ligne - mensuel',
    description: 'Accès hebdomadaire à une nouvelle mini-série de pratiques + la communauté',
    amount: 3000, // 30 CHF/mois
    interval: {interval: 'month', interval_count: 1},
    existingPriceId: 'price_1SdZ4p2Esx6PN6y1bzRGQSC5',
  },
  'complet_trimestriel': {
    name: 'Fluance en ligne - trimestriel',
    description: 'Accès hebdomadaire à une nouvelle mini-série de pratiques + la communauté',
    amount: 7500, // 75 CHF / 3 mois
    interval: {interval: 'month', interval_count: 3},
    existingPriceId: 'price_1SdZ6E2Esx6PN6y11qme0Rde',
  },
  'rdv-clarte_unique': {
    name: 'RDV Clarté - CedricV (paiement unique)',
    description: 'Rendez-vous mensuel en ligne pour retrouver la clarté dans votre activité professionnelle',
    amount: 10000, // 100 CHF
  },
  'rdv-clarte_abonnement': {
    name: 'RDV Clarté - CedricV (abonnement mensuel)',
    description: 'Rendez-vous mensuel en ligne - abonnement mensuel',
    amount: 6900, // 69 CHF/mois
    interval: {interval: 'month', interval_count: 1},
  },
  'focus-sos_unique': {
    name: 'Focus SOS BDC - paiement unique',
    description: 'Accompagnement Focus SOS BDC (3x) - paiement unique',
    amount: 30000, // 300 CHF
  },
  'focus-sos_3x': {
    name: 'Focus SOS BDC - 3x 100 CHF',
    description: 'Accompagnement Focus SOS BDC (3x) - mensuel, 3 échéances',
    amount: 10000, // 100 CHF/mois
    interval: {interval: 'month', interval_count: 1},
  },
  'site-vitrine_5x': {
    name: 'Site web vitrine - 5x 200 CHF',
    description: 'Création de site web vitrine - mensuel, 5 échéances',
    amount: 20000, // 200 CHF/mois
    interval: {interval: 'month', interval_count: 1},
  },
  'flow_pass': {
    name: 'Fluance - Flow Pass (10 séances)',
    description: 'Flow Pass : 10 séances de cours présentiel',
    amount: 21000, // 210 CHF
  },
  'semester_pass': {
    name: 'Fluance - Pass Semestriel',
    description: 'Pass Semestriel : accès illimité aux cours présentiels pendant 6 mois',
    amount: 34000, // 340 CHF / 6 mois
    interval: {interval: 'month', interval_count: 6},
  },
};

/**
 * Nom de la clé interne (document Firestore) pour un produit/variant.
 * @param {string} product
 * @param {string|null} variant
 * @returns {string}
 */
function getPriceKey(product, variant = null) {
  return variant ? `${product}_${variant}` : product;
}

/**
 * Nom du secret Firebase associé à un produit/variant.
 * @param {string} product
 * @param {string|null} variant
 * @returns {string}
 */
function getSecretName(product, variant = null) {
  const key = getPriceKey(product, variant);
  return `STRIPE_PRICE_ID_${key.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

/**
 * Crée le produit et le prix dans Stripe (idempotent) puis les met en cache.
 * @param {Object} stripe - Instance Stripe
 * @param {Object} db - Firestore
 * @param {string} key - Clé interne (ex: 'focus-sos_3x')
 * @param {Object} def - Définition du prix
 * @returns {Promise<string>} priceId
 */
async function provisionPrice(stripe, db, key, def) {
  const productId = `fluance_${key}`;

  // 1. Créer le produit (ID personnalisé → idempotent)
  try {
    await stripe.products.create({
      id: productId,
      name: def.name,
      ...(def.description ? {description: def.description} : {}),
    });
  } catch (error) {
    // Le produit existe déjà → OK (création idempotente)
    if (error.code !== 'resource_already_exists') {
      throw error;
    }
  }

  // 2. Créer le prix (clé d'idempotence → pas de doublons)
  const priceData = {
    product: productId,
    unit_amount: def.amount,
    currency: 'chf',
    ...(def.interval ? {recurring: def.interval} : {}),
  };

  let price;
  try {
    price = await stripe.prices.create(priceData, {idempotencyKey: `fluance_price_${key}`});
  } catch (error) {
    if (error.code === 'resource_already_exists' ||
        (error.type === 'IdempotencyError' && error.code === 'resource_already_exists')) {
      // Rechercher le prix existant du produit (mêmes montant/récurrence)
      const prices = await stripe.prices.list({product: productId, limit: 10});
      price = prices.data.find((p) =>
        p.unit_amount === def.amount &&
        p.currency === 'chf' &&
        Boolean(p.recurring) === Boolean(def.interval) &&
        (!def.interval ||
          (p.recurring.interval === def.interval.interval &&
           p.recurring.interval_count === def.interval.interval_count)),
      );
      if (!price) throw error;
    } else {
      throw error;
    }
  }

  // 3. Mettre en cache dans Firestore
  await db.collection('stripePrices').doc(key).set({
    key,
    product: productId,
    priceId: price.id,
    amount: def.amount,
    currency: 'chf',
    interval: def.interval || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, {merge: true});

  return price.id;
}

/**
 * Retourne le Price ID Stripe d'un produit/variant, en le créant si nécessaire.
 * @param {Object} stripe - Instance Stripe
 * @param {Object} db - Firestore
 * @param {string} product - Identifiant interne (ex: 'focus-sos')
 * @param {string|null} [variant] - Variant (ex: '3x', 'mensuel')
 * @returns {Promise<string>} Price ID Stripe
 */
async function ensureStripePrice(stripe, db, product, variant = null) {
  const key = getPriceKey(product, variant);
  const def = PRICE_DEFINITIONS[key];
  if (!def) {
    throw new Error(`Aucune définition de prix Stripe pour "${key}"`);
  }

  // 1. Secret Firebase configuré (priorité — réutilise un prix existant)
  const secretName = getSecretName(product, variant);
  if (process.env[secretName]) {
    return process.env[secretName];
  }

  // 2. Price ID hardcodé (produits historiques)
  if (def.existingPriceId) {
    return def.existingPriceId;
  }

  // 3. Cache Firestore
  const cacheRef = db.collection('stripePrices').doc(key);
  const cacheDoc = await cacheRef.get();
  if (cacheDoc.exists && cacheDoc.data().priceId) {
    return cacheDoc.data().priceId;
  }

  // 4. Auto-provisioning dans Stripe
  return provisionPrice(stripe, db, key, def);
}

module.exports = {
  ensureStripePrice,
  getPriceKey,
  getSecretName,
};
