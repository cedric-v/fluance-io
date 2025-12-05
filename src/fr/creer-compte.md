---
layout: base.njk
title: Créer mon compte
description: Créez votre compte Fluance pour accéder à votre contenu protégé
lang: fr
permalink: /creer-compte/
---

<div class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Créer mon compte</h1>
      <p class="text-gray-600">Accédez à votre contenu protégé Fluance</p>
    </div>

    <div id="token-form" class="space-y-6">
      <div>
        <label for="token" class="block text-sm font-medium text-gray-700 mb-2">
          Token d'inscription
        </label>
        <input
          type="text"
          id="token"
          name="token"
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Votre token unique"
        />
        <p class="mt-1 text-sm text-gray-500">
          Ce token vous a été envoyé par email après votre achat.
        </p>
      </div>

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
          minlength="6"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Minimum 6 caractères"
        />
      </div>

      <div>
        <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-2">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          id="confirm-password"
          name="confirm-password"
          required
          minlength="6"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Répétez votre mot de passe"
        />
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <div id="success-message" class="hidden bg-green-50 border border-green-200 rounded-lg p-4">
        <p class="text-green-800 text-sm"></p>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="button-text">Créer mon compte</span>
        <span id="button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </div>

    <div class="mt-6 text-center">
      <p class="text-sm text-gray-600">
        Déjà un compte ? 
        <a href="/connexion" class="text-green-600 hover:text-green-700 font-medium">Se connecter</a>
      </p>
    </div>
  </div>
</div>

<script src="/assets/js/firebase-auth.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  // Récupérer le token depuis l'URL si présent
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    document.getElementById('token').value = tokenFromUrl;
  }

  const form = document.getElementById('token-form');
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  const submitButton = document.getElementById('submit-button');
  const buttonText = document.getElementById('button-text');
  const buttonSpinner = document.getElementById('button-spinner');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const token = document.getElementById('token').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validation
    if (!token || !email || !password || !confirmPassword) {
      showError('Veuillez remplir tous les champs.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 6) {
      showError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    // Désactiver le bouton et afficher le spinner
    submitButton.disabled = true;
    buttonText.textContent = 'Création en cours...';
    buttonSpinner.classList.remove('hidden');
    hideError();
    hideSuccess();

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

      const result = await window.FluanceAuth.verifyTokenAndCreateAccount(token, password, email);

      if (result.success) {
        showSuccess('Compte créé avec succès ! Redirection...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        showError(result.error || 'Erreur lors de la création du compte.');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      submitButton.disabled = false;
      buttonText.textContent = 'Créer mon compte';
      buttonSpinner.classList.add('hidden');
    }
  });

  function showError(message) {
    errorDiv.querySelector('p').textContent = message;
    errorDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
  }

  function hideError() {
    errorDiv.classList.add('hidden');
  }

  function showSuccess(message) {
    successDiv.querySelector('p').textContent = message;
    successDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
  }

  function hideSuccess() {
    successDiv.classList.add('hidden');
  }
});
</script>

