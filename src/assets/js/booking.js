/**
 * Fluance Booking System - Frontend JavaScript
 * 
 * Ce script gère :
 * - Vérification du pass utilisateur par email
 * - Affichage temps réel des places disponibles
 * - Formulaire de réservation multi-étapes
 * - Intégration Stripe pour le paiement
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    API_BASE_URL: 'https://europe-west1-fluance-protected-content.cloudfunctions.net',
    STRIPE_PUBLISHABLE_KEY: '', // À configurer
    REFRESH_INTERVAL: 30000, // Rafraîchir toutes les 30 secondes
  };

  // Options tarifaires
  const PRICING_OPTIONS = {
    trial: {
      id: 'trial',
      name: 'Cours d\'essai',
      price: 0,
      description: 'Première séance offerte',
      badge: 'GRATUIT',
    },
    single: {
      id: 'single',
      name: 'À la carte',
      price: 25,
      description: 'Séance unique',
      badge: null,
    },
    flow_pass: {
      id: 'flow_pass',
      name: 'Flow Pass',
      price: 210,
      description: '10 séances (valable 12 mois)',
      badge: 'POPULAIRE',
    },
    semester_pass: {
      id: 'semester_pass',
      name: 'Pass Semestriel',
      price: 340,
      description: 'Accès illimité pendant 6 mois (renouvellement automatique)',
      badge: 'ILLIMITÉ',
    },
  };

  // État global
  let stripe = null;
  let elements = null;
  let currentCourseId = null;
  let currentCourseData = null;
  let userPassStatus = null;
  let currentStep = 1; // 1: email, 2: pass/pricing, 3: infos, 4: payment

  /**
   * Initialise le système de réservation
   */
  function init() {
    // Initialiser Stripe si la clé est configurée
    if (CONFIG.STRIPE_PUBLISHABLE_KEY) {
      stripe = Stripe(CONFIG.STRIPE_PUBLISHABLE_KEY);
    }

    // Charger les cours disponibles
    loadAvailableCourses();

    // Mettre à jour périodiquement
    setInterval(loadAvailableCourses, CONFIG.REFRESH_INTERVAL);

    // Écouter les événements du formulaire
    setupFormListeners();
  }

  /**
   * Charge et affiche tous les cours disponibles
   */
  async function loadAvailableCourses() {
    const container = document.getElementById('courses-list');
    if (!container) return;

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/getAvailableCourses`);
      const data = await response.json();

      if (!data.success || !data.courses.length) {
        container.innerHTML = `
          <div class="text-center py-8 text-[#3E3A35]/60">
            <p>Aucun cours disponible pour le moment.</p>
            <p class="mt-2">Revenez bientôt !</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.courses.map(course => renderCourseCard(course)).join('');

      // Attacher les événements de clic
      container.querySelectorAll('[data-course-id]').forEach(card => {
        card.addEventListener('click', () => {
          const courseId = card.dataset.courseId;
          openBookingModal(courseId, card.dataset);
        });
      });

    } catch (error) {
      console.error('Error loading courses:', error);
      container.innerHTML = `
        <div class="text-center py-8 text-red-500">
          <p>Erreur lors du chargement des cours.</p>
          <button onclick="window.FluanceBooking.loadAvailableCourses()" class="mt-2 text-fluance underline">
            Réessayer
          </button>
        </div>
      `;
    }
  }

  /**
   * Génère le HTML d'une carte de cours
   */
  function renderCourseCard(course) {
    const spotsText = course.isFull 
      ? '<span class="text-red-500 font-semibold">Complet</span>'
      : `<span class="text-green-600 font-semibold">${course.spotsRemaining} place${course.spotsRemaining > 1 ? 's' : ''}</span>`;

    const buttonText = course.isFull ? 'Liste d\'attente' : 'Réserver';
    const buttonClass = course.isFull 
      ? 'bg-gray-400 hover:bg-gray-500'
      : 'bg-[#E6B84A] hover:bg-[#E8C15A] !text-[#7A1F3D]';

    // Formater la date
    const dateObj = new Date(course.date);
    const dateStr = dateObj.toLocaleDateString('fr-CH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    return `
      <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-transparent hover:border-fluance/20"
           data-course-id="${course.id}"
           data-course-title="${course.title}"
           data-course-date="${dateStr}"
           data-course-time="${course.time}"
           data-course-location="${course.location}"
           data-course-price="${course.price}"
           data-is-full="${course.isFull}">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="text-lg font-semibold text-[#3E3A35]">${course.title}</h3>
            <p class="text-sm text-[#3E3A35]/60">${course.location}</p>
          </div>
          <span class="bg-fluance/10 text-fluance px-3 py-1 rounded-full text-sm font-medium">
            ${course.price} CHF
          </span>
        </div>
        <div class="flex items-center gap-4 text-sm text-[#3E3A35]/80 mb-4">
          <span class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            ${dateStr}
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            ${course.time}
          </span>
        </div>
        <div class="flex justify-between items-center">
          <div class="text-sm">
            ${spotsText} disponible${course.spotsRemaining > 1 ? 's' : ''}
          </div>
          <button class="px-4 py-2 rounded-full font-semibold text-sm ${buttonClass} transition-colors">
            ${buttonText}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Ouvre la modal de réservation - Étape 1: Email
   */
  function openBookingModal(courseId, courseData) {
    currentCourseId = courseId;
    currentCourseData = courseData;
    currentStep = 1;
    userPassStatus = null;

    const modal = document.getElementById('booking-modal');
    if (!modal) {
      console.error('Booking modal not found');
      return;
    }

    // Afficher l'étape 1 : vérification email
    renderStep1EmailCheck();

    // Afficher la modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Étape 1 : Vérification de l'email
   */
  function renderStep1EmailCheck() {
    const modal = document.getElementById('booking-modal');
    const content = modal.querySelector('.modal-content') || modal.querySelector('> div > div');
    
    if (!content) return;

    content.innerHTML = `
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div id="booking-course-info">
            <h3 class="text-xl font-semibold text-[#3E3A35]">${currentCourseData.courseTitle}</h3>
            <p class="text-[#3E3A35]/70 mt-1">
              📅 ${currentCourseData.courseDate} à ${currentCourseData.courseTime}<br>
              📍 ${currentCourseData.courseLocation}
            </p>
          </div>
          <button data-close-modal class="text-[#3E3A35]/40 hover:text-[#3E3A35] transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Étape 1 : Email -->
        <div class="mb-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-full bg-fluance text-white flex items-center justify-center text-sm font-bold">1</div>
            <h4 class="text-lg font-semibold text-[#3E3A35]">Entrez votre email</h4>
          </div>
          <p class="text-sm text-[#3E3A35]/60 mb-4">
            Nous vérifierons si vous avez déjà un pass actif (Flow Pass ou Pass Semestriel).
          </p>
          
          <form id="email-check-form" class="space-y-4">
            <div>
              <label for="check-email" class="block text-sm font-medium text-[#3E3A35] mb-1">Email *</label>
              <input type="email" id="check-email" name="email" required
                     placeholder="votre@email.com"
                     class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-lg">
            </div>
            
            <div id="email-check-error" class="hidden p-3 bg-red-50 text-red-600 rounded-lg text-sm"></div>
            
            <button type="submit" id="check-email-btn"
                    class="w-full py-3 bg-fluance text-white font-semibold rounded-lg hover:bg-fluance/90 transition-colors">
              Vérifier mon compte
            </button>
          </form>
        </div>
      </div>
    `;

    // Réattacher les événements
    setupStepListeners();
  }

  /**
   * Vérifie le pass de l'utilisateur par email
   */
  async function checkUserEmail(email) {
    const btn = document.getElementById('check-email-btn');
    const errorContainer = document.getElementById('email-check-error');
    
    btn.disabled = true;
    btn.textContent = 'Vérification...';
    errorContainer.classList.add('hidden');

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/checkUserPass?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      userPassStatus = data;

      if (data.hasActivePass) {
        // L'utilisateur a un pass actif
        renderStep2WithPass(email, data);
      } else if (data.canUseTrial) {
        // Première visite - cours d'essai gratuit
        renderStep2TrialOffer(email, data);
      } else {
        // Pas de pass - proposer les options
        renderStep2PricingOptions(email, data);
      }

    } catch (error) {
      console.error('Error checking email:', error);
      errorContainer.textContent = 'Erreur de connexion. Veuillez réessayer.';
      errorContainer.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Vérifier mon compte';
    }
  }

  /**
   * Étape 2 : Utilisateur avec pass actif
   */
  function renderStep2WithPass(email, passStatus) {
    currentStep = 2;
    const modal = document.getElementById('booking-modal');
    const content = modal.querySelector('.modal-content') || modal.querySelector('> div > div');
    
    const pass = passStatus.pass;
    const isFlowPass = pass.passType === 'flow_pass';
    const passIcon = isFlowPass ? '🎫' : '✨';
    const passColor = isFlowPass ? 'bg-fluance' : 'bg-[#E6B84A]';

    content.innerHTML = `
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h3 class="text-xl font-semibold text-[#3E3A35]">${currentCourseData.courseTitle}</h3>
            <p class="text-[#3E3A35]/70 mt-1">
              📅 ${currentCourseData.courseDate} à ${currentCourseData.courseTime}
            </p>
          </div>
          <button data-close-modal class="text-[#3E3A35]/40 hover:text-[#3E3A35] transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Pass actif -->
        <div class="${passColor} text-white rounded-xl p-6 mb-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-3xl">${passIcon}</span>
            <div>
              <h4 class="text-xl font-bold">${pass.passName}</h4>
              <p class="text-white/80">${email}</p>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-white/20">
            ${isFlowPass ? `
              <div class="flex justify-between items-center">
                <span>Séances restantes</span>
                <span class="text-2xl font-bold">${pass.sessionsRemaining}/${pass.sessionsTotal}</span>
              </div>
              <div class="mt-2 bg-white/20 rounded-full h-2">
                <div class="bg-white rounded-full h-2" style="width: ${(pass.sessionsRemaining / pass.sessionsTotal) * 100}%"></div>
              </div>
            ` : `
              <div class="flex justify-between items-center">
                <span>Accès illimité</span>
                <span class="text-lg font-bold">${pass.daysRemaining} jours restants</span>
              </div>
            `}
          </div>
        </div>

        <!-- Formulaire de réservation simplifié -->
        <form id="pass-booking-form" class="space-y-4">
          <input type="hidden" name="email" value="${email}">
          <input type="hidden" name="usePass" value="true">
          <input type="hidden" name="passId" value="${pass.passId}">
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="firstName" class="block text-sm font-medium text-[#3E3A35] mb-1">Prénom *</label>
              <input type="text" id="firstName" name="firstName" required
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
            <div>
              <label for="lastName" class="block text-sm font-medium text-[#3E3A35] mb-1">Nom</label>
              <input type="text" id="lastName" name="lastName"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
          </div>

          <div>
            <label for="phone" class="block text-sm font-medium text-[#3E3A35] mb-1">Téléphone</label>
            <input type="tel" id="phone" name="phone"
                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
          </div>

          <div id="booking-error" class="hidden p-3 bg-red-50 text-red-600 rounded-lg text-sm"></div>

          <button type="submit"
                  class="w-full py-3 ${passColor} text-white font-semibold rounded-lg hover:opacity-90 transition-colors">
            ${isFlowPass ? `Réserver (1 séance sera décomptée)` : `Réserver avec mon Pass Semestriel`}
          </button>
        </form>

        <button onclick="window.FluanceBooking.goBackToEmail()" 
                class="w-full mt-3 py-2 text-[#3E3A35]/60 hover:text-[#3E3A35] text-sm">
          ← Utiliser une autre adresse email
        </button>
      </div>
    `;

    setupStepListeners();
  }

  /**
   * Étape 2 : Première visite - Cours d'essai gratuit
   */
  function renderStep2TrialOffer(email, passStatus) {
    currentStep = 2;
    const modal = document.getElementById('booking-modal');
    const content = modal.querySelector('.modal-content') || modal.querySelector('> div > div');

    content.innerHTML = `
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h3 class="text-xl font-semibold text-[#3E3A35]">${currentCourseData.courseTitle}</h3>
            <p class="text-[#3E3A35]/70 mt-1">
              📅 ${currentCourseData.courseDate} à ${currentCourseData.courseTime}
            </p>
          </div>
          <button data-close-modal class="text-[#3E3A35]/40 hover:text-[#3E3A35] transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Offre d'essai -->
        <div class="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-6 text-center">
          <span class="text-4xl mb-3 block">🎁</span>
          <h4 class="text-xl font-bold text-green-700 mb-2">Bienvenue !</h4>
          <p class="text-green-700">Votre <strong>première séance est offerte</strong>.</p>
          <p class="text-green-600 text-sm mt-2">Découvrez l'approche Fluance gratuitement.</p>
        </div>

        <!-- Formulaire -->
        <form id="trial-booking-form" class="space-y-4">
          <input type="hidden" name="email" value="${email}">
          <input type="hidden" name="pricingOption" value="trial">
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="firstName" class="block text-sm font-medium text-[#3E3A35] mb-1">Prénom *</label>
              <input type="text" id="firstName" name="firstName" required
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
            <div>
              <label for="lastName" class="block text-sm font-medium text-[#3E3A35] mb-1">Nom</label>
              <input type="text" id="lastName" name="lastName"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
          </div>

          <div>
            <label for="phone" class="block text-sm font-medium text-[#3E3A35] mb-1">Téléphone</label>
            <input type="tel" id="phone" name="phone"
                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
          </div>

          <div id="booking-error" class="hidden p-3 bg-red-50 text-red-600 rounded-lg text-sm"></div>

          <button type="submit"
                  class="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
            Réserver mon cours d'essai gratuit
          </button>
        </form>

        <button onclick="window.FluanceBooking.goBackToEmail()" 
                class="w-full mt-3 py-2 text-[#3E3A35]/60 hover:text-[#3E3A35] text-sm">
          ← Utiliser une autre adresse email
        </button>
      </div>
    `;

    setupStepListeners();
  }

  /**
   * Étape 2 : Options tarifaires (pas de pass)
   */
  function renderStep2PricingOptions(email, passStatus) {
    currentStep = 2;
    const modal = document.getElementById('booking-modal');
    const content = modal.querySelector('.modal-content') || modal.querySelector('> div > div');

    // Filtrer les options (pas de trial si déjà venu)
    const options = Object.values(PRICING_OPTIONS).filter(o => o.id !== 'trial');

    content.innerHTML = `
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h3 class="text-xl font-semibold text-[#3E3A35]">${currentCourseData.courseTitle}</h3>
            <p class="text-[#3E3A35]/70 mt-1">
              📅 ${currentCourseData.courseDate} à ${currentCourseData.courseTime}
            </p>
          </div>
          <button data-close-modal class="text-[#3E3A35]/40 hover:text-[#3E3A35] transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Info -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-blue-800 text-sm">
            <strong>${email}</strong><br>
            ${passStatus.message}
          </p>
        </div>

        <!-- Formulaire -->
        <form id="pricing-booking-form" class="space-y-4">
          <input type="hidden" name="email" value="${email}">
          
          <!-- Options tarifaires -->
          <div>
            <label class="block text-sm font-medium text-[#3E3A35] mb-3">Choisissez votre formule</label>
            <div id="pricing-options" class="space-y-3">
              ${options.map((option, index) => `
                <label class="block p-4 border-2 rounded-lg cursor-pointer hover:border-fluance transition-colors relative ${index === 0 ? 'border-fluance bg-fluance/5' : 'border-gray-200'}">
                  ${option.badge ? `<span class="absolute -top-2 -right-2 ${option.badge === 'POPULAIRE' ? 'bg-fluance' : 'bg-[#E6B84A]'} text-white text-xs px-2 py-1 rounded-full">${option.badge}</span>` : ''}
                  <input type="radio" name="pricing" value="${option.id}" class="sr-only" ${index === 0 ? 'checked' : ''}>
                  <div class="flex justify-between items-center">
                    <div>
                      <span class="font-semibold text-[#3E3A35]">${option.name}</span>
                      <p class="text-sm text-[#3E3A35]/60">${option.description}</p>
                    </div>
                    <span class="text-lg font-bold text-fluance">${option.price} CHF</span>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Infos personnelles -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="firstName" class="block text-sm font-medium text-[#3E3A35] mb-1">Prénom *</label>
              <input type="text" id="firstName" name="firstName" required
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
            <div>
              <label for="lastName" class="block text-sm font-medium text-[#3E3A35] mb-1">Nom</label>
              <input type="text" id="lastName" name="lastName"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
          </div>

          <div>
            <label for="phone" class="block text-sm font-medium text-[#3E3A35] mb-1">Téléphone</label>
            <input type="tel" id="phone" name="phone"
                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
          </div>

          <!-- Mode de paiement -->
          <div>
            <label class="block text-sm font-medium text-[#3E3A35] mb-3">Mode de paiement</label>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-fluance transition-colors border-fluance bg-fluance/5">
                <input type="radio" name="paymentMethod" value="card" checked class="text-fluance focus:ring-fluance">
                <span class="text-sm">Carte / TWINT</span>
              </label>
              <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-fluance transition-colors">
                <input type="radio" name="paymentMethod" value="cash" class="text-fluance focus:ring-fluance">
                <span class="text-sm">Espèces sur place</span>
              </label>
            </div>
          </div>

          <div id="booking-error" class="hidden p-3 bg-red-50 text-red-600 rounded-lg text-sm"></div>

          <button type="submit"
                  class="w-full py-3 bg-[#E6B84A] !text-[#7A1F3D] font-semibold rounded-lg hover:bg-[#E8C15A] transition-colors">
            Réserver
          </button>
        </form>

        <button onclick="window.FluanceBooking.goBackToEmail()" 
                class="w-full mt-3 py-2 text-[#3E3A35]/60 hover:text-[#3E3A35] text-sm">
          ← Utiliser une autre adresse email
        </button>
      </div>
    `;

    // Gérer la sélection des options
    const pricingContainer = document.getElementById('pricing-options');
    if (pricingContainer) {
      pricingContainer.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', () => {
          pricingContainer.querySelectorAll('label').forEach(l => {
            l.classList.remove('border-fluance', 'bg-fluance/5');
            l.classList.add('border-gray-200');
          });
          label.classList.remove('border-gray-200');
          label.classList.add('border-fluance', 'bg-fluance/5');
        });
      });
    }

    setupStepListeners();
  }

  /**
   * Retour à l'étape email
   */
  function goBackToEmail() {
    renderStep1EmailCheck();
  }

  /**
   * Configure les écouteurs d'événements
   */
  function setupStepListeners() {
    // Fermer la modal
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', closeBookingModal);
    });

    // Formulaire de vérification email
    const emailForm = document.getElementById('email-check-form');
    if (emailForm) {
      emailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('check-email').value;
        checkUserEmail(email);
      });
    }

    // Formulaire avec pass
    const passForm = document.getElementById('pass-booking-form');
    if (passForm) {
      passForm.addEventListener('submit', handleBookingWithPass);
    }

    // Formulaire d'essai gratuit
    const trialForm = document.getElementById('trial-booking-form');
    if (trialForm) {
      trialForm.addEventListener('submit', handleBookingSubmit);
    }

    // Formulaire avec options tarifaires
    const pricingForm = document.getElementById('pricing-booking-form');
    if (pricingForm) {
      pricingForm.addEventListener('submit', handleBookingSubmit);
    }
  }

  /**
   * Ferme la modal de réservation
   */
  function closeBookingModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
    currentCourseId = null;
    currentCourseData = null;
    userPassStatus = null;
    currentStep = 1;
  }

  /**
   * Initialise les écouteurs généraux (appelé une seule fois)
   */
  function setupFormListeners() {
    // Fermer en cliquant à l'extérieur
    const modal = document.getElementById('booking-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeBookingModal();
        }
      });
    }
  }

  /**
   * Gère la réservation avec un pass existant
   */
  async function handleBookingWithPass(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    const errorContainer = document.getElementById('booking-error');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Réservation...';
    errorContainer?.classList.add('hidden');

    const formData = new FormData(form);
    const data = {
      courseId: currentCourseId,
      email: formData.get('email'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
      usePass: true,
      passId: formData.get('passId'),
    };

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/bookCourse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        showSuccessMessage(
          'Réservation confirmée !',
          result.message || 'Vous recevrez un email de confirmation.'
        );
      } else {
        if (errorContainer) {
          errorContainer.textContent = result.message || 'Une erreur est survenue';
          errorContainer.classList.remove('hidden');
        }
      }
    } catch (error) {
      console.error('Booking error:', error);
      if (errorContainer) {
        errorContainer.textContent = 'Erreur de connexion. Veuillez réessayer.';
        errorContainer.classList.remove('hidden');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Gère la soumission du formulaire de réservation standard
   */
  async function handleBookingSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    const errorContainer = document.getElementById('booking-error');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Traitement...';
    errorContainer?.classList.add('hidden');

    const formData = new FormData(form);
    const data = {
      courseId: currentCourseId,
      email: formData.get('email'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
      paymentMethod: formData.get('paymentMethod') || 'card',
      pricingOption: formData.get('pricing') || formData.get('pricingOption') || 'single',
    };

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/bookCourse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        if (result.status === 'waitlisted') {
          showSuccessMessage(
            'Ajouté à la liste d\'attente',
            `Vous êtes en position ${result.position}. Nous vous contacterons si une place se libère.`
          );
        } else if (result.requiresPayment && result.clientSecret) {
          await handleStripePayment(result.clientSecret, data);
        } else {
          showSuccessMessage(
            'Réservation confirmée !',
            result.message || 'Vous recevrez un email de confirmation.'
          );
        }
      } else {
        if (errorContainer) {
          errorContainer.textContent = result.message || 'Une erreur est survenue';
          errorContainer.classList.remove('hidden');
        }
      }
    } catch (error) {
      console.error('Booking error:', error);
      if (errorContainer) {
        errorContainer.textContent = 'Erreur de connexion. Veuillez réessayer.';
        errorContainer.classList.remove('hidden');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Gère le paiement Stripe
   */
  async function handleStripePayment(clientSecret, bookingData) {
    if (!stripe) {
      showErrorMessage('Le système de paiement n\'est pas disponible. Veuillez choisir "Espèces sur place".');
      return;
    }

    const modal = document.getElementById('booking-modal');
    const content = modal.querySelector('.modal-content') || modal.querySelector('> div > div');

    content.innerHTML = `
      <div class="p-6">
        <div class="flex justify-between items-start mb-6">
          <h3 class="text-xl font-semibold text-[#3E3A35]">Paiement sécurisé</h3>
          <button data-close-modal class="text-[#3E3A35]/40 hover:text-[#3E3A35] transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div id="payment-element" class="mb-4">
          <!-- Stripe Elements sera monté ici -->
        </div>

        <div id="payment-error" class="hidden p-3 bg-red-50 text-red-600 rounded-lg text-sm mb-4"></div>

        <button id="confirm-payment-btn"
                class="w-full py-3 bg-fluance text-white font-semibold rounded-lg hover:bg-fluance/90 transition-colors">
          Payer
        </button>
      </div>
    `;

    setupStepListeners();

    // Créer les éléments de paiement Stripe
    elements = stripe.elements({
      clientSecret: clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#648ED8',
          colorBackground: '#ffffff',
          colorText: '#3E3A35',
        },
      },
    });

    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');

    // Confirmer le paiement
    const confirmBtn = document.getElementById('confirm-payment-btn');
    const errorContainer = document.getElementById('payment-error');
    
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Traitement...';
      errorContainer.classList.add('hidden');

      const {error} = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/presentiel/reservation-confirmee/`,
        },
      });

      if (error) {
        errorContainer.textContent = error.message;
        errorContainer.classList.remove('hidden');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Payer';
      }
    };
  }

  /**
   * Affiche un message de succès
   */
  function showSuccessMessage(title, message) {
    const modal = document.getElementById('booking-modal');
    const content = modal.querySelector('.modal-content') || modal.querySelector('> div > div');
    
    if (content) {
      content.innerHTML = `
        <div class="p-6 text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-[#3E3A35] mb-2">${title}</h3>
          <p class="text-[#3E3A35]/70 mb-6">${message}</p>
          <button onclick="window.FluanceBooking.closeBookingModal()" 
                  class="px-6 py-2 bg-fluance text-white rounded-full hover:bg-fluance/90 transition-colors">
            Fermer
          </button>
        </div>
      `;
    }
  }

  /**
   * Affiche un message d'erreur
   */
  function showErrorMessage(message) {
    const errorContainer = document.getElementById('booking-error') || document.getElementById('payment-error');
    if (errorContainer) {
      errorContainer.textContent = message;
      errorContainer.classList.remove('hidden');
    } else {
      alert(message);
    }
  }

  // Exposer les fonctions publiques
  window.FluanceBooking = {
    init,
    loadAvailableCourses,
    openBookingModal,
    closeBookingModal,
    goBackToEmail,
    PRICING_OPTIONS,
  };

  // Initialiser au chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
