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

let headerLines = [];
for (const entry of staticHeaders) {
  headerLines.push(entry.path);
  for (const h of entry.headers) {
    headerLines.push(`  ${h}`);
  }
  headerLines.push('');
}

headerLines.push('# Static assets cache');
headerLines.push('*.jpg');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.jpeg');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.gif');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.png');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.webp');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.avif');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.svg');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.ico');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.css');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.js');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.woff2');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.woff');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.ttf');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('*.otf');
headerLines.push('  Cache-Control: public, max-age=31536000, immutable');

writeFileSync(resolve(siteDir, '_headers'), headerLines.join('\n') + '\n', 'utf-8');
console.log(`✅ Generated _headers with ${staticHeaders.length} path-specific rules + glob rules`);
