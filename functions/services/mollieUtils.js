const DEFAULT_MOLLIE_ORIGIN_ALLOWLIST = [
  'https://fluance.io',
  'https://www.fluance.io',
  'https://cedricv.com',
  'https://www.cedricv.com',
];

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
  getAllowedOrigin,
};
