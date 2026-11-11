/** Configuration de l'audit SEO statique (voir scripts/seo-audit.mjs). */
export default {
  dist: '_site',
  site: 'https://fluance.io',
  sitemaps: ['sitemap.xml'],
  robots: 'robots.txt',
  redirects: '_site/_redirects',
  routeBaseline: 'scripts/seo-routes.json',
  // Interfaces techniques générées dans le build : elles ne sont ni indexables
  // ni rattachées au sitemap public.
  excludeRoutes: [],
  excludePrefixes: ['/emails/', '/agent/', '/.well-known/'],
  requireOpenGraph: true,
  requireXDefault: true,
  skipInternalLinks: false,
  report: 'seo-report.json',
};
