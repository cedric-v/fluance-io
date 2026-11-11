#!/usr/bin/env node
// >>> seo-guard:vendor v1.0.0 sha256:53d225f5400d
// Source de vérité : tools/seo-guard/seo-smoke.mjs — cette copie est générée.
// Ne pas éditer ici : corriger l'amont puis resynchroniser (`npm run sync`).
// <<< seo-guard:vendor
/**
 * Smoke test SEO après déploiement.
 *
 * Vérifie les URL du sitemap audité sur l'URL réellement déployée : code HTTP,
 * `noindex`, canonical attendu et présence de JSON-LD.
 *
 * Usage :
 *   node scripts/seo-smoke.mjs --base-url https://... --dist dist
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const baseUrl = getArg('--base-url', process.env.SMOKE_TEST_URL || '');
const dist = getArg('--dist', 'dist');
const defaultSitemap = existsSync(join(dist, 'sitemap-index.xml'))
  ? 'sitemap-index.xml'
  : 'sitemap.xml';
const sitemapName = getArg('--sitemap', defaultSitemap);
const concurrency = Number(getArg('--concurrency', '4'));
const retries = Number(getArg('--retries', '5'));
// Identifiant de robot propre au site (jamais un domaine tiers).
const userAgent = getArg('--user-agent', process.env.SEO_SMOKE_USER_AGENT || 'SeoGuard/1.0');

if (!baseUrl) {
  console.error('❌ --base-url ou SMOKE_TEST_URL est obligatoire.');
  process.exit(1);
}
if (!existsSync(join(dist, sitemapName))) {
  console.error(`❌ Sitemap introuvable : ${join(dist, sitemapName)}`);
  process.exit(1);
}

const absoluteBase = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
const sitemapFiles = [];
const queue = [join(dist, sitemapName)];

while (queue.length > 0) {
  const path = queue.shift();
  if (!path || sitemapFiles.includes(path)) continue;
  if (!existsSync(path)) {
    console.error(`❌ Sitemap introuvable : ${path}`);
    process.exit(1);
  }
  sitemapFiles.push(path);
  const xml = readFileSync(path, 'utf8');
  if (/<sitemapindex\b/i.test(xml)) {
    for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
      const url = new URL(match[1].trim(), absoluteBase);
      queue.push(join(dist, url.pathname.replace(/^\//, '')));
    }
  }
}

const expectedPages = new Map();
for (const path of sitemapFiles) {
  const xml = readFileSync(path, 'utf8');
  if (/<sitemapindex\b/i.test(xml)) continue;
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const block = match[1];
    const loc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/i)?.[1]?.trim();
    if (!loc) continue;
    const canonicalUrl = new URL(loc);
    expectedPages.set(canonicalUrl.pathname, canonicalUrl.href);
  }
}

function getAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] || '';
}

// 404 est temporaire pendant la propagation d'un nouveau déploiement Cloudflare.
const RETRYABLE_STATUS = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

async function fetchWithRetry(path) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(new URL(path, absoluteBase), {
        redirect: 'follow',
        headers: { 'user-agent': `Mozilla/5.0 (compatible; ${userAgent})` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw lastError || new Error(`Échec de requête ${path}`);
}

const paths = [...expectedPages.keys()];
const failures = [];
let completed = 0;

async function worker() {
  while (paths.length > 0) {
    const path = paths.shift();
    if (!path) return;
    try {
      const response = await fetchWithRetry(path);
      const html = await response.text();
      if (response.status !== 200) {
        failures.push(`${path} : HTTP ${response.status} (attendu 200)`);
      } else if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
        failures.push(`${path} : page indexable renvoyée avec robots noindex.`);
      } else {
        const canonicalTag = html.match(
          /<link\b[^>]*\brel=["'][^"']*canonical[^"']*["'][^>]*>/i
        )?.[0];
        const canonical = getAttribute(canonicalTag || '', 'href');
        const expectedCanonical = expectedPages.get(path);
        if (canonical !== expectedCanonical) {
          failures.push(
            `${path} : canonical ${canonical || 'absent'} (attendu ${expectedCanonical}).`
          );
        }
        if (!/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html)) {
          failures.push(`${path} : JSON-LD absent.`);
        }
      }
    } catch (error) {
      failures.push(`${path} : ${error.message}`);
    } finally {
      completed++;
    }
  }
}

console.log(`🧪 Smoke SEO sur ${absoluteBase.origin} — ${expectedPages.size} URL(s).`);
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

for (const path of [sitemapName, 'robots.txt']) {
  try {
    const response = await fetchWithRetry(path);
    if (response.status !== 200) failures.push(`${path} : HTTP ${response.status} (attendu 200)`);
  } catch (error) {
    failures.push(`${path} : ${error.message}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`❌ ${failure}`);
  console.error(`💥 Smoke SEO : ${failures.length} échec(s) sur ${completed} page(s).`);
  process.exit(1);
}

console.log(`✅ Smoke SEO : ${completed} page(s) valides, sitemap et robots.txt accessibles.`);
