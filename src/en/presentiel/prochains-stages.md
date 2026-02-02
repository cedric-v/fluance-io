---
layout: base.njk
title: Upcoming Workshops
description: Discover the upcoming in-person workshops organized by Fluance.
locale: en
permalink: /en/presentiel/prochains-stages/
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="space-y-4 text-center">
    <p class="cta-pill bg-[#8bc34a]/20 text-fluance inline-flex">In-person</p>
    <h1 class="text-4xl font-semibold text-[#3E3A35]">Upcoming Workshops</h1>
  </header>

  <article class="prose prose-lg max-w-none space-y-6 text-[#1f1f1f]">
    <p class="text-lg text-[#3E3A35]">
      Discover our upcoming in-person events to deepen your practice and experience an <strong>immersive</strong> Fluance approach.
    </p>

    <div class="section-card p-8 bg-white">
      <h2 class="text-2xl font-semibold text-fluance mb-4">Upcoming Events</h2>
      <p class="text-[#3E3A35]/70 mb-4">
        The dates for upcoming workshops will be announced soon. Sign up for our waiting list to be informed first.
      </p>
      <ul class="space-y-3 text-[#3E3A35] mb-4">
        <li>• One-day or weekend workshops and immersive retreats</li>
        <li>• Deepening of Fluance practices in nature</li>
        <li>• Time for exchange and sharing</li>
        <li>• Limited group for a privileged experience</li>
      </ul>
      <p class="text-[#3E3A35] mt-4">
        Events can take place in <strong>Switzerland</strong>, <strong>France</strong>, <strong>Belgium</strong> or elsewhere depending on requests.
      </p>
    </div>

    <div class="section-card p-8 bg-white mt-6">
      <h2 class="text-2xl font-semibold text-fluance mb-4">Join the waiting list</h2>
      <p class="text-[#3E3A35] mb-6">
        Fill out the form below to be notified first about upcoming workshops in your region.
      </p>
      
      <form id="stages-waiting-list-form" class="space-y-4" autocomplete="off" data-form-type="stages" data-1p-ignore="true" data-lastpass-ignore="true">
        <div>
          <label for="stages-name" class="block text-sm font-medium text-gray-700 mb-2">First name <span class="text-red-500">*</span></label>
          <input type="text" id="stages-name" name="stages-name" required autocomplete="given-name" data-lpignore="true" data-1p-ignore="true" data-lastpass-ignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-fluance focus:border-transparent">
        </div>
        
        <div>
          <label for="stages-email" class="block text-sm font-medium text-gray-700 mb-2">Email <span class="text-red-500">*</span></label>
          <input type="email" id="stages-email" name="stages-email" required autocomplete="email" data-lpignore="true" data-1p-ignore="true" data-lastpass-ignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-fluance focus:border-transparent">
        </div>
        
        <div>
          <label for="stages-region" class="block text-sm font-medium text-gray-700 mb-2">Region <span class="text-red-500">*</span></label>
          <select id="stages-region" name="stages-region" required data-lpignore="true" data-1p-ignore="true" data-lastpass-ignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-fluance focus:border-transparent">
            <option value="">Select your region</option>
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
             aria-label="Cloudflare Turnstile bot verification"
             role="region"></div>
        <!-- Message d'aide si Turnstile ne se charge pas -->
        <div id="stages-turnstile-loading-message" class="text-sm text-gray-600 mb-2" style="display: none;">
          <span class="inline-block animate-spin mr-2">⏳</span>
          Loading bot verification...
        </div>
        <div id="stages-turnstile-error-message" class="text-sm text-yellow-600 mb-2 hidden">
          ⚠️ Bot verification is not loading. <strong>You can still register by clicking the button below</strong>.
        </div>
        
        <button type="submit" id="stages-submit-btn" class="w-full btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] py-3 px-6 rounded-md font-medium transition-colors">
          <span id="stages-submit-text">Join the waiting list</span>
          <span id="stages-submit-loading" class="hidden">Registering...</span>
        </button>
        
        <div class="text-xs text-gray-500 mt-4">
          By submitting this form, I agree that my information will be used in the context of my request and the ethical and personalized business relationship that may result. To know and exercise my rights, including to cancel my consent, I consult the <a href="/en/mentions-legales" class="text-fluance hover:underline" target="_blank">legal notices and privacy policy</a>.
        </div>
      </form>
    </div>
  </article>
</section>

<script>
  // Formulaire liste d'attente stages avec Firebase Functions
  document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('stages-waiting-list-form');
    if (!form) return;
    
    const messageDiv = document.getElementById('stages-form-message');
    const submitBtn = document.getElementById('stages-submit-btn');
    const submitText = document.getElementById('stages-submit-text');
    const submitLoading = document.getElementById('stages-submit-loading');
    const turnstileWidget = document.getElementById('stages-turnstile-widget');
    
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('192.168.') ||
                       window.location.hostname.startsWith('10.') ||
                       window.location.hostname.endsWith('.local');
    
    window.onStagesTurnstileSuccess = function(token) {
      console.log('Turnstile verification successful');
    };
    
    window.onStagesTurnstileError = function(error) {
      console.error('Turnstile error:', error);
      if (isLocalhost) {
        console.warn('Turnstile error in localhost, allowing submission anyway');
      }
    };
    
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
            errorMessage.innerHTML = '⚠️ Bot verification is not loading. <strong>You can still register by clicking the button below</strong>.';
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
              errorMessage.innerHTML = '⚠️ Bot verification is not loading. <strong>You can still register by clicking the button below</strong>.';
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
    
    async function loadFirebaseFunctions() {
      return new Promise((resolve, reject) => {
          const firebaseConfig = window.FLUANCE_FIREBASE_CONFIG;
          
          if (!firebaseConfig || !firebaseConfig.apiKey) {
            console.error("Firebase configuration is missing!");
            reject(new Error("Firebase configuration non trouvée"));
            return;
          }
        
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
          if (firebase.functions) {
            resolve();
          } else {
            loadFunctionsModule(resolve, reject);
          }
          return;
        }
        
        const appScriptUrl = 'https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js';
        const functionsScriptUrl = 'https://www.gstatic.com/firebasejs/12.8.0/firebase-functions-compat.js';
        
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
    
    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('stages-email').value.trim();
        const name = document.getElementById('stages-name').value.trim();
        const region = document.getElementById('stages-region').value;
        
        if (!name) {
          showMessage('Please enter your first name', 'error');
          return;
        }
        
        if (!email) {
          showMessage('Please enter your email', 'error');
          return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showMessage('Please enter a valid email address', 'error');
          return;
        }
        
        if (!region) {
          showMessage('Please select your region', 'error');
          return;
        }
        
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
                  showMessage('Please complete the bot verification above', 'error');
                  return;
                }
              }
            }
          } else {
            turnstileToken = turnstileResponse.value;
          }
        }
        
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.classList.add('hidden');
        if (submitLoading) submitLoading.classList.remove('hidden');
        if (messageDiv) messageDiv.classList.add('hidden');
        
        try {
          await loadFirebaseFunctions();
          
          if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
            throw new Error('Firebase is not initialized');
          }
          
          if (!firebase.functions) {
            throw new Error('Firebase Functions is not available');
          }
          
          const app = firebase.app();
          if (!app) {
            throw new Error('Unable to get Firebase instance');
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
            const successMessage = result.data.emailSent ?
              'Thank you! A confirmation email has been sent to you. Please click on the link in the email to confirm your registration to the waiting list. Please check your spam / junk mail folder.' :
              'Thank you! Your request has been recorded. A confirmation email should be sent to you shortly.';
            showMessage(successMessage, 'success');
            form.reset();
            if (window.turnstile && turnstileWidget) {
              window.turnstile.reset();
            }
          } else {
            showMessage('An error occurred. Please try again.', 'error');
          }
        } catch (error) {
          console.error('Error during registration:', error);
          
          let errorMessage = 'An error occurred. Please try again.';
          
          if (error.code === 'functions/not-found') {
            errorMessage = 'The function is not yet deployed. Please deploy the subscribeToStagesWaitingList function.';
          } else if (error.code === 'functions/unavailable') {
            errorMessage = 'The service is temporarily unavailable. Please try again later.';
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.code) {
            errorMessage = `Error: ${error.code}`;
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
  });
</script>

<!-- Cloudflare Turnstile Script -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
