---
layout: base.njk
title: Réserver un cours - Cours en présentiel
description: "Réservez votre place pour les cours Fluance en présentiel à Fribourg"
locale: fr
permalink: /presentiel/reserver/
---

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16">
  <header class="text-center mb-12">
    <h1 class="text-4xl font-semibold text-[#3E3A35] mb-4">Réserver un cours</h1>
    <p class="text-lg text-[#3E3A35]/70 max-w-2xl mx-auto">
      Choisissez le créneau qui vous convient et réservez votre place en quelques clics.
    </p>
  </header>

  <!-- Liste des cours disponibles -->
  <div id="courses-list" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
    <div class="col-span-full text-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-fluance border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-[#3E3A35]/60">Chargement des cours disponibles...</p>
    </div>
  </div>

  <!-- Informations sur les tarifs -->
  <div class="bg-white rounded-2xl shadow-lg p-8 mb-12">
    <h2 class="text-2xl font-semibold text-fluance mb-6 text-center">Nos formules</h2>
    <div class="grid md:grid-cols-4 gap-6">
      <div class="text-center p-4 rounded-xl border-2 border-green-200 bg-green-50">
        <span class="inline-block bg-green-500 text-white text-xs px-3 py-1 rounded-full mb-3">OFFERT</span>
        <h3 class="font-semibold text-[#3E3A35] mb-1">Cours d'essai</h3>
        <p class="text-2xl font-bold text-green-600 mb-2">Gratuit</p>
        <p class="text-sm text-[#3E3A35]/60">Première séance offerte</p>
      </div>
      <div class="text-center p-4 rounded-xl border-2 border-gray-200">
        <h3 class="font-semibold text-[#3E3A35] mb-1">À la carte</h3>
        <p class="text-2xl font-bold text-fluance mb-2">25 CHF</p>
        <p class="text-sm text-[#3E3A35]/60">Séance unique</p>
      </div>
      <div class="text-center p-4 rounded-xl border-2 border-fluance bg-fluance/5 relative">
        <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-fluance text-white text-xs px-3 py-1 rounded-full">POPULAIRE</span>
        <h3 class="font-semibold text-[#3E3A35] mb-1">Flow Pass</h3>
        <p class="text-2xl font-bold text-fluance mb-2">210 CHF</p>
        <p class="text-sm text-[#3E3A35]/60">10 séances (12 mois)</p>
      </div>
      <div class="text-center p-4 rounded-xl border-2 border-[#E6B84A] bg-[#E6B84A]/5 relative">
        <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E6B84A] text-[#7A1F3D] text-xs px-3 py-1 rounded-full font-semibold">ILLIMITÉ</span>
        <h3 class="font-semibold text-[#3E3A35] mb-1">Pass Semestriel</h3>
        <p class="text-2xl font-bold text-[#E6B84A] mb-2">340 CHF</p>
        <p class="text-sm text-[#3E3A35]/60">Illimité pendant 6 mois</p>
      </div>
    </div>
  </div>

  <!-- Moyens de paiement -->
  <div class="text-center mb-8">
    <p class="text-sm text-[#3E3A35]/60 mb-4">Moyens de paiement acceptés</p>
    <div class="flex flex-wrap items-center justify-center gap-4">
      <img src="{{ '/assets/img/payment-logos/visa.svg' | relativeUrl }}" alt="VISA" class="h-8 object-contain" loading="lazy">
      <img src="{{ '/assets/img/payment-logos/mastercard.svg' | relativeUrl }}" alt="Mastercard" class="h-8 object-contain" loading="lazy">
      <img src="{{ '/assets/img/payment-logos/twint.svg' | relativeUrl }}" alt="TWINT" class="h-8 object-contain" loading="lazy">
      <img src="{{ '/assets/img/payment-logos/apple-pay.svg' | relativeUrl }}" alt="Apple Pay" class="h-8 object-contain" loading="lazy">
      <img src="{{ '/assets/img/payment-logos/google-pay.svg' | relativeUrl }}" alt="Google Pay" class="h-8 object-contain" loading="lazy">
      <span class="text-[#3E3A35]/60 text-sm">ou espèces sur place</span>
    </div>
  </div>
</section>

<!-- Modal de réservation (contenu généré dynamiquement par JavaScript) -->
<div id="booking-modal" class="hidden fixed inset-0 z-50 bg-black/50 items-center justify-center p-4">
  <div class="modal-content bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
    <!-- Le contenu est généré dynamiquement par booking.js -->
  </div>
</div>

<!-- Script de réservation -->
<script src="https://js.stripe.com/v3/"></script>
<script src="{{ '/assets/js/booking.js' | relativeUrl }}"></script>
