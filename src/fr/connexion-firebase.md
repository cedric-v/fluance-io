---
layout: base.njk
title: Connexion - Contenu protégé
description: Connectez-vous pour accéder à votre contenu protégé Fluance
lang: fr
permalink: /connexion-firebase/
---

<div class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Connexion</h1>
      <p class="text-gray-600">Accédez à votre contenu protégé Fluance</p>
    </div>

    <form id="login-form" class="space-y-6">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="votre@email.com"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
          Mot de passe
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Votre mot de passe"
        />
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="button-text">Se connecter</span>
        <span id="button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </form>

    <div class="mt-6 text-center space-y-2">
      <p class="text-sm text-gray-600">
        Pas encore de compte ? 
        <a href="/creer-compte" class="text-green-600 hover:text-green-700 font-medium">Créer un compte</a>
      </p>
      <p class="text-sm text-gray-600">
        <a href="/connexion" class="text-gray-500 hover:text-gray-700">Retour à la page de connexion principale</a>
      </p>
    </div>
  </div>
</div>

<script src="/assets/js/firebase-auth.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('error-message');
  const submitButton = document.getElementById('submit-button');
  const buttonText = document.getElementById('button-text');
  const buttonSpinner = document.getElementById('button-spinner');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showError('Veuillez remplir tous les champs.');
      return;
    }

    // Désactiver le bouton et afficher le spinner
    submitButton.disabled = true;
    buttonText.textContent = 'Connexion...';
    buttonSpinner.classList.remove('hidden');
    hideError();

    try {
      // Attendre que Firebase soit initialisé
      await new Promise((resolve) => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
          resolve();
        } else {
          const checkInterval = setInterval(() => {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        }
      });

      const result = await window.FluanceAuth.signIn(email, password);

      if (result.success) {
        // Rediriger vers la page d'origine ou la page d'accueil
        const returnUrl = new URLSearchParams(window.location.search).get('return') || '/';
        window.location.href = returnUrl;
      } else {
        showError(result.error || 'Erreur lors de la connexion.');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      submitButton.disabled = false;
      buttonText.textContent = 'Se connecter';
      buttonSpinner.classList.add('hidden');
    }
  });

  function showError(message) {
    errorDiv.querySelector('p').textContent = message;
    errorDiv.classList.remove('hidden');
  }

  function hideError() {
    errorDiv.classList.add('hidden');
  }
});
</script>

