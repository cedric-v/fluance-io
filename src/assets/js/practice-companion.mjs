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
      upsellUrl: '/decouvrir-ma-pratique/#formules',
      error: 'Impossible de lancer cette pratique pour le moment. Réessaie ou reconnecte-toi.',
      signupMissing: 'Merci de renseigner un email valide et un mot de passe de 6 caractères minimum.',
      signupBot: 'Vérification anti-bot en cours ou invalide. Réessaie dans un instant.',
      signupExists: 'Un compte existe déjà avec cet email. Utilise le lien « Se connecter » ci-dessous.',
      signupError: 'Impossible de créer le compte pour le moment. Réessaie dans un instant.',
      signupLoading: 'Création du compte…',
      install: 'Installer l’application',
      installIos: 'Pour installer : Partager → « Sur l’écran d’accueil »',
      gateTitle: 'Crée ton accès pour lancer la pratique',
      gateText: 'Ta sélection est prête. Crée ton compte gratuit (aucun engagement) et lance la pratique tout de suite.',
      gateLaunchTitle: 'Crée ton accès pour continuer',
      gateLaunchText: 'Tu as découvert ta première pratique offerte. Crée ton compte gratuit (aucun engagement) pour lancer les suivantes.',
      gateFavoriteTitle: 'Crée ton accès pour enregistrer tes favoris',
      gateFavoriteText: 'Crée ton compte gratuit (aucun engagement) pour sauvegarder tes pratiques préférées.',
      gateLogTitle: 'Crée ton accès pour garder ton historique',
      gateLogText: 'Crée ton compte gratuit (aucun engagement) pour enregistrer cette pratique et suivre ton rythme.',
      firstFreeNote: 'Ta première pratique est offerte, sans compte.',
      anonNote: 'Première pratique offerte, sans compte. Crée ton accès gratuit pour garder ton historique et tes favoris.',
      trackingTitle: 'Mon suivi',
      stat7: '7 derniers jours',
      stat30: '30 derniers jours',
      statTotal: 'Pratiques au total',
      favoritesTitle: 'Tes favoris',
      favoritesEmpty: 'Ajoute une pratique en favori avec ☆ pour la retrouver ici.',
      historyTitle: 'Ton historique',
      historyEmpty: 'Tes pratiques terminées apparaîtront ici.',
      removeFavorite: 'Retirer des favoris',
      addFavorite: 'Ajouter aux favoris',
      practice: 'Pratiquer',
      notificationsTitle: 'Rappels de pratique',
      notificationsText: 'Recevoir un petit email « Un petit moment pour toi ? » quand tu n’as pas pratiqué depuis quelques jours. Maximum une fois par semaine. Désactivable à tout moment.',
      notificationsOn: 'Activés',
      notificationsOff: 'Désactivés',
      notificationsSaved: 'Préférence enregistrée.',
      unsubscribed: 'Les rappels de pratique sont désactivés.',
      errorSave: 'Impossible d’enregistrer pour le moment.',
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
      upsellUrl: '/en/discover-my-practice/#formules',
      error: 'This practice cannot be started right now. Try again or sign in again.',
      signupMissing: 'Please enter a valid email and a password of at least 6 characters.',
      signupBot: 'Bot verification is in progress or invalid. Please try again in a moment.',
      signupExists: 'An account already exists with this email. Use the “Sign in” link below.',
      signupError: 'The account could not be created right now. Please try again in a moment.',
      signupLoading: 'Creating account…',
      install: 'Install the app',
      installIos: 'To install: Share → “Add to Home Screen”',
      gateTitle: 'Create your access to start the practice',
      gateText: 'Your selection is ready. Create your free account (no commitment) and start right away.',
      gateLaunchTitle: 'Create your access to continue',
      gateLaunchText: 'You’ve discovered your first free practice. Create your free account (no commitment) to start the next ones.',
      gateFavoriteTitle: 'Create your access to save favourites',
      gateFavoriteText: 'Create your free account (no commitment) to save your favourite practices.',
      gateLogTitle: 'Create your access to keep your history',
      gateLogText: 'Create your free account (no commitment) to record this practice and track your rhythm.',
      firstFreeNote: 'Your first practice is free, no account needed.',
      anonNote: 'First practice free, no account needed. Create your free access to keep your history and favourites.',
      trackingTitle: 'My tracking',
      stat7: 'Last 7 days',
      stat30: 'Last 30 days',
      statTotal: 'Total practices',
      favoritesTitle: 'Your favourites',
      favoritesEmpty: 'Favourite a practice with ☆ to find it here.',
      historyTitle: 'Your history',
      historyEmpty: 'Your completed practices will appear here.',
      removeFavorite: 'Remove from favourites',
      addFavorite: 'Add to favourites',
      practice: 'Practice',
      notificationsTitle: 'Practice reminders',
      notificationsText: 'Receive a short email “A little moment for you?” when you haven’t practiced for a few days. At most once a week. Can be turned off anytime.',
      notificationsOn: 'On',
      notificationsOff: 'Off',
      notificationsSaved: 'Preference saved.',
      unsubscribed: 'Practice reminders are turned off.',
      errorSave: 'Could not save right now.',
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
  const trackingSection = document.getElementById('companion-tracking');
  const statsEl = document.getElementById('companion-stats');
  const favoritesEl = document.getElementById('companion-favorites');
  const historyEl = document.getElementById('companion-history');
  const notificationsEl = document.getElementById('companion-notifications');
  const playerFavorite = document.getElementById('player-favorite');
  const recNote = document.getElementById('recommendation-note');
  const playerAnonNote = document.getElementById('player-anon-note');
  const authTitleEl = document.getElementById('companion-auth-title');
  const authTextEl = document.getElementById('companion-auth-text');

  let accessibleProtected = new Map(); // contentId → titre (droits résolus côté serveur)
  let protectedCacheLoaded = false;
  let selectedNeed = null;
  let currentPractice = null;
  let appShown = false;
  let turnstileToken = null;
  let turnstileWidgetId = null;
  let turnstileLoading = null;
  let functionsLoading = null;
  let userStats = null;
  let pendingNeed = null;
  let pendingUnsubscribe = false;
  let notificationMessage = '';
  let authed = false;
  let pendingAction = null;
  let freeTrialUsed = false;

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

  // Appelle une fonction callable (charge firebase-functions si nécessaire).
  async function callFunction(name, payload) {
    await loadFunctionsCompat();
    if (typeof firebase === 'undefined' || typeof firebase.functions !== 'function') {
      throw new Error('firebase-functions-unavailable');
    }
    const callable = firebase.app().functions('europe-west1').httpsCallable(name);
    const response = await callable(payload || {});
    return response.data;
  }

  function titleForContent(contentId) {
    const free = (catalog.practices || []).find(function (p) {
      return p.id === contentId && p.source === 'free';
    });
    if (free) return localize(free.title);
    if (accessibleProtected && accessibleProtected.get(contentId)) return accessibleProtected.get(contentId);
    return contentId;
  }

  function needLabel(needId) {
    const need = (catalog.needs || []).find(function (n) { return n.id === needId; });
    return need ? localize(need.label) : needId;
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(LANG === 'en' ? 'en-GB' : 'fr-CH', {day: '2-digit', month: 'short'});
    } catch (_e) {
      return '';
    }
  }

  function isFavorite(contentId) {
    return !!(userStats && Array.isArray(userStats.favorites) && userStats.favorites.indexOf(contentId) !== -1);
  }

  function findCatalogPractice(contentId) {
    return (catalog.practices || []).find(function (p) { return p.id === contentId; }) || null;
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
        const fav = isFavorite(p.id);
        return '' +
          '<article class="section-card bg-white p-5 flex flex-col gap-3">' +
          '  <div class="flex items-start justify-between gap-3">' +
          '    <h3 class="text-lg font-semibold text-[#3E3A35]">' + escapeHtml(title) + '</h3>' +
          '    <button type="button" class="shrink-0 text-xl leading-none text-[#E6B84A] hover:opacity-80" data-fav-id="' + escapeHtml(p.id) + '" data-fav-state="' + (fav ? '1' : '0') + '" aria-pressed="' + (fav ? 'true' : 'false') + '" aria-label="' + escapeHtml(fav ? T.removeFavorite : T.addFavorite) + '">' + (fav ? '★' : '☆') + '</button>' +
          '  </div>' +
          (reason ? '  <p class="text-sm text-[#3E3A35]/70">' + escapeHtml(reason) + '</p>' : '') +
          '  <div class="flex items-center gap-2 text-sm text-[#3E3A35]/60">' +
          '    <span class="text-xs font-semibold px-2 py-1 rounded-full ' + (p.source === 'free' ? 'bg-[#8bc34a]/15 text-[#5a7d2a]' : 'bg-fluance/10 text-fluance') + '">' + escapeHtml(tierLabel) + '</span>' +
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
      recList.querySelectorAll('[data-fav-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const id = btn.getAttribute('data-fav-id');
          setFavorite(id, btn.getAttribute('data-fav-state') !== '1');
        });
      });
    }

    setVisible(recSection, true);
    if (recNote) {
      recNote.textContent = T.firstFreeNote;
      setVisible(recNote, !authed && !freeTrialUsed);
    }
    track('recommendation_displayed', {need: needId, count: list.length, lang: LANG});
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

  // --- Suivi : favoris, historique, statistiques, rappels ---

  function updatePlayerFavorite() {
    if (!playerFavorite || !currentPractice) return;
    const fav = isFavorite(currentPractice.id);
    playerFavorite.textContent = fav ? '★' : '☆';
    playerFavorite.setAttribute('aria-pressed', fav ? 'true' : 'false');
    playerFavorite.setAttribute('aria-label', fav ? T.removeFavorite : T.addFavorite);
  }

  function renderTracking() {
    if (!trackingSection || !userStats) return;
    setVisible(trackingSection, true);

    const s = userStats.stats || {};
    if (statsEl) {
      const cards = [
        {value: s.last7 || 0, label: T.stat7},
        {value: s.last30 || 0, label: T.stat30},
        {value: s.total || 0, label: T.statTotal},
      ];
      statsEl.innerHTML = cards.map(function (c) {
        return '<div class="rounded-xl border border-fluance/10 bg-white p-4 text-center">' +
          '<div class="text-2xl font-semibold text-fluance">' + escapeHtml(String(c.value)) + '</div>' +
          '<div class="text-xs text-[#3E3A35]/60 mt-1">' + escapeHtml(c.label) + '</div>' +
          '</div>';
      }).join('');
    }

    const favs = Array.isArray(userStats.favorites) ? userStats.favorites : [];
    if (favoritesEl) {
      if (favs.length === 0) {
        favoritesEl.innerHTML = '<h3 class="font-semibold text-[#3E3A35] mb-2">' + escapeHtml(T.favoritesTitle) + '</h3>' +
          '<p class="text-sm text-[#3E3A35]/60">' + escapeHtml(T.favoritesEmpty) + '</p>';
      } else {
        favoritesEl.innerHTML = '<h3 class="font-semibold text-[#3E3A35] mb-3">' + escapeHtml(T.favoritesTitle) + '</h3>' +
          '<ul class="space-y-2">' + favs.map(function (id) {
            return '<li class="flex items-center justify-between gap-3 rounded-lg border border-fluance/10 bg-white px-4 py-3">' +
              '<span class="text-[#3E3A35]">' + escapeHtml(titleForContent(id)) + '</span>' +
              '<span class="flex items-center gap-3 shrink-0">' +
              '<button type="button" class="text-sm font-medium text-fluance hover:underline" data-practice-id="' + escapeHtml(id) + '">' + escapeHtml(T.practice) + '</button>' +
              '<button type="button" class="text-lg leading-none text-[#E6B84A]" data-unfav-id="' + escapeHtml(id) + '" aria-label="' + escapeHtml(T.removeFavorite) + '">★</button>' +
              '</span></li>';
          }).join('') + '</ul>';
      }
      favoritesEl.querySelectorAll('[data-practice-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const practice = findCatalogPractice(btn.getAttribute('data-practice-id'));
          if (practice) startPractice(practice);
        });
      });
      favoritesEl.querySelectorAll('[data-unfav-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setFavorite(btn.getAttribute('data-unfav-id'), false);
        });
      });
    }

    const history = Array.isArray(userStats.history) ? userStats.history : [];
    if (historyEl) {
      if (history.length === 0) {
        historyEl.innerHTML = '<h3 class="font-semibold text-[#3E3A35] mb-2">' + escapeHtml(T.historyTitle) + '</h3>' +
          '<p class="text-sm text-[#3E3A35]/60">' + escapeHtml(T.historyEmpty) + '</p>';
      } else {
        historyEl.innerHTML = '<h3 class="font-semibold text-[#3E3A35] mb-3">' + escapeHtml(T.historyTitle) + '</h3>' +
          '<ul class="text-sm text-[#3E3A35]/80">' + history.slice(0, 8).map(function (h) {
            const need = h.need ? ' · ' + needLabel(h.need) : '';
            return '<li class="flex items-center justify-between gap-3 border-b border-gray-100 py-2">' +
              '<span>' + escapeHtml(titleForContent(h.contentId)) + escapeHtml(need) + '</span>' +
              '<span class="text-[#3E3A35]/50 shrink-0">' + escapeHtml(formatDate(h.completedAt)) + '</span></li>';
          }).join('') + '</ul>';
      }
    }

    if (notificationsEl) {
      const on = userStats.notificationOptIn === true;
      notificationsEl.innerHTML =
        '<div class="rounded-xl border border-fluance/15 bg-white p-5">' +
        '<div class="flex items-start justify-between gap-4">' +
        '<div><h3 class="font-semibold text-[#3E3A35]">' + escapeHtml(T.notificationsTitle) + '</h3>' +
        '<p class="text-sm text-[#3E3A35]/70 mt-1">' + escapeHtml(T.notificationsText) + '</p></div>' +
        '<button type="button" id="companion-notif-toggle" class="shrink-0 rounded-full px-3 py-1 text-sm font-semibold ' + (on ? 'bg-fluance text-white' : 'bg-gray-200 text-gray-700') + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        escapeHtml(on ? T.notificationsOn : T.notificationsOff) + '</button>' +
        '</div>' +
        (notificationMessage ? '<p class="text-sm text-[#5a7d2a] mt-3" role="status">' + escapeHtml(notificationMessage) + '</p>' : '') +
        '</div>';
      const toggle = document.getElementById('companion-notif-toggle');
      if (toggle) toggle.addEventListener('click', function () { setNotifications(!on); });
    }
  }

  async function refreshStats() {
    try {
      const data = await callFunction('getPracticeStats', {});
      if (!data || !data.success) return;
      userStats = {
        favorites: Array.isArray(data.favorites) ? data.favorites : [],
        notificationOptIn: data.notificationOptIn === true,
        stats: data.stats || {total: 0, last7: 0, last30: 0, last365: 0, topNeeds: []},
        history: Array.isArray(data.history) ? data.history : [],
      };
      renderTracking();
      if (selectedNeed) renderRecommendations(selectedNeed);
      updatePlayerFavorite();
    } catch (e) {
      console.warn('[Ma pratique] Statistiques indisponibles :', e && e.message ? e.message : e);
    }
  }

  async function setFavorite(contentId, favorite) {
    if (!contentId) return;
    if (!authed) {
      requestSignup('favorite', {contentId: contentId, favorite: favorite});
      return;
    }
    // Mise à jour optimiste de l'interface
    if (userStats) {
      const favs = Array.isArray(userStats.favorites) ? userStats.favorites.slice() : [];
      const idx = favs.indexOf(contentId);
      if (favorite && idx === -1) favs.unshift(contentId);
      if (!favorite && idx !== -1) favs.splice(idx, 1);
      userStats.favorites = favs;
      renderTracking();
      if (selectedNeed) renderRecommendations(selectedNeed);
      updatePlayerFavorite();
    }
    track(favorite ? 'practice_favorited' : 'practice_unfavorited', {practice: contentId, lang: LANG});
    try {
      const data = await callFunction('toggleFavorite', {contentId: contentId, favorite: favorite});
      if (userStats && data && Array.isArray(data.favorites)) {
        userStats.favorites = data.favorites;
        renderTracking();
        if (selectedNeed) renderRecommendations(selectedNeed);
        updatePlayerFavorite();
      }
    } catch (e) {
      console.warn('[Ma pratique] Favori non enregistré :', e && e.message ? e.message : e);
      // Resynchroniser l'état réel en cas d'échec.
      refreshStats();
    }
  }

  async function setNotifications(optIn, successMessage) {
    try {
      const data = await callFunction('setNotificationOptIn', {optIn: !!optIn});
      if (userStats) userStats.notificationOptIn = !!(data && data.optIn);
      notificationMessage = successMessage || T.notificationsSaved;
    } catch (e) {
      console.warn('[Ma pratique] Préférence non enregistrée :', e && e.message ? e.message : e);
      notificationMessage = T.errorSave;
    }
    renderTracking();
  }

  async function logPractice(practice) {
    if (!practice) return;
    try {
      await callFunction('logPractice', {
        contentId: practice.id || practice.contentId,
        need: selectedNeed,
        source: practice.source,
      });
      await refreshStats();
    } catch (e) {
      console.warn('[Ma pratique] Pratique non enregistrée :', e && e.message ? e.message : e);
    }
  }

  function handleUrlParams() {
    let params;
    try {
      params = new URLSearchParams(location.search);
    } catch (_e) {
      return;
    }
    const need = params.get('need');
    if (need && (catalog.needs || []).some(function (n) { return n.id === need; })) {
      pendingNeed = need;
    }
    if (params.get('notifications') === 'off') {
      pendingUnsubscribe = true;
    }
    if (pendingNeed || pendingUnsubscribe) {
      try { history.replaceState(null, '', location.pathname); } catch (_e) { /* ignore */ }
    }
  }

  // --- Lecture ---

  function startPractice(practice) {
    if (!practice || !playerSection || !playerContainer) return;

    // Anonyme : la PREMIÈRE pratique gratuite est offerte, sans compte.
    // Toute autre action (2e pratique, favori, historique) nécessite un compte.
    if (!authed) {
      const isFirstFree = practice.source === 'free' && !freeTrialUsed;
      if (!isFirstFree) {
        requestSignup('launch', {practice: practice});
        return;
      }
      markFreeTrialUsed();
    }

    const anonymous = !authed;
    currentPractice = practice;
    if (playerDone) playerDone.disabled = false;
    setVisible(playerFeedback, false);
    playerContainer.innerHTML = '';
    if (playerAnonNote) {
      playerAnonNote.textContent = T.anonNote;
      setVisible(playerAnonNote, anonymous);
    }

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
    updatePlayerFavorite();
    scrollToEl(playerSection);
    track('practice_started', {practice: practice.id, source: practice.source, need: selectedNeed, lang: LANG, anonymous: anonymous});
  }

  function finishPractice() {
    if (!currentPractice) return;
    // Enregistrer une pratique (historique) nécessite un compte.
    if (!authed) {
      requestSignup('log', {practice: currentPractice});
      return;
    }
    if (playerFeedback) {
      playerFeedback.textContent = T.thanks;
      setVisible(playerFeedback, true);
    }
    if (playerDone) playerDone.disabled = true;
    track('practice_completed', {practice: currentPractice.id, need: selectedNeed, lang: LANG});
    logPractice(currentPractice);
  }

  function closePlayer() {
    setVisible(playerSection, false);
    if (playerContainer) playerContainer.innerHTML = '';
    if (playerFeedback) setVisible(playerFeedback, false);
    currentPractice = null;
  }

  // --- Auth ---

  function scrollToEl(el) {
    if (el && el.scrollIntoView) el.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  // --- Mur d'inscription (après la première pratique gratuite sans compte) ---

  function loadFreeTrialState() {
    try {
      freeTrialUsed = localStorage.getItem('fluance_free_trial_used') === '1';
    } catch (_e) {
      freeTrialUsed = false;
    }
  }

  function markFreeTrialUsed() {
    freeTrialUsed = true;
    try { localStorage.setItem('fluance_free_trial_used', '1'); } catch (_e) { /* stockage indisponible */ }
    if (recNote) setVisible(recNote, false);
  }

  function applyGateCopy(reason) {
    if (authTitleEl) {
      authTitleEl.textContent = reason === 'favorite' ? T.gateFavoriteTitle
        : reason === 'log' ? T.gateLogTitle
          : reason === 'launch' ? T.gateLaunchTitle
            : T.gateTitle;
    }
    if (authTextEl) {
      authTextEl.textContent = reason === 'favorite' ? T.gateFavoriteText
        : reason === 'log' ? T.gateLogText
          : reason === 'launch' ? T.gateLaunchText
            : T.gateText;
    }
  }

  // Toute action au-delà de la première pratique gratuite nécessite un compte.
  function requestSignup(reason, data) {
    if (authed) return;
    pendingAction = Object.assign({type: reason}, data || {});
    applyGateCopy(reason);
    setVisible(authRequiredEl, true);
    renderTurnstile();
    scrollToEl(authRequiredEl);
    track('signup_wall_reached', {reason: reason, lang: LANG});
  }

  // Reprend l'action interrompue par le mur d'inscription, une fois connecté.
  function resumePendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    pendingAction = null;
    if (action.type === 'launch' && action.practice) {
      startPractice(action.practice);
    } else if (action.type === 'log' && action.practice) {
      if (playerFeedback) {
        playerFeedback.textContent = T.thanks;
        setVisible(playerFeedback, true);
      }
      if (playerDone) playerDone.disabled = true;
      track('practice_completed', {practice: action.practice.id, need: selectedNeed, lang: LANG});
      logPractice(action.practice);
    } else if (action.type === 'favorite' && action.contentId) {
      setFavorite(action.contentId, action.favorite);
    }
  }

  function showLogin() {
    // Anonyme : on affiche d'abord la question ET les choix (valeur avant l'effort).
    authed = false;
    setVisible(pendingEl, false);
    setVisible(mainEl, true);
    setVisible(authRequiredEl, false);
    setVisible(trackingSection, false);
    // Arrivée ciblée (?need=…) : afficher la recommandation sans mur d'inscription.
    if (pendingNeed) {
      const need = pendingNeed;
      pendingNeed = null;
      renderRecommendations(need);
    }
  }

  function showApp() {
    authed = true;
    setVisible(pendingEl, false);
    setVisible(authRequiredEl, false);
    setVisible(mainEl, true);
    setVisible(playerAnonNote, false);
    if (appShown) return;
    appShown = true;
    track('companion_opened', { lang: LANG });
    // Charger les droits premium en arrière-plan (n'affecte pas l'affichage du gratuit)
    loadProtectedAccess().then(function () {
      if (selectedNeed) renderRecommendations(selectedNeed);
    });
    // Charger favoris / historique / statistiques, puis traiter les paramètres d'URL
    // (`?need=` pour une recommandation ciblée, `?notifications=off` pour se désinscrire).
    refreshStats().then(function () {
      if (pendingUnsubscribe) {
        pendingUnsubscribe = false;
        setNotifications(false, T.unsubscribed);
      }
      if (pendingNeed) {
        const need = pendingNeed;
        pendingNeed = null;
        renderRecommendations(need);
        scrollToEl(recSection);
      }
      // Reprend l'action interrompue par le mur d'inscription.
      resumePendingAction();
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
        track('need_selected', {need: need, lang: LANG});
        renderRecommendations(need);
        scrollToEl(recSection);
      });
    });
  }

  function wirePlayer() {
    if (playerDone) playerDone.addEventListener('click', finishPractice);
    if (playerClose) playerClose.addEventListener('click', closePlayer);
    if (playerFavorite) {
      playerFavorite.addEventListener('click', function () {
        if (currentPractice) setFavorite(currentPractice.id, !isFavorite(currentPractice.id));
      });
    }
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
      await callFunction('createFreeAccount', {
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
    loadFreeTrialState();
    attachNeedHandlers();
    wirePlayer();
    wireSignup();
    handleUrlParams();
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
