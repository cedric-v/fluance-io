#!/usr/bin/env node
/**
 * Liste les fonctions Cloud Functions deployables declarees dans `functions/`.
 *
 * Source: le code source lui-meme (`exports.X = onRequest|onCall|onSchedule(`).
 * Pas de liste a tenir a la main: une fonction ajoutee est automatiquement
 * detectee (et donc verifiee par `scripts/verify-functions-runtime.mjs`).
 *
 * Usage:
 *   node scripts/lib/deployed-functions.mjs                # toutes
 *   node scripts/lib/deployed-functions.mjs --kind schedule # seulement les onSchedule
 *   node scripts/lib/deployed-functions.mjs --kind http     # seulement les HTTP
 *   node scripts/lib/deployed-functions.mjs --format csv    # "nom,nom,nom"
 *
 * Code de sortie: 0 si au moins une fonction est trouvee, 1 sinon.
 */

import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..');

const TRIGGER_RE = /exports\.([A-Za-z0-9_$]+)\s*=\s*on([A-Z][A-Za-z0-9_]*)\s*\(/g;

/**
 * Retire les commentaires pour ne pas detecter des exports commentes
 * (ex: `/* exports.stripeBookingWebhook = onRequest(`).
 */
function stripComments(source) {
  return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * @param {{functionsDir?: string}} [options]
 * @returns {{all: Array<{name: string, kind: string, file: string}>,
 *            scheduled: Array<{name: string}>, http: Array<{name: string}>}}
 */
export function scanDeployedFunctions(options = {}) {
  const functionsDir = options.functionsDir || path.join(repoRoot, 'functions');
  const files = readdirSync(functionsDir)
      .filter((file) => file.endsWith('.js') && file !== 'eslint.config.js')
      .sort();

  const all = [];
  for (const file of files) {
    const source = stripComments(readFileSync(path.join(functionsDir, file), 'utf8'));
    for (const match of source.matchAll(TRIGGER_RE)) {
      all.push({
        name: match[1],
        kind: match[2] === 'Schedule' ? 'schedule' : 'http',
        file,
      });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const entry of all) {
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    unique.push(entry);
  }

  return {
    all: unique,
    scheduled: unique.filter((entry) => entry.kind === 'schedule'),
    http: unique.filter((entry) => entry.kind === 'http'),
  };
}

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main() {
  const kind = argValue('--kind', 'all');
  const format = argValue('--format', 'lines');
  const {all, scheduled, http} = scanDeployedFunctions();

  const selected = kind === 'schedule' ? scheduled : kind === 'http' ? http : all;
  if (selected.length === 0) {
    console.error('❌ Aucune fonction detectee dans functions/.');
    process.exit(1);
  }

  const names = selected.map((entry) => entry.name);
  if (format === 'csv') {
    console.log(names.join(','));
  } else {
    console.log(names.join('\n'));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
