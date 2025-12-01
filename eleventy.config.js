// eleventy.config.js
const i18n = require("eleventy-plugin-i18n");
const htmlmin = require("html-minifier-next"); // Le paquet sécurisé

module.exports = function(eleventyConfig) {
  
  // 1. Gestion des Images (Local vs S3)
  eleventyConfig.addShortcode("image", function(src, alt, cls = "") {
    const isProd = process.env.ELEVENTY_ENV === 'prod';
    // En prod, on pointe vers le S3 via S3_PUBLIC_URL défini dans l'Action GH / hébergeur
    const rawBase = isProd ? (process.env.S3_PUBLIC_URL || '') : '';
    const baseUrl = rawBase && !rawBase.endsWith('/') ? rawBase + '/' : rawBase;
    const cleanSrc = src.startsWith('/') ? src.slice(1) : src;
    return `<img src="${baseUrl}${cleanSrc}" alt="${alt}" class="${cls}" loading="lazy">`;
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
  
  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};