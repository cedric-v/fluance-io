// Shared helpers to keep the agent discovery resources consistent:
//   - agent skill digests are recomputed from the SKILL.md files;
//   - the Worker's `discovery.generated.js` is rebuilt from src/.well-known.

import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AGENT_SKILLS, DISCOVERY_FILE_DEFS} from '../api-discovery-files.mjs';

export function sha256(buffer) {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}

export function skillPath(root, name) {
  return resolve(root, 'src', '.well-known', 'agent-skills', name, 'SKILL.md');
}

export function indexJsonPath(root) {
  return resolve(root, 'src', '.well-known', 'agent-skills', 'index.json');
}

/**
 * Recompute the `digest` of every agent skill in index.json.
 * @returns {{changed: boolean, current: string, serialized: string}}
 */
export function refreshSkillDigests(root, {write = true} = {}) {
  const path = indexJsonPath(root);
  const current = readFileSync(path, 'utf8');
  const index = JSON.parse(current);
  const byName = new Map((index.skills || []).map((skill) => [skill.name, skill]));

  let changed = false;
  for (const name of AGENT_SKILLS) {
    const entry = byName.get(name);
    if (!entry) {
      throw new Error(`Agent skill "${name}" is missing from index.json`);
    }
    const digest = sha256(readFileSync(skillPath(root, name)));
    if (entry.digest !== digest) {
      entry.digest = digest;
      changed = true;
    }
  }

  const serialized = `${JSON.stringify(index, null, 2)}\n`;
  if (changed && write) {
    writeFileSync(path, serialized, 'utf8');
  }
  return {changed, current, serialized};
}

/**
 * Read every discovery resource and return the route -> {body, contentType} map.
 */
export function buildDiscoveryResponses(root) {
  const responses = {};
  for (const def of DISCOVERY_FILE_DEFS) {
    responses[def.route] = {
      body: readFileSync(resolve(root, def.file), 'utf8'),
      contentType: def.contentType,
    };
  }
  return responses;
}

export function buildGeneratedModule(responses) {
  return `// Generated from src/.well-known. Do not edit manually.\n` +
    `export const DISCOVERY_RESPONSES = ${JSON.stringify(responses, null, 2)};\n`;
}
