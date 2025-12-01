// eleventy.config.js
const i18n = require("eleventy-plugin-i18n");
const htmlmin = require("html-minifier-next"); // Le paquet sécurisé

module.exports = function(eleventyConfig) {
  
  // 1. Gestion des Images (local, servies depuis GitHub Pages ou tout autre hébergeur statique)
  eleventyConfig.addShortcode("image", function(src, alt, cls = "") {
    const cleanSrc = src.startsWith('/') ? src : `/${src}`;
    return `<img src="${cleanSrc}" alt="${alt}" class="${cls}" loading="lazy">`;
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