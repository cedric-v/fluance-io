#!/usr/bin/env node
/**
 * Valide le frontmatter des pages du site (équivalent « content collections »
 * d'Astro pour Eleventy) : champs requis, types, valeurs autorisées,
 * permalinks uniques, cohérence locale/chemin.
 *
 * Usage : node scripts/validate-frontmatter.mjs
 * Intégré au build via le script npm « prebuild ».
 *
 * Zéro dépendance ajoutée : js-yaml est déjà présent dans l'arbre
 * (utilisé par Eleventy lui-même).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const INCLUDES = path.join(SRC, '_includes');

// Dossiers exclus (schémas différents : emails, agent, assets, .well-known, docs)
const EXCLUDED_DIRS = ['emails', 'agent', 'assets', '.well-known', 'docs'];

const errors = [];
const warnings = [];

const addError = (file, msg) => errors.push(`  ✗ ${path.relative(ROOT, file)} : ${msg}`);
const addWarning = (file, msg) => warnings.push(`  ⚠ ${path.relative(ROOT, file)} : ${msg}`);

function isExcluded(file) {
  const rel = path.relative(SRC, file);
  return EXCLUDED_DIRS.some((dir) => rel.startsWith(dir + path.sep));
}

function collectFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isExcluded(full)) continue;
      files = files.concat(collectFiles(full));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.njk')) {
      files.push(full);
    }
  }
  return files;
}

const ROBOTS_TOKENS = new Set([
  'index', 'noindex', 'follow', 'nofollow', 'noarchive',
  'nosnippet', 'noimageindex', 'none', 'notranslate',
]);
const ROBOTS_PREFIXES = ['max-image-preview:', 'max-snippet:', 'unavailable_after:'];

function parseFrontmatter(file) {
  const content = fs.readFileSync(file, 'utf8');
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  try {
    return yaml.load(m[1]) || {};
  } catch (e) {
    addError(file, `frontmatter YAML invalide : ${e.message}`);
    return null;
  }
}

const files = collectFiles(SRC);
const permalinks = new Map(); // permalink -> file
let parsedCount = 0;

for (const file of files) {
  const fm = parseFrontmatter(file);
  if (fm === null) continue;
  parsedCount++;

  const hasLocale = fm.locale !== undefined;
  const isRootPage = !file.startsWith(path.join(SRC, 'fr')) && !file.startsWith(path.join(SRC, 'en'));
  const isTemplate = file.endsWith('.njk');

  // --- Layout ---
  if (typeof fm.layout === 'string' && !fm.layout.includes('{{')) {
    const layoutPath = path.join(INCLUDES, fm.layout);
    if (!fs.existsSync(layoutPath)) {
      addError(file, `layout introuvable : « ${fm.layout} » (attendu dans src/_includes/)`);
    }
  }

  // --- Pages à rendu (avec layout) : champs requis ---
  if (typeof fm.layout === 'string') {
    if (hasLocale) {
      if (typeof fm.title !== 'string' || fm.title.trim() === '') {
        addError(file, 'title manquant ou vide (requis pour une page localisée)');
      } else if (fm.title.length > 60) {
        addWarning(file, `title long (${fm.title.length} caractères, max conseillé 60) : « ${fm.title.slice(0, 50)}… »`);
      }

      if (typeof fm.description !== 'string' || fm.description.trim() === '') {
        addError(file, 'description manquante ou vide (requis pour une page localisée)');
      } else {
        const len = fm.description.length;
        if (len < 50) addWarning(file, `description courte (${len} caractères, 50-160 conseillés)`);
        else if (len > 160) addWarning(file, `description longue (${len} caractères, max conseillé 160)`);
      }
    }

    // --- Locale : valeur + cohérence avec le chemin ---
    if (fm.locale !== undefined) {
      if (fm.locale !== 'fr' && fm.locale !== 'en') {
        addError(file, `locale invalide : « ${fm.locale} » (attendu fr ou en)`);
      }
      if (!isRootPage) {
        const expected = file.startsWith(path.join(SRC, 'en')) ? 'en' : 'fr';
        if (fm.locale !== expected) {
          addError(file, `locale « ${fm.locale} » incohérente avec le chemin (attendu « ${expected} »)`);
        }
      }
    }
  }

  // --- Permalink ---
  if (typeof fm.permalink === 'string' && !fm.permalink.includes('{{')) {
    const p = fm.permalink;
    if (!p.startsWith('/')) {
      addError(file, `permalink invalide : « ${p} » (doit commencer par /)`);
    }
    if (/\s/.test(p)) {
      addError(file, `permalink invalide : « ${p} » (ne doit pas contenir d'espace)`);
    }
    if (p.includes('//')) {
      addError(file, `permalink invalide : « ${p} » (double slash)`);
    }
    const normalized = p.endsWith('/index.html') ? p.replace(/\/index\.html$/, '/') : p;
    const key = normalized;
    if (permalinks.has(key)) {
      addError(file, `permalink en double : « ${key} » (déjà utilisé par ${path.relative(ROOT, permalinks.get(key))})`);
    } else {
      permalinks.set(key, file);
    }
  }

  // --- robots ---
  if (typeof fm.robots === 'string' && !fm.robots.includes('{{')) {
    const tokens = fm.robots.split(',').map((t) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const ok = ROBOTS_TOKENS.has(token) || ROBOTS_PREFIXES.some((pre) => token.startsWith(pre));
      if (!ok) {
        addError(file, `robots : token inconnu « ${token} » (valeurs: ${[...ROBOTS_TOKENS].join(', ')}, préfixes: ${ROBOTS_PREFIXES.join(', ')})`);
      }
    }
  }

  // --- ogImage ---
  if (fm.ogImage !== undefined) {
    if (typeof fm.ogImage !== 'string' || fm.ogImage.trim() === '') {
      addError(file, 'ogImage vide (doit être un chemin assets/img/... ou une URL http(s))');
    } else if (!/^(assets\/|\/assets\/|https?:\/\/)/.test(fm.ogImage)) {
      addError(file, `ogImage invalide : « ${fm.ogImage} » (attendu assets/img/..., /assets/... ou https://...)`);
    }
  }

  // --- ogTitle ---
  if (fm.ogTitle !== undefined && (typeof fm.ogTitle !== 'string' || fm.ogTitle.trim() === '')) {
    addError(file, 'ogTitle présent mais vide');
  }

  // --- markdownAlternate ---
  if (typeof fm.markdownAlternate === 'string' && !fm.markdownAlternate.startsWith('/')) {
    addError(file, `markdownAlternate invalide : « ${fm.markdownAlternate} » (doit commencer par /)`);
  }

  // --- redirectTo ---
  if (typeof fm.redirectTo === 'string' && !/^(\/|https?:\/\/)/.test(fm.redirectTo)) {
    addError(file, `redirectTo invalide : « ${fm.redirectTo} » (doit commencer par / ou http(s))`);
  }

  // --- eleventyExcludeFromCollections ---
  if (fm.eleventyExcludeFromCollections !== undefined &&
      typeof fm.eleventyExcludeFromCollections !== 'boolean') {
    addError(file, `eleventyExcludeFromCollections doit être un booléen (reçu : ${JSON.stringify(fm.eleventyExcludeFromCollections)})`);
  }

  if (!isTemplate) {
    // Les .md (hors frontmatter vide) doivent avoir au moins title+description
    if (Object.keys(fm).length > 0 && typeof fm.layout !== 'string') {
      addWarning(file, 'page .md sans layout (elle ne sera pas rendue avec base.njk)');
    }
  }
}

// --- Synthèse ---
console.log(`\nFrontmatter : ${files.length} fichiers examinés, ${parsedCount} avec frontmatter.`);

if (warnings.length) {
  console.log(`\n⚠️  ${warnings.length} avertissement(s) :`);
  warnings.forEach((w) => console.log(w));
}
if (errors.length) {
  console.log(`\n❌ ${errors.length} erreur(s) :`);
  errors.forEach((e) => console.log(e));
  console.log('\nRésultat : ÉCHEC — corrigez les erreurs puis relancez.\n');
  process.exit(1);
}

console.log(warnings.length ? `\n✅ Aucune erreur (${warnings.length} avertissement(s)).\n` : '\n✅ Tout est valide.\n');
process.exit(0);
