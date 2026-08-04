// Version de build pour casser le cache navigateur des assets (query ?v=...).
// Chaque déploiement change le hash git → les navigateurs re-téléchargent
// les CSS/JS à jour au lieu d'afficher une version périmée.
const { execSync } = require('child_process');

module.exports = (() => {
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    return hash || Date.now().toString(36);
  } catch (_e) {
    // Pas de dépôt git (build hors CI) : fallback timestamp
    return Date.now().toString(36);
  }
})();
