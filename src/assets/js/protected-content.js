/**
 * Script pour gérer l'affichage du contenu protégé
 * Ce script est chargé une seule fois et gère tous les éléments .protected-content
 */

console.log('[Protected Content] Script loaded');

document.addEventListener('DOMContentLoaded', async function() {
  console.log('[Protected Content] DOMContentLoaded fired');
  
  // Attendre que Firebase soit complètement initialisé
  await new Promise((resolve) => {
    if (typeof window.FluanceAuth !== 'undefined' && 
        typeof firebase !== 'undefined' && 
        firebase.apps.length > 0) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (typeof window.FluanceAuth !== 'undefined' && 
            typeof firebase !== 'undefined' && 
            firebase.apps.length > 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      // Timeout de sécurité après 3 secondes (réduit de 5s)
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    }
  });
  
  console.log('[Protected Content] Looking for protected content elements...');
  const protectedContentElements = document.querySelectorAll('.protected-content[data-content-id]');
  console.log('[Protected Content] Found', protectedContentElements.length, 'protected content elements');
  
  // Fonction pour charger le contenu protégé
  function loadProtectedContentForElement(element) {
    const contentId = element.getAttribute('data-content-id');
    console.log('[Protected Content] Loading content for element:', contentId);
    
    // Fonction utilitaire : le SDK Firebase est-il chargé ?
    function sdkReady() {
      return typeof window.FluanceAuth !== 'undefined' &&
             typeof firebase !== 'undefined' &&
             typeof firebase.auth === 'function';
    }
    
    // Fonction pour vérifier et charger le contenu
    function checkAuthAndLoad() {
      console.log('[Protected Content] checkAuthAndLoad called for:', contentId);
      
      // SDK pas encore chargé : garder le placeholder de chargement et réessayer
      // (on n'affiche JAMAIS « veuillez vous connecter » avant d'avoir confirmé l'état)
      if (!sdkReady()) {
        console.log('[Protected Content] SDK pas encore prêt, nouvel essai dans 250ms');
        setTimeout(checkAuthAndLoad, 250);
        return;
      }
      
      // Vérifier l'authentification avec plusieurs méthodes
      let isAuth = false;
      let currentUser = null;
      
      // Méthode 1 : via FluanceAuth
      if (window.FluanceAuth) {
        isAuth = window.FluanceAuth.isAuthenticated();
        currentUser = window.FluanceAuth.getCurrentUser();
        console.log('[Protected Content] FluanceAuth check - isAuth:', isAuth, 'user:', currentUser ? currentUser.email : 'null');
      } else {
        console.log('[Protected Content] window.FluanceAuth is undefined');
      }
      
      // Méthode 2 : directement via firebase.auth() (fallback)
      if (!isAuth && typeof firebase !== 'undefined' && firebase.auth) {
        currentUser = firebase.auth().currentUser;
        isAuth = !!currentUser;
        console.log('[Protected Content] Firebase direct check - isAuth:', isAuth, 'user:', currentUser ? currentUser.email : 'null');
      } else if (typeof firebase === 'undefined') {
        console.log('[Protected Content] firebase is undefined');
      } else if (!firebase.auth) {
        console.log('[Protected Content] firebase.auth is undefined');
      }
      
      console.log('[Protected Content] Final auth check - isAuth:', isAuth, 'has FluanceAuth:', !!window.FluanceAuth);
      
      if (isAuth && window.FluanceAuth) {
        // Charger et afficher le contenu
        console.log('[Protected Content] User authenticated, loading content for:', contentId);
        window.FluanceAuth.displayProtectedContent(contentId, element).catch(err => {
          console.error('[Protected Content] Error loading protected content:', err);
          element.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <p class="text-red-800">Erreur lors du chargement du contenu : ${err.message || err}</p>
            </div>
          `;
        });
      } else {
        // Afficher un message de connexion
        console.log('[Protected Content] User not authenticated, showing login message');
        element.innerHTML = `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p class="text-yellow-800 mb-4">Veuillez vous connecter pour accéder à ce contenu.</p>
            <a href="/connexion-membre/?return=${encodeURIComponent(window.location.pathname)}" class="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
              Se connecter
            </a>
          </div>
        `;
      }
    }
    
    // Attendre que le SDK soit chargé, puis s'abonner à onAuthStateChanged :
    // son premier appel correspond à l'état CONFIRMÉ par Firebase (évite le flash
    // « veuillez vous connecter » pendant la restauration de session)
    function waitForSdk() {
      if (!sdkReady()) {
        console.log('[Protected Content] SDK pas encore prêt, nouvelle attente dans 250ms');
        setTimeout(waitForSdk, 250);
        return;
      }
      console.log('[Protected Content] SDK prêt, abonnement à onAuthStateChanged');
      firebase.auth().onAuthStateChanged(() => {
        console.log('[Protected Content] Auth state changed (confirmé)');
        checkAuthAndLoad();
      });
      // Filet de sécurité si l'événement ne se déclenche pas
      setTimeout(() => {
        console.log('[Protected Content] Fallback check après 1500ms');
        checkAuthAndLoad();
      }, 1500);
    }
    waitForSdk();
  }
  
  // Charger le contenu pour chaque élément
  protectedContentElements.forEach((element) => {
    loadProtectedContentForElement(element);
  });
});
