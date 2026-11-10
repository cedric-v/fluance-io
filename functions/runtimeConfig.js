/**
 * Dimensionnement des fonctions Cloud Run (Cloud Functions v2).
 *
 * Source de verite unique: ces valeurs sont utilisees a la fois par les
 * definitions `onRequest` / `onSchedule` des fonctions et par
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
  // API de reservation (liste des cours): 18 OOM "Memory limit of 256 MiB
  // exceeded" sur 30 jours (27/10: 7, 3/11: 5, 9/11: 6). Chaque OOM tue la
  // reponse HTTP au lieu de renvoyer la liste des cours.
  getAvailableCourses: {
    memory: '512MiB',
    maxInstances: 20,
    minInstances: 0,
  },
  // Fonctions HTTP secondaires: OOM ponctuels (1 a 3 par mois) au demarrage a
  // froid, sur des pics de memoire identiques (chargement de firebase-admin
  // + googleapis). Meme remede que le hub: 512 MiB.
  getProtectedContent: {
    memory: '512MiB',
    maxInstances: 20,
    minInstances: 0,
  },
  getNotificationPrefs: {
    memory: '512MiB',
    maxInstances: 20,
    minInstances: 0,
  },
  confirmNewsletterOptIn: {
    memory: '512MiB',
    maxInstances: 20,
    minInstances: 0,
  },
  sendSignInLinkViaMailjet: {
    memory: '512MiB',
    maxInstances: 20,
    minInstances: 0,
  },
  apiStatus: {
    memory: '512MiB',
    maxInstances: 20,
    minInstances: 0,
  },
  webhookStripe: {
    memory: '512MiB',
    maxInstances: 20,
    minInstances: 0,
  },
};

/**
 * Dimensionnement des fonctions PLANIFIEES (`onSchedule`).
 *
 * Memoire: 512 MiB (au lieu du defaut GCP 256 Mi). Le runtime Node charge
 * firebase-admin + googleapis : ~260 Mi des le demarrage a froid, soit
 * AU-DESSUS du plafond de 256 Mi. Resultat observe du 3 au 10 novembre 2026 :
 * `Memory limit of 256 MiB exceeded` puis `The request failed because the
 * instance failed the readiness check` -> le tick planifie echoue completement.
 *
 * Compteur des OOM sur 30 jours (avant correction):
 *   sendBlogLeadOpsAlerts   ~46/jour (ticks de 30 min: quasi 100 % des runs)
 *   syncPlanning             ~23/jour (ticks horaires)
 *   sendCartAbandonmentEmails ~12/jour (ticks de 2 h)
 *   sendNewContentEmails      1/jour
 *   + 1 tick par jour pour les 9 autres fonctions planifiees
 *
 * maxInstances: 1 -> Cloud Scheduler declenche une requete a la fois, une
 * seule instance suffit (et evite deux ticks concurrents sur la meme
 * fonction). minInstances: 0 -> aucun cout au repos.
 */
const SCHEDULED_FUNCTION_RUNTIME = {
  memory: '512MiB',
  minInstances: 0,
  maxInstances: 1,
};

module.exports = {HTTP_FUNCTION_RUNTIME, SCHEDULED_FUNCTION_RUNTIME};
