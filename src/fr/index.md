---
layout: base.njk
title: Accueil
description: "Fluance : libérez votre corps des tensions et retrouvez fluidité, mobilité et sérénité grâce à une approche simple basée sur le mouvement, le souffle et le jeu."
locale: fr
---

<section id="fond-cedric" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 pt-32 pb-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/fond-cedric.jpg", "Cédric Vonlanthen au bord du lac", "w-full h-full object-cover object-center md:object-right", "eager", "high", "1280", "960" %}
    <div class="absolute inset-0 md:hidden" style="background-color: rgba(100, 142, 216, 0.8);"></div>
    <div class="hidden md:block absolute inset-0 bg-linear-to-r from-transparent via-[#648ED8]/70 to-[#648ED8]/90"></div>
  </div>
  <div class="relative z-10 max-w-2xl text-white space-y-8">
    <div class="space-y-4">
      <h1 class="text-4xl md:text-6xl font-semibold leading-tight">
        Relâcher les tensions.<br>
        Libérer le trop-plein émotionnel.<br>
        Détendre et fortifier votre corps.
      </h1>
      <p class="text-lg md:text-xl text-white/90">
        Rejoignez un mouvement transformateur basé sur une approche simple, ludique, naturelle et libératrice.<br><br>
        Aucun équipement nécessaire.<br>
        Aucun prérequis.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="javascript://" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center flex flex-col" data-w-token="9241cb136525ee5e376e">
        <span>Essayer 2 pratiques libératrices</span>
        <span class="text-sm font-normal opacity-90">en ligne</span>
      </a>
      <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="btn-secondary border-white/80 text-white hover:bg-white/10 text-center flex flex-col">
        <span>Cours à Fribourg (Suisse)</span>
        <span class="text-sm font-normal opacity-90">présentiel</span>
      </a>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-[2fr_1fr] gap-8 items-center">
  <div class="text-left space-y-4">
    <h2 class="text-3xl md:text-4xl font-semibold text-[#0f172a]">Qu'est-ce que Fluance ?</h2>
    <p class="text-lg md:text-xl text-[#0f172a]/75">
      Fluance est une approche nouvelle du lien au corps et ses tensions.<br><br>
      Grâce à des mouvements en conscience et son aspect ludique, elle rééquilibre progressivement votre système nerveux, amène de la clarté mentale et procure de la vitalité.
    </p>
  </div>
  <a href="{{ '/a-propos/approche-fluance/' | relativeUrl }}" class="section-card overflow-hidden max-w-xs mx-auto md:mx-0 block hover:opacity-90 transition-opacity">
    {% image "assets/img/approche-fluance.png", "Schéma de l'approche Fluance", "w-full h-auto object-contain", "lazy", "", "400", "400" %}
  </a>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-12">
  <div class="text-left space-y-4">
    <h3 class="text-2xl md:text-3xl font-semibold text-[#0f172a]">Une synthèse fluide des sagesses ancestrales</h3>
    <p class="text-lg text-[#0f172a]/75">
       Fluance puise son inspiration aux racines des arts martiaux, du Chi Gong, du Tai-Chi et du Yoga, mais s'affranchit des formes rigides et des chorégraphies imposées.<br /><br />
       Ici, la discipline s'efface au profit de l'écoute : le mouvement devient organique, intuitif et entièrement personnalisé. Il ne s'agit pas de contraindre votre corps dans une posture, mais de laisser le mouvement s'adapter à votre anatomie et à vos ressentis de l'instant.
    </p>
  </div>
  <div class="grid md:grid-cols-[1fr_2fr] gap-8 items-center">
    <div class="section-card overflow-hidden max-w-xs mx-auto md:mx-0" style="aspect-ratio: 500/276;">
      {% image "assets/img/parcours-fluance.jpg", "Parcours Fluance", "w-full h-full object-cover", "lazy", "", "500", "276" %}
    </div>
    <div class="text-left space-y-4">
      <h3 class="text-2xl md:text-3xl font-semibold text-[#0f172a]">L'accès direct au calme pour les esprits agités</h3>
      <p class="text-lg text-[#0f172a]/75">
        C'est souvent la "porte dérobée" idéale pour ceux qui trouvent la méditation assise difficile ou frustrante.<br /><br />
        En passant par le corps plutôt que par le mental, Fluance court-circuite l'agitation intérieure. Après seulement quelques pratiques, on constate des résultats surprenants : même sans expérience préalable, il devient possible de goûter à un état d'ancrage profond, de présence absolue et de calme, là où l'immobilité seule avait échoué.
      </p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-10">
  <div class="text-center space-y-4">
    <h2 class="text-3xl font-semibold text-fluance">Ce qu'ils en disent</h2>
  </div>
  <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">« Cela me fait <strong>un bien fou</strong> ! »</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Sylvie Danielle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">« Cette semaine les <strong>douleurs ont vraiment diminué</strong>. »</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Monique</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">"Ta méthode est tellement simple et fluide. C'est <strong>agréable</strong> et on n'a <strong>pas le sentiment d'avoir un effort à faire</strong>."</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Isabelle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">"J'ai du <strong>plaisir</strong> à <strong>recontacter mon corps</strong>."</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Claire</p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16">
  <div class="text-center space-y-4 mb-12">
    <h2 class="text-3xl font-semibold text-fluance">Rejoignez le mouvement</h2>
  </div>
  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="javascript://" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center flex flex-col" data-w-token="9241cb136525ee5e376e">
      <span>Essayer 2 pratiques libératrices</span>
      <span class="text-sm font-normal opacity-90">en ligne</span>
    </a>
    <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="inline-flex flex-col items-center justify-center rounded-full border-[3px] border-fluance text-fluance bg-white hover:bg-fluance hover:text-white px-6 py-3 font-bold shadow-lg transition-all duration-200">
      <span>Cours à Fribourg (Suisse)</span>
      <span class="text-sm font-normal opacity-90">présentiel</span>
    </a>
  </div>
</section>

<!-- Pop-up personnalisée pour inscription newsletter -->
<div id="newsletter-popup" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0, 0, 0, 0.5);">
  <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 md:p-8 relative">
    <button id="close-popup" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Fermer">&times;</button>
    
    <h2 class="text-2xl md:text-3xl font-semibold text-[#0f172a] mb-2">Recevez 2 pratiques Fluance</h2>
    <p class="text-gray-600 mb-6">Il suffit de remplir le formulaire ci-dessous :</p>
    
    <form id="newsletter-form" class="space-y-4" autocomplete="off" data-form-type="newsletter" data-1p-ignore="true" data-lastpass-ignore="true">
      <div>
        <label for="newsletter-name" class="block text-sm font-medium text-gray-700 mb-2">Prénom <span class="text-red-500">*</span></label>
        <input type="text" id="newsletter-name" name="newsletter-name" required autocomplete="given-name" data-lpignore="true" data-1p-ignore="true" data-lastpass-ignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#648ED8] focus:border-transparent">
      </div>
      
      <div>
        <label for="newsletter-email" class="block text-sm font-medium text-gray-700 mb-2">Email <span class="text-red-500">*</span></label>
        <input type="email" id="newsletter-email" name="newsletter-email" required autocomplete="email" data-lpignore="true" data-1p-ignore="true" data-lastpass-ignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#648ED8] focus:border-transparent">
      </div>
      
      <div id="form-message" class="hidden text-sm"></div>
      
      <button type="submit" id="submit-btn" class="w-full btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] py-3 px-6 rounded-md font-medium transition-colors">
        <span id="submit-text">Recevoir immédiatement</span>
        <span id="submit-loading" class="hidden">Envoi en cours...</span>
      </button>
      
      <div class="text-xs text-gray-500 mt-4">
        En soumettant ce formulaire, j'accepte que mes informations soient utilisées dans le cadre de ma demande et de la relation commerciale éthique et personnalisée qui peut en découler. Pour connaître et exercer mes droits, notamment pour annuler mon consentement, je consulte les <a href="/mentions-legales" class="text-[#648ED8] hover:underline" target="_blank">mentions légales et la politique de confidentialité</a>.
      </div>
    </form>
  </div>
</div>

<script>
  // Pop-up newsletter personnalisée avec Firebase Functions
  document.addEventListener('DOMContentLoaded', function() {
    const popup = document.getElementById('newsletter-popup');
    const closeBtn = document.getElementById('close-popup');
    const form = document.getElementById('newsletter-form');
    const messageDiv = document.getElementById('form-message');
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitLoading = document.getElementById('submit-loading');
    
    // Fonction pour charger Firebase et Firebase Functions
    async function loadFirebaseFunctions() {
      return new Promise((resolve, reject) => {
        // Configuration Firebase
        const firebaseConfig = {
          apiKey: "AIzaSyDJ-VlDMC5PUEMeILLZ8OmdYIhvhxIfhdM",
          authDomain: "fluance-protected-content.firebaseapp.com",
          projectId: "fluance-protected-content",
          storageBucket: "fluance-protected-content.firebasestorage.app",
          messagingSenderId: "173938686776",
          appId: "1:173938686776:web:891caf76098a42c3579fcd",
          measurementId: "G-CWPNXDQEYR"
        };
        
        // Vérifier si Firebase est déjà chargé et initialisé
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
          // Firebase est déjà initialisé, charger Functions si nécessaire
          if (firebase.functions) {
            resolve();
          } else {
            loadFunctionsModule(resolve, reject);
          }
          return;
        }
        
        // Charger Firebase de manière séquentielle (app-compat d'abord, puis functions-compat)
        const appScriptUrl = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js';
        const functionsScriptUrl = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';
        
        // Vérifier si app-compat est déjà chargé
        if (document.querySelector(`script[src="${appScriptUrl}"]`)) {
          // App est déjà chargé, vérifier si initialisé
          if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
              firebase.initializeApp(firebaseConfig);
            }
            // Charger Functions
            loadFunctionsScript();
          } else {
            // Attendre que firebase soit disponible
            waitForFirebase();
          }
        } else {
          // Charger app-compat d'abord
          const appScript = document.createElement('script');
          appScript.src = appScriptUrl;
          appScript.onload = () => {
            // Attendre un peu pour que le module soit prêt
            setTimeout(() => {
              if (typeof firebase === 'undefined') {
                reject(new Error('Firebase App n\'a pas pu être chargé'));
                return;
              }
              
              // Initialiser Firebase
              if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
              }
              
              // Maintenant charger Functions
              loadFunctionsScript();
            }, 100);
          };
          appScript.onerror = () => reject(new Error('Erreur lors du chargement de Firebase App'));
          document.head.appendChild(appScript);
        }
        
        function loadFunctionsScript() {
          // Vérifier si functions-compat est déjà chargé
          if (document.querySelector(`script[src="${functionsScriptUrl}"]`)) {
            // Functions est déjà chargé, vérifier qu'il est disponible
            loadFunctionsModule(resolve, reject);
          } else {
            // Charger functions-compat
            const functionsScript = document.createElement('script');
            functionsScript.src = functionsScriptUrl;
            functionsScript.onload = () => {
              // Attendre que Functions soit disponible
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
            } else if (attempts > 50) { // 5 secondes max
              clearInterval(checkFunctions);
              reject(new Error('Firebase Functions n\'a pas pu être initialisé'));
            }
          }, 100);
        }
      });
    }
    
    // Ouvrir la pop-up au clic sur les boutons
    const buttons = document.querySelectorAll('[data-w-token="9241cb136525ee5e376e"]');
    buttons.forEach(function(button) {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        popup.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Empêcher le scroll
      });
    });
    
    // Fermer la pop-up
    function closePopup() {
      popup.classList.add('hidden');
      document.body.style.overflow = ''; // Rétablir le scroll
      form.reset();
      messageDiv.classList.add('hidden');
    }
    
    closeBtn.addEventListener('click', closePopup);
    popup.addEventListener('click', function(e) {
      if (e.target === popup) {
        closePopup();
      }
    });
    
    // Soumettre le formulaire
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('newsletter-email').value.trim();
      const name = document.getElementById('newsletter-name').value.trim();
      
      if (!name) {
        showMessage('Veuillez entrer votre prénom', 'error');
        return;
      }
      
      if (!email) {
        showMessage('Veuillez entrer votre email', 'error');
        return;
      }
      
      // Validation du format de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showMessage('Veuillez entrer une adresse email valide', 'error');
        return;
      }
      
      // Désactiver le bouton et afficher le loading
      submitBtn.disabled = true;
      submitText.classList.add('hidden');
      submitLoading.classList.remove('hidden');
      messageDiv.classList.add('hidden');
      
      try {
        // Charger Firebase Functions
        await loadFirebaseFunctions();
        
        // Vérifier que Firebase est complètement initialisé
        if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
          throw new Error('Firebase n\'est pas initialisé');
        }
        
        if (!firebase.functions) {
          throw new Error('Firebase Functions n\'est pas disponible');
        }
        
        // Appeler la fonction Firebase
        const app = firebase.app();
        if (!app) {
          throw new Error('Impossible d\'obtenir l\'instance Firebase');
        }
        
        const functions = app.functions('europe-west1');
        const subscribeToNewsletter = functions.httpsCallable('subscribeToNewsletter');
        const result = await subscribeToNewsletter({ email: email, name: name });
        
        if (result.data && result.data.success) {
          showMessage('Merci ! Vous êtes maintenant inscrit à notre newsletter.', 'success');
          // Rediriger vers la page 2-pratiques-offertes après 1.5 secondes
          setTimeout(() => {
            window.location.href = '/2-pratiques-offertes/';
          }, 1500);
        } else {
          showMessage('Une erreur est survenue. Veuillez réessayer.', 'error');
        }
      } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        
        // Gérer les erreurs spécifiques
        let errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
        
        if (error.code === 'functions/not-found') {
          errorMessage = 'La fonction n\'est pas encore déployée. Veuillez déployer la fonction subscribeToNewsletter.';
        } else if (error.code === 'functions/unavailable') {
          errorMessage = 'Le service est temporairement indisponible. Veuillez réessayer plus tard.';
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.code) {
          errorMessage = `Erreur: ${error.code}`;
        }
        
        showMessage(errorMessage, 'error');
      } finally {
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitText.classList.remove('hidden');
        submitLoading.classList.add('hidden');
      }
    });
    
    function showMessage(text, type) {
      messageDiv.textContent = text;
      messageDiv.className = 'text-sm ' + (type === 'success' ? 'text-green-600' : 'text-red-600');
      messageDiv.classList.remove('hidden');
    }
  });
</script>