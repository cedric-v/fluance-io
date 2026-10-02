// Validate that the public API contract stays consistent across:
//   - the Worker route table (cloudflare/api-proxy/src/routes.js)
//   - the OpenAPI document (src/docs/api/openapi.json)
//   - the /.well-known discovery resources and the generated Worker bundle
//
// Run from CI (npm run validate:api) or manually.

import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROUTES, DYNAMIC_ROUTES} from '../cloudflare/api-proxy/src/routes.js';
import {AGENT_SKILLS, DISCOVERY_FILE_DEFS} from './api-discovery-files.mjs';
import {
  buildDiscoveryResponses,
  buildGeneratedModule,
  refreshSkillDigests,
  skillPath,
  sha256,
} from './lib/discovery.mjs';

const root = resolve(import.meta.dirname, '..');
const errors = [];

function readJson(relativePath) {
  const fullPath = resolve(root, relativePath);
  if (!existsSync(fullPath)) {
    errors.push(`Missing file: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(fullPath, 'utf8'));
  } catch (error) {
    errors.push(`Invalid JSON in ${relativePath}: ${error.message}`);
    return null;
  }
}

// ---- 1. Worker routes ↔ OpenAPI ------------------------------------------
const openapi = readJson('src/docs/api/openapi.json');
if (openapi) {
  const openapiPaths = openapi.paths || {};
  const operationIds = new Set();

  for (const [path, route] of Object.entries(ROUTES)) {
    const operationPath = openapiPaths[path];
    if (!operationPath) {
      errors.push(`Route ${path} is served by the Worker but missing from OpenAPI.`);
      continue;
    }
    for (const method of route.methods) {
      const operation = operationPath[method.toLowerCase()];
      if (!operation) {
        errors.push(`Route ${path} ${method} is missing from OpenAPI.`);
        continue;
      }
      if (!operation.operationId) {
        errors.push(`Operation ${method} ${path} has no operationId.`);
      } else if (operationIds.has(operation.operationId)) {
        errors.push(`Duplicate operationId: ${operation.operationId}.`);
      } else {
        operationIds.add(operation.operationId);
      }
    }
  }

  for (const path of Object.keys(openapiPaths)) {
    if (!ROUTES[path]) {
      errors.push(`OpenAPI documents ${path} but the Worker has no such route.`);
    }
  }

  // Protected operations must declare the ApiKeyAuth security scheme.
  const hasApiKeyScheme = Boolean(
      openapi.components &&
      openapi.components.securitySchemes &&
      openapi.components.securitySchemes.ApiKeyAuth,
  );
  if (!hasApiKeyScheme) {
    errors.push('OpenAPI is missing components.securitySchemes.ApiKeyAuth.');
  }
  for (const [path, route] of Object.entries(ROUTES)) {
    if (route.auth !== 'apiKey') continue;
    const operation = (openapiPaths[path] || {})[route.methods[0].toLowerCase()];
    const secured = operation && Array.isArray(operation.security) &&
      operation.security.some((scheme) => scheme.ApiKeyAuth);
    if (!secured) {
      errors.push(`Protected route ${path} does not declare the ApiKeyAuth scheme.`);
    }
  }
}

// ---- 2. Discovery resources on disk --------------------------------------
for (const def of DISCOVERY_FILE_DEFS) {
  if (!existsSync(resolve(root, def.file))) {
    errors.push(`Discovery resource missing: ${def.file} (${def.route}).`);
  }
}

// ---- 3. Agent skill digests ----------------------------------------------
const index = readJson('src/.well-known/agent-skills/index.json');
if (index) {
  const byName = new Map((index.skills || []).map((skill) => [skill.name, skill]));
  for (const name of AGENT_SKILLS) {
    const entry = byName.get(name);
    if (!entry) {
      errors.push(`Agent skill ${name} missing from index.json.`);
      continue;
    }
    const expected = sha256(readFileSync(skillPath(root, name)));
    if (entry.digest !== expected) {
      errors.push(
          `Stale digest for ${name}: index.json has ${entry.digest}, expected ${expected}. ` +
          'Run: node scripts/generate-api-proxy-discovery.mjs',
      );
    }
  }
}

// ---- 4. Generated Worker discovery bundle is up to date ------------------
try {
  const generatedPath = resolve(
      root,
      'cloudflare',
      'api-proxy',
      'src',
      'discovery.generated.js',
  );
  const current = readFileSync(generatedPath, 'utf8');
  const expected = buildGeneratedModule(buildDiscoveryResponses(root));
  if (current !== expected) {
    errors.push(
        'cloudflare/api-proxy/src/discovery.generated.js is stale. ' +
        'Run: node scripts/generate-api-proxy-discovery.mjs',
    );
  }
  const digests = refreshSkillDigests(root, {write: false});
  if (digests.changed) {
    errors.push('Agent skill digests need to be refreshed (run the generator).');
  }
} catch (error) {
  errors.push(`Could not verify generated discovery bundle: ${error.message}`);
}

// ---- 5. webmcp-context endpoints ↔ Worker routes -------------------------
const webmcp = readJson('src/.well-known/webmcp-context.json');
if (webmcp && webmcp.publicApi && Array.isArray(webmcp.publicApi.endpoints)) {
  for (const endpoint of webmcp.publicApi.endpoints) {
    if (endpoint.path && !ROUTES[endpoint.path] && !DYNAMIC_ROUTES[endpoint.path]) {
      errors.push(`webmcp-context.json references unknown endpoint ${endpoint.path}.`);
    }
  }
}

// ---- 6. api-catalog points to a real OpenAPI file ------------------------
const catalogPath = resolve(root, 'src/.well-known/api-catalog');
if (existsSync(catalogPath)) {
  const catalog = readFileSync(catalogPath, 'utf8');
  if (!catalog.includes('/docs/api/openapi.json')) {
    errors.push('api-catalog does not reference /docs/api/openapi.json.');
  }
  if (!existsSync(resolve(root, 'src/docs/api/openapi.json'))) {
    errors.push('api-catalog references an OpenAPI file that does not exist.');
  }
}

if (errors.length > 0) {
  console.error(`❌ API contract validation failed (${errors.length} issue(s)):`);
  for (const error of errors) {
    console.error(`   - ${error}`);
  }
  process.exit(1);
}

console.log('✅ API contract is consistent (routes, OpenAPI, discovery).');
