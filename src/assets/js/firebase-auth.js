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
  script1.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
  document.head.appendChild(script1);
  
  const script2 = document.createElement('script');
  script2.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js';
  document.head.appendChild(script2);
  
  const script3 = document.createElement('script');
  script3.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js';
  document.head.appendChild(script3);
  
  script3.onload = () => {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    initAuth();
  };
} else {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  initAuth();
}

let auth, db;

function initAuth() {
  auth = firebase.auth();
  db = firebase.firestore();
  
  // Écouter les changements d'état d'authentification
  auth.onAuthStateChanged((user) => {
    if (user) {
      // Utilisateur connecté
      updateUIForAuthenticatedUser(user);
      loadProtectedContent();
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
      functionsScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js';
      document.head.appendChild(functionsScript);
      await new Promise((resolve) => {
        functionsScript.onload = resolve;
      });
    }

    // Spécifier la région europe-west1 où la fonction est déployée
    const verifyTokenFunction = firebase.functions('europe-west1').httpsCallable('verifyToken');
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
      
      // Attendre un peu pour que l'état d'authentification soit mis à jour
      await new Promise(resolve => setTimeout(resolve, 200));
      
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
  try {
    // Configuration par défaut : lien valide pour cette page
    const defaultSettings = {
      url: window.location.origin + '/connexion-firebase',
      handleCodeInApp: true
    };
    
    const settings = actionCodeSettings || defaultSettings;
    
    await auth.sendSignInLinkToEmail(email, settings);
    return { success: true };
  } catch (error) {
    console.error('Send sign in link error:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
}

/**
 * Vérifie si un lien de connexion passwordless est présent dans l'URL
 */
async function handleSignInLink() {
  try {
    // Vérifier si un lien de connexion est présent dans l'URL
    if (auth.isSignInWithEmailLink(window.location.href)) {
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
        return { success: false, error: 'Contenu non trouvé' };
      }

      const contentData = contentDoc.data();
      
      // Vérifier que l'utilisateur a accès à ce produit
      if (contentData.product !== userProduct) {
        return { success: false, error: 'Accès non autorisé à ce contenu' };
      }

      return { 
        success: true, 
        content: contentData.content || '', 
        product: userProduct,
        title: contentData.title || '',
        metadata: {
          createdAt: contentData.createdAt,
          updatedAt: contentData.updatedAt
        }
      };
    }

    // Sinon, charger la liste des contenus disponibles pour ce produit
    const contentsSnapshot = await db.collection('protectedContent')
      .where('product', '==', userProduct)
      .orderBy('createdAt', 'desc')
      .get();
    
    const contents = [];
    contentsSnapshot.forEach((doc) => {
      const data = doc.data();
      contents.push({
        id: doc.id,
        title: data.title || doc.id,
        content: data.content || '',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });

    return { success: true, contents, product: userProduct };
  } catch (error) {
    console.error('Error loading protected content:', error);
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

// Exporter les fonctions pour utilisation globale
window.FluanceAuth = {
  signIn,
  signOut,
  sendSignInLink,
  handleSignInLink,
  verifyTokenAndCreateAccount,
  loadProtectedContent,
  displayProtectedContent,
  getCurrentUser: () => auth?.currentUser,
  isAuthenticated: () => !!auth?.currentUser
};

