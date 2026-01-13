// eleventy.config.js
const i18n = require("eleventy-plugin-i18n");
const htmlmin = require("html-minifier-next"); // Le paquet sécurisé
const fs = require("fs");
const path = require("path");
const mjml = require("mjml");

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

  // 2d-bis. Filtre pour normaliser les URLs canoniques
  eleventyConfig.addFilter("canonicalUrl", function(url) {
    if (!url || url === '.' || url === './') return '/';
    
    // Normaliser l'URL : s'assurer qu'elle commence par /
    let normalized = url.startsWith('/') ? url : '/' + url;
    
    // Gérer les cas spéciaux
    if (normalized === '/' || normalized === './' || normalized === '.') {
      return '/';
    }
    
    // S'assurer que l'URL se termine par / pour les pages d'accueil
    if (normalized === '/fr' || normalized === '/en') {
      normalized = normalized + '/';
    }
    
    // Normaliser les doubles slashes (sauf après le protocole)
    normalized = normalized.replace(/\/+/g, '/');
    
    // S'assurer que les pages d'accueil se terminent par /
    if (normalized === '/fr' || normalized === '/en') {
      normalized = normalized + '/';
    }
    
    return normalized;
  });

  // 2e. Shortcode pour le contenu protégé
  // Le script JavaScript est dans un fichier externe (protected-content.js)
  // pour éviter les problèmes de minification HTML
  eleventyConfig.addShortcode("protectedContent", function(contentId) {
    // Échapper correctement le contentId pour l'attribut HTML
    const escapedContentIdAttr = contentId.replace(/"/g, '&quot;');
    
    return `<div class="protected-content" data-content-id="${escapedContentIdAttr}">
  <div class="bg-gray-100 rounded-lg p-8 text-center">
    <p class="text-gray-600 mb-4">Chargement du contenu protégé...</p>
    <div class="animate-pulse">
      <div class="h-4 bg-gray-300 rounded-sm w-3/4 mx-auto mb-2"></div>
      <div class="h-4 bg-gray-300 rounded-sm w-1/2 mx-auto"></div>
    </div>
  </div>
</div>`;
  });

  // 2f. Shortcode pour générer les schémas Schema.org JSON-LD
  eleventyConfig.addShortcode("schemaOrg", function(locale) {
    // Accéder au contexte Eleventy via 'this'
    const page = this.page || this.ctx?.page || {};
    const pageData = page.data || this.ctx || {};
    const pageLocale = locale || this.ctx?.locale || this.locale || 'fr';
    const baseUrl = 'https://fluance.io';
    const pageUrl = baseUrl + (page.url || '/');
    const schemas = [];

    // 1. Organization Schema (toujours présent)
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Fluance",
      "legalName": "Instants Zen Sàrl",
      "url": baseUrl,
      "logo": `${baseUrl}/assets/img/fond-cedric.jpg`,
      "foundingDate": "2020",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Case postale",
        "addressLocality": "Belfaux",
        "postalCode": "1782",
        "addressCountry": "CH"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+33972133388",
        "contactType": "customer service",
        "availableLanguage": ["French", "English"]
      },
      "sameAs": [
        "https://www.youtube.com/@fluanceio",
        "https://www.facebook.com/Fluanceio/",
        "https://www.instagram.com/fluanceio/",
        "https://ch.pinterest.com/fluanceio/",
        "https://x.com/fluanceio",
        "https://www.linkedin.com/company/fluance-consulting/"
      ]
    };
    schemas.push(organizationSchema);

    // 2. WebSite Schema avec SearchAction (toujours présent)
    const websiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Fluance",
      "url": baseUrl,
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${baseUrl}/?q={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      },
      "inLanguage": pageLocale === 'fr' ? 'fr-FR' : 'en-US',
      "alternateName": pageLocale === 'fr' ? 'Fluance - Mouvement, souffle et jeu' : 'Fluance - Movement, breath and play'
    };
    schemas.push(websiteSchema);

    // 3. Person Schema (Cédric Vonlanthen)
    const personSchema = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Cédric Vonlanthen",
      "jobTitle": pageLocale === 'fr' ? "Fondateur et facilitateur Fluance" : "Founder and Fluance facilitator",
      "worksFor": {
        "@type": "Organization",
        "name": "Fluance"
      },
      "url": `${baseUrl}${pageLocale === 'fr' ? '/a-propos/philosophie/' : '/en/a-propos/philosophie/'}`,
      "sameAs": [
        "https://www.youtube.com/@fluanceio",
        "https://www.instagram.com/fluanceio/"
      ]
    };
    schemas.push(personSchema);

    // 4. Schémas spécifiques selon le type de page
    const pagePath = page.url || '';
    
    // Page d'accueil
    if (pagePath === '/' || pagePath === '/fr/' || pagePath === '/en/') {
      const serviceSchema = {
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": pageLocale === 'fr' ? "Bien-être et développement personnel" : "Wellness and personal development",
        "provider": {
          "@type": "Organization",
          "name": "Fluance"
        },
        "areaServed": {
          "@type": "Country",
          "name": "Switzerland"
        },
        "description": pageLocale === 'fr' 
          ? "Fluance : libérez votre corps des tensions grâce à une approche simple basée sur le mouvement, le souffle et le jeu."
          : "Fluance: release tension from your body through a simple approach based on movement, breath and play.",
        "offers": [
          {
            "@type": "Offer",
            "name": pageLocale === 'fr' ? "Cours en ligne" : "Online courses",
            "url": `${baseUrl}${pageLocale === 'fr' ? '/cours-en-ligne/21-jours-mouvement/' : '/en/cours-en-ligne/21-jours-mouvement/'}`
          },
          {
            "@type": "Offer",
            "name": pageLocale === 'fr' ? "Cours en présentiel" : "In-person classes",
            "url": `${baseUrl}${pageLocale === 'fr' ? '/presentiel/cours-hebdomadaires/' : '/en/presentiel/cours-hebdomadaires/'}`
          }
        ]
      };
      schemas.push(serviceSchema);
    }

    // Pages de cours en ligne
    if (pagePath.includes('/cours-en-ligne/')) {
      let courseSchema = {
        "@context": "https://schema.org",
        "@type": "Course",
        "name": pageData.title || (pageLocale === 'fr' ? "Cours Fluance" : "Fluance Course"),
        "description": pageData.description || (pageLocale === 'fr' 
          ? "Cours de bien-être basé sur le mouvement, le souffle et le jeu"
          : "Wellness course based on movement, breath and play"),
        "provider": {
          "@type": "Organization",
          "name": "Fluance",
          "sameAs": baseUrl
        },
        "courseMode": "online",
        "inLanguage": pageLocale === 'fr' ? 'fr-FR' : 'en-US',
        "url": pageUrl
      };

      // Schéma spécifique pour le cours 21 jours
      if (pagePath.includes('21-jours')) {
        courseSchema.name = pageLocale === 'fr' ? "Défi 21 jours" : "21-Day Challenge";
        courseSchema.description = pageLocale === 'fr'
          ? "Retrouvez légèreté, mobilité et sérénité en seulement 2 à 5 minutes par jour, durant 21 jours."
          : "Find lightness, mobility and serenity in just 2 to 5 minutes a day, for 21 days.";
        courseSchema.timeRequired = "PT5M"; // 5 minutes
        courseSchema.offers = {
          "@type": "Offer",
          "price": "19.00",
          "priceCurrency": "CHF"
        };
        
        // Ajouter un schéma VideoObject pour la vidéo de présentation
        const videoSchema = {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          "name": pageLocale === 'fr' 
            ? "Fluance - 21 jours - vidéo de vente"
            : "Fluance - 21 days - sales video",
          "description": pageLocale === 'fr'
            ? "Je vous présente brièvement cette approche douce, brève et accessible pour libérer votre corps des tensions et apaiser votre esprit. Fluance s'adresse à celles et ceux qui ont déjà essayé de nombreuses approches, sans jamais trouver de méthode qui s'adapte vraiment à votre corps, à votre énergie, à votre rythme. Retrouvez légèreté, mobilité et sérénité en seulement 2 à 5 minutes par jour, durant 21 jours."
            : "I briefly present this gentle, brief and accessible approach to release your body from tension and calm your mind. Fluance is for those who have already tried many approaches, without ever finding a method that really adapts to your body, your energy, your rhythm. Find lightness, mobility and serenity in just 2 to 5 minutes a day, for 21 days.",
          "thumbnailUrl": `${baseUrl}/assets/img/bienvenue-21-jour-bandeau.jpg`,
          "uploadDate": "2024-01-01T00:00:00+01:00", // Format ISO 8601 avec fuseau horaire
          "contentUrl": "https://iframe.mediadelivery.net/embed/479894/86766f4f-3e65-4816-8946-ed75b39b4c96",
          "embedUrl": "https://iframe.mediadelivery.net/embed/479894/86766f4f-3e65-4816-8946-ed75b39b4c96",
          "duration": "PT5M", // Durée approximative
          "inLanguage": pageLocale === 'fr' ? 'fr-FR' : 'en-US',
          "publisher": {
            "@type": "Organization",
            "name": "Fluance",
            "logo": {
              "@type": "ImageObject",
              "url": `${baseUrl}/assets/img/fond-cedric.jpg`
            }
          }
        };
        schemas.push(videoSchema);
      }

      // Schéma spécifique pour l'approche complète
      if (pagePath.includes('approche-fluance-complete')) {
        courseSchema.name = pageLocale === 'fr' ? "Approche Fluance Complète" : "Complete Fluance Approach";
        courseSchema.description = pageLocale === 'fr'
          ? "Accès complet à tous les cours et pratiques. Abonnement mensuel ou trimestriel."
          : "Full access to all courses and practices. Monthly or quarterly subscription.";
        courseSchema.offers = [
          {
            "@type": "Offer",
            "name": pageLocale === 'fr' ? "Abonnement mensuel" : "Monthly subscription",
            "price": "30.00",
            "priceCurrency": "CHF",
            "billingIncrement": "P1M"
          },
          {
            "@type": "Offer",
            "name": pageLocale === 'fr' ? "Abonnement trimestriel" : "Quarterly subscription",
            "price": "75.00",
            "priceCurrency": "CHF",
            "billingIncrement": "P3M"
          }
        ];
      }

      schemas.push(courseSchema);
    }

    // Pages de cours en présentiel
    if (pagePath.includes('/presentiel/cours-hebdomadaires')) {
      const localBusinessSchema = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "Fluance - Cours en présentiel",
        "description": pageLocale === 'fr'
          ? "Cours de bien-être en présentiel à Fribourg, Suisse"
          : "In-person wellness classes in Fribourg, Switzerland",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Fribourg",
          "addressRegion": "FR",
          "postalCode": "1700",
          "addressCountry": "CH"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": "46.8065",
          "longitude": "7.1619"
        },
        "url": pageUrl,
        "telephone": "+33972133388",
        "priceRange": "CHF 25 - CHF 340"
      };
      schemas.push(localBusinessSchema);
    }

    // Générer les balises <script> pour chaque schéma
    return schemas.map(schema => {
      const json = JSON.stringify(schema, null, 2);
      return `<script type="application/ld+json">\n${json}\n</script>`;
    }).join('\n');
  });

  // 3. Minification HTML sécurisée
  eleventyConfig.addTransform("htmlmin", function(content, outputPath) {
    if (process.env.ELEVENTY_ENV === 'prod' && outputPath && outputPath.endsWith(".html")) {
      return htmlmin.minify(content, {
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: false, // Désactivé pour éviter les problèmes avec les scripts inline contenant du HTML
      });
    }
    return content;
  });

  // 4. Copie des assets statiques (images, etc.) — le CSS est généré dans _site par Tailwind
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/llms.txt");
  eleventyConfig.addPassthroughCopy("src/site.webmanifest");
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/.nojekyll": ".nojekyll" });
  // Copie de la favicon à la racine
  eleventyConfig.addPassthroughCopy({ "src/assets/img/favicon.ico": "favicon.ico" });
  
  // Shortcode pour préserver le code JavaScript sans interprétation des entités HTML
  eleventyConfig.addPairedShortcode("rawjs", function(content) {
    return content;
  });

  // 5. Support MJML pour les templates d'emails
  // Compiler les fichiers .mjml en HTML avec des placeholders Nunjucks
  eleventyConfig.addTemplateFormats("mjml");
  eleventyConfig.addExtension("mjml", {
    outputFileExtension: "html",
    compile: async (inputContent, inputPath) => {
      // Compiler MJML en HTML
      const mjmlResult = mjml(inputContent, {
        minify: false, // Garder le HTML lisible pour le remplacement de variables
        validationLevel: 'soft', // Permettre quelques warnings
      });

      if (mjmlResult.errors && mjmlResult.errors.length > 0) {
        console.warn('MJML warnings for', inputPath, mjmlResult.errors);
      }

      // Retourner la fonction de compilation qui sera appelée avec les données
      return async (data) => {
        // Le HTML compilé contient déjà les placeholders Nunjucks
        // Eleventy les remplacera automatiquement
        return mjmlResult.html;
      };
    },
  });

  // Copier les templates d'emails compilés vers functions/emails pour utilisation par Cloud Functions
  eleventyConfig.on('eleventy.after', async () => {
    const emailTemplatesDir = path.join(__dirname, '_site', 'emails');
    const functionsEmailsDir = path.join(__dirname, 'functions', 'emails');
    
    if (fs.existsSync(emailTemplatesDir)) {
      // Créer le dossier functions/emails s'il n'existe pas
      if (!fs.existsSync(functionsEmailsDir)) {
        fs.mkdirSync(functionsEmailsDir, { recursive: true });
      }
      
      // Copier tous les fichiers HTML d'emails
      const files = fs.readdirSync(emailTemplatesDir);
      files.forEach((file) => {
        if (file.endsWith('.html')) {
          const srcPath = path.join(emailTemplatesDir, file);
          const destPath = path.join(functionsEmailsDir, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`📧 Copied email template: ${file}`);
        }
      });
    }
  });
  
  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: PATH_PREFIX + "/"
  };
};