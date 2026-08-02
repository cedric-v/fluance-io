#!/usr/bin/env node
/**
 * Convertit src/assets/js/firebase-auth.njk en module ES propre :
 * src/assets/js/firebase-auth.mjs
 *
 * Transformations :
 *  1. Suppression du frontmatter Eleventy (permalink)
 *  2. Config Firebase : plus d'injection Nunjucks {{ env.* }} —
 *     lecture exclusive de window.FLUANCE_FIREBASE_CONFIG (injecté par base.njk)
 *  3. Garde-fou si la config est absente (log clair, pas de crash)
 *  4. Suppression du doublon mort de ensureFunctionsLoaded (1ère définition
 *     écrasée par la 2nde dans le script classique d'origine)
 *  5. Ajout des exports nommés + compat globale window.FluanceAuth / getRememberChoice
 */
import fs from 'node:fs';

const srcPath = new URL('../src/assets/js/firebase-auth.njk', import.meta.url);
const outPath = new URL('../src/assets/js/firebase-auth.mjs', import.meta.url);

let code = fs.readFileSync(srcPath, 'utf8');

// 1. Frontmatter
code = code.replace(/^---\r?\npermalink: \/assets\/js\/firebase-auth\.js\r?\n---\r?\n/, '');

// 2. Config Firebase (bloc injecté par Nunjucks -> lecture du global)
const configBlock = `// Configuration Firebase pour fluance-protected-content
// Injectée via variables d'environnement
var firebaseConfig = window.FLUANCE_FIREBASE_CONFIG || {
  apiKey: "{{ env.FIREBASE_API_KEY }}",
  authDomain: "{{ env.FIREBASE_AUTH_DOMAIN }}",
  projectId: "{{ env.FIREBASE_PROJECT_ID }}",
  storageBucket: "{{ env.FIREBASE_STORAGE_BUCKET }}",
  messagingSenderId: "{{ env.FIREBASE_MESSAGING_SENDER_ID }}",
  appId: "{{ env.FIREBASE_APP_ID }}",
  measurementId: "{{ env.FIREBASE_MEASUREMENT_ID }}"
};
// Stocker globalement pour les prochains chargements éventuels
window.firebaseConfig = firebaseConfig;`;

const newConfigBlock = `// Configuration Firebase, injectée globalement par base.njk (shortcode \`firebaseConfig\`).
// Plus aucune substitution de template dans ce fichier : c'est un module ES pur.
const firebaseConfig = window.FLUANCE_FIREBASE_CONFIG || null;

if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error(
    '[FluanceAuth] Configuration Firebase manquante : window.FLUANCE_FIREBASE_CONFIG n\\'est pas défini. ' +
    'Vérifiez que base.njk injecte la configuration (shortcode firebaseConfig).'
  );
}

// Stocker globalement pour les prochains chargements éventuels
window.firebaseConfig = firebaseConfig;`;

if (!code.includes(configBlock)) {
  console.error('Bloc de configuration introuvable — conversion annulée.');
  process.exit(1);
}
code = code.replace(configBlock, newConfigBlock);

// 3. Garde-fous d'initialisation (config absente -> pas de crash)
code = code.split('firebase.initializeApp(firebaseConfig);').join('if (firebaseConfig) firebase.initializeApp(firebaseConfig);');

const initAuthHead = `function initAuth() {
  // Vérifier que firebase.auth est disponible`;
const initAuthGuarded = `function initAuth() {
  if (!firebaseConfig || !firebase.apps?.length) {
    console.error('[FluanceAuth] Firebase non initialisé (configuration manquante).');
    return;
  }
  // Vérifier que firebase.auth est disponible`;
if (!code.includes(initAuthHead)) {
  console.error('Signature de initAuth() introuvable — conversion annulée.');
  process.exit(1);
}
code = code.replace(initAuthHead, initAuthGuarded);

// 4. Doublon mort de ensureFunctionsLoaded (la 1ère définition async est écrasée
//    par la 2nde `function ensureFunctionsLoaded()` plus bas, qui gagne en JS).
const deadDuplicate = `/**
 * S'assure que le module Firebase Functions est chargé
 */
async function ensureFunctionsLoaded() {
  if (typeof firebase.functions === 'function') return;

  console.log('[Firebase Auth] Chargement du script Firebase Functions...');
  const functionsScript = document.createElement('script');
  functionsScript.src = 'https://www.gstatic.com/firebasejs/12.8.0/firebase-functions-compat.js';
  document.head.appendChild(functionsScript);

  await new Promise((resolve, reject) => {
    functionsScript.onload = resolve;
    functionsScript.onerror = () => reject(new Error('Erreur chargement Firebase Functions'));
  });
  
  // Attendre l'initialisation
  await new Promise(resolve => setTimeout(resolve, 500));
}
`;
if (!code.includes(deadDuplicate)) {
  console.error('Doublon mort de ensureFunctionsLoaded introuvable — conversion annulée.');
  process.exit(1);
}
code = code.replace(deadDuplicate, `// NB: il existait une 1ère définition (async) de ensureFunctionsLoaded,
// écrasée silencieusement par celle-ci (dernière déclaration gagnante en JS).
// Elle a été supprimée : seule la version ci-dessous est utilisée.

`);

// 5. Exports
const exportsBlock = `

/**
 * API publique : exports nommés + compat globale (scripts inline classiques).
 */
export const FluanceAuth = {
  signIn,
  signOut,
  sendSignInLink,
  handleSignInLink,
  verifyTokenAndCreateAccount,
  loadProtectedContent,
  displayProtectedContent,
  getCurrentUser,
  isAuthenticated,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  // Fonctions passkey
  isWebAuthnSupported,
  createAccountWithPasskey,
  signInWithPasskey,
  linkPasskeyToAccount
};

export {
  signIn,
  signOut,
  sendSignInLink,
  handleSignInLink,
  verifyTokenAndCreateAccount,
  loadProtectedContent,
  displayProtectedContent,
  getCurrentUser,
  isAuthenticated,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  isWebAuthnSupported,
  createAccountWithPasskey,
  signInWithPasskey,
  linkPasskeyToAccount,
  getRememberChoice,
  saveRememberChoice
};

// Compat rétro : les pages utilisent window.FluanceAuth et window.getRememberChoice
// depuis des scripts classiques (non modules). On les expose donc aussi globalement.
window.FluanceAuth = FluanceAuth;
window.getRememberChoice = getRememberChoice;
`;

// Remplacer le bloc d'exposition global d'origine par les exports + compat
const legacyExport = `// Exporter les fonctions pour utilisation globale
window.FluanceAuth = {
  signIn,
  signOut,
  sendSignInLink,
  handleSignInLink,
  verifyTokenAndCreateAccount,
  loadProtectedContent,
  displayProtectedContent,
  getCurrentUser,
  isAuthenticated,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  // Fonctions passkey
  isWebAuthnSupported,
  createAccountWithPasskey,
  signInWithPasskey,
  linkPasskeyToAccount
};`;
if (!code.includes(legacyExport)) {
  console.error("Bloc d'export d'origine introuvable — conversion annulée.");
  process.exit(1);
}
code = code.replace(legacyExport, exportsBlock);

// En-tête du module
const header = `/**
 * FluanceAuth — Module ES d'authentification & accès au contenu protégé (Fluance).
 *
 * Chargement : <script type="module" src="/assets/js/firebase-auth.mjs"></script>
 * Prérequis   : window.FLUANCE_FIREBASE_CONFIG injecté par base.njk (shortcode firebaseConfig).
 *
 * Le module expose :
 *   - des exports nommés (signIn, loadProtectedContent, …) pour un usage en ESM ;
 *   - window.FluanceAuth (compat scripts classiques des pages) ;
 *   - window.getRememberChoice / window.firebaseConfig (compat).
 */

`;
code = header + code.trimEnd() + '\n';

fs.writeFileSync(outPath, code, 'utf8');
console.log(`OK → ${outPath}\n(${code.split('\n').length} lignes)`);
