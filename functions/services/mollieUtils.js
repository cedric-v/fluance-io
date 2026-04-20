const DEFAULT_MOLLIE_ORIGIN_ALLOWLIST = [
  'https://fluance.io',
  'https://www.fluance.io',
  'https://cedricv.com',
  'https://www.cedricv.com',
];

function isRecurringProduct(product, variant) {
  return product === 'complet' ||
    (product === 'rdv-clarte' && variant === 'abonnement') ||
    product === 'semester_pass' ||
    (product === 'focus-sos' && variant === '3x');
}

function getRecurringPaymentMethod(product, variant) {
  if (!isRecurringProduct(product, variant)) return null;

  // Restrict recurring products to card mandates. This avoids non-recurring
  // methods such as TWINT being used for the first installment.
  return 'creditcard';
}

function getAllowedOrigin(input, fallback, allowlist = DEFAULT_MOLLIE_ORIGIN_ALLOWLIST) {
  if (!input) return fallback;
  try {
    const url = new URL(input);
    return allowlist.includes(url.origin) ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

module.exports = {
  DEFAULT_MOLLIE_ORIGIN_ALLOWLIST,
  getRecurringPaymentMethod,
  getAllowedOrigin,
  isRecurringProduct,
};
