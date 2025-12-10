/**
 * Firebase Authentication pour Fluance
 * Gère l'authentification et l'accès au contenu protégé
 */

// Configuration Firebase pour fluance-protected-content
// ⚠️ IMPORTANT : Remplacez ces valeurs par celles de votre projet Firebase
// Voir OBTENIR_CONFIGURATION_FIREBASE.md pour obtenir les vraies clés
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDJ-VlDMC5PUEMeILLZ8OmdYIhvhxIfhdM",
  authDomain: "fluance-protected-content.firebaseapp.com",
  projectId: "fluance-protected-content",
  storageBucket: "fluance-protected-content.firebasestorage.app",
  messagingSenderId: "173938686776",
  appId: "1:173938686776:web:891caf76098a42c3579fcd",
  measurementId: "G-CWPNXDQEYR"
};

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
  
  // Configurer la persistance de session (LOCAL par défaut, mais on s'assure qu'elle est active)
  // La persistance LOCAL permet de garder la session même après fermeture du navigateur
  if (auth.setPersistence) {
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
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
async function signIn(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: getErrorMessage(error.code) };
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
      url: window.location.origin + '/connexion-membre',
      handleCodeInApp: true
    };
    
    const settings = actionCodeSettings || defaultSettings;
    
    console.log('[Firebase Auth] Envoi du lien de connexion à:', email);
    console.log('[Firebase Auth] Paramètres:', settings);
    console.log('[Firebase Auth] URL complète:', settings.url);
    console.log('[Firebase Auth] handleCodeInApp:', settings.handleCodeInApp);
    
    console.log('[Firebase Auth] Appel de auth.sendSignInLinkToEmail...');
    await auth.sendSignInLinkToEmail(email, settings);
    
    console.log('[Firebase Auth] ✅ Lien de connexion envoyé avec succès');
    return { success: true };
  } catch (error) {
    console.error('[Firebase Auth] ❌ ERREUR lors de l\'envoi du lien');
    console.error('[Firebase Auth] Erreur complète:', error);
    console.error('[Firebase Auth] Code d\'erreur:', error.code);
    console.error('[Firebase Auth] Message d\'erreur:', error.message);
    console.error('[Firebase Auth] Stack:', error.stack);
    
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
    if (!auth) {
      auth = firebase.auth();
    }

    // Détecter la langue depuis l'URL ou le chemin
    const isEnglish = window.location.pathname.startsWith('/en/');
    const resetPath = isEnglish ? '/en/reset-password' : '/reinitialiser-mot-de-passe';

    // Configuration pour le lien de réinitialisation
    const actionCodeSettings = {
      url: window.location.origin + resetPath,
      handleCodeInApp: true
    };

    await auth.sendPasswordResetEmail(email, actionCodeSettings);
    return { success: true };
  } catch (error) {
    console.error('Send password reset email error:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

/**
 * Confirme la réinitialisation de mot de passe avec le code d'action
 */
async function confirmPasswordReset(actionCode, newPassword) {
  try {
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
 */
async function verifyPasswordResetCode(actionCode) {
  try {
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
      return { success: false, error: 'Non authentifié' };
    }

    // Récupérer les informations de l'utilisateur depuis Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    const userData = userDoc.data();
    const userProduct = userData.product;
    
    // Si un contentId est spécifié, charger ce contenu spécifique
    if (contentId) {
      const contentDoc = await db.collection('protectedContent').doc(contentId).get();
      
      if (!contentDoc.exists) {
        return { 
          success: false, 
          error: `Contenu non trouvé (ID: ${contentId}). Vérifiez que le document existe dans Firestore avec le produit "${userProduct}".` 
        };
      }

      const contentData = contentDoc.data();
      
      // Vérifier que l'utilisateur a accès à ce produit
      if (contentData.product !== userProduct) {
        return { 
          success: false, 
          error: `Accès non autorisé. Ce contenu est pour le produit "${contentData.product || 'inconnu'}", mais vous avez accès à "${userProduct}".` 
        };
      }

      // Pour le produit "21jours", vérifier l'accès progressif basé sur le jour
      if (userProduct === '21jours' && contentData.day !== undefined) {
        let registrationDate = userData.registrationDate;
        
        // Fallback : si registrationDate n'existe pas, utiliser createdAt ou date actuelle
        if (!registrationDate) {
          registrationDate = userData.createdAt;
          // Si createdAt n'existe pas non plus, utiliser la date actuelle (accès immédiat)
          if (!registrationDate) {
            console.warn('registrationDate et createdAt manquants, utilisation de la date actuelle');
            registrationDate = { toDate: () => new Date() };
          } else {
            // Mettre à jour le document utilisateur avec registrationDate pour les prochaines fois
            console.warn('registrationDate manquant, utilisation de createdAt. Mise à jour du document utilisateur...');
            db.collection('users').doc(user.uid).update({
              registrationDate: userData.createdAt
            }).catch(err => console.error('Erreur lors de la mise à jour de registrationDate:', err));
          }
        }

        // Calculer le nombre de jours depuis l'inscription
        const now = new Date();
        const registration = registrationDate.toDate();
        const daysSinceRegistration = Math.floor((now - registration) / (1000 * 60 * 60 * 24));
        const dayNumber = contentData.day;

        // Jour 0 (déroulé) accessible immédiatement
        // Jours 1-21 : accessibles à partir du jour correspondant
        // Jour 22 (bonus) : accessible au jour 22 (daysSinceRegistration >= 21)
        if (dayNumber > 0 && daysSinceRegistration < dayNumber - 1) {
          const daysRemaining = dayNumber - daysSinceRegistration - 1;
          return { 
            success: false, 
            error: `Ce contenu sera disponible dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}. Vous êtes au jour ${daysSinceRegistration + 1} du défi.` 
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

    // Sinon, charger la liste des contenus disponibles pour ce produit
    try {
      let query = db.collection('protectedContent').where('product', '==', userProduct);
      
      // Pour "21jours", trier par jour (0-21) au lieu de createdAt
      if (userProduct === '21jours') {
        query = query.orderBy('day', 'asc');
      } else {
        query = query.orderBy('createdAt', 'desc');
      }
      
      const contentsSnapshot = await query.get();
      
      const contents = [];
      const now = new Date();
      let registrationDate = userData.registrationDate;
      
      // Fallback : si registrationDate n'existe pas, utiliser createdAt ou date actuelle
      if (!registrationDate) {
        registrationDate = userData.createdAt;
        if (!registrationDate) {
          console.warn('registrationDate et createdAt manquants, utilisation de la date actuelle');
          registrationDate = { toDate: () => new Date() };
        } else {
          // Mettre à jour le document utilisateur avec registrationDate pour les prochaines fois
          console.warn('registrationDate manquant, utilisation de createdAt. Mise à jour du document utilisateur...');
          db.collection('users').doc(user.uid).update({
            registrationDate: userData.createdAt
          }).catch(err => console.error('Erreur lors de la mise à jour de registrationDate:', err));
        }
      }
      
      const daysSinceRegistration = registrationDate 
        ? Math.floor((now - registrationDate.toDate()) / (1000 * 60 * 60 * 24))
        : 0;
      
      contentsSnapshot.forEach((doc) => {
        const data = doc.data();
        const dayNumber = data.day;
        
        // Pour "21jours", vérifier l'accès progressif
        let isAccessible = true;
        if (userProduct === '21jours' && dayNumber !== undefined) {
          if (dayNumber === 0) {
            // Jour 0 (déroulé) accessible immédiatement
            isAccessible = true;
          } else if (daysSinceRegistration !== null) {
            // Jours 1-21 : accessibles à partir du jour correspondant
            // Jour 22 (bonus) : accessible au jour 22 (daysSinceRegistration >= 21)
            isAccessible = daysSinceRegistration >= dayNumber - 1;
          } else {
            isAccessible = false;
          }
        }
        
        const contentObj = {
          id: doc.id,
          title: data.title || doc.id,
          content: data.content || '',
          day: dayNumber,
          isAccessible: isAccessible,
          daysRemaining: (userProduct === '21jours' && dayNumber !== undefined && daysSinceRegistration !== null && dayNumber > 0)
            ? Math.max(0, dayNumber - daysSinceRegistration - 1)
            : null,
        };
        
        // Pour les autres produits (pas 21jours), ajouter createdAt/updatedAt pour le tri
        if (userProduct !== '21jours') {
          contentObj.createdAt = data.createdAt;
          contentObj.updatedAt = data.updatedAt;
        }
        
        contents.push(contentObj);
      });

      return { success: true, contents, product: userProduct, daysSinceRegistration };
    } catch (indexError) {
      // Si l'index est en cours de construction, essayer sans orderBy
      if (indexError.code === 'failed-precondition' && 
          indexError.message && 
          indexError.message.includes('index is currently building')) {
        console.warn('Index en cours de construction, chargement sans tri...');
        try {
          const contentsSnapshot = await db.collection('protectedContent')
            .where('product', '==', userProduct)
            .get();
          
          const contents = [];
          contentsSnapshot.forEach((doc) => {
            const data = doc.data();
            const contentObj = {
              id: doc.id,
              title: data.title || doc.id,
              content: data.content || '',
            };
            
            // Pour 21jours, trier par day
            if (userProduct === '21jours' && data.day !== undefined) {
              contentObj.day = data.day;
            } else {
              // Pour les autres produits, utiliser createdAt pour le tri
              contentObj.createdAt = data.createdAt;
              contentObj.updatedAt = data.updatedAt;
            }
            
            contents.push(contentObj);
          });
          
          // Trier manuellement côté client
          if (userProduct === '21jours') {
            // Trier par day pour 21jours
            contents.sort((a, b) => (a.day || 0) - (b.day || 0));
          } else {
            // Trier par createdAt pour les autres produits
            contents.sort((a, b) => {
              const aDate = a.createdAt?.toDate?.() || new Date(0);
              const bDate = b.createdAt?.toDate?.() || new Date(0);
              return bDate - aDate; // Descending
            });
          }

          return { success: true, contents, product: userProduct };
        } catch (fallbackError) {
          console.error('Error loading protected content (fallback):', fallbackError);
          return { 
            success: false, 
            error: 'L\'index Firestore est en cours de construction. Veuillez réessayer dans quelques minutes.' 
          };
        }
      }
      // Relancer l'erreur si ce n'est pas une erreur d'index en construction
      throw indexError;
    }
  } catch (error) {
    console.error('Error loading protected content:', error);
    
    // Message d'erreur plus clair pour l'index en construction
    if (error.code === 'failed-precondition' && 
        error.message && 
        error.message.includes('index is currently building')) {
      return { 
        success: false, 
        error: 'L\'index Firestore est en cours de construction. Veuillez réessayer dans quelques minutes.' 
      };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Charge un contenu protégé spécifique et l'affiche dans un élément
 */
async function displayProtectedContent(contentId, containerElement) {
  try {
    const result = await loadProtectedContent(contentId);
    
    if (!result.success) {
      containerElement.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-800">Erreur : ${result.error}</p>
        </div>
      `;
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
    'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/weak-password': 'Le mot de passe est trop faible.',
    'auth/invalid-email': 'Email invalide.',
    'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard.',
    'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre connexion internet.'
  };
  
  return errorMessages[errorCode] || 'Une erreur est survenue. Veuillez réessayer.';
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
  if (!firebase.functions) {
    // Charger Firebase Functions si pas déjà chargé
    const functionsScript = document.createElement('script');
    functionsScript.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';
    document.head.appendChild(functionsScript);
    
    return new Promise((resolve, reject) => {
      functionsScript.onload = () => {
        if (firebase.functions) {
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
        reject(new Error('Timeout lors du chargement de Firebase Functions'));
      }, 10000);
    });
  }
  return Promise.resolve();
}

/**
 * Vérifie si l'extension Firebase WebAuthn est disponible
 */
async function isWebAuthnExtensionAvailable() {
  try {
    // S'assurer que Firebase Functions est chargé
    await ensureFunctionsLoaded();
    
    // Vérifier si les fonctions de l'extension sont disponibles
    // L'extension expose une fonction unique : ext-firebase-web-authn-fu06-api
    // Utiliser la région europe-west1 (configurée dans extensions/firebase-web-authn-fu06.env)
    // Dans le mode compat, on utilise firebase.functions('region')
    // Essayer d'abord europe-west1 (région configurée)
    let functions = firebase.functions('europe-west1');
    // L'extension expose une fonction unique avec le nom de l'instance
    let checkExtension = functions.httpsCallable('ext-firebase-web-authn-fu06-api');
    
    try {
      // La fonction api accepte un paramètre 'action' pour différentes opérations
      const result = await checkExtension({ action: 'check' });
      return result.data?.available === true || result.data?.success === true;
    } catch (regionError) {
      // Si europe-west1 échoue, essayer us-central1 (fallback)
      if (regionError.code === 'functions/not-found' || regionError.message?.includes('not found')) {
        functions = firebase.functions('us-central1');
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
 * Nécessite l'extension Firebase WebAuthn
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
    
    // Utiliser l'extension Firebase WebAuthn
    // L'extension expose une fonction unique : ext-firebase-web-authn-fu06-api
    // Essayer d'abord europe-west1 (région configurée)
    // Dans le mode compat, on utilise firebase.functions('region')
    let functions = firebase.functions('europe-west1');
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
        functions = firebase.functions('us-central1');
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
 * Nécessite l'extension Firebase WebAuthn
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
    
    // Utiliser l'extension Firebase WebAuthn
    // L'extension expose une fonction unique : ext-firebase-web-authn-fu06-api
    // Essayer d'abord europe-west1 (région configurée)
    // Dans le mode compat, on utilise firebase.functions('region')
    let functions = firebase.functions('europe-west1');
    // Utiliser la fonction api de l'extension avec l'action 'signIn'
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
        functions = firebase.functions('us-central1');
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
      // L'utilisateur est automatiquement connecté
      return { success: true, user: auth.currentUser };
    } else {
      // Si le passkey n'existe pas, proposer de le créer
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
    console.error('Erreur connexion avec passkey:', error);
    
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
    
    // Utiliser l'extension Firebase WebAuthn
    // L'extension expose une fonction unique : ext-firebase-web-authn-fu06-api
    // Essayer d'abord europe-west1 (région configurée)
    // Dans le mode compat, on utilise firebase.functions('region')
    let functions = firebase.functions('europe-west1');
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
        functions = firebase.functions('us-central1');
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

