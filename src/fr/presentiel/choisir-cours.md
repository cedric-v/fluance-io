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
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4">Désinscription confirmée</h1>
    <p class="text-lg text-[#3E3A35]/70 mb-6">
      Votre désinscription a été effectuée avec succès. Vous pouvez maintenant choisir un autre cours.
    </p>
    <p class="text-sm text-[#3E3A35]/50">
      Votre paiement reste valide pour le nouveau cours que vous choisirez.
    </p>
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
    <p class="text-lg text-[#3E3A35]/70 mb-4">Aucun cours disponible pour le moment.</p>
    <a href="{{ '/presentiel/reserver/' | relativeUrl }}" 
       class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-6 py-3 rounded-full font-semibold inline-block">
      Voir tous les cours
    </a>
  </div>

  <div class="text-center mt-8">
    <a href="{{ '/' | relativeUrl }}" 
       class="px-6 py-3 rounded-full font-semibold border-2 border-fluance text-fluance hover:bg-fluance hover:text-white transition-colors inline-block">
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
      document.getElementById('error-message').textContent = 'Informations de réservation manquantes. Veuillez utiliser le lien de désinscription depuis votre email.';
      return;
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
          const courseCard = document.createElement('div');
          courseCard.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow';
          courseCard.innerHTML = `
            <h3 class="text-xl font-semibold text-[#3E3A35] mb-2">${course.title}</h3>
            <p class="text-[#3E3A35]/70 mb-4">
              <strong>Date :</strong> ${course.date}<br>
              <strong>Heure :</strong> ${course.time}<br>
              <strong>Lieu :</strong> ${course.location}
            </p>
            <div class="flex items-center justify-between mb-4">
              <span class="text-sm text-[#3E3A35]/60">
                ${course.spotsRemaining} place${course.spotsRemaining > 1 ? 's' : ''} disponible${course.spotsRemaining > 1 ? 's' : ''}
              </span>
              <span class="text-lg font-semibold text-fluance">${course.price} CHF</span>
            </div>
            <button 
              onclick="transferToCourse('${bookingId}', '${course.id}')"
              class="w-full btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-4 py-2 rounded-full font-semibold ${course.isFull ? 'opacity-50 cursor-not-allowed' : ''}"
              ${course.isFull ? 'disabled' : ''}>
              ${course.isFull ? 'Complet' : 'Choisir ce cours'}
            </button>
          `;
          coursesList.appendChild(courseCard);
        });
      } catch (error) {
        console.error('Error loading courses:', error);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
        document.getElementById('error-message').textContent = 'Erreur lors du chargement des cours. Veuillez réessayer.';
      }
    }

    window.transferToCourse = async function(oldBookingId, newCourseId) {
      if (!oldBookingId || !newCourseId) {
        alert('Erreur : informations manquantes.');
        return;
      }

      const email = urlParams.get('email');
      if (!email) {
        alert('Erreur : email manquant. Veuillez réessayer depuis le lien de désinscription.');
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
          successMessage.textContent = 'Transfert réussi ! Redirection en cours...';
          document.body.appendChild(successMessage);
          
          setTimeout(() => {
            window.location.href = '{{ "/presentiel/reservation-confirmee/" | relativeUrl }}';
          }, 2000);
        } else {
          const errorMsg = data.error === 'COURSE_FULL' ? 
            'Ce cours est maintenant complet. Veuillez choisir un autre cours.' :
            (data.error || 'Impossible de transférer la réservation.');
          alert('Erreur : ' + errorMsg);
        }
      } catch (error) {
        console.error('Error transferring course:', error);
        alert('Erreur lors du transfert. Veuillez réessayer.');
      }
    };

    loadCourses();
  })();
</script>
