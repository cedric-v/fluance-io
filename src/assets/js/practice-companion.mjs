/**
 * practice-companion.mjs — « Ma pratique » (Fluance)
 *
 * Compagnon de pratique : l'utilisateur choisit un état/besoin et reçoit des
 * recommandations courtes, puis lance la pratique sans quitter la page.
 *
 * Principes :
 *  - Aucun contenu vidéo dupliqué : les pratiques gratuites pointent vers des
 *    vidéos déjà publiques, les pratiques premium sont résolues via
 *    window.FluanceAuth.displayProtectedContent() (donc via getProtectedContent,
 *    qui revérifie les droits côté serveur).
 *  - Aucun état émotionnel stocké : le besoin choisi reste en mémoire.
 *  - Aucune vidéo chargée avant le clic (l'iframe n'est injectée qu'à ce moment).
 *  - Aucun framework : DOM natif, quelques Ko.
 *
 * Le catalogue est fourni par src/_data/practices.json et embarqué dans la page
 * via le shortcode `practiceCatalog`.
 */

(function () {
  'use strict';

  const app = document.getElementById('companion-app');
  if (!app) return;

  const catalogEl = document.getElementById('practice-catalog');
  if (!catalogEl) {
    console.warn('[Ma pratique] Catalogue introuvable (#practice-catalog).');
    return;
  }

  let catalog;
  try {
    catalog = JSON.parse(catalogEl.textContent || '{}');
  } catch (e) {
    console.error('[Ma pratique] Catalogue JSON invalide.', e);
    return;
  }

  const LANG = ((document.documentElement.getAttribute('lang') || 'fr').toLowerCase().startsWith('en')) ? 'en' : 'fr';
  const T = {
    fr: {
      recommended: 'Pratiques recommandées pour toi',
      start: 'Lancer la pratique',
      free: 'Gratuit',
      premium: 'Inclus dans ton accès',
      min: 'min',
      none: 'Aucune pratique n’est encore disponible ici. Reviens bientôt, de nouvelles pratiques arrivent.',
      playerTitle: 'Ta pratique',
      thanks: 'Bravo, tu as pris un moment pour toi. 🌿',
      upsellTitle: 'Envie d’aller plus loin ?',
      upsellText: 'Débloque toutes les pratiques Fluance, les parcours guidés et les nouveaux contenus chaque semaine.',
      upsellCta: 'Découvrir l’accès complet',
      upsellUrl: '/decouvrir-ma-pratique/',
      error: 'Impossible de lancer cette pratique pour le moment. Réessaie ou reconnecte-toi.',
      signupMissing: 'Merci de renseigner un email valide et un mot de passe de 6 caractères minimum.',
      signupBot: 'Vérification anti-bot en cours ou invalide. Réessaie dans un instant.',
      signupExists: 'Un compte existe déjà avec cet email. Utilise le lien « Se connecter » ci-dessous.',
      signupError: 'Impossible de créer le compte pour le moment. Réessaie dans un instant.',
      signupLoading: 'Création du compte…',
      install: 'Installer l’application',
      installIos: 'Pour installer : Partager → « Sur l’écran d’accueil »',
    },
    en: {
      recommended: 'Recommended practices for you',
      start: 'Start practice',
      free: 'Free',
      premium: 'Included in your access',
      min: 'min',
      none: 'No practice is available here yet. Come back soon, new practices are on the way.',
      playerTitle: 'Your practice',
      thanks: 'Well done, you took a moment for yourself. 🌿',
      upsellTitle: 'Want to go further?',
      upsellText: 'Unlock all Fluance practices, guided journeys and new content every week.',
      upsellCta: 'Discover full access',
      upsellUrl: '/en/discover-my-practice/',
      error: 'This practice cannot be started right now. Try again or sign in again.',
      signupMissing: 'Please enter a valid email and a password of at least 6 characters.',
      signupBot: 'Bot verification is in progress or invalid. Please try again in a moment.',
      signupExists: 'An account already exists with this email. Use the “Sign in” link below.',
      signupError: 'The account could not be created right now. Please try again in a moment.',
      signupLoading: 'Creating account…',
      install: 'Install the app',
      installIos: 'To install: Share → “Add to Home Screen”',
    },
  }[LANG];

  // --- Éléments d'interface ---
  const pendingEl = document.getElementById('companion-auth-pending');
  const authRequiredEl = document.getElementById('companion-auth-required');
  const mainEl = document.getElementById('companion-main');
  const needGrid = document.getElementById('need-grid');
  const recSection = document.getElementById('recommendation');
  const recList = document.getElementById('recommendation-list');
  const recTitle = document.getElementById('recommendation-title');
  const playerSection = document.getElementById('player-section');
  const playerTitle = document.getElementById('player-title');
  const playerContainer = document.getElementById('player-container');
  const playerDone = document.getElementById('player-done');
  const playerClose = document.getElementById('player-close');
  const playerFeedback = document.getElementById('player-feedback');
  const signupForm = document.getElementById('free-signup-form');
  const signupFirstName = document.getElementById('signup-firstname');
  const signupEmail = document.getElementById('signup-email');
  const signupPassword = document.getElementById('signup-password');
  const signupError = document.getElementById('free-signup-error');
  const signupSubmit = document.getElementById('free-signup-submit');

  let accessibleProtected = new Map(); // contentId → titre (droits résolus côté serveur)
  let protectedCacheLoaded = false;
  let selectedNeed = null;
  let currentPractice = null;
  let appShown = false;
  let turnstileToken = null;
  let turnstileWidgetId = null;
  let turnstileLoading = null;
  let functionsLoading = null;

  // --- Utilitaires ---

  function track(event, data) {
    try {
      if (localStorage.getItem('cookieConsent') !== 'accepted') return;
      if (!window.dataLayer) return;
      window.dataLayer.push(Object.assign({ event: event }, data || {}));
    } catch (_e) { /* stockage indisponible : on ignore */ }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function localize(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[LANG] || obj.fr || obj.en || '';
  }

  function setVisible(el, visible) {
    if (!el) return;
    el.classList.toggle('hidden', !visible);
  }

  // --- Accès aux contenus premium (droits réels côté serveur) ---

  async function loadProtectedAccess() {
    if (protectedCacheLoaded) return;
    protectedCacheLoaded = true;
    try {
      if (!window.FluanceAuth || typeof window.FluanceAuth.loadProtectedContent !== 'function') return;
      const result = await window.FluanceAuth.loadProtectedContent(null, { startProgression: false });
      if (!result || !result.success || !Array.isArray(result.products)) {
        // Un compte sans produit (gratuit) déclenche NO_PRODUCT : ce n'est pas une erreur ici.
        return;
      }
      const map = new Map();
      result.products.forEach(function (product) {
        (product.contents || []).forEach(function (content) {
          if (content && content.id && content.isAccessible) {
            map.set(content.id, content.title || '');
          }
        });
      });
      accessibleProtected = map;
    } catch (e) {
      console.warn('[Ma pratique] Accès premium indisponible :', e);
    }
  }

  // --- Recommandation (règle simple et explicable) ---

  function recommendationsFor(needId) {
    const all = Array.isArray(catalog.practices) ? catalog.practices : [];
    return all
      .filter(function (p) { return Array.isArray(p.needs) && p.needs.indexOf(needId) !== -1; })
      .filter(function (p) {
        if (p.source === 'free') return true; // gratuit : accessible à tout utilisateur connecté
        if (p.source === 'protected') return accessibleProtected.has(p.contentId);
        return false;
      })
      .sort(function (a, b) {
        const pa = a.priority || 0;
        const pb = b.priority || 0;
        if (pb !== pa) return pb - pa;
        return (a.durationMin || 99) - (b.durationMin || 99);
      })
      .slice(0, 3);
  }

  // --- Rendu ---

  function renderRecommendations(needId) {
    if (!needGrid || !recSection || !recList) return;
    selectedNeed = needId;

    // état actif des boutons
    needGrid.querySelectorAll('[data-need]').forEach(function (btn) {
      const active = btn.getAttribute('data-need') === needId;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('ring-2', active);
      btn.classList.toggle('ring-fluance', active);
      btn.classList.toggle('bg-fluance/10', active);
    });

    const list = recommendationsFor(needId);

    if (list.length === 0) {
      recTitle.textContent = T.recommended;
      recList.innerHTML = '<p class="text-gray-600">' + escapeHtml(T.none) + '</p>';
    } else {
      recTitle.textContent = T.recommended;
      recList.innerHTML = list.map(function (p, index) {
        const title = p.source === 'free'
          ? localize(p.title)
          : (accessibleProtected.get(p.contentId) || p.contentId || '');
        const reason = localize(p.reason);
        const tierLabel = p.source === 'free' ? T.free : T.premium;
        const duration = p.durationMin ? (p.durationMin + ' ' + T.min) : '';
        return '' +
          '<article class="section-card bg-white p-5 flex flex-col gap-3">' +
          '  <div class="flex items-start justify-between gap-3">' +
          '    <h3 class="text-lg font-semibold text-[#3E3A35]">' + escapeHtml(title) + '</h3>' +
          '    <span class="shrink-0 text-xs font-semibold px-2 py-1 rounded-full ' + (p.source === 'free' ? 'bg-[#8bc34a]/15 text-[#5a7d2a]' : 'bg-fluance/10 text-fluance') + '">' + escapeHtml(tierLabel) + '</span>' +
          '  </div>' +
          (reason ? '  <p class="text-sm text-[#3E3A35]/70">' + escapeHtml(reason) + '</p>' : '') +
          '  <div class="flex items-center gap-3 text-sm text-[#3E3A35]/60">' +
          (duration ? '    <span>⏱ ' + escapeHtml(duration) + '</span>' : '') +
          '  </div>' +
          '  <button type="button" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] mt-1" data-start-index="' + index + '">' + escapeHtml(T.start) + '</button>' +
          '</article>';
      }).join('');

      recList.querySelectorAll('[data-start-index]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const idx = parseInt(btn.getAttribute('data-start-index'), 10);
          startPractice(list[idx]);
        });
      });
    }

    setVisible(recSection, true);
    track('recommendation_displayed', { need: needId, count: list.length, lang: LANG });
  }

  function renderUpsell() {
    const existing = document.getElementById('companion-upsell');
    if (existing) return;
    const upsell = document.createElement('div');
    upsell.id = 'companion-upsell';
    upsell.className = 'mt-10 rounded-2xl border border-fluance/15 bg-gradient-to-r from-fluance/10 to-fluance/5 p-6 md:p-8 text-center';
    upsell.innerHTML = '' +
      '<h2 class="text-xl md:text-2xl font-semibold text-fluance mb-2">' + escapeHtml(T.upsellTitle) + '</h2>' +
      '<p class="text-[#3E3A35] mb-5 max-w-xl mx-auto">' + escapeHtml(T.upsellText) + '</p>' +
      '<a href="' + (app.getAttribute('data-upsell-url') || T.upsellUrl) + '" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A]">' + escapeHtml(T.upsellCta) + '</a>';
    app.appendChild(upsell);
  }

  // --- Lecture ---

  function startPractice(practice) {
    if (!practice || !playerSection || !playerContainer) return;
    currentPractice = practice;
    setVisible(playerFeedback, false);
    playerContainer.innerHTML = '';

    const title = practice.source === 'free'
      ? localize(practice.title)
      : (accessibleProtected.get(practice.contentId) || practice.contentId || T.playerTitle);
    if (playerTitle) playerTitle.textContent = title;

    if (practice.source === 'free' && practice.embedUrl) {
      playerContainer.innerHTML =
        '<div style="position:relative;padding-top:56.25%;">' +
        '<iframe title="' + escapeHtml(title) + '" src="' + escapeHtml(practice.embedUrl) + '" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe>' +
        '</div>';
    } else if (practice.source === 'protected' && practice.contentId) {
      if (window.FluanceAuth && typeof window.FluanceAuth.displayProtectedContent === 'function') {
        window.FluanceAuth.displayProtectedContent(practice.contentId, playerContainer, { startProgression: false }).catch(function () {
          playerContainer.innerHTML = '<p class="text-red-700">' + escapeHtml(T.error) + '</p>';
        });
      } else {
        playerContainer.innerHTML = '<p class="text-red-700">' + escapeHtml(T.error) + '</p>';
      }
    }

    setVisible(playerSection, true);
    if (playerSection.scrollIntoView) playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    track('practice_started', { practice: practice.id, source: practice.source, need: selectedNeed, lang: LANG });
  }

  function finishPractice() {
    if (playerFeedback) {
      playerFeedback.textContent = T.thanks;
      setVisible(playerFeedback, true);
    }
    track('practice_completed', { practice: currentPractice ? currentPractice.id : null, need: selectedNeed, lang: LANG });
  }

  function closePlayer() {
    setVisible(playerSection, false);
    if (playerContainer) playerContainer.innerHTML = '';
    if (playerFeedback) setVisible(playerFeedback, false);
    currentPractice = null;
  }

  // --- Auth ---

  function showLogin() {
    setVisible(pendingEl, false);
    setVisible(mainEl, false);
    setVisible(authRequiredEl, true);
    renderTurnstile();
  }

  function showApp() {
    setVisible(pendingEl, false);
    setVisible(authRequiredEl, false);
    setVisible(mainEl, true);
    if (appShown) return;
    appShown = true;
    track('companion_opened', { lang: LANG });
    // Charger les droits premium en arrière-plan (n'affecte pas l'affichage du gratuit)
    loadProtectedAccess().then(function () {
      if (selectedNeed) renderRecommendations(selectedNeed);
    });
    renderUpsell();
    setupInstallPrompt();
  }

  function handleAuthState(user) {
    if (user) showApp();
    else showLogin();
  }

  // --- Initialisation ---

  function attachNeedHandlers() {
    if (!needGrid) return;
    needGrid.querySelectorAll('[data-need]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const need = btn.getAttribute('data-need');
        track('need_selected', { need: need, lang: LANG });
        renderRecommendations(need);
      });
    });
  }

  function wirePlayer() {
    if (playerDone) playerDone.addEventListener('click', finishPractice);
    if (playerClose) playerClose.addEventListener('click', closePlayer);
  }

  // --- Inscription gratuite (freemium) ---

  function showSignupError(message) {
    if (!signupError) return;
    signupError.textContent = message;
    signupError.classList.remove('hidden');
  }

  function setSignupLoading(loading) {
    if (!signupSubmit) return;
    signupSubmit.disabled = !!loading;
    signupSubmit.textContent = loading
      ? T.signupLoading
      : (LANG === 'en' ? 'Create my free account' : 'Créer mon compte gratuit');
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (turnstileLoading) return turnstileLoading;
    turnstileLoading = new Promise(function (resolve) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { resolve(); };
      document.head.appendChild(script);
    });
    return turnstileLoading;
  }

  function renderTurnstile() {
    if (turnstileWidgetId !== null) return;
    const container = document.getElementById('companion-turnstile');
    if (!container) return;
    loadTurnstile().then(function () {
      if (!window.turnstile || typeof window.turnstile.render !== 'function') return;
      const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const sitekey = isLocal ? '0x4AAAAAAABkMYinukE8K9X0' : '0x4AAAAAACF5HWhHHcGA5yJk';
      try {
        turnstileWidgetId = window.turnstile.render(container, {
          sitekey: sitekey,
          action: 'free-signup',
          callback: function (token) { turnstileToken = token; },
          'expired-callback': function () { turnstileToken = null; },
          'error-callback': function () { turnstileToken = null; },
        });
      } catch (e) {
        console.warn('[Ma pratique] Turnstile non rendu :', e && e.message ? e.message : e);
      }
    });
  }

  function loadFunctionsCompat() {
    if (typeof firebase !== 'undefined' && typeof firebase.functions === 'function') return Promise.resolve();
    if (functionsLoading) return functionsLoading;
    functionsLoading = new Promise(function (resolve) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/12.8.0/firebase-functions-compat.js';
      script.onload = function () { resolve(); };
      script.onerror = function () { resolve(); };
      document.head.appendChild(script);
    });
    return functionsLoading;
  }

  async function handleFreeSignup(event) {
    event.preventDefault();
    if (signupError) { signupError.classList.add('hidden'); signupError.textContent = ''; }
    const email = signupEmail ? signupEmail.value.trim() : '';
    const password = signupPassword ? signupPassword.value : '';
    const firstName = signupFirstName ? signupFirstName.value.trim() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || password.length < 6) {
      showSignupError(T.signupMissing);
      return;
    }
    setSignupLoading(true);
    try {
      await loadFunctionsCompat();
      if (typeof firebase === 'undefined' || typeof firebase.functions !== 'function') {
        throw new Error('firebase-functions-unavailable');
      }
      const callable = firebase.app().functions('europe-west1').httpsCallable('createFreeAccount');
      await callable({
        email: email,
        password: password,
        firstName: firstName,
        turnstileToken: turnstileToken,
        locale: LANG,
      });
      const signInResult = await window.FluanceAuth.signIn(email, password, true);
      if (!signInResult || !signInResult.success) {
        throw new Error((signInResult && signInResult.error) ? signInResult.error : 'signin-failed');
      }
      track('free_account_created', { lang: LANG });
      showApp();
    } catch (err) {
      const code = String((err && err.code) || '');
      if (code.indexOf('already-exists') !== -1) {
        showSignupError(T.signupExists);
      } else if (code.indexOf('permission-denied') !== -1 || code.indexOf('invalid-argument') !== -1) {
        showSignupError(T.signupBot);
      } else {
        showSignupError(T.signupError);
      }
      console.warn('[Ma pratique] Échec inscription gratuite :', err && err.message ? err.message : err);
    } finally {
      setSignupLoading(false);
    }
  }

  function wireSignup() {
    if (signupForm) signupForm.addEventListener('submit', handleFreeSignup);
  }

  // --- Invitation à installer la PWA (discrète, jamais intrusive) ---

  function setupInstallPrompt() {
    if (!mainEl) return;
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    const wrap = document.createElement('div');
    wrap.id = 'companion-install';
    wrap.className = 'hidden mt-6 text-center';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'text-sm font-medium text-fluance underline';
    btn.textContent = T.install;
    wrap.appendChild(btn);

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      wrap.classList.remove('hidden');
    });
    btn.addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = deferredPrompt.userChoice;
        const reset = function () { deferredPrompt = null; wrap.classList.add('hidden'); };
        if (choice && choice.finally) choice.finally(reset); else reset();
      } else {
        // iOS Safari : pas de beforeinstallprompt → on masque le rappel après lecture.
        wrap.classList.add('hidden');
      }
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      wrap.classList.add('hidden');
    });

    // iOS/Safari : pas d'événement d'installation → indice discret et non bloquant.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      btn.textContent = T.installIos;
      wrap.classList.remove('hidden');
    }

    mainEl.appendChild(wrap);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const swUrl = app.getAttribute('data-sw-url') || '/sw.js';
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(swUrl, { scope: '/' }).catch(function (e) {
        // L'échec d'installation PWA ne doit jamais gêner la pratique.
        console.warn('[Ma pratique] Service worker non enregistré :', e && e.message ? e.message : e);
      });
    });
  }

  function boot() {
    attachNeedHandlers();
    wirePlayer();
    wireSignup();
    registerServiceWorker();
    setVisible(pendingEl, true);

    // Le SDK Firebase est chargé dynamiquement par firebase-auth.mjs.
    let attempts = 0;
    const timer = setInterval(function () {
      attempts += 1;
      const ready = typeof window.FluanceAuth !== 'undefined' &&
        typeof firebase !== 'undefined' &&
        typeof firebase.auth === 'function';
      if (ready) {
        clearInterval(timer);
        firebase.auth().onAuthStateChanged(handleAuthState);
        // Session déjà restaurée : décider immédiatement (état confirmé par Firebase)
        if (window.FluanceAuth.getCurrentUser()) showApp();
        return;
      }
      if (attempts >= 60) { // ~15 s
        clearInterval(timer);
        showLogin();
      }
    }, 250);
  }

  // Exposé pour tests / debug uniquement (aucune dépendance externe).
  window.FluanceCompanion = {
    recommendationsFor: recommendationsFor,
    startPractice: startPractice,
    catalog: catalog,
    lang: LANG,
  };

  boot();
})();
