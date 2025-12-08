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

    <!-- Onglets pour choisir la méthode de connexion -->
    <div class="mb-6 border-b border-gray-200">
      <nav class="flex -mb-px">
        <button
          id="tab-password"
          class="flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 border-green-600 text-green-600"
          onclick="switchTab('password')"
        >
          Mot de passe
        </button>
        <button
          id="tab-passwordless"
          class="flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          onclick="switchTab('passwordless')"
        >
          Lien magique
        </button>
      </nav>
    </div>

    <!-- Formulaire avec mot de passe -->
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

      <div id="password-field">
        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
          Mot de passe
        </label>
        <input
          type="password"
          id="password"
          name="password"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Votre mot de passe"
        />
      </div>

      <div id="success-message" class="hidden bg-green-50 border border-green-200 rounded-lg p-4">
        <p class="text-green-800 text-sm"></p>
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
let currentTab = 'password';

// Fonction pour changer d'onglet
function switchTab(tab) {
  currentTab = tab;
  const passwordTab = document.getElementById('tab-password');
  const passwordlessTab = document.getElementById('tab-passwordless');
  const passwordField = document.getElementById('password-field');
  const passwordInput = document.getElementById('password');
  const buttonText = document.getElementById('button-text');

  if (tab === 'password') {
    passwordTab.classList.add('border-green-600', 'text-green-600');
    passwordTab.classList.remove('border-transparent', 'text-gray-500');
    passwordlessTab.classList.remove('border-green-600', 'text-green-600');
    passwordlessTab.classList.add('border-transparent', 'text-gray-500');
    passwordField.style.display = 'block';
    passwordInput.required = true;
    buttonText.textContent = 'Se connecter';
  } else {
    passwordlessTab.classList.add('border-green-600', 'text-green-600');
    passwordlessTab.classList.remove('border-transparent', 'text-gray-500');
    passwordTab.classList.remove('border-green-600', 'text-green-600');
    passwordTab.classList.add('border-transparent', 'text-gray-500');
    passwordField.style.display = 'none';
    passwordInput.required = false;
    passwordInput.value = '';
    buttonText.textContent = 'Envoyer le lien magique';
  }
  
  hideError();
  hideSuccess();
}

document.addEventListener('DOMContentLoaded', async function() {
  // Vérifier si un lien passwordless est présent dans l'URL
  try {
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

    const linkResult = await window.FluanceAuth.handleSignInLink();
    if (linkResult.success) {
      // Connexion réussie avec le lien
      const returnUrl = new URLSearchParams(window.location.search).get('return') || '/';
      window.location.href = returnUrl;
      return;
    }
  } catch (error) {
    console.error('Error handling sign in link:', error);
  }

  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  const submitButton = document.getElementById('submit-button');
  const buttonText = document.getElementById('button-text');
  const buttonSpinner = document.getElementById('button-spinner');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email) {
      showError('Veuillez entrer votre email.');
      return;
    }

    if (currentTab === 'password' && !password) {
      showError('Veuillez entrer votre mot de passe.');
      return;
    }

    // Désactiver le bouton et afficher le spinner
    submitButton.disabled = true;
    buttonText.textContent = currentTab === 'password' ? 'Connexion...' : 'Envoi...';
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

      if (currentTab === 'password') {
        // Connexion avec mot de passe
        const result = await window.FluanceAuth.signIn(email, password);

        if (result.success) {
          // Rediriger vers la page d'origine ou la page d'accueil
          const returnUrl = new URLSearchParams(window.location.search).get('return') || '/';
          window.location.href = returnUrl;
        } else {
          showError(result.error || 'Erreur lors de la connexion.');
        }
      } else {
        // Envoi du lien passwordless
        // Sauvegarder l'email dans localStorage pour la vérification du lien
        window.localStorage.setItem('emailForSignIn', email);
        
        const result = await window.FluanceAuth.sendSignInLink(email);

        if (result.success) {
          showSuccess('Un lien de connexion a été envoyé à votre email. Cliquez sur le lien pour vous connecter.');
        } else {
          showError(result.error || 'Erreur lors de l\'envoi du lien.');
          window.localStorage.removeItem('emailForSignIn');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Une erreur est survenue. Veuillez réessayer.');
      if (currentTab === 'passwordless') {
        window.localStorage.removeItem('emailForSignIn');
      }
    } finally {
      submitButton.disabled = false;
      buttonText.textContent = currentTab === 'password' ? 'Se connecter' : 'Envoyer le lien magique';
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



