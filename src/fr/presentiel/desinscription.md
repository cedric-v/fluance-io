---
layout: base.njk
title: Désinscription
description: "Désinscription d'un cours Fluance"
locale: fr
permalink: /presentiel/desinscription/
eleventyExcludeFromCollections: true
robots: noindex, nofollow
---

<section class="max-w-2xl mx-auto px-6 md:px-12 py-16 text-center">
  <div id="loading" class="mb-8">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-6 animate-spin">
      <svg class="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
    </div>
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4">Traitement en cours...</h1>
    <p class="text-lg text-[#3E3A35]/70">
      Veuillez patienter pendant que nous traitons votre demande.
    </p>
  </div>

  <div id="error" class="hidden mb-8">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-6">
      <svg class="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </div>
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4">Erreur</h1>
    <p id="error-message" class="text-lg text-[#3E3A35]/70 mb-6"></p>
    <a href="{{ '/' | relativeUrl }}" 
       class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-6 py-3 rounded-full font-semibold inline-block">
      Retour à l'accueil
    </a>
  </div>
</section>

<script>
  (function() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (error) {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error').classList.remove('hidden');
      document.getElementById('error-message').textContent = decodeURIComponent(error);
      return;
    }

    if (!token) {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error').classList.remove('hidden');
      document.getElementById('error-message').textContent = 'Aucun token de désinscription fourni.';
      return;
    }

    // Rediriger vers l'endpoint de désinscription
    window.location.href = `https://europe-west1-fluance-protected-content.cloudfunctions.net/cancelBookingByToken?token=${token}`;
  })();
</script>
