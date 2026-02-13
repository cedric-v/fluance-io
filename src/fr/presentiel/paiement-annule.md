---
layout: base.njk
title: Paiement annulé
description: "Votre paiement a été annulé"
locale: fr
permalink: /presentiel/paiement-annule/
eleventyExcludeFromCollections: true
robots: noindex, nofollow
---

<section class="max-w-2xl mx-auto px-6 md:px-12 py-16 text-center">
  <div class="mb-8">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-6">
      <svg class="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </div>
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4">Paiement annulé</h1>
    <p class="text-lg text-[#3E3A35]/70 mb-2">
      Votre paiement a été annulé et votre réservation n'a pas été confirmée.
    </p>
    <p class="text-[#3E3A35]/60 text-sm">
      Aucun montant n'a été débité de votre compte.
    </p>
  </div>

  <div class="bg-white rounded-2xl shadow-lg p-8 mb-8">
    <h2 class="text-xl font-semibold text-fluance mb-4">💡 Que faire maintenant ?</h2>
    <p class="text-[#3E3A35]/70 mb-4">
      Vous pouvez :
    </p>
    <ul class="space-y-3 text-[#3E3A35]/80 text-left max-w-md mx-auto">
      <li class="flex items-start gap-2">
        <span class="text-fluance mt-1">→</span>
        <span><strong>Réessayer le paiement</strong> en retournant sur la page de réservation</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-fluance mt-1">→</span>
        <span><strong>Choisir un autre créneau</strong> si celui-ci ne vous convient plus</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-fluance mt-1">→</span>
        <span><strong>Opter pour le paiement en espèces</strong> sur place (montant exact requis)</span>
      </li>
    </ul>
  </div>

  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="{{ '/presentiel/reserver/' | relativeUrl }}" 
       id="retry-booking-link"
       class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-6 py-3 rounded-full font-semibold">
      Réessayer la réservation
    </a>
    <a href="{{ '/' | relativeUrl }}" 
       class="px-6 py-3 rounded-full font-semibold border-2 border-fluance text-fluance hover:bg-fluance hover:text-white transition-colors">
      Retour à l'accueil
    </a>
  </div>
</section>

<script>
  // Si un bookingId est présent dans l'URL, on peut proposer de réessayer directement
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('booking_id');
  
  if (bookingId) {
    // Optionnel : on pourrait pré-remplir le formulaire avec les infos de la réservation
    // Pour l'instant, on redirige juste vers la page de réservation
    const retryLink = document.getElementById('retry-booking-link');
    if (retryLink) {
      // Le lien reste vers la page de réservation générale
      // L'utilisateur devra refaire sa réservation
    }
  }
  
  // Nettoyer l'URL après traitement
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
</script>
