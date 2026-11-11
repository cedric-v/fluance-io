#!/usr/bin/env node
// >>> seo-guard:vendor v1.0.0 sha256:1eac18a2f28c
// Source de vérité : tools/seo-guard/seo-audit.mjs — cette copie est générée.
// Ne pas éditer ici : corriger l'amont puis resynchroniser (`npm run sync`).
// <<< seo-guard:vendor
/**
 * Audit SEO déterministe du build statique.
 *
 * Contrôle toutes les pages HTML générées, le sitemap, robots.txt, les
 * canonicals, les alternates hreflang, le JSON-LD, les liens internes et le
 * manifeste des routes. Aucun accès réseau : le contrôle est reproductible et
 * rapide en CI.
 *
 * Configuration : `scripts/seo-audit.config.mjs` (seul fichier qui doit
 * différer d'un dépôt à l'autre).
 *
 * Usage :
 *   npm run seo:audit                 # audit bloquant
 *   npm run seo:audit -- --json       # + rapport JSON
 *   npm run seo:manifest              # régénère scripts/seo-routes.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import config from './seo-audit.config.mjs';

const VENDOR_MARKER_END = '// <<< seo-guard:vendor';

const ROOT = process.cwd();
const DIST = join(ROOT, config.dist);
const SITE = new URL(config.site);
const errors = [];
const warnings = [];

/** Erreur structurelle : jamais configurable (le SEO casse). */
const fail = (message) => errors.push(message);
/** Avertissement : jamais bloquant. */
const warn = (message) => warnings.push(message);
/**
 * Contrôle dont la gravité est réglable par le dépôt (`severity` dans la
 * config). Défaut : `fail`. Valeurs : `fail` | `warn` | `off`.
 */
/**
 * Gravité par défaut des contrôles réglables.
 *
 * Doctrine : un défaut qui se répète sur tout le site (titre, description, H1)
 * n'est pas un détail cosmétique — il bloque. Les signaux "à surveiller"
 * (hreflang x-default, URLs sortantes du JSON-LD, date de build du sitemap)
 * restent des avertissements, sauf si le dépôt les durcit.
 */
const DEFAULT_SEVERITY = {
  duplicateTitle: 'fail',
  duplicateDescription: 'fail',
  multipleH1: 'fail',
  openGraph: 'fail',
  jsonLdType: 'fail',
  jsonLdContext: 'warn',
  jsonLdForeignUrl: 'warn',
  lastmodBuildDate: 'warn',
  redirectShadowsPage: 'warn',
  xDefault: 'warn',
  linkToRedirect: 'warn',
};

function check(id, message) {
  const level = (config.severity || {})[id] ?? DEFAULT_SEVERITY[id] ?? 'fail';
  if (level === 'off') return;
  if (level === 'warn') {
    warnings.push(message);
    return;
  }
  errors.push(message);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function htmlPathToRoute(path) {
  const rel = relative(DIST, path).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

function routeToHtmlPath(route) {
  const clean = route.replace(/^\/+|\/+$/g, '');
  return join(DIST, clean, 'index.html');
}

/** Route normalisée (sans slash final, sans requête ni ancre). */
function normalizeRoute(route) {
  const clean = route.split('#')[0].split('?')[0].replace(/\/+$/, '');
  return clean || '/';
}

function decodeEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function getAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[3]);
  }
  return attributes;
}

function getTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
}

function getContent(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href.replace(/\/$/, '') || `${url.origin}/`;
  } catch {
    return value.replace(/\/$/, '');
  }
}

/** Liste bornée : un défaut massif ne doit pas noyer le rapport. */
function limitList(items, max = 8) {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} … (+${items.length - max})`;
}

/**
 * Vérifie que cette copie n'a pas été éditée localement.
 * La copie reste autonome : l'empreinte est embarquée dans l'en-tête, aucune
 * lecture de `tools/` n'est nécessaire.
 */
function checkVendoredCopy() {
  const level = config.vendorGuard ?? 'warn';
  if (level === 'off') return;

  const source = readFileSync(new URL(import.meta.url), 'utf8');
  const markerIndex = source.indexOf(VENDOR_MARKER_END);
  if (markerIndex < 0) return; // copie amont (tools/seo-guard) : rien à vérifier

  const declared = source.slice(0, markerIndex).match(/sha256:([0-9a-f]{12})/)?.[1];
  if (!declared) return;

  const body = source.slice(markerIndex + VENDOR_MARKER_END.length);
  const actual = createHash('sha256').update(body).digest('hex').slice(0, 12);
  if (actual === declared) return;

  const message =
    `Copie seo-guard modifiée localement (empreinte ${actual} ≠ ${declared}). ` +
    'Corriger tools/seo-guard/seo-audit.mjs puis resynchroniser.';
  if (level === 'fail') fail(message);
  else warn(message);
}

/**
 * Aplatit un bloc JSON-LD : les graphes (`{"@graph": [...]}`) sont fréquents et
 * n'ont pas de `@type` à la racine — seuls leurs nœuds en portent un.
 */
function flattenJsonLd(items, inheritedContext) {
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [item];
    const context = item['@context'] ?? inheritedContext;
    const graph = item['@graph'];
    if (Array.isArray(graph)) return flattenJsonLd(graph, context);
    return [context ? { ...item, '@context': item['@context'] ?? context } : item];
  });
}

/**
 * Propriétés JSON-LD dont la valeur doit rester sur le domaine canonique.
 * `contentUrl`/`thumbnailUrl` sont exclus : ils désignent souvent un CDN vidéo
 * légitime, pas une URL de l'entité.
 */
const JSON_LD_URL_KEYS = new Set(['url', 'image', 'logo', 'mainentityofpage', '@id']);

/** Vocabulaires externes légitimes (jamais des liens sortants « métier »). */
const VOCABULARY_HOSTS = /^https?:\/\/(?:[a-z0-9-]+\.)?(?:schema\.org|w3\.org)\//i;

/** JSON-LD : parsable, typé, et URLs de l'entité sur le domaine canonique. */
function parseJsonLd(html, route) {
  const blocks = [
    ...html.matchAll(
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  if (blocks.length === 0) {
    fail(`${route} : aucun JSON-LD trouvé.`);
    return;
  }
  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block[1]);
    } catch (error) {
      fail(`${route} : JSON-LD invalide — ${error.message}`);
      continue;
    }
    const items = flattenJsonLd(Array.isArray(parsed) ? parsed : [parsed]);
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        fail(`${route} : JSON-LD inattendu (ni objet ni tableau d'objets).`);
        continue;
      }
      if (!item['@type']) check('jsonLdType', `${route} : JSON-LD sans @type.`);
      if (!item['@context']) check('jsonLdContext', `${route} : JSON-LD sans @context.`);
      // Un `Review` cite légitimement une source externe (avis Google, presse) :
      // ce n'est pas une URL de l'entité elle-même.
      const types = String(item['@type'] ?? '').toLowerCase();
      if (types.includes('review')) continue;
      for (const [key, value] of Object.entries(item)) {
        if (typeof value !== 'string') continue;
        if (!JSON_LD_URL_KEYS.has(key.toLowerCase())) continue;
        if (!/^https?:\/\//.test(value)) continue;
        if (VOCABULARY_HOSTS.test(value)) continue;
        if (value.startsWith(SITE.origin)) continue;
        check(
          'jsonLdForeignUrl',
          `${route} : JSON-LD ${key} pointe hors du domaine canonique — ${value}`
        );
      }
    }
  }
}

/** Fichiers du sitemap (index → feuilles) et URLs de pages. */
function readSitemapFiles() {
  const queue = config.sitemaps.map((name) => join(DIST, name));
  const visited = new Set();
  const pageUrls = new Set();
  const files = [];

  while (queue.length > 0) {
    const path = queue.shift();
    if (!path || visited.has(path)) continue;
    visited.add(path);
    if (!existsSync(path)) {
      fail(`Sitemap manquant : ${relative(ROOT, path)}`);
      continue;
    }

    files.push(path);
    const xml = readFileSync(path, 'utf8');
    const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
      decodeEntities(match[1].trim())
    );

    if (/<sitemapindex\b/i.test(xml)) {
      for (const loc of locs) {
        const sitemapUrl = new URL(loc, `https://${SITE.host}`);
        queue.push(join(DIST, sitemapUrl.pathname.replace(/^\//, '')));
      }
    } else {
      for (const loc of locs) pageUrls.add(normalizeUrl(loc));
    }
  }
  return { pageUrls, files };
}

/**
 * `lastmod` : dates lisibles, non futures, et **non uniformes**.
 *
 * Un même `lastmod` pour l'essentiel des URLs est la signature d'une date de
 * build (`new Date()`), pas d'une date de contenu : Google ignore alors le
 * signal (doctrine « Architecture SEO des sites web »).
 */
function checkSitemapLastmod(files) {
  const values = [];
  for (const path of files) {
    const xml = readFileSync(path, 'utf8');
    if (/<sitemapindex\b/i.test(xml)) continue;
    for (const match of xml.matchAll(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/gi)) {
      const value = match[1].trim();
      const time = new Date(value).getTime();
      if (Number.isNaN(time)) {
        fail(`sitemap : lastmod invalide — ${value}`);
        continue;
      }
      if (time > Date.now() + 60_000) fail(`sitemap : lastmod dans le futur — ${value}`);
      values.push(value);
    }
  }
  if (values.length < 5) return;

  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const [dominant, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const share = count / values.length;
  const ageHours = (Date.now() - new Date(dominant).getTime()) / 3_600_000;
  if (share >= 0.5 && ageHours >= 0 && ageHours <= 24) {
    check(
      'lastmodBuildDate',
      `sitemap : lastmod uniforme « ${dominant} » sur ${count}/${values.length} URLs — ` +
        'signature d’une date de build. Utiliser la date de contenu (tools/sitemap-lastmod.mjs).'
    );
  }
}

/** Règles de redirection (`_redirects`, format Cloudflare). */
function readRedirectRules() {
  const path = join(ROOT, config.redirects);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [source, target, status] = line.split(/\s+/);
      return { source, target: target || '', status: status || '' };
    })
    .filter((rule) => rule.source);
}

function redirectMatches(source, route) {
  const candidates = [route, route.replace(/\/$/, ''), `${route.replace(/\/$/, '')}/`];
  if (candidates.some((candidate) => candidate === source)) return true;
  if (!source.includes('*')) return false;

  const pattern = source
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${pattern}$`).test(route);
}

function readSitemapAlternates() {
  const alternatesByUrl = new Map();
  const queue = config.sitemaps.map((name) => join(DIST, name));
  const visited = new Set();

  while (queue.length > 0) {
    const path = queue.shift();
    if (!path || visited.has(path)) continue;
    visited.add(path);
    if (!existsSync(path)) continue;

    const xml = readFileSync(path, 'utf8');
    if (/<sitemapindex\b/i.test(xml)) {
      for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
        const sitemapUrl = new URL(decodeEntities(match[1].trim()), `https://${SITE.host}`);
        queue.push(join(DIST, sitemapUrl.pathname.replace(/^\//, '')));
      }
      continue;
    }

    for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
      const block = match[1];
      const loc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/i)?.[1]?.trim();
      if (!loc) continue;
      const alternates = [...block.matchAll(/<xhtml:link\b([^>]*)>/gi)].map((link) => {
        const attrs = getAttributes(link[0]);
        return { hreflang: (attrs.hreflang || '').toLowerCase(), href: attrs.href || '' };
      });
      alternatesByUrl.set(normalizeUrl(decodeEntities(loc)), alternates);
    }
  }
  return alternatesByUrl;
}

/** Vrai si `route` est la route `prefix` ou l'une de ses sous-routes. */
function matchesPrefix(route, prefix) {
  const base = prefix.replace(/\/$/, '');
  return route === base || route.startsWith(`${base}/`);
}

function isExcludedRoute(route) {
  return (
    (config.excludeRoutes || []).includes(route) ||
    (config.excludePrefixes || []).some((prefix) => route.startsWith(prefix))
  );
}

function pageLanguages(page) {
  return [
    ...new Set(
      page.alternates
        .map((alternate) => alternate.hreflang)
        .filter((hreflang) => hreflang && hreflang !== 'x-default')
    ),
  ].sort();
}

function checkRobots() {
  const path = join(DIST, config.robots);
  if (!existsSync(path)) {
    fail(`robots.txt manquant : ${config.robots}`);
    return;
  }
  const robots = readFileSync(path, 'utf8');
  if (/^\s*Disallow:\s*\/\s*$/im.test(robots)) {
    fail('robots.txt bloque tout le site avec « Disallow: / ».');
  }
  if (!/^\s*Allow:\s*\/\s*$/im.test(robots)) {
    warn('robots.txt ne contient pas explicitement « Allow: / ».');
  }
  if (!robots.includes(new URL(config.sitemaps[0], SITE).href)) {
    fail(`robots.txt ne référence pas le sitemap attendu (${config.sitemaps[0]}).`);
  }
}

checkVendoredCopy();

if (!existsSync(DIST)) {
  console.error(`❌ Build introuvable : ${config.dist}. Lancez d'abord le build.`);
  process.exit(1);
}

const htmlFiles = walk(DIST).filter((path) => path.endsWith('.html'));
const pages = new Map();

for (const path of htmlFiles) {
  const route = htmlPathToRoute(path);
  const html = readFileSync(path, 'utf8');
  const title = getContent(html, 'title');
  const descriptionTag = getTags(html, 'meta').find(
    (tag) => (getAttributes(tag).name || '').toLowerCase() === 'description'
  );
  const description = descriptionTag ? getAttributes(descriptionTag).content || '' : '';
  const canonicalTag = getTags(html, 'link').find((tag) =>
    (getAttributes(tag).rel || '').toLowerCase().split(/\s+/).includes('canonical')
  );
  const canonical = canonicalTag ? getAttributes(canonicalTag).href || '' : '';
  const robotsTag = getTags(html, 'meta').find(
    (tag) => (getAttributes(tag).name || '').toLowerCase() === 'robots'
  );
  const robots = robotsTag ? getAttributes(robotsTag).content || '' : '';
  const lang = (html.match(/<html\b[^>]*\blang\s*=\s*(["'])(.*?)\1/i) || [])[2] || '';
  const alternates = getTags(html, 'link')
    .filter((tag) => {
      const attrs = getAttributes(tag);
      return (
        (attrs.rel || '').toLowerCase().split(/\s+/).includes('alternate') &&
        Boolean(attrs.hreflang)
      );
    })
    .map((tag) => {
      const attrs = getAttributes(tag);
      return { hreflang: attrs.hreflang.toLowerCase(), href: attrs.href || '' };
    });

  const isNoindex = robots.toLowerCase().includes('noindex') || route === '/404.html';
  const isExcluded = isExcludedRoute(route);
  const isIndexable = !isNoindex && !isExcluded;

  if (isIndexable) {
    if (!title) fail(`${route} : title manquant ou vide.`);
    if (!description) fail(`${route} : meta description manquante ou vide.`);
    if (!canonical) {
      fail(`${route} : canonical manquant.`);
    } else {
      try {
        const canonicalUrl = new URL(canonical);
        const canonicalRoute = decodeURIComponent(canonicalUrl.pathname);
        if (canonicalUrl.origin !== SITE.origin) {
          fail(`${route} : canonical hors du domaine canonique — ${canonical}`);
        }
        if (canonicalRoute !== route) {
          fail(`${route} : canonical ${canonicalRoute} ne correspond pas à la route.`);
        }
      } catch {
        fail(`${route} : canonical invalide — ${canonical}`);
      }
    }
    if (!lang) fail(`${route} : attribut html lang manquant.`);

    const h1Count = getTags(html, 'h1').length;
    if (h1Count !== 1) {
      check('multipleH1', `${route} : ${h1Count} H1 détecté(s) — exactement 1 attendu.`);
    }

    if (config.requireOpenGraph) {
      const ogTags = getTags(html, 'meta')
        .map(getAttributes)
        .filter((attrs) => (attrs.property || '').toLowerCase().startsWith('og:'));
      const ogProperties = new Set(ogTags.map((attrs) => attrs.property.toLowerCase()));
      for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
        if (!ogProperties.has(property))
          check('openGraph', `${route} : balise ${property} manquante.`);
      }
    }

    parseJsonLd(html, route);
  }
  pages.set(route, {
    route,
    path,
    html,
    title,
    description,
    canonical,
    robots,
    lang,
    alternates,
    isIndexable,
  });
}

const byCanonical = new Map();
for (const page of pages.values()) {
  // Une redirection legacy peut partager le canonical de sa destination ;
  // conserver la page indexable comme référence pour les contrôles hreflang.
  if (page.isIndexable && page.canonical) byCanonical.set(normalizeUrl(page.canonical), page);
}

for (const page of pages.values()) {
  if (!page.isIndexable) continue;
  for (const alternate of page.alternates) {
    if (!alternate.href) {
      fail(`${page.route} : hreflang ${alternate.hreflang} sans URL.`);
      continue;
    }
    const target = byCanonical.get(normalizeUrl(alternate.href));
    if (!target) {
      fail(
        `${page.route} : hreflang ${alternate.hreflang} pointe vers une page absente — ${alternate.href}`
      );
      continue;
    }
    if (alternate.hreflang === 'x-default') continue;

    const reciprocal = target.alternates.some(
      (candidate) =>
        candidate.hreflang !== 'x-default' &&
        normalizeUrl(candidate.href) === normalizeUrl(page.canonical)
    );
    if (!reciprocal) {
      fail(
        `${page.route} : hreflang ${alternate.hreflang} non réciproque — ${target.route} ne renvoie pas vers ${page.canonical}.`
      );
    }
  }
  if (
    config.requireXDefault &&
    pageLanguages(page).length > 1 &&
    !page.alternates.some((alternate) => alternate.hreflang === 'x-default')
  ) {
    check('xDefault', `${page.route} : aucun hreflang x-default.`);
  }
}

const { pageUrls: sitemapUrls, files: sitemapFiles } = readSitemapFiles();
const indexablePages = [...pages.values()].filter((page) => page.isIndexable);

const indexableUrls = new Set(indexablePages.map((page) => normalizeUrl(page.canonical)));
const missingFromSitemap = [...indexableUrls].filter((url) => !sitemapUrls.has(url));
const missingPage = [...sitemapUrls].filter((url) => !indexableUrls.has(url));

for (const url of missingFromSitemap) fail(`Page indexable absente du sitemap : ${url}`);
for (const url of missingPage) fail(`URL du sitemap absente ou noindex : ${url}`);

checkSitemapLastmod(sitemapFiles);

// Le sitemap doit reprendre exactement les mêmes alternates que le HTML.
const sitemapAlternates = readSitemapAlternates();
for (const [url, alternates] of sitemapAlternates) {
  const page = byCanonical.get(url);
  if (!page || !page.isIndexable) continue;
  const key = (list) =>
    JSON.stringify(
      [...list]
        .map((alternate) => ({
          hreflang: alternate.hreflang,
          href: normalizeUrl(alternate.href),
        }))
        .sort((a, b) => `${a.hreflang}|${a.href}`.localeCompare(`${b.hreflang}|${b.href}`))
    );
  if (key(page.alternates) !== key(alternates)) {
    fail(`Alternates HTML/sitemap différents — ${page.route}.`);
  }
}

const redirectRules = readRedirectRules();
const redirectSources = redirectRules.map((rule) => rule.source);
const baselinePath = join(ROOT, config.routeBaseline);
const baselineRoutes = new Map();

if (existsSync(baselinePath)) {
  try {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    for (const entry of baseline.routes || []) baselineRoutes.set(entry.path, entry);
  } catch (error) {
    fail(`Manifeste SEO illisible (${config.routeBaseline}) — ${error.message}`);
  }
} else if (!process.argv.includes('--write-baseline')) {
  fail(`Manifeste SEO absent (${config.routeBaseline}). Générez-le avec npm run seo:manifest.`);
}

for (const page of indexablePages) {
  const expected = baselineRoutes.get(page.route);
  if (!expected) {
    warn(`Nouvelle route absente du manifeste SEO : ${page.route}`);
    continue;
  }
  if (normalizeUrl(expected.canonical) !== normalizeUrl(page.canonical)) {
    fail(
      `Canonical modifié sans mise à jour du manifeste — ${page.route} : ${expected.canonical} → ${page.canonical}`
    );
  }
  const expectedLanguages = [...(expected.languages || [])].sort();
  const currentLanguages = pageLanguages(page);
  if (expectedLanguages.join('|') !== currentLanguages.join('|')) {
    fail(
      `Langues disponibles modifiées sans mise à jour du manifeste — ${page.route} : ${expectedLanguages.join(', ')} → ${currentLanguages.join(', ')}`
    );
  }
}

for (const path of baselineRoutes.keys()) {
  const page = pages.get(path);
  if (page?.isIndexable) continue;
  const hasRedirect = redirectSources.some((source) => redirectMatches(source, path));
  if (hasRedirect) {
    warn(`Route du manifeste retirée mais redirigée : ${path}`);
  } else {
    fail(`Route du manifeste retirée sans redirection : ${path}`);
  }
}

// Une redirection ne doit pas masquer une page qui existe réellement.
for (const page of indexablePages) {
  for (const rule of redirectRules) {
    if (!redirectMatches(rule.source, page.route)) continue;
    const targetRoute = rule.target ? normalizeRoute(rule.target) : null;
    if (targetRoute && targetRoute === normalizeRoute(page.route)) continue;
    check(
      'redirectShadowsPage',
      `Route existante masquée par une redirection : ${page.route} (règle « ${rule.source} ${rule.target} ${rule.status} »).`
    );
  }
}

if (process.argv.includes('--write-baseline')) {
  if (errors.length > 0) {
    console.error('❌ Manifeste non écrit : corriger les erreurs SEO avant de le régénérer.');
    process.exit(1);
  }
  const manifest = {
    version: 1,
    site: SITE.origin,
    routes: indexablePages
      .map((page) => ({
        path: page.route,
        canonical: page.canonical,
        languages: pageLanguages(page),
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
  writeFileSync(baselinePath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `📝 Manifeste SEO écrit : ${config.routeBaseline} (${manifest.routes.length} routes).`
  );
  process.exit(0);
}

const titleGroups = new Map();
const descriptionGroups = new Map();
for (const page of indexablePages) {
  const locale = page.route.match(/^\/([a-z]{2})(?:\/|$)/i)?.[1].toLowerCase() || 'default';
  const titleKey = `${locale}\0${page.title.trim().toLocaleLowerCase()}`;
  const descriptionKey = `${locale}\0${page.description.trim().toLocaleLowerCase()}`;
  titleGroups.set(titleKey, [...(titleGroups.get(titleKey) || []), page.route]);
  descriptionGroups.set(descriptionKey, [
    ...(descriptionGroups.get(descriptionKey) || []),
    page.route,
  ]);
}
for (const [key, routes] of titleGroups) {
  if (routes.length > 1) {
    const title = key.split('\0')[1];
    check(
      'duplicateTitle',
      `Titre dupliqué (${routes.length} pages) : ${JSON.stringify(title)} — ${limitList(routes)}`
    );
  }
}
for (const [key, routes] of descriptionGroups) {
  if (routes.length > 1) {
    const description = key.split('\0')[1];
    check(
      'duplicateDescription',
      `Description dupliquée (${routes.length} pages) : ${JSON.stringify(description.slice(0, 80))} — ${limitList(routes)}`
    );
  }
}

if (!config.skipInternalLinks) {
  for (const page of indexablePages) {
    for (const tag of getTags(page.html, 'a')) {
      const href = getAttributes(tag).href;
      if (!href || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
      let url;
      try {
        url = new URL(href, SITE);
      } catch {
        fail(`${page.route} : lien interne invalide — ${href}`);
        continue;
      }
      if (url.origin !== SITE.origin) continue;
      const route = decodeURIComponent(url.pathname || '/');
      if ((config.ignoreLinkPrefixes || []).some((prefix) => route.startsWith(prefix))) {
        continue;
      }
      // Routes rendues côté serveur (`prerender = false`) : absentes du build
      // statique, mais bien servies en production.
      if ((config.ssrRoutes || []).some((prefix) => matchesPrefix(route, prefix))) continue;
      const target = routeToHtmlPath(route);
      const directFile = join(DIST, route.replace(/^\//, ''));
      if (!existsSync(target) && !existsSync(directFile)) {
        if (redirectSources.some((source) => redirectMatches(source, route))) {
          check('linkToRedirect', `${page.route} : lien vers une URL redirigée — ${route}`);
        } else {
          fail(`${page.route} : lien interne cassé — ${route}`);
        }
      }
    }
  }
}

checkRobots();

const summary = {
  generatedAt: new Date().toISOString(),
  site: SITE.origin,
  dist: config.dist,
  pages: pages.size,
  indexablePages: indexablePages.length,
  sitemapUrls: sitemapUrls.size,
  errors,
  warnings,
};

if (process.argv.includes('--json')) {
  writeFileSync(config.report, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`📄 Rapport JSON : ${config.report}`);
}

for (const warning of warnings) console.warn(`⚠️  ${warning}`);
for (const error of errors) console.error(`❌ ${error}`);

console.log(
  `🔎 Audit SEO : ${pages.size} pages, ${indexablePages.length} indexables, ${sitemapUrls.size} URLs sitemap.`
);
console.log(`   ${errors.length} erreur(s), ${warnings.length} avertissement(s).`);

if (errors.length > 0) process.exit(1);
