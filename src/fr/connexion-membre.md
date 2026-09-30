---
layout: base.njk
title: Connexion - Contenu protégé
description: Connectez-vous à votre espace membre Fluance pour accéder à tout votre contenu protégé, vos cours en ligne, vos vidéos et vos pratiques de mouvement libre.
locale: fr
robots: noindex, follow
permalink: /connexion-membre/
---

<div class="min-h-screen bg-[#fdfaf6] py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 section-card">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-[#3E3A35] mb-2">Connexion</h1>
      <p class="text-[#1f1f1f]/80">Accédez à votre contenu protégé Fluance</p>
    </div>

    <!-- Onglets pour choisir la méthode de connexion -->
    <div class="mb-6 border-b border-fluance/20">
      <nav class="flex -mb-px">
        <button
          id="tab-password"
          class="flex-1 py-3 px-4 min-h-12 flex items-center justify-center text-center font-medium text-sm border-b-2 border-fluance text-fluance"
          data-tab="password"
        >
          Mot de passe
        </button>
        <button
          id="tab-passwordless"
          class="flex-1 py-3 px-4 min-h-12 flex items-center justify-center text-center font-medium text-sm border-b-2 border-transparent text-[#1f1f1f]/60 hover:text-fluance hover:border-fluance/30"
          data-tab="passwordless"
        >
          Connexion par email
        </button>
      </nav>
    </div>

    <!-- Formulaire avec mot de passe -->
    <form id="login-form" class="space-y-6">
      <div>
        <label for="email" class="block text-sm font-medium text-[#3E3A35] mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#3E3A35]"
          placeholder="votre@email.com"
        />
      </div>

      <div id="password-field">
        <div class="flex items-center justify-between mb-2">
          <label for="password" class="block text-sm font-medium text-[#3E3A35]">
            Mot de passe
          </label>
          <a href="/reinitialiser-mot-de-passe/" class="text-sm text-fluance hover:text-fluance/80">
            Mot de passe oublié ?
          </a>
        </div>
        <input
          type="password"
          id="password"
          name="password"
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#3E3A35]"
          placeholder="Votre mot de passe"
        />
      </div>

      <div class="flex items-center justify-between mt-4 mb-2">
        <label class="flex items-center text-sm text-[#3E3A35]">
          <input
            type="checkbox"
            id="remember-me"
            name="remember"
            class="h-4 w-4 text-fluance border-fluance/40 rounded focus:ring-fluance"
          />
          <span class="ml-2 select-none">Rester connecté</span>
        </label>
      </div>

      <div id="success-message" class="hidden bg-[#E6B84A]/10 border border-[#E6B84A]/30 rounded-lg p-4">
        <p class="text-[#3E3A35] text-sm"></p>
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-6">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <h3 class="text-sm font-medium text-red-800 mb-2">Erreur de connexion</h3>
            <p class="text-sm text-red-700 mb-2" id="error-text"></p>
            <p class="text-xs text-red-600 mb-2 hidden" id="error-code"></p>
            <p class="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-3 mt-3 hidden" id="error-suggestion"></p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-fluance text-[#F5F7F6] py-3 px-4 rounded-lg font-semibold hover:bg-fluance/90 transition-colors duration-200 flex items-center justify-center"
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
        <a href="/creer-compte/" class="text-fluance hover:text-fluance/80 font-medium">Créer un compte</a>
      </p>
      <p class="text-sm text-[#1f1f1f]/60">
        <a href="/connexion/" class="hover:text-fluance">Retour à la page de connexion principale</a>
      </p>
    </div>

    <!-- Section d'aide dépliable -->
    <div class="mt-8 border-t border-fluance/20 pt-6">
      <button
        id="help-toggle"
        class="w-full flex items-center justify-between text-left text-sm font-medium text-fluance hover:text-fluance/80 transition-colors"
        onclick="toggleHelp()"
      >
        <span>❓ Besoin d'aide ?</span>
        <svg id="help-arrow" class="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div id="help-content" class="hidden mt-4 space-y-4 text-sm text-[#1f1f1f]/80">
        <div>
          <p class="font-semibold text-[#3E3A35] mb-1">Je ne trouve pas mon email/code</p>
          <p>→ Vérifiez vos courriers indésirables (spams).</p>
        </div>
        <div>
          <p class="font-semibold text-[#3E3A35] mb-1">Le code ne fonctionne pas</p>
          <p>→ Assurez-vous de copier-coller le code complet, sans espace</p>
        </div>
        <div>
          <p class="font-semibold text-[#3E3A35] mb-1">Qu'est-ce que la « Connexion par e-mail » ?</p>
          <p>C'est la méthode de connexion sans mot de passe. Nous vous envoyons un e-mail contenant un lien unique, utilisable une seule fois, pour vous identifier. C'est simple et très sécurisé.</p>
        </div>
        <div>
          <p class="font-semibold text-[#3E3A35] mb-1">Encore besoin d'aide ?</p>
          <p><a href="/contact/" class="text-fluance hover:underline">Contactez-nous.</a></p>
        </div>
      </div>
    </div>
  </div>
</div>

<script type="module" src="/assets/js/firebase-auth.mjs?v={{ version }}"></script>
<script>
let currentTab = 'password';
let errorDiv, successDiv; // Variables globales pour les divs d'erreur/succès

// Fonctions globales pour gérer les messages d'erreur/succès
function showError(message, errorData = null) {
  if (errorDiv && successDiv) {
    const errorText = errorDiv.querySelector('#error-text');
    const errorCode = errorDiv.querySelector('#error-code');
    const errorSuggestion = errorDiv.querySelector('#error-suggestion');
    
    if (errorText) {
      errorText.textContent = message || 'Une erreur est survenue.';
    }
    
    // Afficher le code d'erreur si disponible
    if (errorCode && errorData && errorData.errorCode) {
      errorCode.textContent = `Code d'erreur: ${errorData.errorCode}`;
      errorCode.classList.remove('hidden');
    } else if (errorCode) {
      errorCode.classList.add('hidden');
    }
    
    // Afficher la suggestion si disponible
    if (errorSuggestion && errorData && errorData.suggestion) {
      errorSuggestion.innerHTML = `<strong>💡 Suggestion :</strong> ${errorData.suggestion}`;
      errorSuggestion.classList.remove('hidden');
    } else if (errorSuggestion) {
      errorSuggestion.classList.add('hidden');
    }
    
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

  // Réinitialiser tous les onglets
  [passwordTab, passwordlessTab].forEach(t => {
    if (t && !t.classList.contains('hidden')) {
      t.classList.remove('border-fluance', 'text-fluance');
      t.classList.add('border-transparent', 'text-[#1f1f1f]/60');
    }
  });

  if (tab === 'password') {
    passwordTab.classList.add('border-fluance', 'text-fluance');
    passwordTab.classList.remove('border-transparent', 'text-[#1f1f1f]/60');
    passwordField.style.display = 'block';
    passwordInput.required = true;
    buttonText.textContent = 'Se connecter';
  } else if (tab === 'passwordless') {
    passwordlessTab.classList.add('border-fluance', 'text-fluance');
    passwordlessTab.classList.remove('border-transparent', 'text-[#1f1f1f]/60');
    passwordField.style.display = 'none';
    passwordInput.required = false;
    passwordInput.value = '';
    buttonText.textContent = 'Envoyer le lien de connexion';
  }
  
  hideError();
  hideSuccess();
}

document.addEventListener('DOMContentLoaded', async function() {
  // Vérifier si un code de réinitialisation de mot de passe est présent dans l'URL
  // Si c'est le cas, rediriger vers la page de réinitialisation
  const urlParams = new URLSearchParams(window.location.search);
  const actionCode = urlParams.get('oobCode');
  const mode = urlParams.get('mode');
  
  if (actionCode && mode === 'resetPassword') {
    // Rediriger vers la page de réinitialisation avec le code
    window.location.replace(`/reinitialiser-mot-de-passe/?oobCode=${actionCode}&mode=${mode}`);
    return;
  }
  
  // Attacher les event listeners aux onglets
  const passwordTab = document.getElementById('tab-password');
  const passwordlessTab = document.getElementById('tab-passwordless');
  
  if (passwordTab) passwordTab.addEventListener('click', () => switchTab('password'));
  if (passwordlessTab) passwordlessTab.addEventListener('click', () => switchTab('passwordless'));
  
  // Vérifier si un onglet spécifique est demandé dans l'URL
  const tabParam = urlParams.get('tab');
  if (tabParam === 'passwordless') {
    switchTab('passwordless');
  } else if (tabParam === 'password') {
    switchTab('password');
  }
  
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
      const returnUrl = new URLSearchParams(window.location.search).get('return') || '/membre/';
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
  const rememberCheckbox = document.getElementById('remember-me');

  if (rememberCheckbox && typeof getRememberChoice === 'function') {
    rememberCheckbox.checked = getRememberChoice(false);
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const remember = rememberCheckbox ? rememberCheckbox.checked : false;

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
        const result = await window.FluanceAuth.signIn(email, password, remember);

        if (result.success) {
          // Rediriger vers la page d'origine ou l'espace membre
          const returnUrl = new URLSearchParams(window.location.search).get('return') || '/membre/';
          window.location.href = returnUrl;
        } else {
          showError(result.error || 'Erreur lors de la connexion.', result);
        }
      } else {
        // Envoi du lien passwordless
        console.log('[Connexion] Début de l\'envoi du lien passwordless');
        console.log('[Connexion] Email:', email);
        console.log('[Connexion] FluanceAuth disponible:', typeof window.FluanceAuth !== 'undefined');
        console.log('[Connexion] sendSignInLink disponible:', typeof window.FluanceAuth?.sendSignInLink === 'function');
        
        // Sauvegarder l'email dans localStorage pour la vérification du lien
        window.localStorage.setItem('emailForSignIn', email);
        console.log('[Connexion] Email sauvegardé dans localStorage');
        
        console.log('[Connexion] Appel de window.FluanceAuth.sendSignInLink...');
        const result = await window.FluanceAuth.sendSignInLink(email);
        console.log('[Connexion] Résultat de sendSignInLink:', result);

        if (result.success) {
          console.log('[Connexion] ✅ Succès, affichage du message');
          showSuccess('Un lien de connexion a été envoyé à votre email. Cliquez sur le lien pour vous connecter.');
        } else {
          console.log('[Connexion] ❌ Erreur:', result.error);
          showError(result.error || 'Erreur lors de l\'envoi du lien.', result);
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
      if (currentTab === 'password') {
        buttonText.textContent = 'Se connecter';
      } else {
        buttonText.textContent = 'Envoyer le lien de connexion';
      }
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

