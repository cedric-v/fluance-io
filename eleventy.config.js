// eleventy.config.js
const i18n = require("eleventy-plugin-i18n");
const htmlmin = require("html-minifier-next"); // Le paquet sécurisé
const fs = require("fs");
const path = require("path");

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
      
      // Vérifier si le fichier WebP existe dans src/assets/img
      // Utiliser path.resolve pour obtenir le chemin absolu depuis le répertoire du projet
      const projectRoot = path.resolve(__dirname);
      const srcPath = path.join(projectRoot, 'src', cleanSrc.replace(/^\//, ''));
      const webpPath = srcPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const webpExists = fs.existsSync(webpPath);
      
      // Utiliser <picture> avec fallback seulement si le fichier WebP existe
      if (webpExists) {
        const sourceWidthAttr = width ? `width="${width}"` : '';
        const sourceHeightAttr = height ? `height="${height}"` : '';
        
        return `<picture>
          <source srcset="${webpFullSrc}" type="image/webp" ${sourceWidthAttr} ${sourceHeightAttr}>
          <img src="${fullSrc}" alt="${alt}" class="${cls}" ${loadingAttr} ${fetchpriorityAttr} ${widthAttr} ${heightAttr}>
        </picture>`;
      }
    }
    
    // Pour les autres formats ou si WebP n'existe pas, utiliser <img> simple
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

  // 2d. Filtre pour construire l'URL complète de l'image OG
  eleventyConfig.addFilter("buildOgImageUrl", function(imagePath) {
    if (!imagePath) imagePath = 'assets/img/fond-cedric.jpg';
    
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('/')) {
      return 'https://fluance.io' + imagePath;
    }
    
    return 'https://fluance.io/' + imagePath;
  });

  // 2e. Shortcode pour le contenu protégé
  eleventyConfig.addShortcode("protectedContent", function(contentId) {
    // Échapper correctement le contentId pour JavaScript
    const escapedContentId = contentId.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const escapedContentIdAttr = contentId.replace(/"/g, '&quot;');
    
    return `<div class="protected-content" data-content-id="${escapedContentIdAttr}">
  <div class="bg-gray-100 rounded-lg p-8 text-center">
    <p class="text-gray-600 mb-4">Chargement du contenu protégé...</p>
    <div class="animate-pulse">
      <div class="h-4 bg-gray-300 rounded w-3/4 mx-auto mb-2"></div>
      <div class="h-4 bg-gray-300 rounded w-1/2 mx-auto"></div>
    </div>
  </div>
</div>
<script>
(function() {
  var contentId = '${escapedContentId}';
  console.log('[Protected Content] Shortcode script loaded for:', contentId);
  
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('[Protected Content] DOMContentLoaded fired for:', contentId);
    
    // Attendre que Firebase soit complètement initialisé
    await new Promise(function(resolve) {
      if (typeof window.FluanceAuth !== 'undefined' && 
          typeof firebase !== 'undefined' && 
          firebase.apps.length > 0) {
        console.log('[Protected Content] Firebase already initialized');
        resolve();
      } else {
        var checkInterval = setInterval(function() {
          if (typeof window.FluanceAuth !== 'undefined' && 
              typeof firebase !== 'undefined' && 
              firebase.apps.length > 0) {
            console.log('[Protected Content] Firebase initialized after wait');
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(function() {
          console.log('[Protected Content] Firebase init timeout');
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      }
    });
    
    var element = document.querySelector('.protected-content[data-content-id="' + contentId + '"]');
    if (!element) {
      console.log('[Protected Content] Element not found');
      return;
    }
    
    function checkAuthAndLoad() {
      console.log('[Protected Content] checkAuthAndLoad called for:', contentId);
      
      var isAuth = false;
      var currentUser = null;
      
      // Méthode 1 : via FluanceAuth
      if (window.FluanceAuth) {
        isAuth = window.FluanceAuth.isAuthenticated();
        currentUser = window.FluanceAuth.getCurrentUser();
        console.log('[Protected Content] FluanceAuth check - isAuth:', isAuth, 'user:', currentUser ? currentUser.email : 'null');
      }
      
      // Méthode 2 : directement via firebase.auth() (fallback)
      if (!isAuth && typeof firebase !== 'undefined' && firebase.auth) {
        currentUser = firebase.auth().currentUser;
        isAuth = !!currentUser;
        console.log('[Protected Content] Firebase direct check - isAuth:', isAuth, 'user:', currentUser ? currentUser.email : 'null');
      }
      
      console.log('[Protected Content] Final auth check - isAuth:', isAuth, 'has FluanceAuth:', !!window.FluanceAuth);
      
      if (isAuth && window.FluanceAuth) {
        console.log('[Protected Content] User authenticated, loading content');
        window.FluanceAuth.displayProtectedContent(contentId, element).catch(function(err) {
          console.error('[Protected Content] Error loading content:', err);
          element.innerHTML = '<div class="bg-red-50 border border-red-200 rounded-lg p-4"><p class="text-red-800">Erreur lors du chargement du contenu : ' + (err.message || err) + '</p></div>';
        });
      } else {
        console.log('[Protected Content] User not authenticated, showing login message');
        var returnUrl = encodeURIComponent(window.location.pathname);
        element.innerHTML = '<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center"><p class="text-yellow-800 mb-4">Veuillez vous connecter pour accéder à ce contenu.</p><a href="/connexion-firebase?return=' + returnUrl + '" class="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">Se connecter</a></div>';
      }
    }
    
    // Vérifier immédiatement si un utilisateur est déjà connecté
    if (typeof firebase !== 'undefined' && firebase.auth) {
      var currentUser = firebase.auth().currentUser;
      console.log('[Protected Content] Immediate check - currentUser:', currentUser ? currentUser.email : 'null');
      if (currentUser) {
        console.log('[Protected Content] User already authenticated, loading immediately');
        checkAuthAndLoad();
        return;
      }
    }
    
    // Écouter les changements d'état d'authentification
    if (typeof firebase !== 'undefined' && firebase.auth) {
      console.log('[Protected Content] Setting up onAuthStateChanged listener');
      firebase.auth().onAuthStateChanged(function(user) {
        console.log('[Protected Content] Auth state changed:', user ? user.email : 'null');
        checkAuthAndLoad();
      });
      
      // Fallback après 500ms
      setTimeout(function() {
        console.log('[Protected Content] Fallback check after 500ms');
        checkAuthAndLoad();
      }, 500);
    } else {
      setTimeout(checkAuthAndLoad, 1000);
    }
  });
})();
</script>`;
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
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
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