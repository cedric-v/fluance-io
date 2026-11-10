const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  HTTP_FUNCTION_RUNTIME,
  SCHEDULED_FUNCTION_RUNTIME,
} = require('../runtimeConfig');

const functionsDir = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(functionsDir, 'index.js'), 'utf8');
const hubSource = fs.readFileSync(path.join(functionsDir, 'blogLeadHub.js'), 'utf8');

/**
 * Blocs d'options d'une fonction planifiee: de `exports.X = onSchedule(` au
 * premier `},` (fermeture de l'objet d'options).
 */
function scheduledOptionBlocks(source) {
  const blocks = [];
  const re = /exports\.([A-Za-z0-9_$]+)\s*=\s*onSchedule\s*\(\s*\n\s*\{/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const start = match.index;
    const end = source.indexOf('\n    },', start);
    blocks.push({
      name: match[1],
      options: source.slice(start, end === -1 ? source.length : end),
    });
  }
  return blocks;
}

test('les 14 fonctions planifiees sont detectees dans index.js', () => {
  const blocks = scheduledOptionBlocks(indexSource);
  assert.strictEqual(blocks.length, 14, `attendu 14 onSchedule, trouve ${blocks.length}`);
});

test('chaque fonction planifiee declare ...SCHEDULED_FUNCTION_RUNTIME', () => {
  // Sans cette option, la fonction retombe sur le defaut GCP de 256 Mi, qui
  // est depasse au demarrage a froid -> OOM et tick planifie perdu
  // (incident du 3 au 10 novembre 2026).
  const blocks = scheduledOptionBlocks(indexSource);
  const sansOption = blocks
      .filter((block) => !block.options.includes('...SCHEDULED_FUNCTION_RUNTIME'))
      .map((block) => block.name);

  assert.deepStrictEqual(
      sansOption,
      [],
      `fonctions planifiees sans dimensionnement explicite: ${sansOption.join(', ')}`,
  );
});

test('les fonctions planifiees sont dimensionnees a 512 MiB', () => {
  assert.strictEqual(SCHEDULED_FUNCTION_RUNTIME.memory, '512MiB');
  assert.strictEqual(SCHEDULED_FUNCTION_RUNTIME.minInstances, 0);
  assert.strictEqual(SCHEDULED_FUNCTION_RUNTIME.maxInstances, 1);
});

test('chaque entree de HTTP_FUNCTION_RUNTIME correspond a une fonction reellement declaree', () => {
  const sansCode = Object.keys(HTTP_FUNCTION_RUNTIME).filter(
      (name) => !indexSource.includes(`exports.${name} =`) && !hubSource.includes(`exports.${name} =`),
  );

  assert.deepStrictEqual(
      sansCode,
      [],
      `fonctions dimensionnees mais absentes du code: ${sansCode.join(', ')}`,
  );
});

test('les fonctions HTTP dimensionnees utilisent ...HTTP_FUNCTION_RUNTIME', () => {
  const sansOption = Object.keys(HTTP_FUNCTION_RUNTIME).filter((name) => {
    const dansHub = hubSource.includes(`exports.${name} =`);
    const source = dansHub ? hubSource : indexSource;
    const debut = source.indexOf(`exports.${name} =`);
    const fin = source.indexOf('\n    },', debut);
    const options = source.slice(debut, fin === -1 ? source.length : fin);
    return !options.includes(`...HTTP_FUNCTION_RUNTIME.${name}`);
  });

  assert.deepStrictEqual(
      sansOption,
      [],
      `fonctions HTTP sans dimensionnement explicite: ${sansOption.join(', ')}`,
  );
});
