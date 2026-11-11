#!/usr/bin/env node
// >>> seo-guard:vendor v1.0.0 sha256:419cff20d3c9
// Source de vérité : tools/seo-guard/sitemap-sync.mjs — cette copie est générée.
// Ne pas éditer ici : corriger l'amont puis resynchroniser (`npm run sync`).
// <<< seo-guard:vendor
/**
 * Aligne le sitemap sur ce que le HTML déclare réellement.
 *
 * Deux garanties, imposées après le build :
 *
 * 1. **`lastmod` = date de contenu** (dernier commit touchant les sources de la
 *    page), jamais la date de build. Google n'exploite `lastmod` que s'il est
 *    « consistently and verifiably accurate » : une date de build fait passer
 *    toutes les pages pour modifiées à chaque déploiement.
 * 2. **Alternates identiques au HTML** : les `<xhtml:link rel="alternate">`
 *    du sitemap sont recopiés depuis les `<link rel="alternate" hreflang>`
 *    de chaque page. Google ignore un jeu `hreflang` non réciproque ou
 *    divergent entre HTML et sitemap.
 *
 * Usage :
 *   node scripts/sitemap-sync.mjs --dist dist --sitemap sitemap-index.xml
 *   node scripts/sitemap-sync.mjs --dist dist --check   # ne rien écrire
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLastmodResolver } from './sitemap-lastmod.mjs';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';

function parseArgs(argv) {
  const args = { dist: 'dist', sitemap: null, check: false, verbose: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dist') args.dist = argv[++index];
    else if (arg === '--sitemap') args.sitemap = argv[++index];
    else if (arg === '--check') args.check = true;
    else if (arg === '--verbose') args.verbose = true;
  }
  return args;
}

function decodeEntities(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Route (`/a/b/`) → fichier HTML dans le build. */
function routeToHtml(dist, pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+|\/+$/g, '');
  const candidates = clean
    ? [join(dist, clean, 'index.html'), join(dist, `${clean}.html`)]
    : [join(dist, 'index.html')];
  return candidates.find((candidate) => existsSync(candidate));
}

/** Alternates déclarés par la page HTML. */
function readHtmlAlternates(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .map((tag) => ({
      rel: (tag.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1] || '').toLowerCase(),
      hreflang: tag.match(/\bhreflang\s*=\s*["']([^"']*)["']/i)?.[1] || '',
      href: tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1] || '',
    }))
    .filter((link) => link.rel.split(/\s+/).includes('alternate') && link.hreflang && link.href);
}

/** Fichiers sitemap à traiter (index → feuilles). */
function sitemapFiles(dist, name) {
  const entry = join(dist, name);
  if (!existsSync(entry)) return [];
  const xml = readFileSync(entry, 'utf8');
  if (!/<sitemapindex\b/i.test(xml)) return [entry];
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => decodeEntities(match[1].trim()))
    .map((loc) => join(dist, new URL(loc).pathname.replace(/^\//, '')))
    .filter((path) => existsSync(path));
}

/**
 * Réécrit un fichier sitemap : alternates + lastmod par URL.
 * @returns {{updated: number, missing: string[]}}
 */
export function syncSitemapFile({ file, dist, lastmodFor, write = true }) {
  const xml = readFileSync(file, 'utf8');
  const missing = [];
  let updated = 0;

  let out = xml.replace(/<url>([\s\S]*?)<\/url>/gi, (block) => {
    const loc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/i)?.[1]?.trim();
    if (!loc) return block;

    let pathname;
    try {
      pathname = new URL(decodeEntities(loc)).pathname;
    } catch {
      return block;
    }

    const htmlPath = routeToHtml(dist, pathname);
    if (!htmlPath) {
      missing.push(pathname);
      return block;
    }

    const alternates = readHtmlAlternates(readFileSync(htmlPath, 'utf8'));
    const lastmod = lastmodFor ? lastmodFor(decodeEntities(loc)) : undefined;

    // On reconstruit le bloc : loc d'abord, puis lastmod, puis alternates.
    const inner = [
      `    <loc>${loc}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
      ...alternates.map(
        (alternate) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}"/>`
      ),
    ]
      .filter(Boolean)
      .join('\n');

    if (`<url>${inner}</url>` !== block.replace(/\n\s*/g, '\n').replace(/\n<\/url>/, '</url>')) {
      updated += 1;
    }
    return `<url>\n${inner}\n  </url>`;
  });

  // Le préfixe `xhtml:` doit être déclaré sur <urlset>.
  if (out.includes('<xhtml:link') && !out.includes(`xmlns:xhtml="${XHTML_NS}"`)) {
    out = out.replace(/<urlset\b([^>]*)>/, (match, attrs) => {
      if (attrs.includes('xmlns:xhtml')) return match;
      return `<urlset${attrs} xmlns:xhtml="${XHTML_NS}">`;
    });
  }

  if (write && out !== xml) writeFileSync(file, out);
  return { updated, missing, changed: out !== xml };
}

export function syncSitemap({ dist, sitemap = null, write = true, lastmodFor = null }) {
  const name =
    sitemap || (existsSync(join(dist, 'sitemap-index.xml')) ? 'sitemap-index.xml' : 'sitemap.xml');
  const files = sitemapFiles(dist, name);
  if (files.length === 0) {
    throw new Error(`Sitemap introuvable : ${join(dist, name)}`);
  }

  const result = { files: [], missing: [], changed: false };
  for (const file of files) {
    const { updated, missing, changed } = syncSitemapFile({ file, dist, lastmodFor, write });
    result.files.push({ file: relative(process.cwd(), file), updated });
    result.missing.push(...missing);
    result.changed = result.changed || changed;
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dist = args.dist;
  if (!existsSync(dist)) {
    console.error(`❌ Build introuvable : ${dist}`);
    process.exit(1);
  }

  const lastmodFor = createLastmodResolver(process.cwd());
  const result = syncSitemap({ dist, sitemap: args.sitemap, write: !args.check, lastmodFor });

  for (const item of result.files) {
    console.log(`📄 ${item.file} — ${item.updated} URL(s) réalignée(s)`);
  }
  if (result.missing.length > 0) {
    console.warn(
      `⚠️  ${result.missing.length} URL(s) du sitemap sans page dans le build : ${result.missing
        .slice(0, 5)
        .join(', ')}`
    );
  }
  if (args.check && result.changed) {
    console.error('❌ Sitemap désynchronisé du HTML (relancer sans --check).');
    process.exit(1);
  }
  console.log(
    result.changed ? '✅ Sitemap réaligné sur le HTML.' : '✅ Sitemap déjà aligné sur le HTML.'
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
