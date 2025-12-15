/**
 * Firebase Authentication pour Fluance
 * Gère l'authentification et l'accès au contenu protégé
 */

// Configuration Firebase pour fluance-protected-content
// ⚠️ IMPORTANT : Remplacez ces valeurs par celles de votre projet Firebase
// Voir OBTENIR_CONFIGURATION_FIREBASE.md pour obtenir les vraies clés
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Utiliser var et réutiliser si déjà présent pour éviter les doublons si le script est injecté deux fois
var firebaseConfig = window.firebaseConfig || {
  apiKey: "AIzaSyDJ-VlDMC5PUEMeILLZ8OmdYIhvhxIfhdM",
  authDomain: "fluance-protected-content.firebaseapp.com",
  projectId: "fluance-protected-content",
  storageBucket: "fluance-protected-content.firebasestorage.app",
  messagingSenderId: "173938686776",
  appId: "1:173938686776:web:891caf76098a42c3579fcd",
  measurementId: "G-CWPNXDQEYR"
};
// Stocker globalement pour les prochains chargements éventuels
window.firebaseConfig = firebaseConfig;

// Initialiser Firebase (compat mode pour compatibilité avec l'existant)
if (typeof firebase === 'undefined') {
  // Charger Firebase SDK si pas déjà chargé
  const script1 = document.createElement('script');
  script1.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js';
  document.head.appendChild(script1);
  
  script1.onload = () => {
    const script2 = document.createElement('script');
    script2.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth-compat.js';
    document.head.appendChild(script2);
    
    script2.onload = () => {
      const script3 = document.createElement('script');
      script3.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore-compat.js';
      document.head.appendChild(script3);
      
      script3.onload = () => {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        // Attendre un peu pour s'assurer que tous les modules sont prêts
        setTimeout(() => {
          initAuth();
        }, 100);
      };
    };
  };
} else {
  // Vérifier que firebase.auth est disponible
  if (typeof firebase.auth === 'function') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    initAuth();
  } else {
    // Firebase est chargé mais auth n'est pas disponible, attendre un peu
    const checkAuth = setInterval(() => {
      if (typeof firebase.auth === 'function') {
        clearInterval(checkAuth);
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        initAuth();
      }
    }, 100);
    
    // Timeout après 5 secondes
    setTimeout(() => {
      clearInterval(checkAuth);
      if (typeof firebase.auth !== 'function') {
        console.error('Firebase Auth n\'a pas pu être chargé');
      }
    }, 5000);
  }
}

let auth, db;
const REMEMBER_STORAGE_KEY = 'fluance_remember_me';

function getRememberChoice(defaultValue = false) {
  try {
    const stored = window.localStorage.getItem(REMEMBER_STORAGE_KEY);
    if (stored === 'local') return true;
    if (stored === 'session') return false;
  } catch (_e) {
    // Ignore storage errors and fall back to default
  }
  return defaultValue;
}

function saveRememberChoice(remember) {
  try {
    window.localStorage.setItem(REMEMBER_STORAGE_KEY, remember ? 'local' : 'session');
  } catch (_e) {
    // Ignore storage errors (private browsing, etc.)
  }
}

async function applyAuthPersistence(remember) {
  if (!auth || !auth.setPersistence || !firebase?.auth?.Auth?.Persistence) return;
  const target = remember
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;
  try {
    await auth.setPersistence(target);
  } catch (err) {
    console.warn('Error setting auth persistence:', err);
  }
}

function initAuth() {
  // Vérifier que firebase.auth est disponible
  if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
    console.error('Firebase Auth n\'est pas disponible. Réessayez dans quelques instants.');
    // Réessayer après un court délai
    setTimeout(() => {
      if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') {
        initAuth();
      }
    }, 500);
    return;
  }
  
  auth = firebase.auth();
  db = firebase.firestore();
  
  // Configurer la persistance selon le choix utilisateur (par défaut: rester connecté)
  if (auth.setPersistence && firebase?.auth?.Auth?.Persistence) {
    const remember = getRememberChoice(false);
    const target = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    auth.setPersistence(target).catch(err => {
      console.warn('Error setting auth persistence:', err);
    });
  }
  
  // Écouter les changements d'état d'authentification
  auth.onAuthStateChanged((user) => {
    if (user) {
      // Utilisateur connecté
      updateUIForAuthenticatedUser(user);
      // Ne charger le contenu protégé que si on est sur une page qui en a besoin
      // (évite les erreurs inutiles sur la page de création de compte)
      if (document.querySelector('.protected-content[data-content-id]')) {
        loadProtectedContent().catch(err => {
          // Ignorer silencieusement les erreurs d'index en construction
          if (err.code !== 'failed-precondition' || 
              !err.message?.includes('index is currently building')) {
            console.error('Error loading protected content:', err);
          }
        });
      }
    } else {
      // Utilisateur déconnecté
      updateUIForUnauthenticatedUser();
    }
  });
}

/**
 * Vérifie un token et crée le compte
 */
async function verifyTokenAndCreateAccount(token, password, email = null) {
  try {
    // S'assurer que Firebase est initialisé
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
      return { success: false, error: 'Firebase non initialisé. Veuillez recharger la page.' };
    }

    // S'assurer que auth est initialisé
    if (!auth) {
      auth = firebase.auth();
    }

    // Initialiser Firebase Functions si nécessaire
    if (!firebase.functions) {
      const functionsScript = document.createElement('script');
      functionsScript.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';
      document.head.appendChild(functionsScript);
      await new Promise((resolve) => {
        functionsScript.onload = resolve;
      });
    }

    // Spécifier la région europe-west1 où la fonction est déployée
    // Dans la version compat, on utilise firebase.app().functions('region')
    const app = firebase.app();
    const functions = app.functions('europe-west1');
    const verifyTokenFunction = functions.httpsCallable('verifyToken');
    const result = await verifyTokenFunction({ token, password });
    
    console.log('verifyToken result:', result);
    
    if (result.data.success) {
      // Utiliser l'email retourné par la fonction ou celui fourni
      const userEmail = result.data.email || email;
      
      if (!userEmail) {
        return { success: false, error: 'Email non disponible. Veuillez vous connecter manuellement.' };
      }

      console.log('Signing in with email:', userEmail);
      
      const remember = getRememberChoice(false);
      await applyAuthPersistence(remember);
      saveRememberChoice(remember);
      
      // Connecter l'utilisateur automatiquement
      const userCredential = await auth.signInWithEmailAndPassword(userEmail, password);
      
      console.log('Sign in successful, user:', userCredential.user.email);
      
      // Attendre que l'état d'authentification soit confirmé via onAuthStateChanged
      // Cela garantit que l'authentification est persistée avant de rediriger
      await new Promise((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            unsubscribe();
            console.warn('Timeout waiting for auth state, but user is signed in');
            resolve(); // Resolve anyway since signInWithEmailAndPassword succeeded
          }
        }, 3000);
        
        const unsubscribe = auth.onAuthStateChanged((user) => {
          if (user && user.email === userEmail && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            unsubscribe();
            console.log('Auth state confirmed, user persisted:', user.email);
            resolve();
          }
        });
      });
      
      return { success: true, user: userCredential.user };
    }
    
    return { success: false, error: 'Erreur lors de la création du compte' };
  } catch (error) {
    console.error('Error verifying token:', error);
    // Extraire le message d'erreur Firebase
    const errorMessage = error.message || error.code || 'Une erreur est survenue';
    return { success: false, error: errorMessage };
  }
}

/**
 * Connexion avec email et mot de passe
 */
async function signIn(email, password, remember = true) {
  try {
    await applyAuthPersistence(remember);
    saveRememberChoice(remember);
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Sign in error:', error);
    const errorMessage = getErrorMessage(error.code);
    return { 
      success: false, 
      error: errorMessage,
      errorCode: error.code,
      // Ajouter des suggestions spécifiques selon le type d'erreur
      suggestion: error.code === 'auth/user-not-found' 
        ? 'Vérifiez que l\'email est correct ou créez un compte si vous n\'en avez pas encore.'
        : error.code === 'auth/wrong-password'
        ? 'Si vous avez oublié votre mot de passe, utilisez le lien "Mot de passe oublié" ci-dessous.'
        : error.code === 'auth/too-many-requests'
        ? 'Attendez quelques minutes avant de réessayer. Pour votre sécurité, les tentatives sont temporairement limitées.'
        : 'Vérifiez vos identifiants et réessayez. Si le problème persiste, contactez le support.'
    };
  }
}

/**
 * Envoie un lien de connexion par email (passwordless)
 */
async function sendSignInLink(email, actionCodeSettings = null) {
  console.log('[Firebase Auth] ===== sendSignInLink appelée =====');
  console.log('[Firebase Auth] Email reçu:', email);
  console.log('[Firebase Auth] actionCodeSettings:', actionCodeSettings);
  
  try {
    // Vérifier que auth est initialisé
    if (!auth) {
      console.log('[Firebase Auth] auth non initialisé, initialisation...');
      auth = firebase.auth();
    } else {
      console.log('[Firebase Auth] auth déjà initialisé');
    }
    
    // Configuration par défaut : lien valide pour cette page
    const defaultSettings = {
      url: window.location.hostname === 'fluance.io' 
        ? 'https://fluance.io/connexion-membre' 
        : window.location.origin + '/connexion-membre',
      handleCodeInApp: true
    };
    
    const settings = actionCodeSettings || defaultSettings;
    
    console.log('[Firebase Auth] Envoi du lien de connexion à:', email);
    console.log('[Firebase Auth] Paramètres:', settings);
    console.log('[Firebase Auth] URL complète:', settings.url);
    console.log('[Firebase Auth] handleCodeInApp:', settings.handleCodeInApp);
    
    // Essayer d'abord Mailjet (meilleure délivrabilité), puis Firebase Auth en fallback
    console.log('[Firebase Auth] Tentative d\'envoi via Mailjet (méthode principale)...');
    
    try {
      // Charger Firebase Functions si nécessaire
      let app;
      try {
        app = firebase.app();
      } catch (appError) {
        throw new Error('Impossible d\'obtenir l\'app Firebase: ' + appError.message);
      }
      
      // Vérifier si le script Functions est déjà chargé
      let functionsScript = document.querySelector('script[src*="firebase-functions-compat"]');
      
      if (!functionsScript) {
        // Charger le script Firebase Functions
        functionsScript = document.createElement('script');
        functionsScript.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';
        document.head.appendChild(functionsScript);
        
        // Attendre que le script se charge
        await new Promise((resolve, reject) => {
          let timeoutId;
          functionsScript.onload = () => {
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          };
          functionsScript.onerror = () => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(new Error('Erreur lors du chargement de Firebase Functions'));
          };
          timeoutId = setTimeout(() => {
            reject(new Error('Timeout lors du chargement de Firebase Functions'));
          }, 10000);
        });
        
        // Attendre un peu pour que Functions soit initialisé
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Vérifier que app.functions est disponible
      if (typeof app.functions !== 'function') {
        throw new Error('Firebase Functions n\'est pas disponible après chargement du script');
      }
      
      // Appeler la fonction Firebase qui envoie via Mailjet
      const functions = app.functions('europe-west1');
      const sendSignInLinkViaMailjet = functions.httpsCallable('sendSignInLinkViaMailjet');
      
      console.log('[Firebase Auth] Appel de sendSignInLinkViaMailjet...');
      const result = await sendSignInLinkViaMailjet({email: email.toLowerCase().trim()});
      
      if (result.data && result.data.success) {
        console.log('[Firebase Auth] ✅ Lien de connexion envoyé via Mailjet');
        return { success: true, message: 'Lien de connexion envoyé avec succès. Vérifiez votre boîte de réception.' };
      } else {
        throw new Error(result.data?.error || 'Erreur lors de l\'envoi via Mailjet');
      }
    } catch (mailjetError) {
      console.warn('[Firebase Auth] ⚠️ Mailjet a échoué, tentative avec Firebase Auth (fallback)');
      console.warn('[Firebase Auth] Erreur Mailjet:', mailjetError.message);
      
      // Fallback sur Firebase Auth
      console.log('[Firebase Auth] Appel de auth.sendSignInLinkToEmail (fallback)...');
      await auth.sendSignInLinkToEmail(email, settings);
      
      console.log('[Firebase Auth] ✅ Lien de connexion envoyé via Firebase Auth (fallback)');
      return { success: true, message: 'Lien de connexion envoyé avec succès. Vérifiez votre boîte de réception.' };
    }
  } catch (error) {
    console.error('[Firebase Auth] ❌ ERREUR lors de l\'envoi du lien');
    console.error('[Firebase Auth] Erreur complète:', error);
    console.error('[Firebase Auth] Code d\'erreur:', error.code);
    console.error('[Firebase Auth] Message d\'erreur:', error.message);
    
    // Messages d'erreur plus détaillés
    let errorMessage = getErrorMessage(error.code);
    
    // Ajouter des informations supplémentaires pour le débogage
    if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email invalide. Vérifiez que l\'email est correct.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'Ce compte a été désactivé. Contactez le support.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Trop de tentatives. Veuillez réessayer plus tard.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'La connexion par email n\'est pas activée. Vérifiez la configuration Firebase.';
    }
    
    return { success: false, error: errorMessage, code: error.code };
  }
}

/**
 * Envoie un email de réinitialisation de mot de passe
 */
async function sendPasswordResetEmail(email) {
  try {
    console.log('[Firebase Auth] ===== sendPasswordResetEmail appelée =====');
    console.log('[Firebase Auth] Email reçu:', email);
    
    if (!auth) {
      console.log('[Firebase Auth] auth non initialisé, initialisation...');
      auth = firebase.auth();
    } else {
      console.log('[Firebase Auth] auth déjà initialisé');
    }

    // Détecter la langue depuis l'URL ou le chemin
    const isEnglish = window.location.pathname.startsWith('/en/');
    const loginPath = isEnglish ? '/en/member-login' : '/connexion-membre';

    // Configuration pour le lien de réinitialisation
    // L'URL pointe vers la page de connexion, qui redirigera vers la page de réinitialisation si un code est présent
    // Utiliser fluance.io explicitement pour garantir la bonne URL
    const baseUrl = window.location.hostname === 'fluance.io' 
      ? 'https://fluance.io' 
      : window.location.origin;
    
    const actionCodeSettings = {
      url: baseUrl + loginPath,
      handleCodeInApp: true
    };

    console.log('[Firebase Auth] Configuration du lien de réinitialisation:');
    console.log('[Firebase Auth]   URL:', actionCodeSettings.url);
    console.log('[Firebase Auth]   handleCodeInApp:', actionCodeSettings.handleCodeInApp);
    console.log('[Firebase Auth]   Origin:', window.location.origin);

    // Essayer d'abord Mailjet (meilleure délivrabilité), puis Firebase Auth en fallback
    console.log('[Firebase Auth] Tentative d\'envoi via Mailjet (méthode principale)...');
    
    try {
      console.log('[Firebase Auth] Début du bloc Mailjet...');
      // Charger Firebase Functions si nécessaire
      let app;
      try {
        app = firebase.app();
        console.log('[Firebase Auth] App Firebase obtenue:', app);
      } catch (appError) {
        console.error('[Firebase Auth] Erreur lors de l\'obtention de l\'app Firebase:', appError);
        throw new Error('Impossible d\'obtenir l\'app Firebase: ' + appError.message);
      }
      
      console.log('[Firebase Auth] app.functions type:', typeof app.functions);
      
      // Vérifier si le script Functions est déjà chargé
      let functionsScript = document.querySelector('script[src*="firebase-functions-compat"]');
      console.log('[Firebase Auth] Script Functions déjà présent:', !!functionsScript);
      
      if (!functionsScript) {
        console.log('[Firebase Auth] Chargement du script Firebase Functions...');
        // Charger le script Firebase Functions
        functionsScript = document.createElement('script');
        functionsScript.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';
        document.head.appendChild(functionsScript);
        
        // Attendre que le script se charge
        await new Promise((resolve, reject) => {
          let timeoutId;
          functionsScript.onload = () => {
            console.log('[Firebase Auth] Script Functions chargé');
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          };
          functionsScript.onerror = () => {
            console.error('[Firebase Auth] Erreur lors du chargement du script Functions');
            if (timeoutId) clearTimeout(timeoutId);
            reject(new Error('Erreur lors du chargement de Firebase Functions'));
          };
          timeoutId = setTimeout(() => {
            console.error('[Firebase Auth] Timeout lors du chargement du script Functions');
            reject(new Error('Timeout lors du chargement de Firebase Functions'));
          }, 10000);
        });
        
        // Attendre un peu pour que Functions soit initialisé
        console.log('[Firebase Auth] Attente de l\'initialisation de Functions...');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('[Firebase Auth] app.functions après chargement:', typeof app.functions);
      } else {
        console.log('[Firebase Auth] Script Functions déjà chargé, app.functions:', typeof app.functions);
      }
      
      // Vérifier que app.functions est disponible
      if (typeof app.functions !== 'function') {
        console.error('[Firebase Auth] app.functions n\'est pas une fonction, type:', typeof app.functions);
        throw new Error('Firebase Functions n\'est pas disponible après chargement du script');
      }
      
      // Appeler la fonction Firebase qui envoie via Mailjet
      // La fonction est dans la région europe-west1
      console.log('[Firebase Auth] Création de l\'instance Functions pour europe-west1...');
      let functions;
      try {
        functions = app.functions('europe-west1');
        console.log('[Firebase Auth] Instance Functions créée:', functions);
      } catch (functionsError) {
        console.error('[Firebase Auth] Erreur lors de la création de l\'instance Functions:', functionsError);
        throw new Error('Firebase Functions n\'est pas disponible: ' + functionsError.message);
      }
      
      const sendPasswordResetViaMailjet = functions.httpsCallable('sendPasswordResetEmailViaMailjet');
      console.log('[Firebase Auth] Fonction callable créée:', sendPasswordResetViaMailjet);
      
      console.log('[Firebase Auth] Appel de sendPasswordResetEmailViaMailjet...');
      const result = await sendPasswordResetViaMailjet({ email });
      
      if (result.data && result.data.success) {
        console.log('[Firebase Auth] ✅ Email de réinitialisation envoyé via Mailjet');
        console.log('[Firebase Auth] 💡 L\'expéditeur est: support@actu.fluance.io');
        console.log('[Firebase Auth] 💡 Vérifiez votre boîte de réception et le dossier spam');
        
        return {
          success: true,
          message: 'Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception et le dossier spam.',
          sentViaMailjet: true
        };
      } else {
        throw new Error(result.data?.message || 'Erreur lors de l\'envoi via Mailjet');
      }
    } catch (mailjetError) {
      // Si Mailjet échoue, utiliser Firebase Auth en fallback
      console.warn('[Firebase Auth] ⚠️ Mailjet a échoué, tentative avec Firebase Auth (fallback)');
      console.warn('[Firebase Auth] Erreur Mailjet:', mailjetError.message);
      
      try {
        console.log('[Firebase Auth] Appel de auth.sendPasswordResetEmail (fallback)...');
        await auth.sendPasswordResetEmail(email, actionCodeSettings);
        
        console.log('[Firebase Auth] ✅ Email de réinitialisation envoyé via Firebase Auth (fallback)');
        console.log('[Firebase Auth] 💡 Note: L\'email est envoyé par Firebase Auth');
        console.log('[Firebase Auth] 💡 Vérifiez votre boîte de réception et le dossier spam');
        console.log('[Firebase Auth] 💡 L\'expéditeur est généralement: noreply@[PROJECT_ID].firebaseapp.com');
        
        return { 
          success: true,
          message: 'Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception et le dossier spam.',
          sentViaFirebase: true
        };
      } catch (firebaseError) {
        console.error('[Firebase Auth] ❌ Firebase Auth a aussi échoué:', firebaseError);
        // Relancer l'erreur Firebase
        throw firebaseError;
      }
    }
  } catch (error) {
    console.error('[Firebase Auth] ❌ ERREUR lors de l\'envoi de l\'email de réinitialisation');
    console.error('[Firebase Auth] Erreur complète:', error);
    console.error('[Firebase Auth] Code d\'erreur:', error.code);
    console.error('[Firebase Auth] Message d\'erreur:', error.message);
    
    // Messages d'erreur plus détaillés
    let errorMessage = getErrorMessage(error.code);
    
    // Ajouter des informations supplémentaires selon le type d'erreur
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'Aucun compte trouvé avec cet email. Vérifiez que l\'email est correct.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Format d\'email invalide. Vérifiez que l\'email est correct.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Trop de tentatives. Pour votre sécurité, veuillez attendre quelques minutes avant de réessayer.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'La réinitialisation de mot de passe n\'est pas activée. Veuillez contacter le support.';
    }
    
    return { 
      success: false, 
      error: errorMessage,
      errorCode: error.code,
      suggestion: error.code === 'auth/user-not-found' 
        ? 'Vérifiez que l\'email est correct ou créez un compte si vous n\'en avez pas encore.'
        : error.code === 'auth/too-many-requests'
        ? 'Attendez quelques minutes avant de réessayer. Pour votre sécurité, les tentatives sont temporairement limitées.'
        : 'Si le problème persiste, contactez le support.'
    };
  }
}

/**
 * Confirme la réinitialisation de mot de passe avec le code d'action
 * Supporte à la fois les codes Firebase (oobCode) et les tokens personnalisés
 */
async function confirmPasswordReset(actionCode, newPassword) {
  try {
    // Si c'est un token personnalisé (format hex de 64 caractères)
    if (actionCode && actionCode.length === 64 && /^[a-f0-9]+$/i.test(actionCode)) {
      // Utiliser le système de tokens personnalisés
      await ensureFunctionsLoaded();
      const app = firebase.app();
      const functions = app.functions('europe-west1');
      const verifyToken = functions.httpsCallable('verifyPasswordResetToken');
      
      const result = await verifyToken({token: actionCode, newPassword: newPassword});
      
      if (result.data && result.data.success) {
        return { success: true };
      } else {
        return { success: false, error: result.data?.error || 'Erreur lors de la réinitialisation' };
      }
    }
    
    // Sinon, utiliser le système Firebase Auth (pour compatibilité)
    if (!auth) {
      auth = firebase.auth();
    }

    await auth.confirmPasswordReset(actionCode, newPassword);
    return { success: true };
  } catch (error) {
    console.error('Confirm password reset error:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

/**
 * Vérifie si un code de réinitialisation de mot de passe est valide
 * Supporte à la fois les codes Firebase (oobCode) et les tokens personnalisés
 */
async function verifyPasswordResetCode(actionCode) {
  try {
    // Si c'est un token personnalisé (format hex de 64 caractères)
    if (actionCode && actionCode.length === 64 && /^[a-f0-9]+$/i.test(actionCode)) {
      // Utiliser le système de tokens personnalisés
      await ensureFunctionsLoaded();
      const app = firebase.app();
      const functions = app.functions('europe-west1');
      const checkToken = functions.httpsCallable('checkPasswordResetToken');
      
      const result = await checkToken({token: actionCode});
      
      if (result.data && result.data.success) {
        return { success: true, email: result.data.email };
      } else {
        return { success: false, error: result.data?.error || 'Token invalide ou expiré' };
      }
    }
    
    // Sinon, utiliser le système Firebase Auth (pour compatibilité)
    if (!auth) {
      auth = firebase.auth();
    }

    const email = await auth.verifyPasswordResetCode(actionCode);
    return { success: true, email: email };
  } catch (error) {
    console.error('Verify password reset code error:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

/**
 * Vérifie si un lien de connexion passwordless est présent dans l'URL
 */
async function handleSignInLink() {
  try {
    // S'assurer que auth est initialisé
    if (!auth) {
      auth = firebase.auth();
    }
    
    // Vérifier si un lien de connexion est présent dans l'URL
    if (auth && auth.isSignInWithEmailLink && auth.isSignInWithEmailLink(window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      
      // Si l'email n'est pas dans localStorage, demander à l'utilisateur
      if (!email) {
        email = window.prompt('Veuillez fournir votre email pour confirmation');
      }
      
      if (!email) {
        return { success: false, error: 'Email requis pour la connexion' };
      }
      
      const remember = getRememberChoice(false);
      await applyAuthPersistence(remember);
      saveRememberChoice(remember);
      
      // Connecter l'utilisateur avec le lien
      const result = await auth.signInWithEmailLink(email, window.location.href);
      
      // Nettoyer localStorage
      window.localStorage.removeItem('emailForSignIn');
      
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return { success: true, user: result.user };
    }
    
    return { success: false, error: 'Aucun lien de connexion valide' };
  } catch (error) {
    console.error('Handle sign in link error:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

/**
 * Déconnexion
 */
async function signOut() {
  try {
    await auth.signOut();
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Charge le contenu protégé depuis Firestore
 */
async function loadProtectedContent(contentId = null) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { 
        success: false, 
        error: 'Vous n\'êtes pas connecté. Veuillez vous connecter pour accéder au contenu protégé.',
        errorCode: 'NOT_AUTHENTICATED',
        suggestion: 'Connectez-vous depuis la page de connexion.'
      };
    }

    // Récupérer les informations de l'utilisateur depuis Firestore
    let userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      // Essayer de réparer automatiquement le document Firestore
      console.log('[Protected Content] Document Firestore manquant, tentative de réparation...');
      try {
        await ensureFunctionsLoaded();
        const app = firebase.app();
        const functions = app.functions('europe-west1');
        const repairUserDocument = functions.httpsCallable('repairUserDocument');
        
        const repairResult = await repairUserDocument({
          email: user.email,
          product: '21jours', // Par défaut, on assume 21jours
        });
        
        if (repairResult.data && repairResult.data.success) {
          console.log('[Protected Content] Document Firestore créé avec succès');
          // Recharger le document
          userDoc = await db.collection('users').doc(user.uid).get();
        } else {
          throw new Error('Réparation échouée');
        }
      } catch (repairError) {
        console.error('[Protected Content] Erreur lors de la réparation:', repairError);
        return { 
          success: false, 
          error: 'Votre compte n\'a pas été trouvé dans notre système. Cela peut arriver si le compte a été créé récemment. Veuillez contacter le support si le problème persiste.',
          errorCode: 'USER_NOT_FOUND',
          suggestion: 'Contactez le support avec votre email: ' + user.email
        };
      }
      
      // Vérifier à nouveau après la tentative de réparation
      if (!userDoc.exists) {
        return { 
          success: false, 
          error: 'Votre compte n\'a pas été trouvé dans notre système. Veuillez contacter le support.',
          errorCode: 'USER_NOT_FOUND',
          suggestion: 'Contactez le support avec votre email: ' + user.email
        };
      }
    }

    const userData = userDoc.data();
    
    // Récupérer les produits : nouveau format (products[]) ou ancien format (product) pour compatibilité
    let userProducts = userData.products || [];
    
    // Migration automatique : si products[] n'existe pas mais product existe
    if (userProducts.length === 0 && userData.product) {
      userProducts = [{
        name: userData.product,
        startDate: userData.registrationDate || userData.createdAt || {toDate: () => new Date()},
        purchasedAt: userData.createdAt || {toDate: () => new Date()},
      }];
    }
    
    // Vérifier qu'au moins un produit est défini
    if (userProducts.length === 0) {
      return { 
        success: false, 
        error: 'Votre compte n\'a pas de produit associé. Veuillez contacter le support pour résoudre ce problème.',
        errorCode: 'NO_PRODUCT',
        suggestion: 'Contactez le support avec votre email: ' + user.email
      };
    }
    
    // Pour compatibilité rétroactive, garder userProduct comme le premier produit
    const userProduct = userProducts[0].name;
    
    // Si un contentId est spécifié, charger ce contenu spécifique
    if (contentId) {
      const contentDoc = await db.collection('protectedContent').doc(contentId).get();
      
      if (!contentDoc.exists) {
        return { 
          success: false, 
          error: `Le contenu demandé n'existe pas ou n'est plus disponible.`,
          errorCode: 'CONTENT_NOT_FOUND',
          suggestion: 'Essayez d\'accéder au contenu depuis la page principale de votre formation.'
        };
      }

      const contentData = contentDoc.data();
      const contentProduct = contentData.product;
      
      // Trouver le produit correspondant dans les produits de l'utilisateur
      const userProductData = userProducts.find(p => p.name === contentProduct);
      
      if (!userProductData) {
        return { 
          success: false, 
          error: `Vous n'avez pas accès à ce contenu. Ce contenu fait partie d'une autre formation que celle à laquelle vous êtes inscrit(e).`,
          errorCode: 'PRODUCT_MISMATCH',
          suggestion: `Accédez au contenu depuis votre espace membre.`
        };
      }

      // Vérifier l'accès progressif selon le type de produit
      const now = new Date();
      const startDate = userProductData.startDate ? userProductData.startDate.toDate() : new Date();
      
      // Pour le produit "21jours", vérifier l'accès progressif basé sur le jour
      if (contentProduct === '21jours' && contentData.day !== undefined) {
        const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const dayNumber = contentData.day;

        // Jour 0 (déroulé) accessible immédiatement
        // Jours 1-21 : accessibles à partir du jour correspondant
        // Jour 22 (bonus) : accessible au jour 22 (daysSinceStart >= 21)
        if (dayNumber > 0 && daysSinceStart < dayNumber - 1) {
          const daysRemaining = dayNumber - daysSinceStart - 1;
          return { 
            success: false, 
            error: `Ce contenu sera disponible dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}. Vous êtes actuellement au jour ${daysSinceStart + 1} du défi de 21 jours.`,
            errorCode: 'CONTENT_NOT_AVAILABLE_YET',
            suggestion: 'Continuez à suivre le programme jour par jour. Le contenu se débloque automatiquement chaque jour.',
            daysRemaining: daysRemaining,
            currentDay: daysSinceStart + 1
          };
        }
      }
      
      // Pour le produit "complet", vérifier l'accès progressif basé sur la semaine
      if (contentProduct === 'complet' && contentData.week !== undefined) {
        const weeksSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24 * 7));
        const weekNumber = contentData.week;

        // Semaine 0 (bonus) et semaine 1 accessibles immédiatement
        // Semaines 2-14 : accessibles à partir de la semaine correspondante
        if (weekNumber > 1 && weeksSinceStart < weekNumber) {
          const weeksRemaining = weekNumber - weeksSinceStart;
          return { 
            success: false, 
            error: `Ce contenu sera disponible dans ${weeksRemaining} semaine${weeksRemaining > 1 ? 's' : ''}. Vous êtes actuellement à la semaine ${weeksSinceStart + 1}.`,
            errorCode: 'CONTENT_NOT_AVAILABLE_YET',
            suggestion: 'Continuez à suivre le programme semaine par semaine. Le contenu se débloque automatiquement chaque semaine.',
            weeksRemaining: weeksRemaining,
            currentWeek: weeksSinceStart + 1
          };
        }
      }

      const result = {
        success: true, 
        content: contentData.content || '', 
        product: userProduct,
        title: contentData.title || '',
        day: contentData.day,
        commentText: contentData.commentText || null, // Texte personnalisé pour les commentaires
      };
      
      // Pour les autres produits (pas 21jours), ajouter createdAt/updatedAt
      if (userProduct !== '21jours') {
        result.metadata = {
          createdAt: contentData.createdAt || null,
          updatedAt: contentData.updatedAt || null
        };
      }
      
      return result;
    }

    // Sinon, charger la liste des contenus disponibles pour tous les produits
    try {
      const now = new Date();
      const productsData = [];
      
      // Pour chaque produit de l'utilisateur, charger ses contenus
      for (const userProductData of userProducts) {
        const productName = userProductData.name;
        const startDate = userProductData.startDate ? userProductData.startDate.toDate() : new Date();
        
        let query = db.collection('protectedContent').where('product', '==', productName);
        
        // Pour "21jours", trier par jour (0-22) au lieu de createdAt
        if (productName === '21jours') {
          query = query.orderBy('day', 'asc');
        } else if (productName === 'complet') {
          // Pour "complet", trier par semaine (0-14)
          query = query.orderBy('week', 'asc');
        } else {
          query = query.orderBy('createdAt', 'desc');
        }
        
        let contentsSnapshot;
        try {
          contentsSnapshot = await query.get();
        } catch (indexError) {
          // Si l'index est en cours de construction, essayer sans orderBy
          if (indexError.code === 'failed-precondition') {
            contentsSnapshot = await db.collection('protectedContent')
              .where('product', '==', productName)
              .get();
          } else {
            throw indexError;
          }
        }
        
        const contents = [];
        const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const weeksSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24 * 7));
        
        contentsSnapshot.forEach((doc) => {
          const data = doc.data();
          const dayNumber = data.day;
          const weekNumber = data.week;
          
          // Vérifier l'accès progressif selon le type de produit
          let isAccessible = true;
          let daysRemaining = null;
          let weeksRemaining = null;
          
          if (productName === '21jours' && dayNumber !== undefined) {
            if (dayNumber === 0) {
              // Jour 0 (déroulé) accessible immédiatement
              isAccessible = true;
            } else {
              // Jours 1-21 : accessibles à partir du jour correspondant
              // Jour 22 (bonus) : accessible au jour 22 (daysSinceStart >= 21)
              isAccessible = daysSinceStart >= dayNumber - 1;
              if (!isAccessible && dayNumber > 0) {
                daysRemaining = Math.max(0, dayNumber - daysSinceStart - 1);
              }
            }
          } else if (productName === 'complet' && weekNumber !== undefined) {
            if (weekNumber === 0 || weekNumber === 1) {
              // Semaine 0 (bonus) et semaine 1 accessibles immédiatement
              isAccessible = true;
            } else {
              // Semaines 2-14 : accessibles à partir de la semaine correspondante
              isAccessible = weeksSinceStart >= weekNumber;
              if (!isAccessible && weekNumber > 1) {
                weeksRemaining = Math.max(0, weekNumber - weeksSinceStart);
              }
            }
          }
          
          const contentObj = {
            id: doc.id,
            title: data.title || doc.id,
            content: data.content || '',
            day: dayNumber,
            week: weekNumber,
            isAccessible: isAccessible,
            daysRemaining: daysRemaining,
            weeksRemaining: weeksRemaining,
          };
          
          // Pour les autres produits, ajouter createdAt/updatedAt pour le tri
          if (productName !== '21jours' && productName !== 'complet') {
            contentObj.createdAt = data.createdAt;
            contentObj.updatedAt = data.updatedAt;
          }
          
          contents.push(contentObj);
        });
        
        productsData.push({
          name: productName,
          startDate: startDate,
          contents: contents,
          daysSinceStart: productName === '21jours' ? daysSinceStart : null,
          weeksSinceStart: productName === 'complet' ? weeksSinceStart : null,
        });
      }

      // Retourner tous les produits avec leurs contenus
      // Garder aussi product et daysSinceRegistration pour compatibilité rétroactive
      return { 
        success: true, 
        products: productsData, // Nouveau format : tableau de produits
        product: userProduct, // Premier produit pour compatibilité
        daysSinceRegistration: productsData.find(p => p.name === '21jours')?.daysSinceStart || null,
      };
    } catch (error) {
      console.error('Error loading protected content:', error);
      // Si l'index est en cours de construction, retourner une erreur explicite
      if (error.code === 'failed-precondition') {
        return { 
          success: false, 
          error: 'Le système est en cours de mise à jour. Veuillez réessayer dans quelques minutes.',
          errorCode: 'INDEX_BUILDING',
          suggestion: 'Cette opération est temporaire. Attendez 2-3 minutes et rafraîchissez la page.'
        };
      }
      // Relancer l'erreur pour qu'elle soit gérée par le catch externe
      throw error;
    }
  } catch (error) {
    console.error('Error loading protected content:', error);
    
    // Message d'erreur plus clair pour l'index en construction
    if (error.code === 'failed-precondition' && 
        error.message && 
        error.message.includes('index is currently building')) {
      return { 
        success: false, 
        error: 'Le système est en cours de mise à jour. Veuillez réessayer dans quelques minutes.',
        errorCode: 'INDEX_BUILDING',
        suggestion: 'Cette opération est temporaire. Attendez 2-3 minutes et rafraîchissez la page.'
      };
    }
    
    // Erreur de permission
    if (error.code === 'permission-denied') {
      return {
        success: false,
        error: 'Vous n\'avez pas la permission d\'accéder à ce contenu. Vérifiez que vous êtes bien connecté(e).',
        errorCode: 'PERMISSION_DENIED',
        suggestion: 'Déconnectez-vous et reconnectez-vous, puis réessayez.'
      };
    }
    
    // Erreur réseau
    if (error.code === 'unavailable' || error.message?.includes('network') || error.message?.includes('fetch')) {
      return {
        success: false,
        error: 'Erreur de connexion. Vérifiez votre connexion internet et réessayez.',
        errorCode: 'NETWORK_ERROR',
        suggestion: 'Vérifiez votre connexion internet et rafraîchissez la page.'
      };
    }
    
    // Message d'erreur générique mais utile
    return { 
      success: false, 
      error: error.message || 'Une erreur est survenue lors du chargement du contenu. Veuillez réessayer.',
      errorCode: error.code || 'UNKNOWN_ERROR',
      suggestion: 'Si le problème persiste, contactez le support avec le code d\'erreur ci-dessus.'
    };
  }
}

/**
 * Charge un contenu protégé spécifique et l'affiche dans un élément
 */
async function displayProtectedContent(contentId, containerElement) {
  try {
    const result = await loadProtectedContent(contentId);
    
    if (!result.success) {
      let errorHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-6">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <h3 class="text-sm font-medium text-red-800 mb-2">Erreur d'accès au contenu</h3>
              <p class="text-sm text-red-700 mb-3">${result.error}</p>
      `;
      
      // Ajouter le code d'erreur si disponible (pour le support)
      if (result.errorCode) {
        errorHTML += `
              <p class="text-xs text-red-600 mb-3">
                <span class="font-mono bg-red-100 px-2 py-1 rounded">Code: ${result.errorCode}</span>
              </p>
        `;
      }
      
      // Ajouter la suggestion si disponible
      if (result.suggestion) {
        errorHTML += `
              <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                <p class="text-sm text-yellow-800">
                  <strong>💡 Suggestion :</strong> ${result.suggestion}
                </p>
              </div>
        `;
      }
      
      // Ajouter des informations supplémentaires pour certains types d'erreurs
      if (result.errorCode === 'CONTENT_NOT_AVAILABLE_YET' && result.daysRemaining !== undefined) {
        errorHTML += `
              <div class="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                <p class="text-sm text-blue-800">
                  <strong>📅 Progression :</strong> Vous êtes au jour ${result.currentDay} sur 21. Ce contenu sera disponible dans ${result.daysRemaining} jour${result.daysRemaining > 1 ? 's' : ''}.
                </p>
              </div>
        `;
      }
      
      errorHTML += `
            </div>
          </div>
        </div>
      `;
      
      containerElement.innerHTML = errorHTML;
      return;
    }

    // Afficher le contenu HTML
    containerElement.innerHTML = result.content;
    
    // Pour le produit "21jours", ajouter automatiquement la question et la section de commentaires
    if (result.product === '21jours' && result.day !== undefined) {
      // Créer un conteneur pour la section de commentaires
      const commentSection = document.createElement('div');
      commentSection.className = 'mt-8 pt-8 border-t border-gray-200';
      commentSection.setAttribute('data-comment-section', contentId);
      
      // Utiliser le texte personnalisé si disponible, sinon le texte par défaut
      const commentQuestion = result.commentText || 'Quelles améliorations avez-vous ressenties suite à la pratique du jour ?';
      
      // Formater le texte sur plusieurs lignes si nécessaire (pour les jours 0 et 21)
      const commentQuestionHTML = commentQuestion.split('\n').map(line => line.trim()).filter(line => line).join('<br>');
      
      commentSection.innerHTML = `
        <h3 class="text-xl font-semibold text-[#0f172a] mb-4">
          ${commentQuestionHTML}
        </h3>
        
        <!-- Comment Section -->
        <form id="comment-form-${contentId}" class="mb-6 space-y-4">
          <input 
            type="text" 
            id="name-${contentId}" 
            placeholder="Votre prénom" 
            required 
            class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#0f172a]"
          />
          <textarea 
            id="text-${contentId}" 
            placeholder="Votre commentaire" 
            required
            rows="4"
            class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#0f172a]"
          ></textarea>
          <button 
            type="submit"
            class="bg-fluance text-white py-2 px-6 rounded-lg font-semibold hover:bg-fluance/90 transition-colors duration-200"
          >
            Envoyer
          </button>
        </form>
        
        <div id="comments-container-${contentId}" class="mb-4"></div>
        <div id="pagination-controls-${contentId}" class="mt-4"></div>
      `;
      
      // Ajouter la section après le contenu
      containerElement.appendChild(commentSection);
      
      // Initialiser le système de commentaires pour ce contenu (avec un petit délai pour s'assurer que le DOM est prêt)
      setTimeout(() => {
        initCommentSection(contentId);
      }, 100);
    }
    
    // Exécuter les scripts dans le contenu (pour les embeds vidéo, etc.)
    const scripts = containerElement.querySelectorAll('script');
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  } catch (error) {
    console.error('Error displaying protected content:', error);
    containerElement.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800">Erreur lors du chargement du contenu</p>
      </div>
    `;
  }
}

/**
 * Initialise la section de commentaires pour un contenu spécifique
 */
function initCommentSection(contentId) {
  // Vérifier si Firebase pour les commentaires est déjà chargé
  if (typeof firebase === 'undefined') {
    // Charger Firebase pour les commentaires
    const script1 = document.createElement('script');
    script1.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js';
    document.head.appendChild(script1);
    
    const script2 = document.createElement('script');
    script2.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore-compat.js';
    document.head.appendChild(script2);
    
    script2.onload = () => {
      setupCommentSection(contentId);
    };
  } else {
    setupCommentSection(contentId);
  }
}

/**
 * Configure la section de commentaires
 */
function setupCommentSection(contentId) {
  // Utiliser le même projet Firebase que le reste du site (fluance-protected-content)
  // Plus besoin d'une instance Firebase séparée, on utilise l'instance principale
  const db = firebase.firestore();
  // Utiliser le contentId comme identifiant unique pour les commentaires de ce jour
  // Cela permet d'avoir des commentaires séparés pour chaque jour du programme
  const pageId = encodeURIComponent(window.location.origin + window.location.pathname + '|' + contentId);
  const COMMENTS_PER_PAGE = 20;
  let allComments = [];
  let currentPage = 1;

  // Fonction pour décoder les entités HTML
  function decodeHTML(str) {
    if (!str) return '';
    // Décoder récursivement pour gérer le double encodage
    const textarea = document.createElement('textarea');
    let decoded = str;
    let previous = '';
    // Décoder jusqu'à ce qu'il n'y ait plus de changement (max 5 itérations pour éviter les boucles infinies)
    for (let i = 0; i < 5 && decoded !== previous; i++) {
      previous = decoded;
      textarea.innerHTML = decoded;
      decoded = textarea.value;
    }
    return decoded;
  }
  // Fonction pour échapper le HTML
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Gérer la soumission du formulaire
  const commentForm = document.getElementById(`comment-form-${contentId}`);
  if (commentForm) {
    commentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = document.getElementById(`name-${contentId}`).value.trim();
      const text = document.getElementById(`text-${contentId}`).value.trim();
      
      if (!name || !text) return;
      
      if (/[<>]/.test(name) || /[<>]/.test(text)) {
        alert("Les caractères < et > ne sont pas autorisés.");
        return;
      }
      
      db.collection("comments").doc(pageId).collection("messages").add({
        name: name,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function() {
        document.getElementById(`comment-form-${contentId}`).reset();
      }).catch(function(error) {
        console.error("Erreur lors de l'ajout du commentaire:", error);
        alert("Erreur lors de l'envoi du commentaire. Veuillez réessayer.");
      });
    });
  }

  function renderCommentsPage(page) {
    const container = document.getElementById(`comments-container-${contentId}`);
    if (!container) return;
    
    container.innerHTML = "<h4 class='text-lg font-semibold text-[#0f172a] mb-4'>Commentaires</h4>";
    
    if (allComments.length === 0) {
      container.innerHTML += "<p class='text-[#1f1f1f]/60 text-sm'>Aucun commentaire pour le moment. Soyez le premier à partager votre expérience !</p>";
      renderPaginationControls(page);
      return;
    }
    
    const start = (page - 1) * COMMENTS_PER_PAGE;
    const end = start + COMMENTS_PER_PAGE;
    const pageComments = allComments.slice(start, end);
    
    for (let i = 0; i < pageComments.length; i++) {
      const c = pageComments[i];
      // Décoder d'abord les entités HTML existantes, puis échapper pour sécurité
      const decodedText = decodeHTML(c.text);
      const decodedName = decodeHTML(c.name);
      const text = escapeHTML(decodedText);
      const name = escapeHTML(decodedName);
      
      container.innerHTML += '<div class="border-b border-gray-200 mb-4 pb-4"><div class="mb-2"><strong class="text-[#0f172a]">' + name + '</strong></div><p class="text-[#1f1f1f]/80">' + text + '</p></div>';
    }
    
    renderPaginationControls(page);
  }

  function renderPaginationControls(page) {
    const controls = document.getElementById(`pagination-controls-${contentId}`);
    if (!controls) return;
    
    const totalPages = Math.ceil(allComments.length / COMMENTS_PER_PAGE);
    
    if (totalPages <= 1) {
      controls.innerHTML = '';
      return;
    }
    
    // Vider le conteneur
    controls.innerHTML = '';
    
    // Bouton précédent
    if (page > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.id = `prev-page-${contentId}`;
      prevBtn.textContent = '< Précédent';
      prevBtn.style.cursor = 'pointer';
      prevBtn.style.padding = '0.5rem 1rem';
      prevBtn.style.borderRadius = '0.5rem';
      prevBtn.style.border = '1px solid rgba(130, 21, 62, 0.2)';
      prevBtn.style.backgroundColor = 'transparent';
      prevBtn.style.color = '#82153e';
      prevBtn.style.fontWeight = '500';
      prevBtn.style.transition = 'all 0.2s ease';
      prevBtn.style.marginRight = '0.5rem';
      prevBtn.onmouseenter = function() {
        this.style.backgroundColor = 'rgba(130, 21, 62, 0.1)';
        this.style.borderColor = 'rgba(130, 21, 62, 0.3)';
        this.style.transform = 'translateY(-1px)';
      };
      prevBtn.onmouseleave = function() {
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = 'rgba(130, 21, 62, 0.2)';
        this.style.transform = 'translateY(0)';
      };
      prevBtn.onclick = function() {
        currentPage--;
        renderCommentsPage(currentPage);
      };
      controls.appendChild(prevBtn);
      controls.appendChild(document.createTextNode(' '));
    }
    
    // Texte de pagination
    const pageText = document.createElement('span');
    pageText.style.color = 'rgba(31, 31, 31, 0.8)';
    pageText.style.fontSize = '0.875rem';
    pageText.textContent = 'Page ' + page + ' / ' + totalPages;
    controls.appendChild(pageText);
    
    // Bouton suivant
    if (page < totalPages) {
      controls.appendChild(document.createTextNode(' '));
      const nextBtn = document.createElement('button');
      nextBtn.id = `next-page-${contentId}`;
      nextBtn.textContent = 'Suivant >';
      nextBtn.style.cursor = 'pointer';
      nextBtn.style.padding = '0.5rem 1rem';
      nextBtn.style.borderRadius = '0.5rem';
      nextBtn.style.border = '1px solid rgba(130, 21, 62, 0.2)';
      nextBtn.style.backgroundColor = 'transparent';
      nextBtn.style.color = '#82153e';
      nextBtn.style.fontWeight = '500';
      nextBtn.style.transition = 'all 0.2s ease';
      nextBtn.style.marginLeft = '0.5rem';
      nextBtn.onmouseenter = function() {
        this.style.backgroundColor = 'rgba(130, 21, 62, 0.1)';
        this.style.borderColor = 'rgba(130, 21, 62, 0.3)';
        this.style.transform = 'translateY(-1px)';
      };
      nextBtn.onmouseleave = function() {
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = 'rgba(130, 21, 62, 0.2)';
        this.style.transform = 'translateY(0)';
      };
      nextBtn.onclick = function() {
        currentPage++;
        renderCommentsPage(currentPage);
      };
      controls.appendChild(nextBtn);
    }
  }

  // Charger les commentaires
  if (db && pageId) {
    db.collection("comments").doc(pageId).collection("messages")
      .orderBy("timestamp", "desc")
      .onSnapshot(function(snapshot) {
        allComments = [];
        snapshot.forEach(function(doc) {
          allComments.push(doc.data());
        });
        
        // Trier par date (plus récent en premier)
        allComments.sort(function(a, b) {
          if (a.timestamp && b.timestamp) {
            try {
              const timeA = a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
              const timeB = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
              return timeB - timeA;
            } catch (e) {
              return 0;
            }
          }
          return 0;
        });
        
        currentPage = 1;
        renderCommentsPage(currentPage);
      }, function(error) {
        console.error("Erreur Firestore :", error);
        const container = document.getElementById(`comments-container-${contentId}`);
        if (container) {
          container.innerHTML = "<p class='text-red-600 text-sm'>Erreur lors du chargement des commentaires.</p>";
        }
      });
  }
}

/**
 * Met à jour l'UI pour un utilisateur authentifié
 */
function updateUIForAuthenticatedUser(user) {
  // Masquer les boutons de connexion, afficher les boutons de déconnexion
  const loginButtons = document.querySelectorAll('.auth-login-button');
  const logoutButtons = document.querySelectorAll('.auth-logout-button');
  const userInfo = document.querySelectorAll('.auth-user-info');
  
  loginButtons.forEach(btn => btn.style.display = 'none');
  logoutButtons.forEach(btn => btn.style.display = 'inline-block');
  userInfo.forEach(info => {
    info.textContent = user.email;
    info.style.display = 'inline-block';
  });
}

/**
 * Met à jour l'UI pour un utilisateur non authentifié
 */
function updateUIForUnauthenticatedUser() {
  const loginButtons = document.querySelectorAll('.auth-login-button');
  const logoutButtons = document.querySelectorAll('.auth-logout-button');
  const userInfo = document.querySelectorAll('.auth-user-info');
  const protectedContent = document.querySelectorAll('.protected-content');
  
  loginButtons.forEach(btn => btn.style.display = 'inline-block');
  logoutButtons.forEach(btn => btn.style.display = 'none');
  userInfo.forEach(info => info.style.display = 'none');
  
  // Masquer le contenu protégé
  protectedContent.forEach(content => {
    content.innerHTML = `
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p class="text-yellow-800">Veuillez vous connecter pour accéder à ce contenu.</p>
        <a href="/connexion" class="text-blue-600 underline">Se connecter</a>
      </div>
    `;
  });
}

/**
 * Convertit les codes d'erreur Firebase en messages lisibles
 */
function getErrorMessage(errorCode) {
  const errorMessages = {
    'auth/user-not-found': 'Aucun compte trouvé avec cet email. Vérifiez que l\'email est correct ou créez un compte.',
    'auth/wrong-password': 'Mot de passe incorrect. Si vous avez oublié votre mot de passe, utilisez le lien "Mot de passe oublié".',
    'auth/email-already-in-use': 'Cet email est déjà utilisé. Essayez de vous connecter ou utilisez "Mot de passe oublié" si vous ne vous souvenez plus de votre mot de passe.',
    'auth/weak-password': 'Le mot de passe est trop faible. Utilisez au moins 6 caractères.',
    'auth/invalid-email': 'Format d\'email invalide. Vérifiez que l\'email est correct (exemple: nom@domaine.com).',
    'auth/too-many-requests': 'Trop de tentatives de connexion. Pour votre sécurité, veuillez attendre quelques minutes avant de réessayer.',
    'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre connexion internet et réessayez.',
    'auth/user-disabled': 'Ce compte a été désactivé. Veuillez contacter le support pour plus d\'informations.',
    'auth/operation-not-allowed': 'Cette méthode de connexion n\'est pas activée. Veuillez contacter le support.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect. Vérifiez vos identifiants et réessayez.',
    'auth/invalid-verification-code': 'Code de vérification invalide ou expiré. Demandez un nouveau code.',
    'auth/invalid-verification-id': 'Lien de vérification invalide ou expiré. Demandez un nouveau lien.',
    'auth/code-expired': 'Le code de vérification a expiré. Demandez un nouveau code.',
    'auth/session-cookie-expired': 'Votre session a expiré. Veuillez vous reconnecter.',
    'auth/requires-recent-login': 'Pour des raisons de sécurité, veuillez vous reconnecter avant d\'effectuer cette action.',
    'auth/credential-already-in-use': 'Ces identifiants sont déjà utilisés par un autre compte.',
    'auth/account-exists-with-different-credential': 'Un compte existe déjà avec cet email mais avec une autre méthode de connexion.',
    'Non authentifié': 'Vous n\'êtes pas connecté. Veuillez vous connecter pour accéder à ce contenu.',
    'Utilisateur non trouvé': 'Votre compte n\'a pas été trouvé dans notre système. Veuillez contacter le support si le problème persiste.',
  };
  
  // Si c'est un code d'erreur connu, retourner le message
  if (errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }
  
  // Si c'est un code d'erreur Firebase Auth (commence par auth/), donner un message générique mais utile
  if (errorCode && errorCode.startsWith('auth/')) {
    return `Erreur d'authentification: ${errorCode}. Si le problème persiste, contactez le support.`;
  }
  
  // Message par défaut
  return 'Une erreur est survenue. Veuillez réessayer. Si le problème persiste, contactez le support.';
}

/**
 * Extrait l'email depuis le token (fallback si nécessaire)
 */
function extractEmailFromToken(token) {
  // Cette fonction ne devrait pas être nécessaire car l'email est retourné par la fonction
  // Mais c'est une sécurité au cas où
  return '';
}

// Fonction pour obtenir l'utilisateur actuel (avec fallback)
function getCurrentUser() {
  if (auth && auth.currentUser) {
    return auth.currentUser;
  }
  // Fallback : utiliser firebase.auth() directement si auth n'est pas encore initialisé
  if (typeof firebase !== 'undefined' && firebase.auth) {
    return firebase.auth().currentUser;
  }
  return null;
}

// Fonction pour vérifier l'authentification (avec fallback)
function isAuthenticated() {
  const user = getCurrentUser();
  return !!user;
}

/**
 * Vérifie si WebAuthn/Passkeys est supporté
 */
function isWebAuthnSupported() {
  return typeof window.PublicKeyCredential !== 'undefined' && 
         typeof navigator.credentials !== 'undefined' &&
         typeof navigator.credentials.create !== 'undefined';
}

/**
 * Vérifie si Firebase Functions est disponible
 */
function ensureFunctionsLoaded() {
  // Vérifier si Firebase Functions est disponible via app.functions() (mode compat)
  const app = firebase.app();
  if (app && typeof app.functions === 'function') {
    return Promise.resolve();
  }
  
  // Si pas disponible, vérifier si le script est déjà en cours de chargement
  const existingScript = document.querySelector('script[src*="firebase-functions-compat"]');
  if (existingScript) {
    // Attendre que le script se charge
    return new Promise((resolve, reject) => {
      existingScript.onload = () => {
        if (app && typeof app.functions === 'function') {
          resolve();
        } else {
          reject(new Error('Firebase Functions n\'a pas pu être chargé'));
        }
      };
      existingScript.onerror = () => {
        reject(new Error('Erreur lors du chargement de Firebase Functions'));
      };
      setTimeout(() => {
        if (app && typeof app.functions === 'function') {
          resolve();
        } else {
          reject(new Error('Timeout lors du chargement de Firebase Functions'));
        }
      }, 10000);
    });
  }
  
  // Charger Firebase Functions si pas déjà chargé
  const functionsScript = document.createElement('script');
  functionsScript.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';
  document.head.appendChild(functionsScript);
  
  return new Promise((resolve, reject) => {
    functionsScript.onload = () => {
      // Vérifier que app.functions() est maintenant disponible
      if (app && typeof app.functions === 'function') {
        resolve();
      } else {
        reject(new Error('Firebase Functions n\'a pas pu être chargé'));
      }
    };
    functionsScript.onerror = () => {
      reject(new Error('Erreur lors du chargement de Firebase Functions'));
    };
    // Timeout après 10 secondes
    setTimeout(() => {
      if (app && typeof app.functions === 'function') {
        resolve();
      } else {
        reject(new Error('Timeout lors du chargement de Firebase Functions'));
      }
    }, 10000);
  });
}

/**
 * S'assure qu'un utilisateur est authentifié (anonymement si nécessaire)
 * L'extension WebAuthn nécessite une authentification pour appeler ses fonctions
 */
async function ensureAuthenticated() {
  const currentUser = firebase.auth().currentUser;
  if (currentUser) {
    console.log('Utilisateur déjà authentifié:', currentUser.uid, currentUser.isAnonymous ? '(anonyme)' : '(connecté)');
    return currentUser;
  }
  
  // S'authentifier anonymement si pas déjà authentifié
  try {
    console.log('Authentification anonyme en cours...');
    const userCredential = await firebase.auth().signInAnonymously();
    console.log('Authentification anonyme réussie:', userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error('Erreur lors de l\'authentification anonyme:', error);
    if (error.code === 'auth/operation-not-allowed') {
      throw new Error('L\'authentification anonyme n\'est pas activée. Activez-la dans Firebase Console > Authentication > Sign-in method.');
    }
    throw error;
  }
}

/**
 * Vérifie si l'extension Firebase WebAuthn est disponible
 */
async function isWebAuthnExtensionAvailable() {
  try {
    // S'assurer que Firebase Functions est chargé
    await ensureFunctionsLoaded();
    
    // S'assurer qu'un utilisateur est authentifié (anonymement si nécessaire)
    await ensureAuthenticated();
    
    // Vérifier si les fonctions de l'extension sont disponibles
    // L'extension expose une fonction unique : ext-firebase-web-authn-fu06-api
    // Utiliser la région europe-west1 (configurée dans extensions/firebase-web-authn-fu06.env)
    // Dans le mode compat, on utilise firebase.app().functions('region')
    const app = firebase.app();
    // Essayer d'abord europe-west1 (région configurée)
    let functions = app.functions('europe-west1');
    // L'extension expose une fonction unique avec le nom de l'instance
    let checkExtension = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
    
    try {
      // Vérifier que l'utilisateur est bien authentifié avant l'appel
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error('Aucun utilisateur authentifié avant l\'appel à l\'extension');
      }
      console.log('Appel à l\'extension avec utilisateur:', user.uid, user.isAnonymous ? '(anonyme)' : '(connecté)');
      
      // Forcer le refresh du token avant l'appel pour s'assurer qu'il est valide
      await user.getIdToken(true);
      console.log('Token rafraîchi avant l\'appel');
      
      // La fonction api peut accepter différents formats
      // Essayer d'abord sans paramètre action (certaines versions de l'extension)
      let result;
      try {
        result = await checkExtension({});
        console.log('Résultat de l\'extension (sans action):', result);
      } catch (noActionError) {
        // Si ça échoue, essayer avec action: 'check'
        console.log('Essai avec action: check...');
        result = await checkExtension({ action: 'check' });
        console.log('Résultat de l\'extension (avec action):', result);
      }
      return result.data?.available === true || result.data?.success === true || result.data === true;
    } catch (regionError) {
      console.error('Erreur lors de l\'appel à l\'extension (europe-west1):', regionError);
      
      // Si l'erreur est "Unauthenticated", vérifier l'authentification
      if (regionError.code === 'unauthenticated' || regionError.message?.includes('Unauthenticated')) {
        const user = firebase.auth().currentUser;
        if (!user) {
          throw new Error('L\'utilisateur n\'est pas authentifié. L\'authentification anonyme a peut-être échoué.');
        }
        console.error('Erreur Unauthenticated malgré l\'authentification. Utilisateur:', user.uid, 'Token:', user.accessToken ? 'présent' : 'absent');
        // Réessayer avec un nouveau token
        try {
          const token = await user.getIdToken(true); // Force refresh
          console.log('Nouveau token obtenu, nouvel essai...');
          const result = await checkExtension({ action: 'check' });
          return result.data?.available === true || result.data?.success === true;
        } catch (retryError) {
          console.error('Erreur après refresh du token:', retryError);
          throw retryError;
        }
      }
      
      // Si europe-west1 échoue, essayer us-central1 (fallback)
      if (regionError.code === 'functions/not-found' || regionError.message?.includes('not found')) {
        console.log('Tentative avec us-central1...');
        functions = app.functions('us-central1');
        checkExtension = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
        const result = await checkExtension({ action: 'check' });
        return result.data?.available === true || result.data?.success === true;
      }
      throw regionError;
    }
  } catch (error) {
    // Si l'erreur indique que la fonction n'existe pas, l'extension n'est pas installée
    if (error.code === 'functions/not-found' || error.message?.includes('not found')) {
      return false;
    }
    // Gérer les erreurs d'authentification
    if (error.code === 'auth/operation-not-allowed' || error.message?.includes('anonymous')) {
      console.warn('L\'authentification anonyme n\'est pas activée. Activez-la dans Firebase Console > Authentication > Sign-in method.');
      return false;
    }
    // Gérer les erreurs "Unauthenticated" de manière spécifique
    if (error.code === 'unauthenticated' || error.message?.includes('Unauthenticated')) {
      console.error('Erreur Unauthenticated lors de l\'appel à l\'extension:', error);
      console.error('Vérifiez que:');
      console.error('1. L\'authentification anonyme est activée dans Firebase Console');
      console.error('2. Les règles Firestore permettent l\'accès aux utilisateurs anonymes si nécessaire');
      console.error('3. L\'extension est correctement configurée');
      return false;
    }
    // Gérer les erreurs CORS - l'extension n'est peut-être pas configurée correctement
    if (error.code === 'internal' || error.message?.includes('CORS') || error.message?.includes('Access-Control')) {
      console.warn('Erreur CORS lors de la vérification de l\'extension WebAuthn. L\'extension doit être configurée pour accepter les requêtes depuis fluance.io:', error);
      return false;
    }
    // Autre erreur, on assume que l'extension n'est pas disponible
    console.warn('Erreur lors de la vérification de l\'extension WebAuthn:', error);
    return false;
  }
}

/**
 * Créer un compte avec passkey
 * Utilise la bibliothèque browser officielle @firebase-web-authn/browser
 */
async function createAccountWithPasskey(email, displayName = null) {
  try {
    // Vérifier le support WebAuthn
    if (!isWebAuthnSupported()) {
      return { 
        success: false, 
        error: 'Les passkeys ne sont pas supportés par votre navigateur. Utilisez Chrome, Safari, Edge ou Firefox récent.' 
      };
    }

    // Vérifier si la bibliothèque browser est disponible
    // La bibliothèque peut être exposée sous différents noms selon la version
    // Attendre un peu pour que le script se charge si nécessaire
    let webAuthnLib = window.FirebaseWebAuthn || window.firebaseWebAuthn || window['@firebase-web-authn/browser'];
    
    // Si pas disponible, attendre un peu et réessayer (le script peut être en cours de chargement)
    if (!webAuthnLib || !webAuthnLib.createUserWithPasskey) {
      console.log('Bibliothèque WebAuthn non disponible immédiatement, attente...');
      await new Promise(resolve => setTimeout(resolve, 500));
      webAuthnLib = window.FirebaseWebAuthn || window.firebaseWebAuthn || window['@firebase-web-authn/browser'];
    }
    
    if (!webAuthnLib || !webAuthnLib.createUserWithPasskey) {
      console.warn('Bibliothèque WebAuthn non disponible après attente, utilisation de la méthode directe...');
      console.warn('Variables disponibles:', Object.keys(window).filter(k => k.toLowerCase().includes('webauthn')));
      // Fallback vers l'ancienne méthode si la bibliothèque n'est pas chargée
      return await createAccountWithPasskeyLegacy(email, displayName);
    }

    // Utiliser la bibliothèque browser officielle
    const { createUserWithPasskey: createUserWithPasskeyLib } = webAuthnLib;
    const auth = firebase.auth();
    const functions = firebase.app().functions('europe-west1');
    
    console.log('Création de compte avec passkey via bibliothèque browser...');
    const userCredential = await createUserWithPasskeyLib(
      auth, 
      functions, 
      displayName || email.split('@')[0]
    );
    
    console.log('Compte créé avec passkey:', userCredential.user);
    return {
      success: true,
      user: userCredential.user
    };
  } catch (error) {
    console.error('Erreur lors de la création du compte avec passkey:', error);
    return { 
      success: false, 
      error: error.message || 'Une erreur est survenue lors de la création du compte avec passkey.' 
    };
  }
}

/**
 * Créer un compte avec passkey (méthode legacy - fallback)
 * Utilisée si la bibliothèque browser n'est pas disponible
 */
async function createAccountWithPasskeyLegacy(email, displayName = null) {
  try {
    // Vérifier le support WebAuthn
    if (!isWebAuthnSupported()) {
      return { 
        success: false, 
        error: 'Les passkeys ne sont pas supportés par votre navigateur. Utilisez Chrome, Safari, Edge ou Firefox récent.' 
      };
    }

    // Vérifier si l'extension est disponible
    const extensionAvailable = await isWebAuthnExtensionAvailable();
    if (!extensionAvailable) {
      return { 
        success: false, 
        error: 'L\'extension Firebase WebAuthn n\'est pas installée. Veuillez contacter le support ou utiliser une autre méthode de connexion.',
        needsExtension: true
      };
    }

    // S'assurer que Firebase Functions est chargé
    await ensureFunctionsLoaded();
    
    // S'assurer qu'un utilisateur est authentifié (anonymement si nécessaire)
    await ensureAuthenticated();
    
    // Utiliser l'extension Firebase WebAuthn
    // L'extension expose une fonction unique : ext-firebase-web-authn-fu06-api
    // Essayer d'abord europe-west1 (région configurée)
    // Dans le mode compat, on utilise firebase.app().functions('region')
    const app = firebase.app();
    let functions = app.functions('europe-west1');
    // Utiliser la fonction api de l'extension avec l'action 'createUser'
    let apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
    
    let result;
    try {
      result = await apiFunction({
        action: 'createUser',
        email: email,
        displayName: displayName || email.split('@')[0]
      });
    } catch (regionError) {
      // Si europe-west1 échoue, essayer us-central1 (fallback)
      if (regionError.code === 'functions/not-found' || regionError.message?.includes('not found') || regionError.code === 'internal') {
        functions = app.functions('us-central1');
        apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
        result = await apiFunction({
          action: 'createUser',
          email: email,
          displayName: displayName || email.split('@')[0]
        });
      } else {
        throw regionError;
      }
    }

    if (result.data.success) {
      // L'utilisateur est automatiquement connecté après la création
      return { success: true, user: auth.currentUser };
    } else {
      return { success: false, error: result.data.error || 'Erreur lors de la création du compte' };
    }
  } catch (error) {
    console.error('Erreur création compte avec passkey:', error);
    
    // Gérer les erreurs spécifiques
    if (error.code === 'functions/not-found') {
      return { 
        success: false, 
        error: 'L\'extension Firebase WebAuthn n\'est pas installée.',
        needsExtension: true
      };
    }
    
    // Gérer les erreurs CORS
    if (error.code === 'internal' || error.message?.includes('CORS') || error.message?.includes('Access-Control')) {
      return { 
        success: false, 
        error: 'L\'extension Firebase WebAuthn n\'est pas correctement configurée pour accepter les requêtes depuis ce domaine. Veuillez contacter le support.',
        needsExtension: true
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Une erreur est survenue lors de la création du compte avec passkey.' 
    };
  }
}

/**
 * Connexion avec passkey
 * Utilise la bibliothèque browser officielle @firebase-web-authn/browser
 */
async function signInWithPasskey(email) {
  try {
    // Vérifier le support WebAuthn
    if (!isWebAuthnSupported()) {
      return { 
        success: false, 
        error: 'Les passkeys ne sont pas supportés par votre navigateur. Utilisez Chrome, Safari, Edge ou Firefox récent.' 
      };
    }

    // Vérifier si la bibliothèque browser est disponible
    // La bibliothèque peut être exposée sous différents noms selon la version
    // Attendre un peu pour que le script se charge si nécessaire
    let webAuthnLib = window.FirebaseWebAuthn || window.firebaseWebAuthn || window['@firebase-web-authn/browser'];
    
    // Si pas disponible, attendre un peu et réessayer (le script peut être en cours de chargement)
    if (!webAuthnLib || !webAuthnLib.signInWithPasskey) {
      console.log('Bibliothèque WebAuthn non disponible immédiatement, attente...');
      await new Promise(resolve => setTimeout(resolve, 500));
      webAuthnLib = window.FirebaseWebAuthn || window.firebaseWebAuthn || window['@firebase-web-authn/browser'];
    }
    
    if (!webAuthnLib || !webAuthnLib.signInWithPasskey) {
      console.warn('Bibliothèque WebAuthn non disponible après attente, utilisation de la méthode directe...');
      console.warn('Variables disponibles:', Object.keys(window).filter(k => k.toLowerCase().includes('webauthn')));
      // Fallback vers l'ancienne méthode si la bibliothèque n'est pas chargée
      return await signInWithPasskeyLegacy(email);
    }

    // Utiliser la bibliothèque browser officielle
    const { signInWithPasskey: signInWithPasskeyLib } = webAuthnLib;
    const auth = firebase.auth();
    const functions = firebase.app().functions('europe-west1');
    
    console.log('Connexion avec passkey via bibliothèque browser...');
    const userCredential = await signInWithPasskeyLib(auth, functions);
    
    console.log('Connexion réussie avec passkey:', userCredential.user);
    return {
      success: true,
      user: userCredential.user
    };
  } catch (error) {
    console.error('Erreur lors de la connexion avec passkey:', error);
    
    // Si l'erreur indique qu'aucun passkey n'est trouvé, proposer de le créer
    if (error.message?.includes('not found') || error.message?.includes('not registered') || error.message?.includes('No credentials')) {
      return { 
        success: false, 
        error: 'Aucun passkey trouvé pour cet email.',
        canCreate: true
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Une erreur est survenue lors de la connexion avec passkey.' 
    };
  }
}

/**
 * Connexion avec passkey (méthode legacy - fallback)
 * Utilisée si la bibliothèque browser n'est pas disponible
 */
async function signInWithPasskeyLegacy(email) {
  try {
    // Vérifier si l'extension est disponible
    const extensionAvailable = await isWebAuthnExtensionAvailable();
    if (!extensionAvailable) {
      return { 
        success: false, 
        error: 'L\'extension Firebase WebAuthn n\'est pas installée. Veuillez contacter le support ou utiliser une autre méthode de connexion.',
        needsExtension: true
      };
    }

    // S'assurer que Firebase Functions est chargé
    await ensureFunctionsLoaded();
    
    // S'assurer qu'un utilisateur est authentifié (anonymement si nécessaire)
    await ensureAuthenticated();
    
    // Utiliser l'extension Firebase WebAuthn
    const app = firebase.app();
    let functions = app.functions('europe-west1');
    let apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
    
    let result;
    try {
      result = await apiFunction({
        action: 'signIn',
        email: email
      });
    } catch (regionError) {
      // Si europe-west1 échoue, essayer us-central1 (fallback)
      if (regionError.code === 'functions/not-found' || regionError.message?.includes('not found') || regionError.code === 'internal') {
        functions = app.functions('us-central1');
        apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
        result = await apiFunction({
          action: 'signIn',
          email: email
        });
      } else {
        throw regionError;
      }
    }

    if (result.data.success) {
      return { success: true, user: auth.currentUser };
    } else {
      if (result.data.error?.includes('not found') || result.data.error?.includes('not registered')) {
        return { 
          success: false, 
          error: 'Aucun passkey trouvé pour cet email.',
          canCreate: true
        };
      }
      return { success: false, error: result.data.error || 'Erreur lors de la connexion' };
    }
  } catch (error) {
    console.error('Erreur connexion avec passkey (legacy):', error);
    return { 
      success: false, 
      error: error.message || 'Une erreur est survenue lors de la connexion avec passkey.' 
    };
  }
}

/**
 * Lier un passkey à un compte existant
 * Nécessite l'extension Firebase WebAuthn et un utilisateur connecté
 */
async function linkPasskeyToAccount() {
  try {
    // Vérifier qu'un utilisateur est connecté
    const user = auth.currentUser;
    if (!user) {
      return { 
        success: false, 
        error: 'Vous devez être connecté pour lier un passkey à votre compte.' 
      };
    }

    // Vérifier le support WebAuthn
    if (!isWebAuthnSupported()) {
      return { 
        success: false, 
        error: 'Les passkeys ne sont pas supportés par votre navigateur.' 
      };
    }

    // Vérifier si l'extension est disponible
    const extensionAvailable = await isWebAuthnExtensionAvailable();
    if (!extensionAvailable) {
      return { 
        success: false, 
        error: 'L\'extension Firebase WebAuthn n\'est pas installée.',
        needsExtension: true
      };
    }

    // S'assurer que Firebase Functions est chargé
    await ensureFunctionsLoaded();
    
    // S'assurer qu'un utilisateur est authentifié (anonymement si nécessaire)
    await ensureAuthenticated();
    
    // Utiliser l'extension Firebase WebAuthn
    // L'extension expose une fonction unique : ext-firebase-web-authn-fu06-api
    // Essayer d'abord europe-west1 (région configurée)
    // Dans le mode compat, on utilise firebase.app().functions('region')
    const app = firebase.app();
    let functions = app.functions('europe-west1');
    // Utiliser la fonction api de l'extension avec l'action 'linkPasskey'
    let apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
    
    let result;
    try {
      result = await apiFunction({
        action: 'linkPasskey'
      });
    } catch (regionError) {
      // Si europe-west1 échoue, essayer us-central1 (fallback)
      if (regionError.code === 'functions/not-found' || regionError.message?.includes('not found') || regionError.code === 'internal') {
        functions = app.functions('us-central1');
        apiFunction = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
        result = await apiFunction({
          action: 'linkPasskey'
        });
      } else {
        throw regionError;
      }
    }

    if (result.data.success) {
      return { success: true };
    } else {
      return { success: false, error: result.data.error || 'Erreur lors de la liaison du passkey' };
    }
  } catch (error) {
    console.error('Erreur liaison passkey:', error);
    
    if (error.code === 'functions/not-found') {
      return { 
        success: false, 
        error: 'L\'extension Firebase WebAuthn n\'est pas installée.',
        needsExtension: true
      };
    }
    
    // Gérer les erreurs CORS
    if (error.code === 'internal' || error.message?.includes('CORS') || error.message?.includes('Access-Control')) {
      return { 
        success: false, 
        error: 'L\'extension Firebase WebAuthn n\'est pas correctement configurée pour accepter les requêtes depuis ce domaine. Veuillez contacter le support.',
        needsExtension: true
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Une erreur est survenue lors de la liaison du passkey.' 
    };
  }
}

// Exporter les fonctions pour utilisation globale
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
};

