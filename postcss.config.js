module.exports = {
  plugins: {
    // Tailwind v4 : Lightning CSS (minification + préfixes navigateurs) est activé
    // automatiquement quand NODE_ENV=production (cf. script "build:css").
    '@tailwindcss/postcss': {},
  },
}
