// Regenerate the Worker discovery resources from src/.well-known.
//
// Usage:
//   node scripts/generate-api-proxy-discovery.mjs           # write
//   node scripts/generate-api-proxy-discovery.mjs --check   # fail if stale

import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  buildDiscoveryResponses,
  buildGeneratedModule,
  refreshSkillDigests,
} from './lib/discovery.mjs';

const root = resolve(import.meta.dirname, '..');
const outputPath = resolve(
    root,
    'cloudflare',
    'api-proxy',
    'src',
    'discovery.generated.js',
);
const check = process.argv.includes('--check');

const digests = refreshSkillDigests(root, {write: !check});
const responses = buildDiscoveryResponses(root);
const output = buildGeneratedModule(responses);

let existing = '';
try {
  existing = readFileSync(outputPath, 'utf8');
} catch {
  existing = '';
}

const stale = digests.changed || existing !== output;

if (check) {
  if (stale) {
    console.error('❌ API discovery resources are stale.');
    console.error('   Run: node scripts/generate-api-proxy-discovery.mjs');
    process.exit(1);
  }
  console.log('✅ API discovery resources are up to date.');
} else {
  if (existing !== output) {
    writeFileSync(outputPath, output, 'utf8');
  }
  console.log(`Generated ${Object.keys(responses).length} API discovery responses.`);
}
