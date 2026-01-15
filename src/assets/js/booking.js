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
  // La clé Stripe peut être injectée via window.FLUANCE_STRIPE_CONFIG (configuré par Eleventy)
  // ou définie directement ici pour le développement
  const CONFIG = {
    API_BASE_URL: 'https://europe-west1-fluance-protected-content.cloudfunctions.net',
    STRIPE_PUBLISHABLE_KEY: (window.FLUANCE_STRIPE_CONFIG && window.FLUANCE_STRIPE_CONFIG.publishableKey) || '', // Injecté via Eleventy ou configuré manuellement
    REFRESH_INTERVAL: 30000, // Rafraîchir toutes les 30 secondes
  };

  // Détecter la langue depuis l'URL ou l'attribut lang du document
  function getCurrentLocale() {
    // Vérifier l'URL pour /en/
    if (window.location.pathname.includes('/en/')) {
      return 'en';
    }
    // Vérifier l'attribut lang du document
    const lang = document.documentElement.lang || document.documentElement.getAttribute('lang');
    if (lang && lang.startsWith('en')) {
      return 'en';
    }
    // Par défaut: français
    return 'fr';
  }

  const currentLocale = getCurrentLocale();

  // Variable pour stocker l'email actuel et le statut de première visite
  let currentUserEmail = null;
  let isFirstVisit = false;

  /**
   * Vérifie si l'utilisateur a déjà accepté les CGV pour cet email
   * Utilise d'abord le statut isFirstVisit de Firestore, puis localStorage comme cache
   */
  function hasAcceptedCGV(email) {
    if (!email) return false;
    
    // Si on a déjà vérifié via Firestore et que ce n'est pas la première visite, pas besoin d'afficher
    if (currentUserEmail === email.toLowerCase().trim() && !isFirstVisit) {
      return true;
    }
    
    // Fallback : vérifier localStorage (cache local)
    const key = `cgv_accepted_${email.toLowerCase().trim()}`;
    return localStorage.getItem(key) === 'true';
  }

  /**
   * Marque l'acceptation des CGV pour cet email
   * Stocke dans localStorage comme cache local
   */
  function markCGVAccepted(email) {
    if (!email) return;
    const key = `cgv_accepted_${email.toLowerCase().trim()}`;
    localStorage.setItem(key, 'true');
  }

  // Traductions
  const translations = {
    fr: {
      step1Title: 'Entrez votre email',
      emailLabel: 'Email *',
      emailPlaceholder: 'votre@email.com',
      continue: 'Continuer',
      checking: 'Vérification...',
      firstName: 'Prénom *',
      lastName: 'Nom *',
      phone: 'Téléphone (optionnel)',
      phoneOptional: 'Téléphone (optionnel - utile en cas de changement de dernière minute)',
      bookingError: 'Erreur de connexion. Veuillez réessayer.',
      sessionsRemaining: 'Séances restantes',
      unlimitedAccess: 'Accès illimité',
      daysRemaining: 'jours restants',
      bookWithFlowPass: 'Réserver (1 séance sera décomptée)',
      bookWithSemesterPass: 'Réserver avec mon Pass Semestriel',
      useOtherEmail: '← Utiliser une autre adresse email',
      close: 'Fermer',
      acceptCGV: 'J\'ai pris connaissance et j\'accepte les Conditions générales de vente (CGV), y compris les dispositions relatives à l\'assurance et à la responsabilité, ainsi que le règlement du lieu d\'accueil.',
      acceptCGVError: 'Vous devez accepter les Conditions générales de vente pour continuer.',
    },
    en: {
      step1Title: 'Enter your email',
      emailLabel: 'Email *',
      emailPlaceholder: 'your@email.com',
      continue: 'Continue',
      checking: 'Checking...',
      firstName: 'First name *',
      lastName: 'Last name *',
      phone: 'Phone (optional)',
      phoneOptional: 'Phone (optional - useful in case of last-minute changes)',
      bookingError: 'Connection error. Please try again.',
      sessionsRemaining: 'Sessions remaining',
      unlimitedAccess: 'Unlimited access',
      daysRemaining: 'days remaining',
      bookWithFlowPass: 'Book (1 session will be deducted)',
      bookWithSemesterPass: 'Book with my Semester Pass',
      useOtherEmail: '← Use another email address',
      close: 'Close',
      acceptCGV: 'I have read and accept the Terms and Conditions (T&C), including the provisions relating to insurance and liability, as well as the venue regulations.',
      acceptCGVError: 'You must accept the Terms and Conditions to continue.',
    },
  };

  const t = translations[currentLocale] || translations.fr;

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
      description: '10 séances à votre rythme (valable 12 mois)',
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
  let storedFirstName = ''; // Prénom stocké pour pré-remplir les formulaires

  /**
   * Formate une date au format DD/MM/YYYY en format lisible selon la locale
   * @param {string} dateStr - Date au format DD/MM/YYYY
   * @returns {string} - Date formatée (ex: "mercredi 22 janvier" ou "Wednesday, January 22")
   */
  function formatDateFromDDMMYYYY(dateStr) {
    try {
      const [day, month, year] = dateStr.split('/');
      if (day && month && year) {
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(dateObj.getTime())) {
          // Utiliser la locale appropriée selon la langue de la page
          const locale = currentLocale === 'en' ? 'en-US' : 'fr-CH';
          return dateObj.toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          });
        }
      }
    } catch (e) {
      console.error('Error formatting date:', e);
    }
    // Fallback : retourner la date originale
    return dateStr;
  }

  /**
   * Corrige l'adresse selon la locale (remplace "Switzerland" par "Suisse" pour FR)
   * @param {string} location - Adresse à corriger
   * @returns {string} - Adresse corrigée
   */
  function formatLocation(location) {
    if (!location) return '';
    if (currentLocale === 'fr' && location.includes('Switzerland')) {
      return location.replace(/Switzerland/gi, 'Suisse');
    }
    return location;
  }

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
        const noCoursesText = currentLocale === 'en'
          ? 'No classes available at the moment.'
          : 'Aucun cours disponible pour le moment.';
        const comeBackText = currentLocale === 'en'
          ? 'Come back soon!'
          : 'Revenez bientôt !';
        container.innerHTML = `
          <div class="text-center py-8 text-[#3E3A35]/60">
            <p>${noCoursesText}</p>
            <p class="mt-2">${comeBackText}</p>
          </div>
        `;
        return;
      }

      // Limiter à 6 cours maximum (même si l'API en retourne plus)
      const coursesToDisplay = data.courses.slice(0, 6);
      container.innerHTML = coursesToDisplay.map(course => renderCourseCard(course)).join('');

      // Attacher les événements de clic
      container.querySelectorAll('[data-course-id]').forEach(card => {
        card.addEventListener('click', () => {
          const courseId = card.dataset.courseId;
          openBookingModal(courseId, card.dataset);
        });
      });

    } catch (error) {
      console.error('Error loading courses:', error);
        const errorText = currentLocale === 'en' 
          ? 'Error loading classes.'
          : 'Erreur lors du chargement des cours.';
        const retryText = currentLocale === 'en'
          ? 'Retry'
          : 'Réessayer';
        container.innerHTML = `
        <div class="text-center py-8 text-red-500">
          <p>${errorText}</p>
          <button onclick="window.FluanceBooking.loadAvailableCourses()" class="mt-2 text-fluance underline">
            ${retryText}
          </button>
        </div>
      `;
    }
  }

  /**
   * Détermine la couleur et le style d'affichage selon la disponibilité
   * Basé sur les bonnes pratiques UX/marketing pour créer une urgence appropriée
   * @param {number} spotsRemaining - Nombre de places restantes
   * @param {number} maxCapacity - Capacité maximale
   * @param {boolean} isFull - Si le cours est complet
   * @returns {Object} - { colorClass, bgClass, text, urgency }
   */
  function getAvailabilityStyle(spotsRemaining, maxCapacity, isFull) {
    const isEnglish = currentLocale === 'en';

    if (isFull || spotsRemaining <= 0) {
      return {
        colorClass: 'text-red-600',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
        text: isEnglish ? 'Full' : 'Complet',
        urgency: 'high',
        icon: '⚠️'
      };
    }

    // Calculer le pourcentage de disponibilité (adaptatif selon la capacité)
    const availabilityPercent = (spotsRemaining / maxCapacity) * 100;
    const spotsCount = spotsRemaining;

    // Seuils basés sur le pourcentage ET le nombre absolu (pour petits groupes)
    // Rouge : < 20% OU < 3 places (urgence maximale)
    if (availabilityPercent < 20 || spotsCount < 3) {
      return {
        colorClass: 'text-red-600',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
        text: spotsCount === 1 
          ? (isEnglish ? 'Last spot!' : 'Dernière place !')
          : (isEnglish ? `${spotsCount} spots left` : `${spotsCount} places restantes`),
        urgency: 'critical',
        icon: '🔥'
      };
    }

    // Orange : 20-40% OU 3-5 places (attention requise)
    if (availabilityPercent < 40 || spotsCount <= 5) {
      return {
        colorClass: 'text-orange-600',
        bgClass: 'bg-orange-50',
        borderClass: 'border-orange-200',
        text: isEnglish 
          ? `${spotsCount} spot${spotsCount > 1 ? 's' : ''} left`
          : `${spotsCount} place${spotsCount > 1 ? 's' : ''} restante${spotsCount > 1 ? 's' : ''}`,
        urgency: 'high',
        icon: '⚡'
      };
    }

    // Jaune/Amber : 40-70% OU 6-10 places (modéré)
    if (availabilityPercent < 70 || spotsCount <= 10) {
      return {
        colorClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        text: isEnglish
          ? `${spotsCount} spot${spotsCount > 1 ? 's' : ''} available`
          : `${spotsCount} place${spotsCount > 1 ? 's' : ''} disponible${spotsCount > 1 ? 's' : ''}`,
        urgency: 'medium',
        icon: '✨'
      };
    }

    // Vert : > 70% ET > 10 places (beaucoup de disponibilité)
    return {
      colorClass: 'text-green-600',
      bgClass: 'bg-green-50',
      borderClass: 'border-green-200',
      text: isEnglish
        ? `${spotsCount} spot${spotsCount > 1 ? 's' : ''} available`
        : `${spotsCount} place${spotsCount > 1 ? 's' : ''} disponible${spotsCount > 1 ? 's' : ''}`,
      urgency: 'low',
      icon: '✓'
    };
  }

  /**
   * Génère le HTML d'une carte de cours
   */
  function renderCourseCard(course) {
    const availability = getAvailabilityStyle(
      course.spotsRemaining, 
      course.maxCapacity, 
      course.isFull
    );

    const spotsText = course.isFull 
      ? `<span class="${availability.colorClass} font-semibold flex items-center gap-1">
           <span>${availability.icon}</span>
           <span>${availability.text}</span>
         </span>`
      : `<span class="${availability.colorClass} font-semibold flex items-center gap-1">
           <span>${availability.icon}</span>
           <span>${availability.text}</span>
         </span>`;

    const buttonText = course.isFull 
      ? (currentLocale === 'en' ? 'Waitlist' : 'Liste d\'attente')
      : (currentLocale === 'en' ? 'Book' : 'Réserver');
    const buttonClass = course.isFull 
      ? 'bg-gray-400 hover:bg-gray-500'
      : 'bg-[#E6B84A] hover:bg-[#E8C15A] !text-[#7A1F3D]';

    // Formater la date (format DD/MM/YYYY depuis l'API)
    const dateStr = formatDateFromDDMMYYYY(course.date);
    
    // Corriger l'adresse selon la locale
    const displayLocation = formatLocation(course.location);

    return `
      <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-transparent hover:border-fluance/20"
           data-course-id="${course.id}"
           data-course-title="${course.title}"
           data-course-date="${dateStr}"
           data-course-date-raw="${course.date}"
           data-course-time="${course.time}"
           data-course-location="${displayLocation}"
           data-course-price="${course.price}"
           data-is-full="${course.isFull}">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-[#3E3A35] mb-2">${course.title}</h3>
          <p class="text-sm text-[#3E3A35]/60">${displayLocation}</p>
        </div>
        
        <!-- Date et heure mises en avant -->
        <div class="bg-fluance/5 border border-fluance/20 rounded-lg p-4 mb-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-fluance flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <span class="text-base font-bold text-[#3E3A35]">${dateStr}</span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-fluance flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="text-base font-bold text-[#3E3A35]">${course.time}</span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center justify-between mb-4">
          <span class="px-3 py-1.5 rounded-full ${availability.bgClass} border ${availability.borderClass} ${availability.urgency === 'critical' ? 'animate-pulse' : ''}">
            ${spotsText}
          </span>
        </div>
        <div class="flex justify-end items-center">
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
    
    // S'assurer que la date est correctement formatée
    // Si courseDate est "Invalid Date" ou invalide, reformater depuis la date originale
    if (courseData.courseDateRaw && 
        (courseData.courseDate === 'Invalid Date' || !courseData.courseDate || courseData.courseDate.includes('Invalid'))) {
      courseData.courseDate = formatDateFromDDMMYYYY(courseData.courseDateRaw);
    }
    
    // Corriger l'adresse selon la locale
    if (courseData.courseLocation) {
      courseData.courseLocation = formatLocation(courseData.courseLocation);
    }
    
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
              Continuer
            </button>
          </form>
        </div>
      </div>
    `;

    // Réattacher les événements
    setupStepListeners();
  }

  /**
   * Génère le HTML de la case à cocher CGV si nécessaire
   * @param {string} email - Email de l'utilisateur
   * @param {string} checkboxId - ID unique pour la checkbox
   * @returns {string} HTML de la case à cocher ou chaîne vide
   */
  function renderCGVCheckbox(email, checkboxId) {
    if (!email || hasAcceptedCGV(email)) {
      // L'utilisateur a déjà accepté, pas besoin d'afficher la case
      return '';
    }
    
    return `
      <!-- Case à cocher CGV -->
      <div class="flex items-start gap-2">
        <input type="checkbox" id="${checkboxId}" name="acceptCGV" required
               class="mt-1 w-4 h-4 text-fluance border-gray-300 rounded focus:ring-fluance">
        <label for="${checkboxId}" class="text-sm text-[#3E3A35]">
          ${currentLocale === 'en' 
            ? `I have read and accept the <a href="/cgv/" target="_blank" rel="noopener noreferrer" class="text-fluance hover:underline">Terms and Conditions (T&C)</a>, including the provisions relating to insurance and liability, as well as the venue regulations.`
            : `J'ai pris connaissance et j'accepte les <a href="/cgv/" target="_blank" rel="noopener noreferrer" class="text-fluance hover:underline">Conditions générales de vente (CGV)</a>, y compris les dispositions relatives à l'assurance et à la responsabilité, ainsi que le règlement du lieu d'accueil.`}
        </label>
      </div>
    `;
  }

  /**
   * Vérifie le pass de l'utilisateur par email
   */
  async function checkUserEmail(email) {
    const btn = document.getElementById('check-email-btn');
    const errorContainer = document.getElementById('email-check-error');
    
    btn.disabled = true;
    btn.textContent = t.checking;
    errorContainer.classList.add('hidden');

    // Stocker l'email actuel
    currentUserEmail = email.toLowerCase().trim();

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/checkUserPass?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      userPassStatus = data;
      
      // Stocker l'email actuel et le statut de première visite
      currentUserEmail = email.toLowerCase().trim();
      isFirstVisit = data.isFirstVisit === true;
      
      // Stocker le firstName si disponible pour pré-remplir les formulaires
      if (data.firstName) {
        storedFirstName = data.firstName;
      }

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
      errorContainer.textContent = t.bookingError;
      errorContainer.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = t.continue;
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
                <span>${t.sessionsRemaining}</span>
                <span class="text-2xl font-bold">${pass.sessionsRemaining}/${pass.sessionsTotal}</span>
              </div>
              <div class="mt-2 bg-white/20 rounded-full h-2">
                <div class="bg-white rounded-full h-2" style="width: ${(pass.sessionsRemaining / pass.sessionsTotal) * 100}%"></div>
              </div>
            ` : `
              <div class="flex justify-between items-center">
                <span>${t.unlimitedAccess}</span>
                <span class="text-lg font-bold">${pass.daysRemaining} ${t.daysRemaining}</span>
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
              <label for="firstName" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.firstName}</label>
              <input type="text" id="firstName" name="firstName" required
                     value="${storedFirstName || ''}"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
            <div>
              <label for="lastName" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.lastName}</label>
              <input type="text" id="lastName" name="lastName" required
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
          </div>

          <div>
            <label for="phone" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.phoneOptional}</label>
            <input type="tel" id="phone" name="phone"
                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
          </div>

          ${renderCGVCheckbox(email, 'accept-cgv-pass')}

          <div id="booking-error" class="hidden p-3 bg-red-50 text-red-600 rounded-lg text-sm"></div>

          <button type="submit"
                  class="w-full py-3 ${passColor} text-white font-semibold rounded-lg hover:opacity-90 transition-colors">
            ${isFlowPass ? t.bookWithFlowPass : t.bookWithSemesterPass}
          </button>
        </form>

        <button onclick="window.FluanceBooking.goBackToEmail()" 
                class="w-full mt-3 py-2 text-[#3E3A35]/60 hover:text-[#3E3A35] text-sm">
          ${t.useOtherEmail}
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
              <label for="firstName" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.firstName}</label>
              <input type="text" id="firstName" name="firstName" required
                     value="${storedFirstName || ''}"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
            <div>
              <label for="lastName" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.lastName}</label>
              <input type="text" id="lastName" name="lastName" required
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
          </div>

          <div>
            <label for="phone" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.phoneOptional}</label>
            <input type="tel" id="phone" name="phone"
                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
          </div>

          ${renderCGVCheckbox(email, 'accept-cgv-trial')}

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
                <label class="block p-4 border-2 rounded-lg cursor-pointer hover:border-fluance transition-colors relative ${index === 0 ? 'border-fluance bg-fluance/5' : 'border-gray-200'}" data-pricing-id="${option.id}">
                  ${option.badge ? `<span class="absolute -top-2 -right-2 ${option.badge === 'POPULAIRE' ? 'bg-fluance' : 'bg-[#E6B84A]'} text-white text-xs px-2 py-1 rounded-full">${option.badge}</span>` : ''}
                  <input type="radio" name="pricing" value="${option.id}" class="sr-only" ${index === 0 ? 'checked' : ''}>
                  <div class="flex justify-between items-center">
                    <div>
                      <span class="font-semibold text-[#3E3A35]">${option.name}</span>
                      <p class="text-sm text-[#3E3A35]/60">${option.description}</p>
                    </div>
                    <div class="text-right">
                      <span id="price-display-${option.id}" class="text-lg font-bold text-fluance">${option.price} CHF</span>
                      ${option.id === 'semester_pass' || option.id === 'flow_pass' ? `<div id="discount-display-${option.id}" class="text-sm text-green-600 font-semibold hidden"></div>` : ''}
                    </div>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Code partenaire (Flow Pass et Pass Semestriel) -->
          <div id="partner-code-section" class="hidden">
            <label for="partnerCode" class="block text-sm font-medium text-[#3E3A35] mb-1">
              ${currentLocale === 'en' ? 'Partner Code (optional)' : 'Code partenaire (optionnel)'}
            </label>
            <div class="flex gap-2">
              <input type="text" 
                     id="partnerCode" 
                     name="partnerCode" 
                     placeholder="${currentLocale === 'en' ? 'Enter code' : 'Entrez le code'}"
                     class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance uppercase"
                     maxlength="20">
              <button type="button" 
                      id="apply-partner-code-btn"
                      class="px-4 py-2 bg-fluance text-white rounded-lg hover:bg-fluance/90 transition-colors font-semibold">
                ${currentLocale === 'en' ? 'Apply' : 'Appliquer'}
              </button>
            </div>
            <div id="partner-code-message" class="hidden mt-2"></div>
          </div>

          <!-- Infos personnelles -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="firstName" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.firstName}</label>
              <input type="text" id="firstName" name="firstName" required
                     value="${storedFirstName || ''}"
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
            <div>
              <label for="lastName" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.lastName}</label>
              <input type="text" id="lastName" name="lastName" required
                     class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
            </div>
          </div>

          <div>
            <label for="phone" class="block text-sm font-medium text-[#3E3A35] mb-1">${t.phoneOptional}</label>
            <input type="tel" id="phone" name="phone"
                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance">
          </div>

          <!-- Mode de paiement -->
          <div>
            <label class="block text-sm font-medium text-[#3E3A35] mb-3">Mode de paiement</label>
            <div id="payment-methods" class="grid grid-cols-2 gap-3">
              <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-fluance transition-colors border-fluance bg-fluance/5">
                <input type="radio" name="paymentMethod" value="card" checked class="text-fluance focus:ring-fluance">
                <span class="text-sm" id="card-payment-label">Carte / TWINT</span>
              </label>
              <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-fluance transition-colors border-gray-200">
                <input type="radio" name="paymentMethod" value="cash" class="text-fluance focus:ring-fluance">
                <span class="text-sm">Espèces sur place</span>
              </label>
            </div>
            <!-- Message informatif pour le paiement en espèces -->
            <div id="cash-payment-info" class="hidden mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p class="text-sm text-blue-800">
                <strong>💡 Important :</strong> ${currentLocale === 'en' 
                  ? 'Please bring the exact amount in cash.' 
                  : 'Merci d\'apporter le montant exact en espèces.'}
              </p>
            </div>
          </div>

          ${renderCGVCheckbox(email, 'accept-cgv-pricing')}

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

    // Gérer la sélection des options tarifaires
    const pricingContainer = document.getElementById('pricing-options');
    const partnerCodeSection = document.getElementById('partner-code-section');
    const partnerCodeInput = document.getElementById('partnerCode');
    const applyCodeBtn = document.getElementById('apply-partner-code-btn');
    const partnerCodeMessage = document.getElementById('partner-code-message');
    
    // Fonction pour réinitialiser les prix affichés
    function resetPrices() {
      const flowPassPrice = document.getElementById('price-display-flow_pass');
      const flowPassDiscount = document.getElementById('discount-display-flow_pass');
      const semesterPassPrice = document.getElementById('price-display-semester_pass');
      const semesterPassDiscount = document.getElementById('discount-display-semester_pass');
      
      if (flowPassPrice) flowPassPrice.textContent = '210 CHF';
      if (flowPassDiscount) {
        flowPassDiscount.classList.add('hidden');
        flowPassDiscount.textContent = '';
      }
      
      if (semesterPassPrice) semesterPassPrice.textContent = '340 CHF';
      if (semesterPassDiscount) {
        semesterPassDiscount.classList.add('hidden');
        semesterPassDiscount.textContent = '';
      }
    }
    
    // Fonction pour afficher/masquer le champ code partenaire
    function togglePartnerCodeField(show) {
      if (partnerCodeSection) {
        if (show) {
          partnerCodeSection.classList.remove('hidden');
        } else {
          partnerCodeSection.classList.add('hidden');
          // Réinitialiser le code et la remise
          if (partnerCodeInput) partnerCodeInput.value = '';
          if (partnerCodeMessage) {
            partnerCodeMessage.classList.add('hidden');
            partnerCodeMessage.textContent = '';
          }
          // Réinitialiser le prix affiché
          resetPrices();
        }
      }
    }
    
    // Fonction pour valider et appliquer le code partenaire
    async function validatePartnerCode(code, pricingOption) {
      if (!code || !code.trim()) {
        return { valid: false, message: currentLocale === 'en' ? 'Please enter a code' : 'Veuillez entrer un code' };
      }
      
      try {
        const validFor = pricingOption || 'semester_pass';
        const response = await fetch(`${CONFIG.API_BASE_URL}/validatePartnerCode?code=${encodeURIComponent(code.toUpperCase().trim())}&validFor=${encodeURIComponent(validFor)}`);
        const data = await response.json();
        
        if (data.valid) {
          return {
            valid: true,
            discount: data.discount || 0,
            discountPercent: data.discountPercent || 0,
            message: data.message || (currentLocale === 'en' 
              ? `Discount of ${data.discountPercent}% applied!` 
              : `Remise de ${data.discountPercent}% appliquée !`)
          };
        } else {
          return {
            valid: false,
            message: data.message || (currentLocale === 'en' 
              ? 'Invalid code' 
              : 'Code invalide')
          };
        }
      } catch (error) {
        console.error('Error validating partner code:', error);
        return {
          valid: false,
          message: currentLocale === 'en' 
            ? 'Error validating code. Please try again.' 
            : 'Erreur lors de la validation du code. Veuillez réessayer.'
        };
      }
    }
    
    // Fonction pour appliquer la remise au prix affiché
    function applyDiscount(discountPercent) {
      // Récupérer l'option tarifaire sélectionnée
      const selectedRadio = pricingContainer.querySelector('input[type="radio"]:checked');
      if (!selectedRadio) return;
      
      const pricingOption = selectedRadio.value;
      
      // Définir le prix original selon l'option
      let originalPrice;
      if (pricingOption === 'flow_pass') {
        originalPrice = 210; // Prix du Flow Pass
      } else if (pricingOption === 'semester_pass') {
        originalPrice = 340; // Prix du Pass Semestriel
      } else {
        return; // Pas de remise pour les autres options
      }
      
      const discountAmount = (originalPrice * discountPercent) / 100;
      const finalPrice = originalPrice - discountAmount;
      
      const priceDisplay = document.getElementById(`price-display-${pricingOption}`);
      const discountDisplay = document.getElementById(`discount-display-${pricingOption}`);
      
      if (priceDisplay) {
        priceDisplay.innerHTML = `
          <span class="line-through text-gray-400 text-base">${originalPrice} CHF</span>
          <span class="ml-2">${finalPrice.toFixed(2)} CHF</span>
        `;
      }
      
      if (discountDisplay) {
        discountDisplay.textContent = `-${discountPercent}%`;
        discountDisplay.classList.remove('hidden');
      }
    }
    
    if (pricingContainer) {
      pricingContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
          // Mettre à jour les styles des labels
          pricingContainer.querySelectorAll('label').forEach(l => {
            l.classList.remove('border-fluance', 'bg-fluance/5');
            l.classList.add('border-gray-200');
          });
          const selectedLabel = radio.closest('label');
          selectedLabel.classList.remove('border-gray-200');
          selectedLabel.classList.add('border-fluance', 'bg-fluance/5');
          
          // Réinitialiser les prix affichés lors du changement d'option
          resetPrices();
          
          // Réinitialiser le code partenaire et le message
          if (partnerCodeInput) partnerCodeInput.value = '';
          if (partnerCodeMessage) {
            partnerCodeMessage.classList.add('hidden');
            partnerCodeMessage.textContent = '';
          }
          
          // Afficher/masquer le champ code partenaire (Flow Pass et Pass Semestriel)
          togglePartnerCodeField(radio.value === 'flow_pass' || radio.value === 'semester_pass');
          
          // Mettre à jour les options de paiement selon le type de pass
          updatePaymentMethodsForPricingOption(radio.value);
        });
      });
      
      // Gérer aussi les clics sur les labels
      pricingContainer.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', () => {
          const radio = label.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
        });
      });
      
      // Vérifier l'option sélectionnée au chargement
      const selectedRadio = pricingContainer.querySelector('input[type="radio"]:checked');
      if (selectedRadio) {
        if (selectedRadio.value === 'flow_pass' || selectedRadio.value === 'semester_pass') {
          togglePartnerCodeField(true);
        }
        updatePaymentMethodsForPricingOption(selectedRadio.value);
      }
    }
    
    /**
     * Met à jour les options de paiement selon le type de pass sélectionné
     * - Pass Semestriel : Carte uniquement (pas TWINT car pas d'abonnements récurrents)
     * - Autres : Carte / TWINT
     */
    function updatePaymentMethodsForPricingOption(pricingOption) {
      const cardPaymentLabel = document.getElementById('card-payment-label');
      if (!cardPaymentLabel) return;
      
      if (pricingOption === 'semester_pass') {
        // Pass Semestriel : Carte uniquement (abonnement récurrent)
        cardPaymentLabel.textContent = currentLocale === 'en' ? 'Card' : 'Carte bancaire';
      } else {
        // Autres options : Carte / TWINT (paiements uniques)
        cardPaymentLabel.textContent = currentLocale === 'en' ? 'Card / TWINT' : 'Carte / TWINT';
      }
    }
    
    // Gérer l'application du code partenaire
    if (applyCodeBtn && partnerCodeInput) {
      applyCodeBtn.addEventListener('click', async () => {
        const code = partnerCodeInput.value.trim().toUpperCase();
        
        // Si le champ est vide, retirer le code partenaire si une remise est appliquée
        if (!code) {
          // Vérifier si une remise est actuellement appliquée
          const selectedRadio = pricingContainer.querySelector('input[type="radio"]:checked');
          if (selectedRadio) {
            const pricingOption = selectedRadio.value;
            const discountDisplay = document.getElementById(`discount-display-${pricingOption}`);
            
            // Si une remise est visible, la retirer
            if (discountDisplay && !discountDisplay.classList.contains('hidden')) {
              resetPrices();
              partnerCodeMessage.textContent = currentLocale === 'en' 
                ? 'Partner code removed' 
                : 'Code partenaire retiré';
              partnerCodeMessage.className = 'mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800';
              partnerCodeMessage.classList.remove('hidden');
              return;
            }
          }
          
          // Si aucune remise n'est appliquée, afficher l'erreur
          partnerCodeMessage.textContent = currentLocale === 'en' 
            ? 'Please enter a code' 
            : 'Veuillez entrer un code';
          partnerCodeMessage.className = 'mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800';
          partnerCodeMessage.classList.remove('hidden');
          return;
        }
        
        applyCodeBtn.disabled = true;
        applyCodeBtn.textContent = currentLocale === 'en' ? 'Checking...' : 'Vérification...';
        
        // Récupérer l'option tarifaire sélectionnée
        const selectedPricingOption = pricingContainer.querySelector('input[type="radio"]:checked')?.value || 'semester_pass';
        const result = await validatePartnerCode(code, selectedPricingOption);
        
        applyCodeBtn.disabled = false;
        applyCodeBtn.textContent = currentLocale === 'en' ? 'Apply' : 'Appliquer';
        
        if (result.valid) {
          // Construire le message avec mention spéciale pour RETRAITE50
          let messageHTML = result.message;
          if (code === 'RETRAITE50') {
            messageHTML += '<div class="mt-3 pt-3 border-t border-green-300">';
            if (currentLocale === 'en') {
              messageHTML += '<div class="font-semibold mb-1">Retiree rate</div>';
              messageHTML += '<div class="text-xs">This rate is reserved for people officially retired (OASI or equivalent).<br>It is based on a relationship of trust and mutual respect.</div>';
            } else {
              messageHTML += '<div class="font-semibold mb-1">Tarif retraité</div>';
              messageHTML += '<div class="text-xs">Ce tarif est réservé aux personnes officiellement à la retraite (AVS ou équivalent).<br>Il repose sur une démarche de confiance et de respect mutuel.</div>';
            }
            messageHTML += '</div>';
          }
          partnerCodeMessage.innerHTML = messageHTML;
          partnerCodeMessage.className = 'mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800';
          partnerCodeMessage.classList.remove('hidden');
          applyDiscount(result.discountPercent);
        } else {
          partnerCodeMessage.textContent = result.message;
          partnerCodeMessage.className = 'mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800';
          partnerCodeMessage.classList.remove('hidden');
        }
      });
      
      // Permettre d'appliquer le code avec Enter
      partnerCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyCodeBtn.click();
        }
      });
    }

    // Gérer la sélection des méthodes de paiement
    const paymentMethodsContainer = document.getElementById('payment-methods');
    const cashPaymentInfo = document.getElementById('cash-payment-info');
    if (paymentMethodsContainer) {
      paymentMethodsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
          // Mettre à jour les styles des labels
          paymentMethodsContainer.querySelectorAll('label').forEach(l => {
            l.classList.remove('border-fluance', 'bg-fluance/5');
            l.classList.add('border-gray-200');
          });
          const selectedLabel = radio.closest('label');
          selectedLabel.classList.remove('border-gray-200');
          selectedLabel.classList.add('border-fluance', 'bg-fluance/5');
          
          // Afficher/masquer le message informatif pour le paiement en espèces
          if (cashPaymentInfo) {
            if (radio.value === 'cash') {
              cashPaymentInfo.classList.remove('hidden');
            } else {
              cashPaymentInfo.classList.add('hidden');
            }
          }
        });
      });
      
      // Gérer aussi les clics sur les labels (pour compatibilité)
      paymentMethodsContainer.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', () => {
          const radio = label.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
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
    const acceptCGV = form.querySelector('input[name="acceptCGV"]');
    const formData = new FormData(form);
    const email = formData.get('email');

    // Vérifier que la case CGV est cochée (si elle existe)
    // Si la case n'existe pas, c'est que l'utilisateur a déjà accepté
    if (acceptCGV && !acceptCGV.checked) {
      if (errorContainer) {
        errorContainer.textContent = t.acceptCGVError;
        errorContainer.classList.remove('hidden');
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Réservation...';
    errorContainer?.classList.add('hidden');

    const data = {
      courseId: currentCourseId,
      email: email,
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
        // Marquer l'acceptation CGV si la case était présente et cochée
        if (acceptCGV && acceptCGV.checked && email) {
          markCGVAccepted(email);
        }
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
    const acceptCGV = form.querySelector('input[name="acceptCGV"]');
    const formData = new FormData(form);
    const email = formData.get('email');

    // Vérifier que la case CGV est cochée (si elle existe)
    // Si la case n'existe pas, c'est que l'utilisateur a déjà accepté
    if (acceptCGV && !acceptCGV.checked) {
      if (errorContainer) {
        errorContainer.textContent = t.acceptCGVError;
        errorContainer.classList.remove('hidden');
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = currentLocale === 'en' ? 'Processing...' : 'Traitement...';
    errorContainer?.classList.add('hidden');

    const partnerCode = formData.get('partnerCode')?.trim().toUpperCase() || null;
    const data = {
      courseId: currentCourseId,
      email: email,
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
      paymentMethod: formData.get('paymentMethod') || 'card',
      pricingOption: formData.get('pricing') || formData.get('pricingOption') || 'single',
      partnerCode: partnerCode || undefined, // Inclure seulement si présent
    };

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/bookCourse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        // Marquer l'acceptation CGV si la case était présente et cochée
        if (acceptCGV && acceptCGV.checked && email) {
          markCGVAccepted(email);
        }
        
        if (result.status === 'waitlisted') {
          const waitlistTitle = currentLocale === 'en' ? 'Added to waitlist' : 'Ajouté à la liste d\'attente';
          const waitlistMsg = currentLocale === 'en'
            ? `You are in position ${result.position}. We will contact you if a spot becomes available.`
            : `Vous êtes en position ${result.position}. Nous vous contacterons si une place se libère.`;
          showSuccessMessage(waitlistTitle, waitlistMsg);
        } else if (result.requiresPayment && result.clientSecret) {
          // Passer l'email et l'acceptation CGV pour le marquer après paiement réussi
          await handleStripePayment(result.clientSecret, data, email, acceptCGV && acceptCGV.checked);
        } else {
          const confirmTitle = currentLocale === 'en' ? 'Booking confirmed!' : 'Réservation confirmée !';
          const confirmMsg = currentLocale === 'en'
            ? (result.message || 'You will receive a confirmation email.')
            : (result.message || 'Vous recevrez un email de confirmation.');
          showSuccessMessage(confirmTitle, confirmMsg);
        }
      } else {
        if (errorContainer) {
          const errorMsg = result.message || (currentLocale === 'en' ? 'An error occurred' : 'Une erreur est survenue');
          errorContainer.textContent = errorMsg;
          errorContainer.classList.remove('hidden');
        }
      }
    } catch (error) {
      console.error('Booking error:', error);
      if (errorContainer) {
        const errorMsg = currentLocale === 'en'
          ? 'Connection error. Please try again.'
          : 'Erreur de connexion. Veuillez réessayer.';
        errorContainer.textContent = errorMsg;
        errorContainer.classList.remove('hidden');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Gère le paiement Stripe
   * @param {string} clientSecret - Secret client Stripe
   * @param {object} bookingData - Données de réservation
   * @param {string} email - Email de l'utilisateur
   * @param {boolean} cgvAccepted - Si l'utilisateur a coché la case CGV
   */
  async function handleStripePayment(clientSecret, bookingData, email, cgvAccepted) {
    if (!stripe) {
      const errorMsg = currentLocale === 'en'
        ? 'Payment system is not available. Please choose "Cash on site".'
        : 'Le système de paiement n\'est pas disponible. Veuillez choisir "Espèces sur place".';
      showErrorMessage(errorMsg);
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
          return_url: currentLocale === 'en' 
            ? `${window.location.origin}/en/presentiel/booking-confirmed/`
            : `${window.location.origin}/presentiel/reservation-confirmee/`,
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
            ${t.close}
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
