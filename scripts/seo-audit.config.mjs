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
  /**
   * Gravité des contrôles réglables (voir tools/seo-guard) : `fail`, `warn` ou
   * `off`. Les défauts bloquants sont les doublons de titre/description et les
   * H1 multiples — ce sont des signaux d'auto-génération, pas des détails.
   */
  severity: {
    // Le JSON-LD Person pointe volontairement vers cedricv.com (auteur).
    jsonLdForeignUrl: 'off',
  },
  /**
   * Vérifie que la copie vendue de seo-guard n'a pas été éditée localement.
   * `fail` = garde-fou ; `off` pour un dépôt qui assume un fork.
   */
  vendorGuard: 'fail',
  report: 'seo-report.json',
};
