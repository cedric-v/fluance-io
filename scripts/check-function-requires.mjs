#!/usr/bin/env node
/**
 * Verifie que tous les require() / import relatifs de `functions/` resolvent.
 *
 * Pourquoi ce garde-fou :
 * le 2 novembre 2026, un commit a embarque la suppression de
 * `functions/services/bexioService.js` sans les modifications de
 * `functions/index.js` qui retiraient son `require('./services/bexioService')`
 * (travail en cours indexe partiellement). Le lint et les tests unitaires
 * passaient, mais le deploiement CI a echoue a l'analyse du code :
 * `MODULE_NOT_FOUND: bexioService`.
 *
 * Ce script transforme cette classe d'erreur en echec de CI, avant le
 * deploiement en production. Il n'a besoin d'aucune dependance installee.
 *
 * Usage : node scripts/check-function-requires.mjs
 * Sortie : code 0 si tout resout, code 1 sinon (liste des require casses).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'functions';
const SKIP_DIRS = new Set(['node_modules', '.git', 'test', 'coverage']);
const REQUIRE_RE = /require\(\s*['"](\.{1,2}\/[^'"]*)['"]\s*\)/g;
const IMPORT_RE = /(?:from|import)\s+['"](\.{1,2}\/[^'"]*)['"]/g;

/** Liste recursive des fichiers .js / .mjs de functions/. */
function listSources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSources(full));
    else if (full.endsWith('.js') || full.endsWith('.mjs')) out.push(full);
  }
  return out;
}

/** Un specifieur relatif resout-il vers un fichier existant ? */
function resolves(base) {
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

if (!fs.existsSync(ROOT)) {
  console.error(`❌ Repertoire introuvable : ${ROOT} (lancer depuis la racine du depot)`);
  process.exit(1);
}

const failures = [];
let checked = 0;

for (const file of listSources(ROOT)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const re of [REQUIRE_RE, IMPORT_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      checked += 1;
      const specifier = match[1];
      const base = path.resolve(path.dirname(file), specifier);
      if (!resolves(base)) {
        const line = source.slice(0, match.index).split('\n').length;
        failures.push(`${file}:${line}  ->  ${specifier}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('❌ Modules locaux introuvables dans functions/ :');
  for (const failure of failures) console.error(`   ${failure}`);
  console.error(
      '\nUn fichier supprime est encore require() quelque part (ou une casse/chemin est errone).\n' +
      'Corriger le require ou restaurer le fichier, puis relancer.',
  );
  process.exit(1);
}

console.log(`✅ ${checked} import(s) relatif(s) verifie(s) dans ${ROOT}/ : tous resolvent.`);
