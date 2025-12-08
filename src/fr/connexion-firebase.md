---
layout: base.njk
title: Connexion - Contenu protégé
description: Connectez-vous pour accéder à votre contenu protégé Fluance
locale: fr
permalink: /connexion-firebase/
---

<div class="min-h-screen bg-[#fdfaf6] py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 section-card">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-[#0f172a] mb-2">Connexion</h1>
      <p class="text-[#1f1f1f]/80">Accédez à votre contenu protégé Fluance</p>
    </div>

    <!-- Onglets pour choisir la méthode de connexion -->
    <div class="mb-6 border-b border-[#82153e]/20">
      <nav class="flex -mb-px">
        <button
          id="tab-password"
          class="flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 border-[#82153e] text-[#82153e]"
          onclick="switchTab('password')"
        >
          Mot de passe
        </button>
        <button
          id="tab-passwordless"
          class="flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 border-transparent text-[#1f1f1f]/60 hover:text-[#82153e] hover:border-[#82153e]/30"
          onclick="switchTab('passwordless')"
        >
          Connexion par email
        </button>
      </nav>
    </div>

    <!-- Formulaire avec mot de passe -->
    <form id="login-form" class="space-y-6">
      <div>
        <label for="email" class="block text-sm font-medium text-[#0f172a] mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          class="w-full px-4 py-2 border border-[#82153e]/20 rounded-lg focus:ring-2 focus:ring-[#82153e] focus:border-[#82153e] text-[#0f172a]"
          placeholder="votre@email.com"
        />
      </div>

      <div id="password-field">
        <div class="flex items-center justify-between mb-2">
          <label for="password" class="block text-sm font-medium text-[#0f172a]">
            Mot de passe
          </label>
          <a href="/reinitialiser-mot-de-passe" class="text-sm text-[#82153e] hover:text-[#82153e]/80">
            Mot de passe oublié ?
          </a>
        </div>
        <input
          type="password"
          id="password"
          name="password"
          class="w-full px-4 py-2 border border-[#82153e]/20 rounded-lg focus:ring-2 focus:ring-[#82153e] focus:border-[#82153e] text-[#0f172a]"
          placeholder="Votre mot de passe"
        />
      </div>

      <div id="success-message" class="hidden bg-[#ffce2d]/10 border border-[#ffce2d]/30 rounded-lg p-4">
        <p class="text-[#0f172a] text-sm"></p>
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-[#82153e] text-white py-3 px-4 rounded-lg font-semibold hover:bg-[#82153e]/90 transition-colors duration-200 flex items-center justify-center"
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
      <p class="text-sm text-[#1f1f1f]/80">
        Pas encore de compte ? 
        <a href="/creer-compte" class="text-[#82153e] hover:text-[#82153e]/80 font-medium">Créer un compte</a>
      </p>
      <p class="text-sm text-[#1f1f1f]/60">
        <a href="/connexion" class="hover:text-[#82153e]">Retour à la page de connexion principale</a>
      </p>
    </div>

    <!-- Section d'aide dépliable -->
    <div class="mt-8 border-t border-[#82153e]/20 pt-6">
      <button
        id="help-toggle"
        class="w-full flex items-center justify-between text-left text-sm font-medium text-[#82153e] hover:text-[#82153e]/80 transition-colors"
        onclick="toggleHelp()"
      >
        <span>❓ Besoin d'aide ?</span>
        <svg id="help-arrow" class="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div id="help-content" class="hidden mt-4 space-y-4 text-sm text-[#1f1f1f]/80">
        <div>
          <p class="font-semibold text-[#0f172a] mb-1">Je ne trouve pas mon email/code</p>
          <p>→ Vérifiez vos courriers indésirables (spams).</p>
        </div>
        <div>
          <p class="font-semibold text-[#0f172a] mb-1">Le code ne fonctionne pas</p>
          <p>→ Assurez-vous de copier-coller le code complet, sans espace</p>
        </div>
        <div>
          <p class="font-semibold text-[#0f172a] mb-1">Qu'est-ce que la « Connexion par e-mail » ?</p>
          <p>C'est la méthode de connexion sans mot de passe. Nous vous envoyons un e-mail contenant un lien unique, utilisable une seule fois, pour vous identifier. C'est simple et très sécurisé.</p>
        </div>
        <div>
          <p class="font-semibold text-[#0f172a] mb-1">Encore besoin d'aide ?</p>
          <p><a href="/contact" class="text-[#82153e] hover:underline">Contactez-nous.</a></p>
        </div>
      </div>
    </div>
  </div>
</div>

<script src="/assets/js/firebase-auth.js"></script>
<script>
let currentTab = 'password';
let errorDiv, successDiv; // Variables globales pour les divs d'erreur/succès

// Fonctions globales pour gérer les messages d'erreur/succès
function showError(message) {
  if (errorDiv && successDiv) {
    errorDiv.querySelector('p').textContent = message;
    errorDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
  }
}

function hideError() {
  if (errorDiv) {
    errorDiv.classList.add('hidden');
  }
}

function showSuccess(message) {
  if (successDiv && errorDiv) {
    successDiv.querySelector('p').textContent = message;
    successDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
  }
}

function hideSuccess() {
  if (successDiv) {
    successDiv.classList.add('hidden');
  }
}

// Fonction pour changer d'onglet
function switchTab(tab) {
  currentTab = tab;
  const passwordTab = document.getElementById('tab-password');
  const passwordlessTab = document.getElementById('tab-passwordless');
  const passwordField = document.getElementById('password-field');
  const passwordInput = document.getElementById('password');
  const buttonText = document.getElementById('button-text');

  if (tab === 'password') {
    passwordTab.classList.add('border-[#82153e]', 'text-[#82153e]');
    passwordTab.classList.remove('border-transparent', 'text-[#1f1f1f]/60');
    passwordlessTab.classList.remove('border-[#82153e]', 'text-[#82153e]');
    passwordlessTab.classList.add('border-transparent', 'text-[#1f1f1f]/60');
    passwordField.style.display = 'block';
    passwordInput.required = true;
    buttonText.textContent = 'Se connecter';
  } else {
    passwordlessTab.classList.add('border-[#82153e]', 'text-[#82153e]');
    passwordlessTab.classList.remove('border-transparent', 'text-[#1f1f1f]/60');
    passwordTab.classList.remove('border-[#82153e]', 'text-[#82153e]');
    passwordTab.classList.add('border-transparent', 'text-[#1f1f1f]/60');
    passwordField.style.display = 'none';
    passwordInput.required = false;
    passwordInput.value = '';
    buttonText.textContent = 'Envoyer le lien de connexion';
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
  errorDiv = document.getElementById('error-message'); // Assigner à la variable globale
  successDiv = document.getElementById('success-message'); // Assigner à la variable globale
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
      buttonText.textContent = currentTab === 'password' ? 'Se connecter' : 'Envoyer le lien de connexion';
      buttonSpinner.classList.add('hidden');
    }
  });

  // Les fonctions showError, hideError, showSuccess, hideSuccess sont déjà définies globalement
  // Fonction pour toggle la section d'aide
  function toggleHelp() {
    const helpContent = document.getElementById('help-content');
    const helpArrow = document.getElementById('help-arrow');
    if (helpContent && helpArrow) {
      helpContent.classList.toggle('hidden');
      helpArrow.classList.toggle('rotate-180');
    }
  }
  window.toggleHelp = toggleHelp;
});
</script>



