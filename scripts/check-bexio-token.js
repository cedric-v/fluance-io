/**
 * Simple script to check Bexio API Token expiration from JWT.
 * Exits with error (1) if token expires within the threshold.
 */

function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    console.error('Failed to decode JWT:', error.message);
    process.exit(1);
  }
}

const token = process.env.BEXIO_API_TOKEN;
const thresholdDays = 15;

if (!token) {
  console.error('Error: BEXIO_API_TOKEN environment variable is missing.');
  process.exit(1);
}

const payload = decodeJwt(token);

if (!payload.exp) {
  console.error('Error: JWT does not contain an "exp" field.');
  process.exit(1);
}

const expirationDate = new Date(payload.exp * 1000);
const now = new Date();
const diffMs = expirationDate - now;
const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

console.log(`Bexio Token Status:`);
console.log(`- Expiration: ${expirationDate.toISOString()}`);
console.log(`- Days remaining: ${diffDays}`);

if (diffDays <= 0) {
  console.error('CRITICAL: Bexio API Token has EXPIRED!');
  process.exit(1);
}

if (diffDays <= thresholdDays) {
  console.warn(`WARNING: Bexio API Token expires in ${diffDays} days. Please renew it.`);
  // Exit with error to trigger GitHub Action failure notification
  process.exit(1);
}

console.log('Token is valid and well within expiration limits.');
process.exit(0);
