// >>> seo-guard:vendor v1.0.0 sha256:14f990eac9ea
// Source de vérité : tools/seo-guard/sitemap-lastmod.mjs — cette copie est générée.
// Ne pas éditer ici : corriger l'amont puis resynchroniser (`npm run sync`).
// <<< seo-guard:vendor
/**
 * `lastmod` du sitemap basé sur la **date de contenu**.
 *
 * Rappel de la doctrine (Google Search Central, « Build and submit a
 * sitemap ») : « Google uses the `<lastmod>` value if it's consistently and
 * verifiably accurate. The `<lastmod>` value should reflect the date and time
 * of the last significant update to the page. »
 *
 * Conséquence : mettre `lastmod: new Date()` (date de build) dans le sitemap
 * est une **fausse information** — toutes les pages semblent modifiées à
 * chaque déploiement, y compris celles qui n'ont pas bougé. Google compare
 * la valeur avec la modification réelle de la page et ignore alors le signal.
 *
 * Cette implémentation déduit la date de la page de l'historique Git :
 * date du dernier commit ayant touché les fichiers source de la route.
 *
 * Utilisation (Astro) :
 *
 *   import { createLastmodResolver } from './tools/sitemap-lastmod.mjs';
 *   const lastmodFor = createLastmodResolver(process.cwd());
 *   // puis, dans l'intégration sitemap :
 *   serialize: (item) => {
 *     const lastmod = lastmodFor(item.url);
 *     return lastmod ? { ...item, lastmod } : { ...item };
 *   }
 *
 * Prérequis CI : `actions/checkout` avec `fetch-depth: 0` (un clone
 * superficiel ne contient qu'un commit → toutes les pages recevraient la
 * date de ce commit). Le module détecte ce cas et **omet** le `lastmod`
 * plutôt que de mentir.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Extensions de page possibles dans le dossier de pages. */
const PAGE_EXTENSIONS = ['.astro', '.ts', '.mdx', '.js'];

/** Extensions de contenu possibles dans les collections. */
const CONTENT_EXTENSIONS = ['.md', '.mdx'];

/**
 * Fichiers source susceptibles de produire une route.
 *
 * - la page elle-même (`pages/<route>.astro`, `pages/<route>/index.astro`) ;
 * - les pages dynamiques du chemin (`pages/formations/[slug].astro`) ;
 * - l'entrée de collection associée (`content/formations/<slug>.md`).
 */
export function sourceCandidates(root, route, options = {}) {
  const { pagesDir = 'src/pages', contentDirs = ['src/content'] } = options;
  const clean = route.replace(/^\/+|\/+$/g, '');
  const files = [];

  if (clean === '') {
    for (const extension of PAGE_EXTENSIONS) files.push(`${pagesDir}/index${extension}`);
  } else {
    const base = `${pagesDir}/${clean}`;
    for (const extension of PAGE_EXTENSIONS) {
      files.push(`${base}${extension}`);
      files.push(`${base}/index${extension}`);
    }
  }

  // Pages dynamiques rencontrées en remontant le chemin.
  let dir = pagesDir;
  for (const part of clean.split('/').filter(Boolean)) {
    const absolute = join(root, dir);
    if (existsSync(absolute)) {
      for (const name of readdirSync(absolute)) {
        if (name.startsWith('[') && PAGE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
          files.push(`${dir}/${name}`);
        }
      }
    }
    dir = `${dir}/${part}`;
  }

  // Contenu lié : /formations/<slug>/ → content/formations/<slug>.md
  if (clean) {
    for (const contentDir of contentDirs) {
      for (const extension of CONTENT_EXTENSIONS) {
        files.push(`${contentDir}/${clean}${extension}`);
      }
    }
  }

  return [...new Set(files)];
}

/**
 * Parse la sortie de `git log --format=%cI --name-only`.
 *
 * Format réel de git : `<date>`, une ligne vide, puis la liste des fichiers
 * modifiés, puis le commit suivant. On lit donc ligne à ligne : une ligne
 * ISO est une date, toute autre ligne non vide est un fichier.
 */
export function parseGitLog(output) {
  const dates = new Map();
  let current;
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(line)) {
      current = line;
      continue;
    }
    if (!current) continue;
    // Renommage : on ne garde que le nouveau chemin.
    const file = line.includes(' => ') ? line.split(' => ').pop().trim() : line;
    if (!dates.has(file)) dates.set(file, current);
  }
  return dates;
}

/**
 * Un clone superficiel (`fetch-depth: 1`) ne contient qu'un commit : toutes
 * les pages recevraient la date de ce commit — un signal faux. Dans ce cas,
 * on s'abstient (pas de `lastmod`) plutôt que de mentir.
 */
export function isShallowRepo(root) {
  return existsSync(join(root, '.git', 'shallow'));
}

/** Historique Git : fichier → date du dernier commit. */
export function readGitDates(root) {
  try {
    const output = execFileSync(
      'git',
      ['log', '--format=%cI', '--name-only', '--no-merges', '-n', '1000'],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );
    return parseGitLog(output);
  } catch {
    return new Map();
  }
}

/**
 * Crée un résolveur `url → lastmod` (date ISO ou `undefined`).
 *
 * @param {string} root racine du dépôt
 * @param {{pagesDir?: string, contentDirs?: string[]}} options
 * @returns {(url: string) => string | undefined}
 */
export function createLastmodResolver(root = process.cwd(), options = {}) {
  let gitDates = null;
  let shallow = null;

  const dates = () => {
    if (!gitDates) gitDates = readGitDates(root);
    return gitDates;
  };

  /** Historique incomplet : dates non fiables (voir `isShallowRepo`). */
  const usable = () => {
    if (shallow === null) {
      shallow = isShallowRepo(root);
      if (shallow) {
        console.warn('[sitemap] Clone Git superficiel : lastmod omis (utiliser fetch-depth: 0).');
      }
    }
    return !shallow;
  };

  return (url) => {
    if (!usable()) return undefined;

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(url).pathname);
    } catch {
      return undefined;
    }

    let latest;
    for (const file of sourceCandidates(root, pathname, options)) {
      const absolute = join(root, file);
      if (!existsSync(absolute)) continue;

      const fromGit = dates().get(file);
      const date = fromGit ?? statSync(absolute).mtime.toISOString();
      const time = new Date(date).getTime();
      if (Number.isNaN(time)) continue;
      if (latest === undefined || time > latest.time) latest = { time, date };
    }

    return latest?.date;
  };
}
