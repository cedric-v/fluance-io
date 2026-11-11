#!/usr/bin/env node

/**
 * Audit SEO déterministe du build statique.
 *
 * Contrôle toutes les pages HTML générées, le sitemap, robots.txt, les
 * canonicals, les alternates hreflang, le JSON-LD et les liens internes.
 * Aucun accès réseau : le contrôle est reproductible et rapide en CI.
 *
 * Configuration : scripts/seo-audit.config.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import config from './seo-audit.config.mjs';

const ROOT = process.cwd();
const DIST = join(ROOT, config.dist);
const SITE = new URL(config.site);
const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

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

function parseJsonLd(html, route) {
  const blocks = [
    ...html.matchAll(
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  if (blocks.length === 0) {
    fail(`${route} : aucun JSON-LD trouvé.`);
    return;
  }
  for (const block of blocks) {
    try {
      JSON.parse(block[1]);
    } catch (error) {
      fail(`${route} : JSON-LD invalide — ${error.message}`);
    }
  }
}

function readSitemapFiles() {
  const queue = config.sitemaps.map((name) => join(DIST, name));
  const visited = new Set();
  const pageUrls = new Set();

  while (queue.length > 0) {
    const path = queue.shift();
    if (!path || visited.has(path)) continue;
    visited.add(path);
    if (!existsSync(path)) {
      fail(`Sitemap manquant : ${relative(ROOT, path)}`);
      continue;
    }

    const xml = readFileSync(path, 'utf8');
    const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
      decodeEntities(match[1].trim()),
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
  return pageUrls;
}

function isExcludedRoute(route) {
  return (
    config.excludeRoutes.includes(route) ||
    (config.excludePrefixes || []).some((prefix) => route.startsWith(prefix))
  );
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

function readRedirectSources() {
  const path = join(ROOT, config.redirects);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
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

function pageLanguages(page) {
  return [
    ...new Set(
      page.alternates
        .map((alternate) => alternate.hreflang)
        .filter((hreflang) => hreflang && hreflang !== 'x-default'),
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
    (tag) => (getAttributes(tag).name || '').toLowerCase() === 'description',
  );
  const description = descriptionTag ? getAttributes(descriptionTag).content || '' : '';
  const canonicalTag = getTags(html, 'link').find((tag) =>
    (getAttributes(tag).rel || '').toLowerCase().split(/\s+/).includes('canonical'),
  );
  const canonical = canonicalTag ? getAttributes(canonicalTag).href || '' : '';
  const robotsTag = getTags(html, 'meta').find(
    (tag) => (getAttributes(tag).name || '').toLowerCase() === 'robots',
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
    if (getTags(html, 'h1').length !== 1) {
      warn(`${route} : ${getTags(html, 'h1').length} H1 détecté(s) (1 recommandé).`);
    }
    if (config.requireOpenGraph) {
      const ogTags = getTags(html, 'meta')
        .map(getAttributes)
        .filter((attrs) => (attrs.property || '').toLowerCase().startsWith('og:'));
      const ogProperties = new Set(ogTags.map((attrs) => attrs.property.toLowerCase()));
      for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
        if (!ogProperties.has(property)) fail(`${route} : balise ${property} manquante.`);
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
  if (page.isIndexable && page.canonical) {
    byCanonical.set(normalizeUrl(page.canonical), page);
  }
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
        `${page.route} : hreflang ${alternate.hreflang} pointe vers une page absente — ${alternate.href}`,
      );
      continue;
    }
    if (alternate.hreflang === 'x-default') continue;

    const reciprocal = target.alternates.some(
      (candidate) =>
        candidate.hreflang !== 'x-default' &&
        normalizeUrl(candidate.href) === normalizeUrl(page.canonical),
    );
    if (!reciprocal) {
      fail(
        `${page.route} : hreflang ${alternate.hreflang} non réciproque — ${target.route} ne renvoie pas vers ${page.canonical}.`,
      );
    }
  }
  if (
    config.requireXDefault &&
    pageLanguages(page).length > 1 &&
    !page.alternates.some((alternate) => alternate.hreflang === 'x-default')
  ) {
    warn(`${page.route} : aucun hreflang x-default.`);
  }
}

const sitemapUrls = readSitemapFiles();
const indexablePages = [...pages.values()].filter((page) => page.isIndexable);

const indexableUrls = new Set(indexablePages.map((page) => normalizeUrl(page.canonical)));
const missingFromSitemap = [...indexableUrls].filter((url) => !sitemapUrls.has(url));
const missingPage = [...sitemapUrls].filter((url) => !indexableUrls.has(url));

for (const url of missingFromSitemap) fail(`Page indexable absente du sitemap : ${url}`);
for (const url of missingPage) fail(`URL du sitemap absente ou noindex : ${url}`);

// Le sitemap doit reprendre exactement les mêmes alternates que le HTML.
const sitemapAlternates = readSitemapAlternates();
for (const [url, alternates] of sitemapAlternates) {
  const page = byCanonical.get(url);
  if (!page || !page.isIndexable) continue;
  const htmlAlternates = page.alternates.map((alternate) => ({
    hreflang: alternate.hreflang,
    href: normalizeUrl(alternate.href),
  }));
  const xmlAlternates = alternates.map((alternate) => ({
    hreflang: alternate.hreflang,
    href: normalizeUrl(alternate.href),
  }));
  const htmlKey = JSON.stringify(
    [...htmlAlternates].sort((a, b) => `${a.hreflang}|${a.href}`.localeCompare(`${b.hreflang}|${b.href}`)),
  );
  const xmlKey = JSON.stringify(
    [...xmlAlternates].sort((a, b) => `${a.hreflang}|${a.href}`.localeCompare(`${b.hreflang}|${b.href}`)),
  );
  if (htmlKey !== xmlKey) {
    fail(`Alternates HTML/sitemap différents — ${page.route}.`);
  }
}

const redirectSources = readRedirectSources();
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
      `Canonical modifié sans mise à jour du manifeste — ${page.route} : ${expected.canonical} → ${page.canonical}`,
    );
  }
  const expectedLanguages = [...(expected.languages || [])].sort();
  const currentLanguages = pageLanguages(page);
  if (expectedLanguages.join('|') !== currentLanguages.join('|')) {
    fail(
      `Langues disponibles modifiées sans mise à jour du manifeste — ${page.route} : ${expectedLanguages.join(', ')} → ${currentLanguages.join(', ')}`,
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
    `📝 Manifeste SEO écrit : ${config.routeBaseline} (${manifest.routes.length} routes).`,
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
for (const [title, routes] of titleGroups) {
  if (routes.length > 1) warn(`Titre dupliqué : ${JSON.stringify(title)} — ${routes.join(', ')}`);
}
for (const [description, routes] of descriptionGroups) {
  if (routes.length > 1) {
    warn(
      `Description dupliquée : ${JSON.stringify(description.slice(0, 80))} — ${routes.join(', ')}`,
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
      const target = routeToHtmlPath(route);
      const directFile = join(DIST, route.replace(/^\//, ''));
      if (!existsSync(target) && !existsSync(directFile)) {
        if (redirectSources.some((source) => redirectMatches(source, route))) {
          warn(`${page.route} : lien vers une URL redirigée — ${route}`);
        } else {
          fail(`${page.route} : lien interne cassé — ${route}`);
        }
      }
    }
  }
}

checkRobots();

const report = {
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
  writeFileSync(config.report, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`📄 Rapport JSON : ${config.report}`);
}

for (const warning of warnings) console.warn(`⚠️  ${warning}`);
for (const error of errors) console.error(`❌ ${error}`);

console.log(
  `🔎 Audit SEO : ${pages.size} pages, ${indexablePages.length} indexables, ${sitemapUrls.size} URLs sitemap.`,
);
console.log(`   ${errors.length} erreur(s), ${warnings.length} avertissement(s).`);

if (errors.length > 0) process.exit(1);
