import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDir = resolve(root, 'src', '.well-known');
const outputPath = resolve(
    root,
    'cloudflare',
    'api-proxy',
    'src',
    'discovery.generated.js',
);

const files = {
  '/.well-known/api-catalog': {
    path: resolve(sourceDir, 'api-catalog'),
    contentType: 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
  },
  '/.well-known/agent-skills/index.json': {
    path: resolve(sourceDir, 'agent-skills', 'index.json'),
    contentType: 'application/json; charset=utf-8',
  },
  '/.well-known/mcp/server-card.json': {
    path: resolve(sourceDir, 'mcp', 'server-card.json'),
    contentType: 'application/json; charset=utf-8',
  },
};

for (const skillName of [
  'identify-fluance-fit',
  'list-fluance-classes',
  'book-fluance-session',
]) {
  const route = `/.well-known/agent-skills/${skillName}/SKILL.md`;
  files[route] = {
    path: resolve(sourceDir, 'agent-skills', skillName, 'SKILL.md'),
    contentType: 'text/markdown; charset=utf-8',
  };
}

const responses = Object.fromEntries(Object.entries(files).map(([route, file]) => [
  route,
  {
    body: readFileSync(file.path, 'utf8'),
    contentType: file.contentType,
  },
]));

const output = `// Generated from src/.well-known. Do not edit manually.\n` +
  `export const DISCOVERY_RESPONSES = ${JSON.stringify(responses, null, 2)};\n`;

writeFileSync(outputPath, output, 'utf8');
console.log(`Generated ${Object.keys(responses).length} API discovery responses`);
