---
layout: base.njk
title: Créer mon compte
description: Créez votre compte Fluance pour accéder à votre contenu protégé
locale: fr
permalink: /creer-compte/
---

<div class="min-h-screen bg-[#fdfaf6] py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 section-card">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-[#0f172a] mb-2">Créer mon compte</h1>
      <p class="text-[#1f1f1f]/80">Accédez à votre contenu protégé Fluance</p>
    </div>

    <form id="token-form" class="space-y-6">
      <div>
        <label for="token" class="block text-sm font-medium text-[#0f172a] mb-2">
          Code d'activation
        </label>
        <input
          type="text"
          id="token"
          name="token"
          required
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#0f172a]"
          placeholder="Votre code d'activation"
        />
        <p class="mt-1 text-sm text-[#1f1f1f]/60">
          Ce code vous a été envoyé par email après votre achat.
        </p>
      </div>

      <div>
        <label for="email" class="block text-sm font-medium text-[#0f172a] mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#0f172a]"
          placeholder="votre@email.com"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-[#0f172a] mb-2">
          Mot de passe
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minlength="6"
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#0f172a]"
          placeholder="Minimum 6 caractères"
        />
      </div>

      <div>
        <label for="confirm-password" class="block text-sm font-medium text-[#0f172a] mb-2">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          id="confirm-password"
          name="confirm-password"
          required
          minlength="6"
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#0f172a]"
          placeholder="Répétez votre mot de passe"
        />
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <div id="success-message" class="hidden bg-[#ffce2d]/10 border border-[#ffce2d]/30 rounded-lg p-4">
        <p class="text-[#0f172a] text-sm"></p>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-fluance text-white py-3 px-4 rounded-lg font-semibold hover:bg-fluance/90 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="button-text">Créer mon compte</span>
        <span id="button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </form>

    <div class="mt-6 text-center">
      <p class="text-sm text-[#1f1f1f]/80">
        Déjà un compte ? 
        <a href="/connexion-firebase" class="text-fluance hover:text-fluance/80 font-medium">Se connecter</a>
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
          <p><a href="/contact" class="text-fluance hover:underline">Contactez-nous.</a></p>
        </div>
      </div>
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

      console.log('Result from verifyTokenAndCreateAccount:', result);

      if (result.success) {
        showSuccess('Compte créé avec succès !');
        
        // Vérifier que l'utilisateur est bien connecté
        // Utiliser directement firebase.auth() pour être sûr
        let user = null;
        let attempts = 0;
        const maxAttempts = 30; // 3 secondes max (30 * 100ms)
        
        while (!user && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
              user = firebase.auth().currentUser;
              console.log('Attempt', attempts + 1, '- Current user:', user ? user.email : 'null');
            } catch (e) {
              console.error('Error getting current user:', e);
            }
          }
          attempts++;
        }
        
        if (user) {
          console.log('✅ User authenticated:', user.email, '- Redirecting to /membre/');
          showSuccess('Redirection vers votre espace client...');
          // Redirection immédiate
          window.location.href = '/membre/';
        } else {
          console.error('❌ User not authenticated after', maxAttempts, 'attempts');
          console.log('Firebase state:', {
            firebaseDefined: typeof firebase !== 'undefined',
            authAvailable: typeof firebase !== 'undefined' && !!firebase.auth,
            currentUser: typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : 'N/A'
          });
          showError('Connexion réussie mais redirection impossible. Redirection vers la page de connexion...');
          setTimeout(() => {
            window.location.href = '/connexion-firebase/';
          }, 2000);
        }
      } else {
        console.error('Account creation failed:', result.error);
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

