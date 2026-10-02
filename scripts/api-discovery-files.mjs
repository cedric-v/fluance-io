// Canonical list of the `/.well-known/*` resources served by the API proxy
// Worker. Shared by the discovery generator and the contract validator.

export const AGENT_SKILLS = [
  'identify-fluance-fit',
  'list-fluance-classes',
  'book-fluance-session',
];

export const DISCOVERY_FILE_DEFS = [
  {
    route: '/.well-known/api-catalog',
    file: 'src/.well-known/api-catalog',
    contentType: 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
  },
  {
    route: '/.well-known/agent-card.json',
    file: 'src/.well-known/agent-card.json',
    contentType: 'application/json; charset=utf-8',
  },
  {
    route: '/.well-known/agent-skills/index.json',
    file: 'src/.well-known/agent-skills/index.json',
    contentType: 'application/json; charset=utf-8',
  },
  {
    route: '/.well-known/mcp/server-card.json',
    file: 'src/.well-known/mcp/server-card.json',
    contentType: 'application/json; charset=utf-8',
  },
  {
    route: '/.well-known/webmcp-context.json',
    file: 'src/.well-known/webmcp-context.json',
    contentType: 'application/json; charset=utf-8',
  },
  ...AGENT_SKILLS.map((name) => ({
    route: `/.well-known/agent-skills/${name}/SKILL.md`,
    file: `src/.well-known/agent-skills/${name}/SKILL.md`,
    contentType: 'text/markdown; charset=utf-8',
  })),
];
