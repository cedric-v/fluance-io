---
layout: base.njk
title: Prochains stages
description: Découvrez les prochains stages en présentiel organisés par Fluance.
locale: fr
permalink: /presentiel/prochains-stages/
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="space-y-4 text-center">
    <p class="cta-pill bg-[#8bc34a]/20 text-fluance inline-flex">Présentiel</p>
    <h1 class="text-4xl font-semibold text-[#3E3A35]">Prochains stages</h1>
  </header>

  <article class="prose prose-lg max-w-none space-y-6 text-[#1f1f1f]">
    <p class="text-lg text-[#3E3A35]">
      Découvrez les prochains événements en présentiel pour approfondir votre pratique et vivre une <strong>expérience immersive</strong> de l'approche Fluance.
    </p>

    <div class="section-card p-8 bg-white">
      <h2 class="text-2xl font-semibold text-fluance mb-4">Evénements à venir</h2>
      <p class="text-[#3E3A35]/70 mb-4">
        Les dates des prochains stages seront bientôt annoncées. Inscrivez-vous à notre liste d'attente pour être informé en priorité.
      </p>
      <ul class="space-y-3 text-[#3E3A35] mb-4">
        <li>• Stages d'une journée ou d'un weekend et retraites immersives</li>
        <li>• Approfondissement des pratiques Fluance dans la nature</li>
        <li>• Temps d'échange et de partage</li>
        <li>• Groupe limité pour une expérience privilégiée</li>
      </ul>
      <p class="text-[#3E3A35] mt-4">
        Les événements peuvent avoir lieu en <strong>Suisse</strong>, en <strong>France</strong>, en <strong>Belgique</strong> ou même ailleurs selon les demandes.
      </p>
    </div>

    <div class="section-card p-8 bg-white mt-6">
      <h2 class="text-2xl font-semibold text-fluance mb-4">Inscription à la liste d'attente</h2>
      <p class="text-[#3E3A35] mb-6">
        Remplissez le formulaire ci-dessous pour être informé en priorité des prochains stages dans votre région.
      </p>
      
      <form id="stages-waiting-list-form" class="space-y-4" autocomplete="off" data-form-type="stages" data-1p-ignore="true" data-lastpass-ignore="true">
        <div>
          <label for="stages-name" class="block text-sm font-medium text-gray-700 mb-2">Prénom <span class="text-red-500">*</span></label>
          <input type="text" id="stages-name" name="stages-name" required autocomplete="given-name" data-lpignore="true" data-1p-ignore="true" data-lastpass-ignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-fluance focus:border-transparent">
        </div>
        
        <div>
          <label for="stages-email" class="block text-sm font-medium text-gray-700 mb-2">Email <span class="text-red-500">*</span></label>
          <input type="email" id="stages-email" name="stages-email" required autocomplete="email" data-lpignore="true" data-1p-ignore="true" data-lastpass-ignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-fluance focus:border-transparent">
        </div>
        
        <div>
          <label for="stages-region" class="block text-sm font-medium text-gray-700 mb-2">Région <span class="text-red-500">*</span></label>
          <select id="stages-region" name="stages-region" required data-lpignore="true" data-1p-ignore="true" data-lastpass-ignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-fluance focus:border-transparent">
            <option value="">Sélectionnez votre région</option>
            <option value="France : Est">France : Est</option>
            <option value="France : Nord">France : Nord</option>
            <option value="France : Sud">France : Sud</option>
            <option value="France : Ouest">France : Ouest</option>
            <option value="France : outre-mer">France : outre-mer</option>
            <option value="Belgique">Belgique</option>
            <option value="Québec">Québec</option>
            <option value="Suisse">Suisse</option>
            <option value="Autres régions">Autres régions</option>
          </select>
        </div>
        
        <div id="stages-form-message" class="hidden text-sm"></div>
        
        <!-- Cloudflare Turnstile -->
        <div class="cf-turnstile" 
             data-sitekey="0x4AAAAAACF5HWhHHcGA5yJk" 
             data-theme="light" 
             data-size="normal" 
             data-callback="onStagesTurnstileSuccess"
             data-error-callback="onStagesTurnstileError"
             id="stages-turnstile-widget"
             style="display: none;"
             aria-label="Vérification anti-bot Cloudflare Turnstile"
             role="region"></div>
        <!-- Message d'aide si Turnstile ne se charge pas -->
        <div id="stages-turnstile-loading-message" class="text-sm text-gray-600 mb-2" style="display: none;">
          <span class="inline-block animate-spin mr-2">⏳</span>
          Chargement de la vérification anti-bot...
        </div>
        <div id="stages-turnstile-error-message" class="text-sm text-yellow-600 mb-2 hidden">
          ⚠️ La vérification anti-bot ne se charge pas. <strong>Vous pouvez quand même vous inscrire en cliquant sur le bouton ci-dessous</strong>.
        </div>
        
        <button type="submit" id="stages-submit-btn" class="w-full btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] py-3 px-6 rounded-md font-medium transition-colors">
          <span id="stages-submit-text">S'inscrire sur la liste d'attente</span>
          <span id="stages-submit-loading" class="hidden">Inscription en cours...</span>
        </button>
        
        <div class="text-xs text-gray-500 mt-4">
          En soumettant ce formulaire, j'accepte que mes informations soient utilisées dans le cadre de ma demande et de la relation commerciale éthique et personnalisée qui peut en découler. Pour connaître et exercer mes droits, notamment pour annuler mon consentement, je consulte les <a href="/mentions-legales" class="text-fluance hover:underline" target="_blank">mentions légales et la politique de confidentialité</a>.
        </div>
      </form>
    </div>
  </article>
</section>

<script>
  // Formulaire liste d'attente stages avec Firebase Functions
  document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('stages-waiting-list-form');
    if (!form) return; // Si le formulaire n'existe pas, ne pas initialiser
    
    const messageDiv = document.getElementById('stages-form-message');
    const submitBtn = document.getElementById('stages-submit-btn');
    const submitText = document.getElementById('stages-submit-text');
    const submitLoading = document.getElementById('stages-submit-loading');
    const turnstileWidget = document.getElementById('stages-turnstile-widget');
    
    // Détecter si on est en développement local
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('192.168.') ||
                       window.location.hostname.startsWith('10.') ||
                       window.location.hostname.endsWith('.local');
    
    // Callbacks Turnstile
    window.onStagesTurnstileSuccess = function(token) {
      console.log('Turnstile verification successful');
    };
    
    window.onStagesTurnstileError = function(error) {
      console.error('Turnstile error:', error);
      if (isLocalhost) {
        console.warn('Turnstile error in localhost, allowing submission anyway');
      }
    };
    
    // Configurer Turnstile selon l'environnement
    const loadingMessage = document.getElementById('stages-turnstile-loading-message');
    const errorMessage = document.getElementById('stages-turnstile-error-message');
    let turnstileFailed = false;
    let turnstileTimeout = null;
    
    if (turnstileWidget && !isLocalhost) {
      if (loadingMessage) loadingMessage.style.display = 'block';
      
      turnstileTimeout = setTimeout(() => {
        const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
        if (!turnstileResponse || !turnstileResponse.value) {
          turnstileFailed = true;
          if (loadingMessage) loadingMessage.style.display = 'none';
          if (errorMessage) {
            errorMessage.classList.remove('hidden');
            errorMessage.innerHTML = '⚠️ La vérification anti-bot ne se charge pas. <strong>Vous pouvez quand même vous inscrire en cliquant sur le bouton ci-dessous</strong>.';
            errorMessage.className = 'text-sm text-yellow-600 mb-2';
          }
          if (turnstileWidget) turnstileWidget.style.display = 'none';
          console.warn('[Turnstile] Widget failed to load, fallback mode enabled');
        }
      }, 3000);
      
      function initTurnstile() {
        if (typeof turnstile === 'undefined') {
          setTimeout(initTurnstile, 100);
          return;
        }
        
        if (turnstileTimeout) {
          clearTimeout(turnstileTimeout);
          turnstileTimeout = null;
        }
        
        if (isLocalhost) {
          turnstileWidget.setAttribute('data-sitekey', '0x4AAAAAAABkMYinukE8K9X0');
        } else {
          turnstileWidget.setAttribute('data-sitekey', '0x4AAAAAACF5HWhHHcGA5yJk');
        }
        
        turnstileWidget.style.display = 'block';
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (errorMessage) errorMessage.classList.add('hidden');
        
        setTimeout(() => {
          const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
          if (!turnstileResponse && !isLocalhost) {
            turnstileFailed = true;
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (errorMessage) {
              errorMessage.classList.remove('hidden');
              errorMessage.innerHTML = '⚠️ La vérification anti-bot ne se charge pas. <strong>Vous pouvez quand même vous inscrire en cliquant sur le bouton ci-dessous</strong>.';
              errorMessage.className = 'text-sm text-yellow-600 mb-2';
            }
            if (turnstileWidget) turnstileWidget.style.display = 'none';
            console.warn('[Turnstile] Widget failed to initialize, fallback mode enabled');
          }
        }, 2000);
      }
      
      initTurnstile();
    } else if (isLocalhost) {
      if (turnstileWidget) turnstileWidget.style.display = 'none';
      if (loadingMessage) loadingMessage.style.display = 'none';
      if (errorMessage) errorMessage.classList.add('hidden');
    }
    
    // Fonction pour charger Firebase et Firebase Functions
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
                reject(new Error('Firebase App n\'a pas pu être chargé'));
                return;
              }
              
              if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
              }
              
              loadFunctionsScript();
            }, 100);
          };
          appScript.onerror = () => reject(new Error('Erreur lors du chargement de Firebase App'));
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
            functionsScript.onerror = () => reject(new Error('Erreur lors du chargement de Firebase Functions'));
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
              reject(new Error('Timeout: Firebase n\'a pas pu être chargé'));
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
              reject(new Error('Firebase Functions n\'a pas pu être initialisé'));
            }
          }, 100);
        }
      });
    }
    
    // Soumettre le formulaire
    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('stages-email').value.trim();
        const name = document.getElementById('stages-name').value.trim();
        const region = document.getElementById('stages-region').value;
        
        if (!name) {
          showMessage('Veuillez entrer votre prénom', 'error');
          return;
        }
        
        if (!email) {
          showMessage('Veuillez entrer votre email', 'error');
          return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showMessage('Veuillez entrer une adresse email valide', 'error');
          return;
        }
        
        if (!region) {
          showMessage('Veuillez sélectionner votre région', 'error');
          return;
        }
        
        // Vérifier que Turnstile est complété (seulement si pas en localhost)
        let turnstileToken = null;
        let turnstileSkipped = false;
        
        if (!isLocalhost) {
          const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
          if (!turnstileResponse || !turnstileResponse.value) {
            if (turnstileFailed) {
              turnstileSkipped = true;
              console.log('[Form] Submitting without Turnstile (fallback mode)');
            } else {
              if (typeof turnstile === 'undefined') {
                turnstileFailed = true;
                turnstileSkipped = true;
                console.log('[Form] Turnstile script never loaded, enabling fallback automatically');
              } else {
                const widgetVisible = turnstileWidget && turnstileWidget.style.display !== 'none';
                if (!widgetVisible) {
                  turnstileFailed = true;
                  turnstileSkipped = true;
                  console.log('[Form] Turnstile widget not visible, enabling fallback automatically');
                } else {
                  showMessage('Veuillez compléter la vérification anti-bot ci-dessus', 'error');
                  return;
                }
              }
            }
          } else {
            turnstileToken = turnstileResponse.value;
          }
        }
        
        // Désactiver le bouton et afficher le loading
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.classList.add('hidden');
        if (submitLoading) submitLoading.classList.remove('hidden');
        if (messageDiv) messageDiv.classList.add('hidden');
        
        try {
          await loadFirebaseFunctions();
          
          if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
            throw new Error('Firebase n\'est pas initialisé');
          }
          
          if (!firebase.functions) {
            throw new Error('Firebase Functions n\'est pas disponible');
          }
          
          const app = firebase.app();
          if (!app) {
            throw new Error('Impossible d\'obtenir l\'instance Firebase');
          }
          
          const functions = app.functions('europe-west1');
          // Détecter la langue depuis l'URL
          const locale = window.location.pathname.startsWith('/en/') ? 'en' : 'fr';

          const subscribeToStagesWaitingList = functions.httpsCallable('subscribeToStagesWaitingList');
          const result = await subscribeToStagesWaitingList({ 
            email: email, 
            name: name,
            region: region,
            turnstileToken: turnstileToken,
            isLocalhost: isLocalhost,
            turnstileSkipped: turnstileSkipped,
            locale: locale // Langue détectée depuis l'URL
          });
          
          if (result.data && result.data.success) {
            const successMessage = 'Merci ! Vous êtes maintenant inscrit(e) sur la liste d\'attente. Nous vous informerons dès que les prochains stages seront annoncés dans votre région.<br><br>' +
              '<strong>En attendant</strong>, vous pouvez :<br>' +
              '• <a href="/cours-en-ligne/21-jours-mouvement/" class="text-fluance hover:underline font-medium">Suivre le cours en ligne de 21 jours</a><br>' +
              '• <a href="https://www.youtube.com/@fluanceio" target="_blank" rel="noopener noreferrer" class="text-fluance hover:underline font-medium">S\'abonner à la chaîne YouTube</a>';
            showMessageHTML(successMessage, 'success');
            form.reset();
            // Réinitialiser Turnstile
            if (window.turnstile && turnstileWidget) {
              window.turnstile.reset();
            }
          } else {
            showMessage('Une erreur est survenue. Veuillez réessayer.', 'error');
          }
        } catch (error) {
          console.error('Erreur lors de l\'inscription:', error);
          
          let errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
          
          if (error.code === 'functions/not-found') {
            errorMessage = 'La fonction n\'est pas encore déployée. Veuillez déployer la fonction subscribeToStagesWaitingList.';
          } else if (error.code === 'functions/unavailable') {
            errorMessage = 'Le service est temporairement indisponible. Veuillez réessayer plus tard.';
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.code) {
            errorMessage = `Erreur: ${error.code}`;
          }
          
          showMessage(errorMessage, 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
          if (submitText) submitText.classList.remove('hidden');
          if (submitLoading) submitLoading.classList.add('hidden');
        }
      });
    }
    
    function showMessage(text, type) {
      if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = 'text-sm ' + (type === 'success' ? 'text-green-600' : 'text-red-600');
        messageDiv.classList.remove('hidden');
      }
    }
    
    function showMessageHTML(html, type) {
      if (messageDiv) {
        messageDiv.innerHTML = html;
        messageDiv.className = 'text-sm ' + (type === 'success' ? 'text-green-600' : 'text-red-600');
        messageDiv.classList.remove('hidden');
      }
    }
  });
</script>

<!-- Cloudflare Turnstile Script -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>