---
layout: base.njk
title: Réinitialiser le mot de passe
description: Réinitialisez votre mot de passe pour accéder à votre contenu protégé Fluance
locale: fr
permalink: /reinitialiser-mot-de-passe/
---

<div class="min-h-screen bg-[#fdfaf6] py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 section-card">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-[#0f172a] mb-2">Réinitialiser le mot de passe</h1>
      <p class="text-[#1f1f1f]/80">Entrez votre email pour recevoir un lien de réinitialisation</p>
    </div>

    <!-- Formulaire de demande de réinitialisation -->
    <form id="reset-request-form" class="space-y-6">
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

      <div id="success-message" class="hidden bg-[#ffce2d]/10 border border-[#ffce2d]/30 rounded-lg p-4">
        <p class="text-[#0f172a] text-sm"></p>
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-fluance text-white py-3 px-4 rounded-lg font-semibold hover:bg-fluance/90 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="button-text">Envoyer le lien de réinitialisation</span>
        <span id="button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </form>

    <!-- Formulaire de confirmation de réinitialisation (affiché si code présent dans l'URL) -->
    <form id="reset-confirm-form" class="space-y-6 hidden">
      <div>
        <label for="new-password" class="block text-sm font-medium text-[#0f172a] mb-2">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          id="new-password"
          name="new-password"
          required
          minlength="6"
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#0f172a]"
          placeholder="Au moins 6 caractères"
        />
        <p class="mt-1 text-xs text-[#1f1f1f]/60">Le mot de passe doit contenir au moins 6 caractères</p>
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
          placeholder="Répétez le mot de passe"
        />
      </div>

      <div id="confirm-success-message" class="hidden bg-[#ffce2d]/10 border border-[#ffce2d]/30 rounded-lg p-4">
        <p class="text-[#0f172a] text-sm"></p>
      </div>

      <div id="confirm-error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <button
        type="submit"
        id="confirm-submit-button"
        class="w-full bg-fluance text-white py-3 px-4 rounded-lg font-semibold hover:bg-fluance/90 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="confirm-button-text">Réinitialiser le mot de passe</span>
        <span id="confirm-button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </form>

    <div class="mt-6 text-center space-y-2">
      <p class="text-sm text-[#1f1f1f]/80">
        <a href="/connexion-membre" class="text-fluance hover:text-fluance/80 font-medium">Retour à la connexion</a>
      </p>
    </div>
  </div>
</div>

<script src="/assets/js/firebase-auth.js?v=20241211-1650"></script>
<script>
document.addEventListener('DOMContentLoaded', async function() {
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
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    }
  });

  // Attendre que window.FluanceAuth soit disponible
  await new Promise((resolve) => {
    if (typeof window.FluanceAuth !== 'undefined' && 
        typeof window.FluanceAuth.sendPasswordResetEmail === 'function') {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (typeof window.FluanceAuth !== 'undefined' && 
            typeof window.FluanceAuth.sendPasswordResetEmail === 'function') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof window.FluanceAuth === 'undefined') {
          console.error('window.FluanceAuth is not available');
        }
        resolve();
      }, 5000);
    }
  });

  const requestForm = document.getElementById('reset-request-form');
  const confirmForm = document.getElementById('reset-confirm-form');
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  const confirmErrorDiv = document.getElementById('confirm-error-message');
  const confirmSuccessDiv = document.getElementById('confirm-success-message');

  // Vérifier si un code de réinitialisation est présent dans l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const actionCode = urlParams.get('oobCode');
  const mode = urlParams.get('mode');

  if (actionCode && mode === 'resetPassword') {
    // Afficher le formulaire de confirmation
    requestForm.classList.add('hidden');
    confirmForm.classList.remove('hidden');

    // Vérifier que le code est valide
    const verifyResult = await window.FluanceAuth.verifyPasswordResetCode(actionCode);
    if (!verifyResult.success) {
      confirmErrorDiv.querySelector('p').textContent = verifyResult.error || 'Code de réinitialisation invalide ou expiré.';
      confirmErrorDiv.classList.remove('hidden');
      confirmForm.querySelector('button').disabled = true;
    }

    // Gérer la soumission du formulaire de confirmation
    confirmForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (newPassword !== confirmPassword) {
        confirmErrorDiv.querySelector('p').textContent = 'Les mots de passe ne correspondent pas.';
        confirmErrorDiv.classList.remove('hidden');
        confirmSuccessDiv.classList.add('hidden');
        return;
      }

      if (newPassword.length < 6) {
        confirmErrorDiv.querySelector('p').textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
        confirmErrorDiv.classList.remove('hidden');
        confirmSuccessDiv.classList.add('hidden');
        return;
      }

      const submitButton = document.getElementById('confirm-submit-button');
      const buttonText = document.getElementById('confirm-button-text');
      const buttonSpinner = document.getElementById('confirm-button-spinner');

      submitButton.disabled = true;
      buttonText.textContent = 'Réinitialisation...';
      buttonSpinner.classList.remove('hidden');
      confirmErrorDiv.classList.add('hidden');
      confirmSuccessDiv.classList.add('hidden');

      try {
        const result = await window.FluanceAuth.confirmPasswordReset(actionCode, newPassword);

        if (result.success) {
          confirmSuccessDiv.querySelector('p').textContent = 'Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé vers la page de connexion...';
          confirmSuccessDiv.classList.remove('hidden');
          
          // Nettoyer l'URL pour éviter que Firebase Auth ne redirige automatiquement
          window.history.replaceState({}, document.title, '/reinitialiser-mot-de-passe');
          
          // Rediriger immédiatement vers la page de connexion
          // Utiliser replace pour éviter que l'utilisateur puisse revenir en arrière
          setTimeout(() => {
            window.location.replace('/connexion-membre');
          }, 100);
        } else {
          confirmErrorDiv.querySelector('p').textContent = result.error || 'Erreur lors de la réinitialisation.';
          confirmErrorDiv.classList.remove('hidden');
          submitButton.disabled = false;
          buttonText.textContent = 'Réinitialiser le mot de passe';
          buttonSpinner.classList.add('hidden');
        }
      } catch (error) {
        console.error('Error:', error);
        confirmErrorDiv.querySelector('p').textContent = 'Une erreur est survenue. Veuillez réessayer.';
        confirmErrorDiv.classList.remove('hidden');
        submitButton.disabled = false;
        buttonText.textContent = 'Réinitialiser le mot de passe';
        buttonSpinner.classList.add('hidden');
      }
    });
  } else {
    // Afficher le formulaire de demande
    requestForm.classList.remove('hidden');
    confirmForm.classList.add('hidden');

    // Gérer la soumission du formulaire de demande
    requestForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();

      if (!email) {
        errorDiv.querySelector('p').textContent = 'Veuillez entrer votre email.';
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
        return;
      }

      const submitButton = document.getElementById('submit-button');
      const buttonText = document.getElementById('button-text');
      const buttonSpinner = document.getElementById('button-spinner');

      submitButton.disabled = true;
      buttonText.textContent = 'Envoi...';
      buttonSpinner.classList.remove('hidden');
      errorDiv.classList.add('hidden');
      successDiv.classList.add('hidden');

      try {
        const result = await window.FluanceAuth.sendPasswordResetEmail(email);

        if (result.success) {
          const message = result.message || 'Un email de réinitialisation a été envoyé à ' + email + '. Vérifiez votre boîte de réception et le dossier spam, puis cliquez sur le lien pour réinitialiser votre mot de passe.';
          successDiv.querySelector('p').textContent = message;
          successDiv.classList.remove('hidden');
        } else {
          // Afficher l'erreur avec suggestion si disponible
          let errorHTML = result.error || 'Erreur lors de l\'envoi de l\'email.';
          if (result.suggestion) {
            errorHTML += '<br><br><strong>💡 Suggestion :</strong> ' + result.suggestion;
          }
          if (result.errorCode) {
            errorHTML += '<br><small class="text-red-600">Code: ' + result.errorCode + '</small>';
          }
          errorDiv.querySelector('p').innerHTML = errorHTML;
          errorDiv.classList.remove('hidden');
        }
      } catch (error) {
        console.error('Error:', error);
        errorDiv.querySelector('p').textContent = 'Une erreur est survenue. Veuillez réessayer.';
        errorDiv.classList.remove('hidden');
      } finally {
        submitButton.disabled = false;
        buttonText.textContent = 'Envoyer le lien de réinitialisation';
        buttonSpinner.classList.add('hidden');
      }
    });
  }
});
</script>

