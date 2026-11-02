#!/usr/bin/env node
/**
 * Verifie que le dimensionnement REELLEMENT deploye des fonctions HTTP du hub
 * leads/contact correspond a ce qui est declare dans le code
 * (`functions/runtimeConfig.js`).
 *
 * Motif: un redeploiement Firebase reecrit memoire / instances depuis les
 * options du code. Une option oubliee repasse silencieusement au defaut GCP
 * (c'est ainsi que `maxInstanceCount` etait revenu de 20 a 100).
 *
 * Usage:
 *   node scripts/verify-functions-runtime.mjs
 *   node scripts/verify-functions-runtime.mjs --project autre-projet --region europe-west1
 *
 * Authentification: Application Default Credentials
 *   - en local: `gcloud auth application-default login`
 *   - en CI: Workload Identity Federation (pas de cle JSON)
 *
 * Code de sortie: 0 si tout correspond, 1 sinon.
 */

import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const functionsDir = path.join(repoRoot, 'functions');

// Les dependances (google-auth-library) et la source de verite vivent dans
// functions/ : on resout depuis ce dossier.
const requireFromFunctions = createRequire(path.join(functionsDir, 'package.json'));
const {GoogleAuth} = requireFromFunctions('google-auth-library');
const {HTTP_FUNCTION_RUNTIME} = requireFromFunctions('./runtimeConfig');

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function defaultProject() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  try {
    const firebaserc = JSON.parse(readFileSync(path.join(repoRoot, '.firebaserc'), 'utf8'));
    return firebaserc?.projects?.default || null;
  } catch {
    return null;
  }
}

// L'API renvoie "512Mi", le code declare "512MiB".
function normalizeMemory(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).replace(/i?B$/i, '').replace(/i$/, '').toLowerCase();
}

function normalizeInstanceCount(value) {
  // undefined/null = non defini, donc 0 instance minimale cote Cloud Run.
  return value === undefined || value === null ? 0 : Number(value);
}

async function fetchDeployedConfig({project, region, functionName, token}) {
  const url = `https://cloudfunctions.googleapis.com/v2/projects/${project}` +
    `/locations/${region}/functions/${functionName}`;
  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});

  if (response.status === 404) {
    return {missing: true};
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API Cloud Functions ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const serviceConfig = data.serviceConfig || {};
  return {
    missing: false,
    state: data.state,
    memory: serviceConfig.availableMemory,
    minInstances: serviceConfig.minInstanceCount,
    maxInstances: serviceConfig.maxInstanceCount,
    revision: serviceConfig.revision,
  };
}

function compare(expected, deployed) {
  const checks = [
    {
      label: 'memory',
      expected: expected.memory,
      actual: deployed.memory,
      ok: normalizeMemory(deployed.memory) === normalizeMemory(expected.memory),
    },
    {
      label: 'minInstances',
      expected: expected.minInstances ?? 0,
      actual: normalizeInstanceCount(deployed.minInstances),
      ok: normalizeInstanceCount(deployed.minInstances) === (expected.minInstances ?? 0),
    },
  ];

  if (expected.maxInstances !== undefined) {
    checks.push({
      label: 'maxInstances',
      expected: expected.maxInstances,
      // Non defini = plafond Cloud Run par defaut (100), pas la valeur attendue.
      actual: deployed.maxInstances ?? 'non defini (defaut 100)',
      ok: normalizeInstanceCount(deployed.maxInstances) === expected.maxInstances,
    });
  }

  return checks;
}

async function main() {
  const project = argValue('--project', defaultProject());
  const region = argValue('--region', 'europe-west1');

  if (!project) {
    console.error('❌ Projet introuvable: passer --project ou definir GCLOUD_PROJECT.');
    process.exit(1);
  }

  let token;
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    token = await auth.getAccessToken();
  } catch (error) {
    console.error(
        '❌ Authentification impossible (Application Default Credentials).\n' +
        '   En local: gcloud auth application-default login\n' +
        '   En CI: Workload Identity Federation\n' +
        `   Detail: ${error.message}`,
    );
    process.exit(1);
  }

  const entries = Object.entries(HTTP_FUNCTION_RUNTIME);
  let failures = 0;

  console.log(`Verification du runtime deploye (${project} / ${region})\n`);

  for (const [functionName, expected] of entries) {
    let deployed;
    try {
      deployed = await fetchDeployedConfig({project, region, functionName, token});
    } catch (error) {
      console.error(`❌ ${functionName}: lecture impossible - ${error.message}`);
      failures++;
      continue;
    }

    if (deployed.missing) {
      console.error(`❌ ${functionName}: fonction introuvable dans ${region}`);
      failures++;
      continue;
    }

    const checks = compare(expected, deployed);
    const bad = checks.filter((check) => !check.ok);
    console.log(`${bad.length === 0 ? '✅' : '❌'} ${functionName} (${deployed.revision || 'revision inconnue'})`);
    checks.forEach((check) => {
      const line = `     ${check.ok ? 'ok  ' : 'ECART'} ${check.label}: deploye=${check.actual} attendu=${check.expected}`;
      console.log(line);
    });

    failures += bad.length;
  }

  if (failures > 0) {
    console.error(
        `\n❌ ${failures} ecart(s). Redéployer avec \`firebase deploy --only functions\` ` +
        'puis relancer ce script.',
    );
    process.exit(1);
  }

  console.log('\n✅ Configuration deployee alignee avec functions/runtimeConfig.js');
}

main().catch((error) => {
  console.error('❌ Erreur inattendue:', error.message);
  process.exit(1);
});
