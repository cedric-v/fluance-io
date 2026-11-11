// >>> seo-guard:vendor v1.0.0 sha256:0edf11e20b4e
// Source de vérité : tools/seo-guard/description.cjs — cette copie est générée.
// Ne pas éditer ici : corriger l'amont puis resynchroniser (`npm run sync`).
// <<< seo-guard:vendor
/**
 * Meta description dérivée du contenu (filtre Eleventy/Nunjucks).
 *
 * Pourquoi : une page sans `description:` tombe sur la description générique
 * du site — des centaines de pages avec exactement la même balise, ce qui est
 * un défaut SEO bloquant (et un signal d'auto-génération pour Google).
 *
 * Règles :
 * - on ne garde que du texte visible : `<script>`, `<style>`, `<nav>`,
 *   `<form>`, `<figure>`, commentaires et syntaxe de gabarit sont supprimés
 *   (c'est ainsi qu'un libellé de honeypot s'était retrouvé dans une meta) ;
 * - les phrases « boilerplate » (formulaires, cookies, newsletter) sont
 *   écartées ;
 * - jamais de coupure au milieu d'un mot, jamais de « … » : on termine sur une
 *   ponctuation de phrase ou de proposition ;
 * - la description ne répète pas le `<title>` (perte de place dans le SERP).
 *
 * Volume : 120–158 caractères utiles (au-delà, Google tronque).
 */

/** Fragments de texte qui ne doivent jamais devenir une description. */
const BOILERPLATE = [
  /honeypot/i,
  /ne pas remplir/i,
  /bot-field/i,
  /en vous inscrivant/i,
  /newsletter/i,
  /abonnez[- ]vous/i,
  /g[ée]rer les cookies/i,
  /partager sur/i,
  /laisser un commentaire/i,
  /articles? similaires/i,
  /^lire (la suite|aussi)/i,
  /^sommaire$/i,
  // Bylines et blocs de métadonnées recopiés d'un article à l'autre.
  /^article r[ée]dig[ée] par/i,
  /^d[ée]tails\s*:/i,
  /(?:blogueur|blog)\s+organisateur\s*:/i,
  /fait partie de la lign[ée]e d'articles/i,
  /^[ée]crit par\s/i,
  // Appels à l'action newsletter, présents en tête de nombreux articles.
  /rejoignez nos lecteurs/i,
  /recevoir (plus de|nos) (conseils|actualit[ée]s)/i,
  /^inscrivez-vous/i,
  /^abonnez-vous/i,
  /^pour recevoir/i,
  /^vous avez aim[ée] cet article/i,
  /^statut de cette [ée]dition/i,
  /^article (?:de lancement|r[ée]capitulatif)\s*:/i,
  /^d[ée]couvrir articles similaires/i,
];

/** Abréviations qui ne terminent pas une phrase. */
const ABBREVIATIONS = /(?:\b(?:M|MM|Mme|Mmes|Dr|St|Ste|cf|ex|env|art|av|bd|etc|p|pp|n°|vol)\.)$/i;

/** Entités nommées utiles en français (les autres passent en numérique). */
const NAMED_ENTITIES = {
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  agrave: 'à',
  acirc: 'â',
  aelig: 'æ',
  ccedil: 'ç',
  egrave: 'è',
  eacute: 'é',
  ecirc: 'ê',
  euml: 'ë',
  icirc: 'î',
  iuml: 'ï',
  ocirc: 'ô',
  oelig: 'œ',
  ugrave: 'ù',
  ucirc: 'û',
  uuml: 'ü',
  deg: '°',
  euro: '€',
};

function decodeEntities(value) {
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith('#')) {
      const code =
        entity[1].toLowerCase() === 'x'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Supprime tout ce qui n'est pas du texte rédigé. */
/** Blocs structurels qui ne portent jamais le propos de la page. */
const DROP_ELEMENTS = [
  'script',
  'style',
  'nav',
  'footer',
  'aside',
  'form',
  'figure',
  'figcaption',
  'header',
  'h1',
  'time',
];

/** Classes/ids d'habillage (catégorie, méta, fil d'Ariane, widgets…). */
const DROP_ATTRIBUTE =
  /(?:class|id)\s*=\s*("[^"]*(?:categor|tag-|tags|label|byline|breadcrumb|post-meta|entry-meta|sidebar|widget|related|share|comments?|cookie|newsletter|banner|hero-meta)[^"]*"|'[^']*(?:categor|tag-|tags|label|byline|breadcrumb|post-meta|entry-meta|sidebar|widget|related|share|comments?|cookie|newsletter|banner|hero-meta)[^']*')/i;

/** Un bloc d'habillage plus long que ça contient du vrai texte : on le garde. */
const WRAPPER_MAX_LENGTH = 400;

/** Supprime tout ce qui n'est pas du texte rédigé. */
function stripNoise(html) {
  let out = html;
  for (const tag of DROP_ELEMENTS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
  }
  // Blocs d'habillage courts (catégorie, date, fil d'Ariane, partage) : le
  // contenu est retiré. Au-delà de `WRAPPER_MAX_LENGTH`, on conserve le texte
  // intérieur — sinon un conteneur « sidebar » avalerait tout l'article.
  out = out.replace(/<([a-z][a-z0-9]*)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, inner) => {
    if (!DROP_ATTRIBUTE.test(attrs)) return match;
    return inner.length > WRAPPER_MAX_LENGTH ? inner : ' ';
  });
  return out
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{#[\s\S]*?#\}/g, ' ')
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ');
}

function toText(value) {
  return decodeEntities(stripNoise(String(value || '')).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?»])/g, '$1')
    .trim();
}

function normalizeForCompare(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Découpe en phrases, en recollant les fragments trop courts. */
function sentences(text) {
  const raw = text.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ«"'—–(0-9])/u);
  const merged = [];
  for (const fragment of raw) {
    const previous = merged[merged.length - 1];
    // On recolle uniquement les fragments qui ne terminent pas une phrase
    // (coupure après une abréviation, ou fragment trop court sans ponctuation).
    const endsSentence = /[.!?…]$/.test(previous || '');
    if (previous && (ABBREVIATIONS.test(previous) || (previous.length < 25 && !endsSentence))) {
      merged[merged.length - 1] = `${previous} ${fragment}`;
    } else {
      merged.push(fragment);
    }
  }
  return merged.map((sentence) => sentence.trim()).filter(Boolean);
}

/** Coupe proprement : ponctuation de proposition, sinon fin de mot. */
function cutAtBoundary(text, maxLength) {
  const limit = Math.max(40, maxLength - 1);
  const slice = text.slice(0, limit);
  const clause = Math.max(
    slice.lastIndexOf(', '),
    slice.lastIndexOf('; '),
    slice.lastIndexOf(': '),
    slice.lastIndexOf(' — '),
    slice.lastIndexOf(' – ')
  );
  if (clause > limit * 0.55) {
    return `${slice
      .slice(0, clause)
      .trimEnd()
      .replace(/[\s,;:—–-]+$/, '')}.`;
  }
  const space = slice.lastIndexOf(' ');
  const cut = space > limit * 0.5 ? space : limit;
  return `${slice
    .slice(0, cut)
    .trimEnd()
    .replace(/[\s,;:—–-]+$/, '')}.`;
}

/**
 * @param {string} html Contenu rendu (ou texte brut) de la page.
 * @param {object} [options]
 * @param {string} [options.title] Titre de la page (pour éviter la redite).
 * @param {number} [options.maxLength] Longueur cible (158 par défaut).
 * @param {number} [options.minLength] Longueur minimale d'une phrase retenue.
 * @returns {string} Description, ou chaîne vide si rien d'exploitable.
 */
function extractSentences(text, { title, minLength }) {
  const titleNorm = normalizeForCompare(title);
  return sentences(text).filter((sentence) => {
    if (sentence.length < Math.min(minLength, text.length)) return false;
    if (BOILERPLATE.some((pattern) => pattern.test(sentence))) return false;
    if (titleNorm && normalizeForCompare(sentence) === titleNorm) return false;
    return true;
  });
}

/**
 * @param {string} html Contenu rendu (ou texte brut) de la page.
 * @param {object} [options]
 * @param {string} [options.title] Titre de la page (pour éviter la redite).
 * @param {string} [options.tagline] Accroche du site, utilisée en dernier recours.
 * @param {number} [options.maxLength] Longueur cible (158 par défaut).
 * @param {number} [options.minLength] Longueur minimale d'une phrase retenue.
 * @returns {string} Description, ou chaîne vide si rien d'exploitable.
 */
function seoDescription(html, options = {}) {
  const { title = '', tagline = '', maxLength = 158, minLength = 60 } = options;
  const text = toText(html);

  // Deux passes : phrases complètes, puis fragments plus courts (pages faites
  // de listes de liens, où aucune phrase longue n'existe).
  let usable = text.length > 0 ? extractSentences(text, { title, minLength }) : [];
  if (usable.length === 0 && text.length > 0) {
    usable = extractSentences(text, { title, minLength: 30 });
  }

  if (usable.length === 0) {
    // Dernier recours : le titre est déjà unique, on l'annonce avec l'accroche
    // du site plutôt que de dupliquer la description générique sur N pages.
    if (!title) return '';
    const suffix = tagline ? ` — ${tagline}` : '';
    return `${title.replace(/\s*[|—–-]\s*$/, '')}${suffix}`;
  }

  let out = '';
  for (const sentence of usable) {
    if (out && out.length + 1 + sentence.length > maxLength) break;
    out = out ? `${out} ${sentence}` : sentence;
  }

  if (out.length <= maxLength) return out;
  return cutAtBoundary(out, maxLength);
}

module.exports = { seoDescription, toText, sentences, cutAtBoundary };
