#!/usr/bin/env node
// >>> seo-guard:vendor v1.0.0 sha256:d2f88d9efa3a
// Source de vérité : tools/seo-guard/gsc-inspect.mjs — cette copie est générée.
// Ne pas éditer ici : corriger l'amont puis resynchroniser (`npm run sync`).
// <<< seo-guard:vendor
/**
 * Contrôle Search Console URL Inspection.
 *
 * Authentification possible par :
 * - GSC_ACCOUNT_JSON : chemin vers le fichier de service account (local) ;
 * - GSC_SERVICE_ACCOUNT_JSON : JSON complet dans une variable d'environnement ;
 * - GSC_SERVICE_ACCOUNT_JSON_B64 : JSON encodé en base64 (variable GitHub).
 *
 * Si aucune credential n'est fournie, le script se termine sans erreur afin que
 * le workflow planifié reste utilisable avant la configuration du compte.
 */
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import config from './gsc.config.mjs';

const siteUrl = process.env.GSC_SITE_URL || config.siteUrl;
const urls = config.urls;

function getCredentials() {
  if (process.env.GSC_SERVICE_ACCOUNT_JSON_B64) {
    return JSON.parse(Buffer.from(process.env.GSC_SERVICE_ACCOUNT_JSON_B64, 'base64').toString());
  }
  if (process.env.GSC_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.GSC_ACCOUNT_JSON && existsSync(process.env.GSC_ACCOUNT_JSON)) {
    return JSON.parse(readFileSync(process.env.GSC_ACCOUNT_JSON, 'utf8'));
  }
  return null;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken(credentials) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(credentials.private_key, 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `HTTP ${response.status}`);
  }
  return payload.access_token;
}

async function inspect(accessToken, inspectionUrl) {
  const response = await fetch(
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        inspectionUrl,
        siteUrl,
        languageCode: config.languageCode,
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `HTTP ${response.status}`);
  }
  return payload.indexStatusResult;
}

const credentials = getCredentials();
if (!credentials) {
  console.log('⚠️ Credentials Search Console absentes — contrôle ignoré.');
  process.exit(0);
}

const failures = [];
try {
  const accessToken = await getAccessToken(credentials);
  console.log(`🔎 Search Console — propriété ${siteUrl}, ${urls.length} URL(s).`);

  for (const url of urls) {
    try {
      const result = await inspect(accessToken, url);
      const verdict = result.verdict || 'UNKNOWN';
      const coverage = result.coverageState || 'UNKNOWN';
      console.log(`${verdict === 'PASS' ? '✅' : '⚠️'} ${url} — ${verdict}, ${coverage}`);
      if (verdict === 'FAIL') failures.push(`${url} — ${coverage}`);
    } catch (error) {
      failures.push(`${url} — ${error.message}`);
      console.error(`❌ ${url} — ${error.message}`);
    }
  }
} catch (error) {
  console.error(`❌ Search Console indisponible : ${error.message}`);
  process.exit(1);
}

if (failures.length > 0) {
  console.error(`💥 ${failures.length} URL(s) en échec d'indexation ou d'inspection.`);
  process.exit(1);
}
