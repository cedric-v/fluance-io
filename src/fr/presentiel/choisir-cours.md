---
layout: base.njk
title: Choisir un nouveau cours
description: "Choisissez un nouveau cours après votre désinscription"
locale: fr
permalink: /presentiel/choisir-cours/
eleventyExcludeFromCollections: true
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16">
  <div class="text-center mb-12">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
      <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4" data-i18n="unsubscribe-confirmed-title">Désinscription confirmée</h1>
    <p class="text-lg text-[#3E3A35]/70 mb-6" data-i18n="unsubscribe-confirmed-message">Votre désinscription a été effectuée avec succès. Vous pouvez maintenant choisir un autre cours.</p>
    <p class="text-sm text-[#3E3A35]/50" data-i18n="unsubscribe-payment-info">Votre paiement reste valide pour le nouveau cours que vous choisirez.</p>
  </div>

  <div id="loading" class="text-center py-12">
    <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4 animate-spin">
      <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
    </div>
    <p class="text-[#3E3A35]/70">Chargement des cours disponibles...</p>
  </div>

  <div id="error" class="hidden bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
    <p id="error-message" class="text-red-800"></p>
  </div>

  <div id="courses-list" class="hidden grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8"></div>

  <div id="no-courses" class="hidden text-center py-12">
    <p class="text-lg text-[#3E3A35]/70 mb-4" data-i18n="no-courses-available">Aucun cours disponible pour le moment.</p>
    <a href="{{ '/presentiel/reserver/' | relativeUrl }}" 
       class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-6 py-3 rounded-full font-semibold inline-block"
       data-i18n="view-all-courses">
      Voir tous les cours
    </a>
  </div>

  <div class="text-center mt-8">
    <a href="{{ '/' | relativeUrl }}" 
       class="px-6 py-3 rounded-full font-semibold border-2 border-fluance text-fluance hover:bg-fluance hover:text-white transition-colors inline-block"
       data-i18n="back-to-home">
      Retour à l'accueil
    </a>
  </div>
</section>

<script>
  (function() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('bookingId');
    const email = urlParams.get('email');
    const cancelled = urlParams.get('cancelled');

    if (!bookingId || !email || cancelled !== 'true') {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error').classList.remove('hidden');
      const errorMsg = currentLocale === 'en' 
        ? 'Missing booking information. Please use the unsubscribe link from your email.'
        : 'Informations de réservation manquantes. Veuillez utiliser le lien de désinscription depuis votre email.';
      document.getElementById('error-message').textContent = errorMsg;
      return;
    }

    // Détecter la langue
    function getCurrentLocale() {
      if (window.location.pathname.includes('/en/')) {
        return 'en';
      }
      const lang = document.documentElement.lang || document.documentElement.getAttribute('lang');
      if (lang && lang.startsWith('en')) {
        return 'en';
      }
      return 'fr';
    }

    const currentLocale = getCurrentLocale();

    // Traduire les textes statiques selon la langue
    function updateStaticTexts() {
      const texts = {
        fr: {
          title: 'Désinscription confirmée',
          message: 'Votre désinscription a été effectuée avec succès. Vous pouvez maintenant choisir un autre cours.',
          paymentInfo: 'Votre paiement reste valide pour le nouveau cours que vous choisirez.',
          noCourses: 'Aucun cours disponible pour le moment.',
          viewAll: 'Voir tous les cours',
          backHome: 'Retour à l\'accueil'
        },
        en: {
          title: 'Unsubscription confirmed',
          message: 'Your unsubscription was successful. You can now choose another class.',
          paymentInfo: 'Your payment remains valid for the new class you choose.',
          noCourses: 'No classes available at the moment.',
          viewAll: 'View all classes',
          backHome: 'Back to home'
        }
      };

      const t = texts[currentLocale] || texts.fr;

      const titleEl = document.querySelector('[data-i18n="unsubscribe-confirmed-title"]');
      const messageEl = document.querySelector('[data-i18n="unsubscribe-confirmed-message"]');
      const paymentEl = document.querySelector('[data-i18n="unsubscribe-payment-info"]');
      const noCoursesEl = document.querySelector('[data-i18n="no-courses-available"]');
      const viewAllEl = document.querySelector('[data-i18n="view-all-courses"]');
      const backHomeEl = document.querySelector('[data-i18n="back-to-home"]');

      if (titleEl) titleEl.textContent = t.title;
      if (messageEl) messageEl.textContent = t.message;
      if (paymentEl) paymentEl.textContent = t.paymentInfo;
      if (noCoursesEl) noCoursesEl.textContent = t.noCourses;
      if (viewAllEl) viewAllEl.textContent = t.viewAll;
      if (backHomeEl) backHomeEl.textContent = t.backHome;
    }

    updateStaticTexts();

    // Fonction pour déterminer le style de disponibilité (identique à booking.js)
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

      const availabilityPercent = (spotsRemaining / maxCapacity) * 100;
      const spotsCount = spotsRemaining;

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

    // Charger les cours disponibles
    async function loadCourses() {
      try {
        // Récupérer le courseId de l'ancienne réservation
        let excludeCourseId = null;
        try {
          const bookingResponse = await fetch(
            `https://europe-west1-fluance-protected-content.cloudfunctions.net/getUserBookings?email=${encodeURIComponent(email)}`
          );
          const bookingData = await bookingResponse.json();
          if (bookingData.success && bookingData.bookings) {
            const oldBooking = bookingData.bookings.find(b => b.bookingId === bookingId || b.id === bookingId);
            if (oldBooking && oldBooking.courseId) {
              excludeCourseId = oldBooking.courseId;
            }
          }
        } catch (e) {
          console.error('Error fetching booking:', e);
        }

        const url = excludeCourseId ? 
          `https://europe-west1-fluance-protected-content.cloudfunctions.net/getAvailableCoursesForTransfer?excludeCourseId=${excludeCourseId}` :
          `https://europe-west1-fluance-protected-content.cloudfunctions.net/getAvailableCoursesForTransfer`;
        
        const response = await fetch(url);
        const data = await response.json();

        document.getElementById('loading').classList.add('hidden');

        if (!data.success || !data.courses || data.courses.length === 0) {
          document.getElementById('no-courses').classList.remove('hidden');
          return;
        }

        const coursesList = document.getElementById('courses-list');
        coursesList.classList.remove('hidden');

        data.courses.forEach(course => {
          const availability = getAvailabilityStyle(
            course.spotsRemaining,
            course.maxCapacity || 15,
            course.isFull
          );

          const spotsText = `<span class="${availability.colorClass} font-semibold flex items-center gap-1">
            <span>${availability.icon}</span>
            <span>${availability.text}</span>
          </span>`;

          const buttonText = course.isFull
            ? (currentLocale === 'en' ? 'Full' : 'Complet')
            : (currentLocale === 'en' ? 'Choose this class' : 'Choisir ce cours');

          const courseCard = document.createElement('div');
          courseCard.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow';
          courseCard.innerHTML = `
            <h3 class="text-xl font-semibold text-[#3E3A35] mb-2">${course.title}</h3>
            <p class="text-[#3E3A35]/70 mb-4">
              <strong>${currentLocale === 'en' ? 'Date' : 'Date'} :</strong> ${course.date}<br>
              <strong>${currentLocale === 'en' ? 'Time' : 'Heure'} :</strong> ${course.time}<br>
              <strong>${currentLocale === 'en' ? 'Location' : 'Lieu'} :</strong> ${course.location}
            </p>
            <div class="flex items-center justify-between mb-4">
              <span class="px-3 py-1.5 rounded-full ${availability.bgClass} border ${availability.borderClass} ${availability.urgency === 'critical' ? 'animate-pulse' : ''}">
                ${spotsText}
              </span>
              <span class="text-lg font-semibold text-fluance">${course.price} CHF</span>
            </div>
            <button 
              onclick="transferToCourse('${bookingId}', '${course.id}')"
              class="w-full btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-4 py-2 rounded-full font-semibold ${course.isFull ? 'opacity-50 cursor-not-allowed' : ''}"
              ${course.isFull ? 'disabled' : ''}>
              ${buttonText}
            </button>
          `;
          coursesList.appendChild(courseCard);
        });
      } catch (error) {
        console.error('Error loading courses:', error);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
        const errorMsg = currentLocale === 'en'
          ? 'Error loading courses. Please try again.'
          : 'Erreur lors du chargement des cours. Veuillez réessayer.';
        document.getElementById('error-message').textContent = errorMsg;
      }
    }

    window.transferToCourse = async function(oldBookingId, newCourseId) {
      if (!oldBookingId || !newCourseId) {
        const msg = currentLocale === 'en' 
          ? 'Error: missing information.'
          : 'Erreur : informations manquantes.';
        alert(msg);
        return;
      }

      const email = urlParams.get('email');
      if (!email) {
        const msg = currentLocale === 'en'
          ? 'Error: email missing. Please try again from the unsubscribe link.'
          : 'Erreur : email manquant. Veuillez réessayer depuis le lien de désinscription.';
        alert(msg);
        return;
      }

        const response = await fetch(
          'https://europe-west1-fluance-protected-content.cloudfunctions.net/transferCourseBooking',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId: oldBookingId,
              newCourseId: newCourseId,
              email: email
            })
          }
        );

        const data = await response.json();

        if (data.success) {
          // Afficher un message de succès
          const successMessage = document.createElement('div');
          successMessage.className = 'fixed top-0 left-0 right-0 bg-green-500 text-white p-4 text-center z-50';
          const successText = currentLocale === 'en'
            ? 'Transfer successful! Redirecting...'
            : 'Transfert réussi ! Redirection en cours...';
          successMessage.textContent = successText;
          document.body.appendChild(successMessage);
          
          setTimeout(() => {
            const redirectUrl = currentLocale === 'en'
              ? '{{ "/en/presentiel/confirmation/" | relativeUrl }}'
              : '{{ "/presentiel/reservation-confirmee/" | relativeUrl }}';
            window.location.href = redirectUrl;
          }, 2000);
        } else {
          let errorMsg;
          if (data.error === 'COURSE_FULL') {
            errorMsg = currentLocale === 'en'
              ? 'This class is now full. Please choose another class.'
              : 'Ce cours est maintenant complet. Veuillez choisir un autre cours.';
          } else {
            errorMsg = currentLocale === 'en'
              ? (data.error || 'Unable to transfer booking.')
              : (data.error || 'Impossible de transférer la réservation.');
          }
          const alertMsg = currentLocale === 'en'
            ? 'Error: ' + errorMsg
            : 'Erreur : ' + errorMsg;
          alert(alertMsg);
        }
      } catch (error) {
        console.error('Error transferring course:', error);
        const msg = currentLocale === 'en'
          ? 'Error during transfer. Please try again.'
          : 'Erreur lors du transfert. Veuillez réessayer.';
        alert(msg);
      }
    };

    loadCourses();
  })();
</script>
