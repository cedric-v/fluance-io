/**
 * Configuration et fonctions pour les paiements Stripe et PayPal
 * 
 * ⚠️ IMPORTANT : 
 * - Les Price IDs Stripe et Product IDs PayPal doivent être configurés dans products.json
 * - Les clés API Stripe/PayPal doivent être configurées côté serveur (Firebase Functions)
 */

/**
 * Crée une session Stripe Checkout
 * @param {string} productId - ID du produit ("21jours" ou "complet")
 * @param {string} variant - Variante ("mensuel" ou "trimestriel" pour complet)
 * @param {string} locale - Langue ("fr" ou "en")
 * @returns {Promise<string>} URL de la session Stripe Checkout
 */
async function createStripeCheckoutSession(productId, variant = null, locale = 'fr') {
  try {
    // Déterminer le produit complet
    const productKey = variant ? `${productId}_${variant}` : productId;
    
    const response = await fetch('/api/create-stripe-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: productId,
        variant: variant,
        locale: locale,
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la création de la session Stripe');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Erreur Stripe:', error);
    throw error;
  }
}

/**
 * Crée une commande PayPal
 * @param {string} productId - ID du produit ("21jours" ou "complet")
 * @param {string} variant - Variante ("mensuel" ou "trimestriel" pour complet)
 * @param {string} locale - Langue ("fr" ou "en")
 * @returns {Promise<string>} URL d'approbation PayPal
 */
async function createPayPalOrder(productId, variant = null, locale = 'fr') {
  try {
    const response = await fetch('/api/create-paypal-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: productId,
        variant: variant,
        locale: locale,
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la création de la commande PayPal');
    }

    const data = await response.json();
    return data.approvalUrl;
  } catch (error) {
    console.error('Erreur PayPal:', error);
    throw error;
  }
}

/**
 * Redirige vers Stripe Checkout
 */
async function redirectToStripe(productId, variant = null, locale = 'fr') {
  try {
    const url = await createStripeCheckoutSession(productId, variant, locale);
    window.location.href = url;
  } catch (error) {
    alert('Erreur lors de la redirection vers Stripe. Veuillez réessayer.');
  }
}

/**
 * Redirige vers PayPal
 */
async function redirectToPayPal(productId, variant = null, locale = 'fr') {
  try {
    const url = await createPayPalOrder(productId, variant, locale);
    window.location.href = url;
  } catch (error) {
    alert('Erreur lors de la redirection vers PayPal. Veuillez réessayer.');
  }
}

// Exporter les fonctions pour utilisation globale
window.FluancePayment = {
  createStripeCheckoutSession,
  createPayPalOrder,
  redirectToStripe,
  redirectToPayPal,
};

