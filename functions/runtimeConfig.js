/**
 * Dimensionnement des fonctions HTTP du hub leads/contact.
 *
 * Source de verite unique: ces valeurs sont utilisees a la fois par les
 * definitions `onRequest` de `blogLeadHub.js` et par
 * `scripts/verify-functions-runtime.mjs`, qui compare ce qui est REELLEMENT
 * deploye (API Cloud Functions v2) a ce qui est declare ici.
 *
 * Justification et mesures: docs/leads-architecture.md
 * (section "Dimensionnement des instances") et docs/leads-runbook.md.
 */

const HTTP_FUNCTION_RUNTIME = {
  captureLead: {
    // Le demarrage a froid depassait le defaut GCP de 256 MiB (pic 268 MiB):
    // un kill memoire peut tuer une requete en cours sans laisser d'evenement
    // dans journal_evenements_leads.
    memory: '512MiB',
    // Garde-fou de cout en cas de pic (plafond Cloud Run par defaut: 100).
    maxInstances: 20,
    // Trafic ~12 requetes/jour: une instance chaude couterait ~4.5 CHF/mois
    // pour economiser ~5 s de demarrage a froid.
    minInstances: 0,
  },
  sendContactEmail: {
    memory: '512MiB',
    maxInstances: 20,
    minInstances: 0,
  },
};

module.exports = {HTTP_FUNCTION_RUNTIME};
