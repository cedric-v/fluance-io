// eleventy.config.js
const i18n = require("eleventy-plugin-i18n");
const htmlmin = require("html-minifier-next"); // Le paquet sécurisé

// PathPrefix conditionnel : vide en dev, /fluance-io en prod (GitHub Pages), vide en prod (fluance.io)
const PATH_PREFIX = process.env.ELEVENTY_ENV === 'prod' ? "" : "";

module.exports = function(eleventyConfig) {
  
  // 1. Gestion des Images (local, servies depuis GitHub Pages ou tout autre hébergeur statique)
  // Support WebP avec fallback automatique pour jpg/jpeg/png
  eleventyConfig.addShortcode("image", function(src, alt, cls = "", loading = "lazy", fetchpriority = "", width = "", height = "") {
    const cleanSrc = src.startsWith('/') ? src : `/${src}`;
    const fullSrc = PATH_PREFIX + cleanSrc;
    const loadingAttr = loading ? `loading="${loading}"` : '';
    const fetchpriorityAttr = fetchpriority ? `fetchpriority="${fetchpriority}"` : '';
    const widthAttr = width ? `width="${width}"` : '';
    const heightAttr = height ? `height="${height}"` : '';
    
    // Vérifier si c'est une image jpg/jpeg/png (pour laquelle on peut avoir une version WebP)
    const isConvertibleImage = /\.(jpg|jpeg|png)$/i.test(cleanSrc);
    
    if (isConvertibleImage) {
      // Générer le chemin WebP correspondant
      const webpSrc = cleanSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const webpFullSrc = PATH_PREFIX + webpSrc;
      
      // Utiliser <picture> avec fallback - le navigateur choisira automatiquement WebP s'il le supporte
      // Les dimensions doivent être sur le <source> aussi pour éviter le CLS
      const sourceWidthAttr = width ? `width="${width}"` : '';
      const sourceHeightAttr = height ? `height="${height}"` : '';
      
      return `<picture>
        <source srcset="${webpFullSrc}" type="image/webp" ${sourceWidthAttr} ${sourceHeightAttr}>
        <img src="${fullSrc}" alt="${alt}" class="${cls}" ${loadingAttr} ${fetchpriorityAttr} ${widthAttr} ${heightAttr}>
      </picture>`;
    }
    
    // Pour les autres formats (gif, svg, etc.), utiliser <img> simple
    return `<img src="${fullSrc}" alt="${alt}" class="${cls}" ${loadingAttr} ${fetchpriorityAttr} ${widthAttr} ${heightAttr}>`;
  });

  // 2. Configuration i18n
  eleventyConfig.addPlugin(i18n, {
    translations: {
      "welcome": { "en": "Welcome", "fr": "Bienvenue" } // Exemple
    },
    defaultLanguage: "fr"
  });

  // 2b. Filtre de date simple pour Nunjucks (utilisé dans le footer)
  eleventyConfig.addFilter("date", function(value, format) {
    const date = value === "now" || !value ? new Date() : new Date(value);
    if (format === "yyyy") {
      return date.getFullYear().toString();
    }
    return date.toISOString();
  });

  // 2c. Filtre pour ajouter le pathPrefix de manière relative (sans domaine)
  eleventyConfig.addFilter("relativeUrl", function(url) {
    // Nettoyer l'URL pour commencer par /
    const cleanUrl = url.startsWith('/') ? url : '/' + url;
    // Ajouter le pathPrefix seulement s'il existe
    return PATH_PREFIX ? PATH_PREFIX + cleanUrl : cleanUrl;
  });

  // 3. Minification HTML sécurisée
  eleventyConfig.addTransform("htmlmin", function(content, outputPath) {
    if (process.env.ELEVENTY_ENV === 'prod' && outputPath && outputPath.endsWith(".html")) {
      return htmlmin.minify(content, {
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }
    return content;
  });

  // 4. Copie des assets statiques (images, etc.) — le CSS est généré dans _site par Tailwind
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  // Copie de la favicon à la racine
  eleventyConfig.addPassthroughCopy({ "src/assets/img/favicon.ico": "favicon.ico" });
  
  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: PATH_PREFIX + "/"
  };
};