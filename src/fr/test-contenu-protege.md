---
layout: base.njk
title: Test - Contenu protégé
description: Page de test pour le contenu protégé
lang: fr
permalink: /test-contenu-protege/
---

<section class="max-w-4xl mx-auto px-6 py-16">
  <div class="bg-white rounded-lg shadow-lg p-8 space-y-8">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Test du contenu protégé</h1>
      <p class="text-gray-600">
        Cette page permet de tester l'affichage du contenu protégé après connexion.
      </p>
    </header>

    <div class="bg-gray-50 rounded-lg p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">Instructions de test :</h2>
      <ol class="list-decimal list-inside space-y-2 text-gray-700">
        <li>Créez un token dans Firestore (collection <code>registrationTokens</code>)</li>
        <li>Créez un compte via <code>/creer-compte?token=VOTRE_TOKEN</code></li>
        <li>Connectez-vous via <code>/connexion-firebase/</code></li>
        <li>Ajoutez du contenu dans Firestore (collection <code>protectedContent</code>)</li>
        <li>Le contenu devrait s'afficher ci-dessous</li>
      </ol>
    </div>

    <div class="border-t pt-8">
      <h2 class="text-2xl font-semibold mb-6">Contenu protégé de test :</h2>
      
      {% protectedContent "test-video-1" %}
    </div>

    <div class="border-t pt-8">
      <h2 class="text-xl font-semibold mb-4">État de l'authentification :</h2>
      <div id="auth-status" class="bg-gray-100 rounded-lg p-4">
        <p class="text-gray-600">Vérification...</p>
      </div>
    </div>
  </div>
</section>

<script src="/assets/js/firebase-auth.js"></script>
<script src="/assets/js/protected-content.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  const authStatus = document.getElementById('auth-status');
  
  function updateAuthStatus() {
    if (typeof window.FluanceAuth !== 'undefined') {
      const isAuth = window.FluanceAuth.isAuthenticated();
      const user = window.FluanceAuth.getCurrentUser();
      
      if (isAuth && user) {
        authStatus.innerHTML = `
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <p class="text-green-800 font-semibold mb-2">✅ Connecté</p>
            <p class="text-green-700 text-sm">Email : ${user.email}</p>
            <p class="text-green-700 text-sm">UID : ${user.uid}</p>
          </div>
        `;
      } else {
        authStatus.innerHTML = `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p class="text-yellow-800 font-semibold mb-2">⚠️ Non connecté</p>
            <p class="text-yellow-700 text-sm mb-3">Vous devez être connecté pour voir le contenu protégé.</p>
            <a href="/connexion-firebase?return=${encodeURIComponent(window.location.pathname)}" 
               class="inline-block bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm">
              Se connecter
            </a>
          </div>
        `;
      }
    } else {
      authStatus.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-800">❌ Erreur : Script Firebase Auth non chargé</p>
        </div>
      `;
    }
  }
  
  // Mettre à jour immédiatement
  updateAuthStatus();
  
  // Mettre à jour après un délai (au cas où le script se charge plus tard)
  setTimeout(updateAuthStatus, 1000);
  
  // Écouter les changements d'authentification
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => {
      updateAuthStatus();
    });
  }
});
</script>

