---
layout: base.njk
title: Confirm your subscription
description: "Confirm your subscription to the Fluance newsletter."
locale: en
permalink: /en/confirm/
eleventyExcludeFromCollections: true
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <div id="confirmation-container" class="space-y-8">
    <!-- Loading state -->
    <div id="loading-state" class="text-center space-y-4">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-fluance"></div>
      <p class="text-lg text-[#3E3A35]">Verifying...</p>
    </div>

    <!-- Success state -->
    <div id="success-state" class="hidden text-center space-y-6">
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
        <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
      <h1 class="text-4xl font-semibold text-[#3E3A35]">Subscription confirmed!</h1>
      <p id="success-description" class="text-xl text-[#3E3A35]">
        Thank you for confirming your subscription. You will now receive our emails.
      </p>
      <p id="success-subtext" class="text-lg text-[#3E3A35]/70">
        Access the 2 free liberating practices now:
      </p>
      <div class="pt-4">
        <a id="success-cta" href="{{ '/en/2-pratiques-offertes/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold rounded-md shadow-lg transition-all hover:shadow-xl">
          <span id="success-cta-text">Access the 2 free practices</span>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
          </svg>
        </a>
      </div>
    </div>

    <!-- Error state -->
    <div id="error-state" class="hidden text-center space-y-6">
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
        <svg class="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </div>
      <h1 class="text-4xl font-semibold text-[#3E3A35]">Confirmation error</h1>
      <p id="error-message" class="text-xl text-[#3E3A35]"></p>
      <div class="pt-6">
        <a href="{{ '/en/' | relativeUrl }}" class="btn-secondary border-fluance text-fluance hover:bg-fluance hover:text-[#F5F7F6] inline-block">
          Back to home
        </a>
      </div>
    </div>
  </div>
</section>

<script>
  document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const token = urlParams.get('token');
    const redirectParam = urlParams.get('redirect');
    const sourceParam = urlParams.get('source');

    const loadingState = document.getElementById('loading-state');
    const successState = document.getElementById('success-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const successDescription = document.getElementById('success-description');
    const successSubtext = document.getElementById('success-subtext');
    const successCta = document.getElementById('success-cta');
    const successCtaText = document.getElementById('success-cta-text');

    if (!email || !token) {
      loadingState.classList.add('hidden');
      errorState.classList.remove('hidden');
      errorMessage.textContent = 'Invalid confirmation link. Please check your email.';
      return;
    }

    // Same Firebase loading logic as French version
    async function loadFirebaseFunctions() {
      return new Promise((resolve, reject) => {
        const firebaseConfig = {
          apiKey: "AIzaSyDJ-VlDMC5PUEMeILLZ8OmdYIhvhxIfhdM",
          authDomain: "fluance-protected-content.firebaseapp.com",
          projectId: "fluance-protected-content",
          storageBucket: "fluance-protected-content.firebasestorage.app",
          messagingSenderId: "173938686776",
          appId: "1:173938686776:web:891caf76098a42c3579fcd",
          measurementId: "G-CWPNXDQEYR"
        };

        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
          if (firebase.functions) {
            resolve();
          } else {
            loadFunctionsModule(resolve, reject);
          }
          return;
        }

        const appScriptUrl = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js';
        const functionsScriptUrl = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';

        if (document.querySelector(`script[src="${appScriptUrl}"]`)) {
          if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
              firebase.initializeApp(firebaseConfig);
            }
            loadFunctionsScript();
          } else {
            waitForFirebase();
          }
        } else {
          const appScript = document.createElement('script');
          appScript.src = appScriptUrl;
          appScript.onload = () => {
            setTimeout(() => {
              if (typeof firebase === 'undefined') {
                reject(new Error('Firebase App could not be loaded'));
                return;
              }
              if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
              }
              loadFunctionsScript();
            }, 100);
          };
          appScript.onerror = () => reject(new Error('Error loading Firebase App'));
          document.head.appendChild(appScript);
        }

        function loadFunctionsScript() {
          if (document.querySelector(`script[src="${functionsScriptUrl}"]`)) {
            loadFunctionsModule(resolve, reject);
          } else {
            const functionsScript = document.createElement('script');
            functionsScript.src = functionsScriptUrl;
            functionsScript.onload = () => {
              loadFunctionsModule(resolve, reject);
            };
            functionsScript.onerror = () => reject(new Error('Error loading Firebase Functions'));
            document.head.appendChild(functionsScript);
          }
        }

        function waitForFirebase() {
          let attempts = 0;
          const checkFirebase = setInterval(() => {
            attempts++;
            if (typeof firebase !== 'undefined') {
              clearInterval(checkFirebase);
              if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
              }
              loadFunctionsScript();
            } else if (attempts > 50) {
              clearInterval(checkFirebase);
              reject(new Error('Timeout: Firebase could not be loaded'));
            }
          }, 100);
        }

        function loadFunctionsModule(resolve, reject) {
          let attempts = 0;
          const checkFunctions = setInterval(() => {
            attempts++;
            if (firebase.functions) {
              clearInterval(checkFunctions);
              resolve();
            } else if (attempts > 50) {
              clearInterval(checkFunctions);
              reject(new Error('Firebase Functions could not be initialized'));
            }
          }, 100);
        }
      });
    }

    try {
      await loadFirebaseFunctions();

      if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
        throw new Error('Firebase is not initialized');
      }

      if (!firebase.functions) {
        throw new Error('Firebase Functions is not available');
      }

      const app = firebase.app();
      const functions = app.functions('europe-west1');
      const confirmNewsletterOptIn = functions.httpsCallable('confirmNewsletterOptIn');
      
      const result = await confirmNewsletterOptIn({ email: email, token: token });

      if (result.data && result.data.success) {
        loadingState.classList.add('hidden');
        successState.classList.remove('hidden');

        // Déterminer la destination en fonction de la source
        const sourceOptin = sourceParam || result.data.sourceOptin || redirectParam || '2pratiques';
        let target = '2pratiques';
        if (redirectParam === 'stages' || sourceOptin === 'stages') {
          target = 'stages';
        } else if (sourceOptin && sourceOptin.includes('5joursofferts')) {
          target = '5joursofferts';
        } else if (redirectParam === 'achat21' || sourceOptin === 'achat21') {
          target = 'achat21';
        }

        // Envoyer l'événement de conversion à Google Analytics (événement recommandé generate_lead)
        if (window.dataLayer) {
          window.dataLayer.push({
            event: 'generate_lead',
            source: 'newsletter_optin',
            optin_type: target === 'stages' ? 'stages' : (target === '5joursofferts' ? '5joursofferts' : '2pratiques'),
            lead_type: target === 'stages' ? 'stages' : (target === '5joursofferts' ? '5_jours' : '2_pratiques')
          });
          console.log('Opt-in conversion tracked:', target);
        }

        // Mettre à jour le contenu selon le type d'opt-in
        if (target === 'stages' && successDescription && successSubtext && successCta && successCtaText) {
          successDescription.textContent = 'Thank you for confirming your registration to the waiting list for upcoming workshops!';
          successSubtext.textContent = 'You will be notified first as soon as upcoming workshops are announced in your region.';
          successCta.href = '/en/presentiel/prochains-stages/';
          successCtaText.textContent = 'Back to workshops page';
        } else if (target === '5joursofferts' && successSubtext && successCta && successCtaText) {
          successSubtext.textContent = 'Access day 1 of your 5 free practices now:';
          successCta.href = '/en/cours-en-ligne/5jours/j1/';
          successCtaText.textContent = 'Access day 1 of the 5 practices';
        } else if (target === 'achat21' && successSubtext && successCta && successCtaText) {
          successSubtext.textContent = 'Access your purchase confirmation for 21 days:';
          successCta.href = '/en/confirmation/';
          successCtaText.textContent = 'Access my purchase confirmation';
        } else if (successSubtext && successCta && successCtaText) {
          // Par défaut : 2 pratiques
          successSubtext.textContent = 'Access the 2 free liberating practices now:';
          successCta.href = '/en/2-pratiques-offertes/';
          successCtaText.textContent = 'Access the 2 free practices';
        }
      } else {
        throw new Error(result.data?.message || 'Error during confirmation');
      }
    } catch (error) {
      console.error('Error during confirmation:', error);
      loadingState.classList.add('hidden');
      errorState.classList.remove('hidden');
      
      let errorMsg = 'An error occurred during confirmation.';
      if (error.code === 'not-found') {
        errorMsg = 'Invalid or expired confirmation link.';
      } else if (error.code === 'deadline-exceeded') {
        errorMsg = 'This confirmation link has expired. Please subscribe again.';
      } else if (error.code === 'permission-denied') {
        errorMsg = 'Email does not match the confirmation link.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      errorMessage.textContent = errorMsg;
    }
  });
</script>
