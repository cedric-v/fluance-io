import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const siteDir = resolve(projectRoot, '_site');

const redirectRulesPath = resolve(projectRoot, 'src/_data/redirectRules.json');

let redirectLines = [];
if (existsSync(redirectRulesPath)) {
  const rules = JSON.parse(readFileSync(redirectRulesPath, 'utf-8'));
  for (const rule of rules) {
    redirectLines.push(`${rule.from} ${rule.to} 301`);
  }
}
writeFileSync(resolve(siteDir, '_redirects'), redirectLines.join('\n') + '\n', 'utf-8');
console.log(`✅ Generated _redirects with ${redirectLines.length} rules`);

const SECURITY_HEADERS = [
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-Frame-Options: SAMEORIGIN',
  // Anti-clickjacking via CSP (complète le <meta CSP> du site : frame-ancestors
  // ne peut pas être déclaré en <meta>, il doit passer par un header)
  'Content-Security-Policy: frame-ancestors \'self\'',
];

const staticHeaders = [
  { path: '/.well-known/api-catalog', headers: [
    'Content-Type: application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
    'Access-Control-Allow-Origin: *',
  ]},
  { path: '/.well-known/agent-skills/index.json', headers: [
    'Content-Type: application/json; charset=utf-8',
    'Access-Control-Allow-Origin: *',
  ]},
  { path: '/.well-known/mcp/server-card.json', headers: [
    'Content-Type: application/json; charset=utf-8',
    'Access-Control-Allow-Origin: *',
  ]},
  { path: '/', headers: [
    'Link: </.well-known/api-catalog>; rel="api-catalog", </docs/api/>; rel="service-doc", </agent/home.md>; rel="alternate"; type="text/markdown", </.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
    'Vary: Accept',
  ]},
  { path: '/fr', headers: [
    'Link: </.well-known/api-catalog>; rel="api-catalog", </docs/api/>; rel="service-doc", </agent/home.md>; rel="alternate"; type="text/markdown", </.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
    'Vary: Accept',
  ]},
  { path: '/fr/*', headers: [
    'Link: </.well-known/api-catalog>; rel="api-catalog", </docs/api/>; rel="service-doc", </.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
  ]},
  { path: '/en', headers: [
    'Link: </.well-known/api-catalog>; rel="api-catalog", </docs/api/>; rel="service-doc", </agent/home.md>; rel="alternate"; type="text/markdown", </.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
    'Vary: Accept',
  ]},
  { path: '/en/*', headers: [
    'Link: </.well-known/api-catalog>; rel="api-catalog", </docs/api/>; rel="service-doc", </.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
  ]},
  { path: '/agent/*', headers: [
    'Content-Type: text/markdown; charset=utf-8',
    'Cache-Control: public, max-age=3600, must-revalidate',
  ]},
];

// Les règles Cloudflare Pages se REPLACENT (pas de fusion) : les headers de
// sécurité doivent donc être répétés sur chaque règle de chemin pour couvrir
// toutes les pages. Le header frame-ancestors (anti-clickjacking) est appliqué
// partout sauf sur les fichiers statiques (jamais embarqués en iframe).
for (const entry of staticHeaders) {
  if (entry.path !== '/.well-known/api-catalog' &&
      entry.path !== '/.well-known/agent-skills/index.json' &&
      entry.path !== '/.well-known/mcp/server-card.json') {
    entry.headers = [...entry.headers, ...SECURITY_HEADERS];
  }
}

let headerLines = [];
for (const entry of staticHeaders) {
  headerLines.push(entry.path);
  for (const h of entry.headers) {
    headerLines.push(`  ${h}`);
  }
  headerLines.push('');
}

const ASSET_TYPES = ['jpg', 'jpeg', 'gif', 'png', 'webp', 'avif', 'svg', 'ico', 'css', 'js', 'woff2', 'woff', 'ttf', 'otf'];

for (const ext of ASSET_TYPES) {
  headerLines.push(`*.${ext}`);
  headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
  headerLines.push('  X-Content-Type-Options: nosniff');
  headerLines.push('');
}

writeFileSync(resolve(siteDir, '_headers'), headerLines.join('\n') + '\n', 'utf-8');
console.log(`✅ Generated _headers with ${staticHeaders.length} path-specific rules + glob rules`);
