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

  <!-- Email de confirmation -->
  <div class="bg-white rounded-2xl shadow-lg p-8 space-y-4 text-center">
    <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-fluance/10">
      <span class="text-3xl">📧</span>
    </div>
    <h2 class="text-2xl font-semibold text-[#3E3A35]">Consultez votre email de confirmation</h2>
    <p class="text-[#3E3A35]/80 max-w-xl mx-auto">
      Vous avez reçu un email contenant toutes les informations pratiques pour votre cours :
    </p>
    <ul class="text-[#3E3A35]/70 space-y-2 max-w-md mx-auto text-left">
      <li class="flex items-center gap-2">
        <span class="text-fluance">📅</span>
        <span>Date et horaire du cours</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">📍</span>
        <span>Adresse et lien Google Maps</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">🚌</span>
        <span>Transports en commun</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">🚗</span>
        <span>Informations de parking</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">➕</span>
        <span>Lien pour ajouter le cours à votre calendrier</span>
      </li>
    </ul>
    <p class="text-[#3E3A35]/60 text-sm pt-4">
      Pensez à vérifier vos spams si vous ne trouvez pas l'email.
    </p>
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
        <span>Prévoyez une tenue confortable permettant le mouvement</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-fluance">✓</span>
        <span>En cas d'empêchement, pensez à annuler votre réservation via Momoyoga</span>
      </li>
    </ul>
  </div>

  <!-- Cours en ligne complémentaires -->
  <div class="bg-gradient-to-r from-fluance/10 to-[#E6B84A]/10 rounded-2xl p-8 space-y-4">
    <div class="text-center">
      <span class="text-3xl">💻</span>
      <h2 class="text-xl font-semibold text-[#3E3A35] mt-2">En attendant, complétez votre pratique avec les cours en ligne</h2>
      <p class="text-[#3E3A35]/70 mt-2">
        Entre deux séances en présentiel, continuez à pratiquer chez vous à votre rythme.
      </p>
    </div>
    <div class="grid sm:grid-cols-2 gap-4 mt-4">
      <a href="{{ '/cours-en-ligne/21-jours-mouvement/' | relativeUrl }}" class="block bg-white rounded-xl p-4 shadow hover:shadow-md transition-shadow">
        <h3 class="font-semibold text-fluance">21 jours pour remettre du mouvement</h3>
        <p class="text-sm text-[#3E3A35]/70 mt-1">Programme de 2 à 5 minutes par jour pour un regain rapide de fluidité</p>
        <span class="text-fluance text-sm mt-2 inline-flex items-center gap-1">
          Découvrir →
        </span>
      </a>
      <a href="{{ '/cours-en-ligne/approche-fluance-complete/' | relativeUrl }}" class="block bg-white rounded-xl p-4 shadow hover:shadow-md transition-shadow">
        <h3 class="font-semibold text-fluance">Du nouveau chaque semaine</h3>
        <p class="text-sm text-[#3E3A35]/70 mt-1">Une nouvelle mini-série chaque semaine, à réaliser depuis chez vous + accès illimité à toutes les pratiques passées, pour une transformation durable</p>
        <span class="text-fluance text-sm mt-2 inline-flex items-center gap-1">
          En savoir plus →
        </span>
      </a>
    </div>
  </div>

  <!-- Réseaux sociaux -->
  <div class="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
    <h2 class="text-xl font-semibold text-[#3E3A35]">Retrouvez Fluance sur les réseaux sociaux</h2>
    <div class="flex justify-center gap-6">
      <a href="https://www.youtube.com/@fluanceio" target="_blank" rel="noopener noreferrer" aria-label="YouTube Fluance" class="hover:opacity-70 transition-opacity">
        <svg class="w-10 h-10 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      </a>
      <a href="https://www.instagram.com/fluanceio/" target="_blank" rel="noopener noreferrer" aria-label="Instagram Fluance" class="hover:opacity-70 transition-opacity">
        <svg class="w-10 h-10 text-[#E4405F]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      </a>
      <a href="https://www.facebook.com/Fluanceio/" target="_blank" rel="noopener noreferrer" aria-label="Facebook Fluance" class="hover:opacity-70 transition-opacity">
        <svg class="w-10 h-10 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      </a>
      <a href="https://www.linkedin.com/company/fluance-consulting/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Fluance" class="hover:opacity-70 transition-opacity">
        <svg class="w-10 h-10 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </a>
    </div>
  </div>

  <!-- Partager avec des amis -->
  <div class="bg-fluance/5 rounded-2xl p-8 text-center space-y-4">
    <span class="text-3xl">👥</span>
    <h2 class="text-xl font-semibold text-[#3E3A35]">Vous aimeriez partager ce moment avec quelqu'un ?</h2>
    <p class="text-[#3E3A35]/70 max-w-lg mx-auto">
      Transmettez le lien vers les cours à un(e) ami(e) pour qu'il/elle découvre Fluance et puisse s'inscrire aussi !
    </p>
    <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="inline-flex items-center gap-2 text-fluance font-semibold hover:underline">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
      </svg>
      Copier le lien à partager →
    </a>
    <p class="text-sm text-[#3E3A35]/50">fluance.io/presentiel/cours-hebdomadaires/</p>
  </div>

  <!-- CTA -->
  <div class="text-center space-y-4">
    <p class="text-lg text-[#3E3A35]/70">À très bientôt en cours !</p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="{{ '/presentiel/reserver/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold rounded-full shadow-lg transition-all hover:shadow-xl">
        <span>Voir les autres cours</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
        </svg>
      </a>
      <a href="{{ '/' | relativeUrl }}" class="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-full border-2 border-fluance text-fluance bg-white hover:bg-fluance hover:text-white transition-all shadow-lg hover:shadow-xl">
        Retour à l'accueil
      </a>
    </div>
  </div>
</section>
