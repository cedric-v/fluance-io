---
layout: base.njk
title: Réservation confirmée
description: "Votre réservation pour un cours Fluance est confirmée"
locale: fr
permalink: /presentiel/reservation-confirmee/
eleventyExcludeFromCollections: true
---

<section class="max-w-2xl mx-auto px-6 md:px-12 py-16 text-center">
  <div class="mb-8">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
      <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4">Réservation confirmée !</h1>
    <p class="text-lg text-[#3E3A35]/70">
      Merci pour votre réservation. Un email de confirmation vous a été envoyé.
    </p>
  </div>

  <div class="bg-white rounded-2xl shadow-lg p-8 mb-8 text-left">
    <h2 class="text-xl font-semibold text-fluance mb-4">📧 Vérifiez votre email</h2>
    <p class="text-[#3E3A35]/70 mb-4">
      Vous recevrez un email avec :
    </p>
    <ul class="space-y-2 text-[#3E3A35]/80">
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>Le récapitulatif de votre réservation</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>L'adresse et les informations pratiques</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>Un lien pour ajouter le cours à votre calendrier</span>
      </li>
    </ul>
    <p class="text-sm text-[#3E3A35]/50 mt-4">
      Pensez à vérifier vos spams si vous ne trouvez pas l'email.
    </p>
  </div>

  <div class="bg-fluance/5 rounded-2xl p-6 mb-8">
    <h3 class="font-semibold text-[#3E3A35] mb-3">📍 Rappel du lieu</h3>
    <p class="text-[#3E3A35]/80">
      <strong>le duplex danse & bien-être</strong><br>
      Rte de Chantemerle 58d, 1763 Granges-Paccot
    </p>
    <a href="https://maps.app.goo.gl/2a3AZBFTjirjEfm99" 
       target="_blank" 
       rel="noopener noreferrer"
       class="inline-flex items-center gap-1 text-fluance mt-2 hover:underline">
      Voir sur Google Maps →
    </a>
  </div>

  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="{{ '/presentiel/reserver/' | relativeUrl }}" 
       class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-6 py-3 rounded-full font-semibold">
      Réserver un autre cours
    </a>
    <a href="{{ '/' | relativeUrl }}" 
       class="px-6 py-3 rounded-full font-semibold border-2 border-fluance text-fluance hover:bg-fluance hover:text-white transition-colors">
      Retour à l'accueil
    </a>
  </div>
</section>

<script>
  // Nettoyer l'URL après le retour de Stripe
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
</script>
