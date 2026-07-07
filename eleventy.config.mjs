import i18n from "eleventy-plugin-i18n";
import EleventyImage from "@11ty/eleventy-img";
import htmlmin from "html-minifier-next";
import fs from "fs";
import path from "path";
import mjml from "mjml";
import 'dotenv/config';

const PATH_PREFIX = process.env.ELEVENTY_ENV === 'prod' ? "" : "";

export default function (eleventyConfig) {

  eleventyConfig.addShortcode("responsiveImage", async function (src, alt, sizes = "100vw", cls = "", loading = "lazy", width = null, height = null) {
    if (alt === undefined) {
      throw new Error(`Missing \`alt\` on responsive image from: ${src}`);
    }

    let inputPath = src;
    if (src.startsWith('/assets/')) {
      inputPath = './src' + src;
    } else if (src.startsWith('assets/')) {
      inputPath = './src/' + src;
    }

    let metadata = await EleventyImage(inputPath, {
      widths: [150, 300, 450, 600, 750, 900, 1050, 1200, 1400, 1600],
      formats: ["avif", "webp", "jpeg"],
      outputDir: "./_site/assets/img/",
      urlPath: "/assets/img/",
      sharpWebpOptions: {
        quality: 55,
        smartSubsample: true
      },
      sharpAvifOptions: {
        quality: 35
      },
      sharpJpegOptions: {
        quality: 55
      }
    });

    let lowsrc = metadata.jpeg[0];
    let highsrc = metadata.jpeg[metadata.jpeg.length - 1];

    let imageAttributes = {
      alt,
      sizes,
      loading,
      decoding: loading === "eager" ? "sync" : "async",
      fetchpriority: loading === "eager" ? "high" : "auto",
    };

    if (cls) imageAttributes.class = cls;

    const aspectRatio = (highsrc.width / highsrc.height).toFixed(4);

    let inlineStyle = `aspect-ratio: ${aspectRatio}; width: 100%; height: auto;`;

    if (cls.includes('w-auto')) {
      inlineStyle = `aspect-ratio: ${aspectRatio}; width: auto;`;
    }
    else if (cls.includes('h-full')) {
      inlineStyle = `aspect-ratio: ${aspectRatio}; width: 100%; height: 100%;`;
    }

    imageAttributes.style = inlineStyle;

    let html = EleventyImage.generateHTML(metadata, imageAttributes);

    return html;
  });

  eleventyConfig.addShortcode("image", function (src, alt, cls = "", loading = "lazy", fetchpriority = "", width = "", height = "") {
    const cleanSrc = src.startsWith('/') ? src : `/${src}`;
    const fullSrc = PATH_PREFIX + cleanSrc;
    const loadingAttr = loading ? `loading="${loading}"` : '';
    const fetchpriorityAttr = fetchpriority ? `fetchpriority="${fetchpriority}"` : '';
    const widthAttr = width ? `width="${width}"` : '';
    const heightAttr = height ? `height="${height}"` : '';

    const isConvertibleImage = /\.(jpg|jpeg|png)$/i.test(cleanSrc);

    if (isConvertibleImage) {
      const webpSrc = cleanSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const webpFullSrc = PATH_PREFIX + webpSrc;

      const projectRoot = path.resolve(import.meta.dirname);
      const srcPath = path.join(projectRoot, 'src', cleanSrc.replace(/^\//, ''));
      const webpPath = srcPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const webpExists = fs.existsSync(webpPath);

      if (webpExists) {
        const sourceWidthAttr = width ? `width="${width}"` : '';
        const sourceHeightAttr = height ? `height="${height}"` : '';

        return `<picture>
          <source srcset="${webpFullSrc}" type="image/webp" ${sourceWidthAttr} ${sourceHeightAttr}>
          <img src="${fullSrc}" alt="${alt}" class="${cls}" ${loadingAttr} ${fetchpriorityAttr} ${widthAttr} ${heightAttr}>
        </picture>`;
      }
    }

    return `<img src="${fullSrc}" alt="${alt}" class="${cls}" ${loadingAttr} ${fetchpriorityAttr} ${widthAttr} ${heightAttr}>`;
  });

  eleventyConfig.addPlugin(i18n, {
    translations: {
      "welcome": { "en": "Welcome", "fr": "Bienvenue" }
    },
    defaultLanguage: "fr"
  });

  eleventyConfig.addFilter("date", function (value, format) {
    const date = value === "now" || !value ? new Date() : new Date(value);
    if (format === "yyyy") {
      return date.getFullYear().toString();
    }
    return date.toISOString();
  });

  eleventyConfig.addFilter("relativeUrl", function (url) {
    const cleanUrl = url.startsWith('/') ? url : '/' + url;
    return PATH_PREFIX ? PATH_PREFIX + cleanUrl : cleanUrl;
  });

  eleventyConfig.addFilter("buildOgImageUrl", function (imagePath) {
    if (!imagePath) imagePath = 'assets/img/fond-cedric.jpg';

    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    if (imagePath.startsWith('/')) {
      return 'https://fluance.io' + imagePath;
    }

    return 'https://fluance.io/' + imagePath;
  });

  eleventyConfig.addFilter("canonicalUrl", function (url) {
    if (!url || url === '.' || url === './') return '/';

    let normalized = url.startsWith('/') ? url : '/' + url;

    if (normalized === '/' || normalized === './' || normalized === '.') {
      return '/';
    }

    if (normalized === '/fr' || normalized === '/en') {
      normalized = normalized + '/';
    }

    normalized = normalized.replace(/\/+/g, '/');

    if (normalized === '/fr' || normalized === '/en') {
      normalized = normalized + '/';
    }

    return normalized;
  });

  eleventyConfig.addShortcode("protectedContent", function (contentId) {
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

  eleventyConfig.addShortcode("stripeConfig", function () {
    const stripeKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
    const escapedKey = stripeKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    return `<script>
  window.FLUANCE_STRIPE_CONFIG = {
    publishableKey: '${escapedKey}'
  };
</script>`;
  });

  eleventyConfig.addShortcode("firebaseConfig", function () {
    const config = {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || '',
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
    };

    return `<script>
  window.FLUANCE_FIREBASE_CONFIG = ${JSON.stringify(config)};
</script>`;
  });

  eleventyConfig.addShortcode("schemaOrg", function (locale) {
    const page = this.page || this.ctx?.page || {};
    const pageData = page.data || this.ctx || {};
    const pageLocale = locale || this.ctx?.locale || this.locale || 'fr';
    const baseUrl = 'https://fluance.io';
    const pageUrl = baseUrl + (page.url || '/');
    const schemas = [];

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
        "https://www.linkedin.com/company/fluance-consulting/",
        "https://cedricv.com"
      ],
      "founder": {
        "@type": "Person",
        "@id": "https://cedricv.com/#person",
        "name": "Cédric Vonlanthen",
        "url": "https://cedricv.com"
      }
    };
    schemas.push(organizationSchema);

    const websiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Fluance",
      "url": baseUrl,
      "inLanguage": pageLocale === 'fr' ? 'fr-FR' : 'en-US',
      "alternateName": pageLocale === 'fr' ? 'Fluance - Mouvement, souffle et jeu' : 'Fluance - Movement, breath and play'
    };
    schemas.push(websiteSchema);

    const personSchema = {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": "https://cedricv.com/#person",
      "name": "Cédric Vonlanthen",
      "jobTitle": pageLocale === 'fr' ? "Fondateur et facilitateur Fluance" : "Founder and Fluance facilitator",
      "worksFor": {
        "@type": "Organization",
        "name": "Fluance"
      },
      "url": "https://cedricv.com",
      "sameAs": [
        "https://cedricv.com",
        "https://instant-academie.com",
        "https://vie-explosive.fr",
        "https://www.techniquesdemeditation.com",
        "https://developpementpersonnel.org",
        "https://lapleineconscience.com",
        "https://www.youtube.com/@fluanceio",
        "https://www.instagram.com/fluanceio/"
      ],
      "knowsAbout": pageLocale === 'fr'
        ? [
          "Mouvement en conscience",
          "Bien-être corporel",
          "Respiration",
          "Méditation",
          "Gestion du stress",
          "Fluidité corps-esprit"
        ]
        : [
          "Conscious Movement",
          "Body Wellness",
          "Breathing",
          "Meditation",
          "Stress Management",
          "Body-Mind Fluidity"
        ]
    };
    schemas.push(personSchema);

    const pagePath = page.url || '';

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
          "url": baseUrl,
          "sameAs": baseUrl
        },
        "courseMode": "online",
        "inLanguage": pageLocale === 'fr' ? 'fr-FR' : 'en-US',
        "url": pageUrl,
        "teaches": pageLocale === 'fr'
          ? "Bien-être, mouvement, respiration, gestion du stress, mobilité corporelle"
          : "Wellness, movement, breathing, stress management, body mobility"
      };

      if (pagePath.includes('21-jours')) {
        courseSchema.name = pageLocale === 'fr' ? "Défi 21 jours" : "21-Day Challenge";
        courseSchema.description = pageLocale === 'fr'
          ? "Retrouvez légèreté, mobilité et sérénité en seulement 2 à 5 minutes par jour, durant 21 jours. Parcours de 21 mini-séries de pratiques simples et libératrices basées sur le mouvement, le souffle et le jeu."
          : "Find lightness, mobility and serenity in just 2 to 5 minutes a day, for 21 days. A 21-day journey of simple and liberating mini-practices based on movement, breath and play.";
        courseSchema.timeRequired = "PT5M";
        courseSchema.courseCode = "FLUANCE-21";
        courseSchema.educationalLevel = "beginner";
        courseSchema.image = `${baseUrl}/assets/img/bienvenue-21-jour-bandeau.jpg`;
        courseSchema.offers = {
          "@type": "Offer",
          "price": "19.00",
          "priceCurrency": "CHF",
          "availability": "https://schema.org/InStock",
          "url": pageUrl,
          "priceValidUntil": "2026-12-31"
        };

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
          "uploadDate": "2024-01-01T00:00:00+01:00",
          "contentUrl": "https://iframe.mediadelivery.net/embed/479894/86766f4f-3e65-4816-8946-ed75b39b4c96",
          "embedUrl": "https://iframe.mediadelivery.net/embed/479894/86766f4f-3e65-4816-8946-ed75b39b4c96",
          "duration": "PT5M",
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

      if (pagePath.includes('approche-fluance-complete')) {
        courseSchema.name = pageLocale === 'fr' ? "Approche Fluance Complète" : "Complete Fluance Approach";
        courseSchema.description = pageLocale === 'fr'
          ? "Accès complet à tous les cours et pratiques Fluance. Programme complet et régulier pour intégrer l'approche Fluance dans votre vie. Abonnement mensuel ou trimestriel."
          : "Full access to all Fluance courses and practices. Complete and regular program to integrate the Fluance approach into your life. Monthly or quarterly subscription.";
        courseSchema.courseCode = "FLUANCE-COMPLETE";
        courseSchema.educationalLevel = "all";
        courseSchema.image = `${baseUrl}/assets/img/cedric-bord-mer.jpg`;
        courseSchema.offers = [
          {
            "@type": "Offer",
            "name": pageLocale === 'fr' ? "Abonnement mensuel" : "Monthly subscription",
            "price": "30.00",
            "priceCurrency": "CHF",
            "availability": "https://schema.org/InStock",
            "url": pageUrl,
            "priceValidUntil": "2026-12-31",
            "billingIncrement": "P1M"
          },
          {
            "@type": "Offer",
            "name": pageLocale === 'fr' ? "Abonnement trimestriel" : "Quarterly subscription",
            "price": "75.00",
            "priceCurrency": "CHF",
            "availability": "https://schema.org/InStock",
            "url": pageUrl,
            "priceValidUntil": "2026-12-31",
            "billingIncrement": "P3M"
          }
        ];
      }

      schemas.push(courseSchema);
    }

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

    if (pagePath.includes('/presentiel/reserver')) {
      const yogaStudioSchema = {
        "@context": "https://schema.org",
        "@type": "YogaStudio",
        "name": pageLocale === 'fr' ? "Fluance - mouvements apaisants" : "Fluance - soothing movements",
        "description": pageLocale === 'fr'
          ? "Cours de bien-être en présentiel basés sur le mouvement, le souffle et le jeu à Fribourg"
          : "In-person wellness classes based on movement, breath and play in Fribourg",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Rte de Chantemerle 58d",
          "addressLocality": "Granges-Paccot",
          "addressRegion": "FR",
          "postalCode": "1763",
          "addressCountry": "CH"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": "46.8065",
          "longitude": "7.1619"
        },
        "url": pageUrl,
        "telephone": "+33972133388",
        "priceRange": "CHF 0 - CHF 340",
        "potentialAction": {
          "@type": "ReserveAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": pageUrl
          },
          "result": {
            "@type": "Reservation",
            "name": pageLocale === 'fr' ? "Réserver un cours" : "Book a class"
          }
        }
      };
      schemas.push(yogaStudioSchema);

      const eventMidiSchema = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": pageLocale === 'fr' ? "Cours Fluance - Jeudi midi" : "Fluance Class - Thursday noon",
        "description": pageLocale === 'fr'
          ? "Cours de bien-être Fluance le jeudi de 12h15 à 13h. Mouvements apaisants basés sur le mouvement, le souffle et le jeu."
          : "Fluance wellness class on Thursdays from 12:15 PM to 1:00 PM. Soothing movements based on movement, breath and play.",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "eventStatus": "https://schema.org/EventScheduled",
        "location": {
          "@type": "Place",
          "name": "le duplex danse & bien-être",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Rte de Chantemerle 58d",
            "addressLocality": "Granges-Paccot",
            "addressRegion": "FR",
            "postalCode": "1763",
            "addressCountry": "CH"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "46.8065",
            "longitude": "7.1619"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Fluance",
          "url": baseUrl
        },
        "offers": {
          "@type": "Offer",
          "price": "25",
          "priceCurrency": "CHF",
          "availability": "https://schema.org/InStock",
          "url": pageUrl,
          "validFrom": "2026-01-22"
        },
        "startDate": "2026-01-22T12:15:00+01:00",
        "endDate": "2026-01-22T13:00:00+01:00",
        "eventSchedule": {
          "@type": "Schedule",
          "repeatFrequency": "P1W",
          "byDay": "Thursday",
          "startTime": "12:15:00",
          "endTime": "13:00:00"
        }
      };
      schemas.push(eventMidiSchema);

      const eventSoirSchema = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": pageLocale === 'fr' ? "Cours Fluance - Jeudi soir" : "Fluance Class - Thursday evening",
        "description": pageLocale === 'fr'
          ? "Cours de bien-être Fluance le jeudi de 20h15 à 21h. Mouvements apaisants basés sur le mouvement, le souffle et le jeu."
          : "Fluance wellness class on Thursdays from 8:15 PM to 9:00 PM. Soothing movements based on movement, breath and play.",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "eventStatus": "https://schema.org/EventScheduled",
        "location": {
          "@type": "Place",
          "name": "le duplex danse & bien-être",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Rte de Chantemerle 58d",
            "addressLocality": "Granges-Paccot",
            "addressRegion": "FR",
            "postalCode": "1763",
            "addressCountry": "CH"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "46.8065",
            "longitude": "7.1619"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Fluance",
          "url": baseUrl
        },
        "offers": {
          "@type": "Offer",
          "price": "25",
          "priceCurrency": "CHF",
          "availability": "https://schema.org/InStock",
          "url": pageUrl,
          "validFrom": "2026-01-22"
        },
        "startDate": "2026-01-22T20:15:00+01:00",
        "endDate": "2026-01-22T21:00:00+01:00",
        "eventSchedule": {
          "@type": "Schedule",
          "repeatFrequency": "P1W",
          "byDay": "https://schema.org/Thursday",
          "startTime": "20:15:00",
          "endTime": "21:00:00"
        }
      };
      schemas.push(eventSoirSchema);
    }

    if (pagePath.includes('/a-propos/approche-fluance')) {
      const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": pageData.title || (pageLocale === 'fr' ? "L'approche Fluance" : "The Fluance Approach"),
        "description": pageData.description || (pageLocale === 'fr'
          ? "Découvrez l'approche globale de Fluance pour la fluidité corps et esprit. Le trépied de la vitalité : Mouvement, Souffle, Jeu."
          : "Discover Fluance's holistic approach for body and mind fluidity. The tripod of vitality: Movement, Breath, Play."),
        "author": {
          "@type": "Person",
          "name": "Cédric Vonlanthen"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Fluance",
          "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/assets/img/fond-cedric.jpg`
          }
        },
        "datePublished": "2024-01-01T00:00:00+01:00",
        "dateModified": "2024-01-01T00:00:00+01:00",
        "image": `${baseUrl}/assets/img/cedric-dehors-fluance-reduit.jpeg`,
        "inLanguage": pageLocale === 'fr' ? 'fr-FR' : 'en-US',
        "url": pageUrl,
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": pageUrl
        }
      };
      schemas.push(articleSchema);

      const videoSchema = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": pageLocale === 'fr'
          ? "L'approche Fluance - Présentation"
          : "The Fluance Approach - Presentation",
        "description": pageLocale === 'fr'
          ? "Présentation de l'approche Fluance basée sur le trépied de la vitalité : Mouvement, Souffle, Jeu. Une approche simple, ludique, naturelle et libératrice pour libérer le corps et l'esprit."
          : "Presentation of the Fluance approach based on the tripod of vitality: Movement, Breath, Play. A simple, playful, natural and liberating approach to free the body and mind.",
        "thumbnailUrl": `${baseUrl}/assets/img/cedric-dehors-fluance-reduit.jpeg`,
        "uploadDate": "2024-01-01T00:00:00+01:00",
        "contentUrl": "https://player.mediadelivery.net/embed/479894/d09798a7-faf4-4117-9b98-54edad2b7aec",
        "embedUrl": "https://player.mediadelivery.net/embed/479894/d09798a7-faf4-4117-9b98-54edad2b7aec",
        "duration": "PT5M",
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

    return schemas.map(schema => {
      const json = JSON.stringify(schema, null, 2);
      return `<script type="application/ld+json">\n${json}\n</script>`;
    }).join('\n');
  });

  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    if (process.env.ELEVENTY_ENV === 'prod' && outputPath && outputPath.endsWith(".html") && !outputPath.includes("/emails/")) {
      return htmlmin.minify(content, {
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: false,
      });
    }
    return content;
  });

  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/llms.txt");
  eleventyConfig.addPassthroughCopy("src/site.webmanifest");
  eleventyConfig.addPassthroughCopy({ "src/.well-known": ".well-known" });
  eleventyConfig.addPassthroughCopy({ "src/agent": "agent" });
  eleventyConfig.addPassthroughCopy({ "src/docs/api/openapi.json": "docs/api/openapi.json" });
  // Passthrough copies for GitHub Pages-specific files (CNAME, .nojekyll)
  // have been removed — Cloudflare Pages handles custom domains natively
  eleventyConfig.addPassthroughCopy({ "src/assets/img/favicon.ico": "favicon.ico" });

  eleventyConfig.addPairedShortcode("rawjs", function (content) {
    return content;
  });

  eleventyConfig.addTemplateFormats("mjml");
  eleventyConfig.addExtension("mjml", {
    outputFileExtension: "html",
    compile: async (inputContent, inputPath) => {
      const mjmlResult = mjml(inputContent, {
        minify: false,
        validationLevel: 'soft',
      });

      if (mjmlResult.errors && mjmlResult.errors.length > 0) {
        console.warn('MJML warnings for', inputPath, mjmlResult.errors);
      }

      return async (data) => {
        return mjmlResult.html;
      };
    },
  });

  eleventyConfig.on('eleventy.after', async () => {
    const emailTemplatesDir = path.join(import.meta.dirname, '_site', 'emails');
    const functionsEmailsDir = path.join(import.meta.dirname, 'functions', 'emails');
    const robotsMetaTag = '<meta name="robots" content="noindex, nofollow">';

    if (fs.existsSync(emailTemplatesDir)) {
      if (!fs.existsSync(functionsEmailsDir)) {
        fs.mkdirSync(functionsEmailsDir, { recursive: true });
      }

      const files = fs.readdirSync(emailTemplatesDir);
      files.forEach((file) => {
        if (file.endsWith('.html')) {
          const srcPath = path.join(emailTemplatesDir, file);
          const destPath = path.join(functionsEmailsDir, file);
          let html = fs.readFileSync(srcPath, 'utf8');

          if (!html.includes('name="robots"')) {
            html = html.replace('<head>', `<head>${robotsMetaTag}`);
            fs.writeFileSync(srcPath, html, 'utf8');
          }

          fs.writeFileSync(destPath, html, 'utf8');
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
