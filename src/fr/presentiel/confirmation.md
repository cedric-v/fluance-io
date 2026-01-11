---
layout: base.njk
title: Inscription confirmée - Cours en présentiel
description: "Votre inscription aux cours Fluance en présentiel est confirmée."
locale: fr
permalink: /presentiel/confirmation/
eleventyExcludeFromCollections: true
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <div class="text-center space-y-6">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
      <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1 class="text-4xl font-semibold text-[#3E3A35]">Inscription confirmée !</h1>
    <p class="text-xl text-[#3E3A35]">
      Merci d'avoir confirmé votre inscription aux cours Fluance en présentiel.
    </p>
    <p class="text-lg text-[#3E3A35]/70">
      Vous recevrez désormais les informations importantes concernant vos prochains cours 
      (rappels, changements éventuels, conseils pratiques).
    </p>
  </div>

  <!-- Informations pratiques -->
  <div class="bg-white rounded-2xl shadow-lg p-8 space-y-6">
    <h2 class="text-2xl font-semibold text-[#3E3A35] text-center">Informations pratiques</h2>
    
    <div class="grid md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <div class="flex items-start gap-3">
          <span class="text-2xl">📍</span>
          <div>
            <h3 class="font-semibold text-[#3E3A35]">Lieu</h3>
            <p class="text-[#3E3A35]/80">le duplex danse & bien-être</p>
            <p class="text-[#3E3A35]/60 text-sm">Rte de Chantemerle 58d, 1763 Granges-Paccot</p>
            <a href="https://maps.app.goo.gl/8V2vg6XWoTqJc5Bw6" target="_blank" rel="noopener noreferrer" class="text-fluance text-sm hover:underline">
              Voir sur Google Maps →
            </a>
          </div>
        </div>
        
        <div class="flex items-start gap-3">
          <span class="text-2xl">🕐</span>
          <div>
            <h3 class="font-semibold text-[#3E3A35]">Horaire</h3>
            <p class="text-[#3E3A35]/80">Jeudis de 20h15 à 21h00</p>
            <p class="text-[#3E3A35]/60 text-sm">Merci d'arriver 5 minutes avant le début</p>
          </div>
        </div>
      </div>
      
      <div class="space-y-4">
        <div class="flex items-start gap-3">
          <span class="text-2xl">🚗</span>
          <div>
            <h3 class="font-semibold text-[#3E3A35]">Parking</h3>
            <p class="text-[#3E3A35]/80">Places gratuites autour du bâtiment</p>
            <p class="text-[#3E3A35]/60 text-sm">Zone bleue : stationnement interdit</p>
          </div>
        </div>
        
        <div class="flex items-start gap-3">
          <span class="text-2xl">👕</span>
          <div>
            <h3 class="font-semibold text-[#3E3A35]">Tenue</h3>
            <p class="text-[#3E3A35]/80">Vêtements confortables</p>
            <p class="text-[#3E3A35]/60 text-sm">Permettant le mouvement libre</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Ce qu'il faut savoir -->
  <div class="bg-fluance/5 rounded-2xl p-8 space-y-4">
    <h2 class="text-2xl font-semibold text-[#3E3A35] text-center">Ce qu'il faut savoir</h2>
    <ul class="space-y-3 text-[#3E3A35]/80">
      <li class="flex items-start gap-2">
        <span class="text-fluance">✓</span>
        <span>Les cours sont accessibles à tous, quel que soit votre niveau de forme physique</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-fluance">✓</span>
        <span>Chaque séance est autonome : vous pouvez venir quand vous le souhaitez</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-fluance">✓</span>
        <span>L'eau est fournie sur place, mais vous pouvez apporter votre propre bouteille</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-fluance">✓</span>
        <span>En cas d'empêchement, pensez à annuler votre réservation via Momoyoga</span>
      </li>
    </ul>
  </div>

  <!-- CTA -->
  <div class="text-center space-y-4">
    <p class="text-lg text-[#3E3A35]/70">À très bientôt en cours !</p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold rounded-md shadow-lg transition-all hover:shadow-xl">
        <span>Voir les cours hebdomadaires</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
        </svg>
      </a>
      <a href="{{ '/' | relativeUrl }}" class="btn-secondary border-fluance text-fluance hover:bg-fluance hover:text-[#F5F7F6] inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-md transition-all">
        Retour à l'accueil
      </a>
    </div>
  </div>
</section>
