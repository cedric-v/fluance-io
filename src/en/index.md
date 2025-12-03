---
layout: base.njk
title: Home
description: Development at the service of entrepreneurs.
locale: en
---

<section id="hero" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 pt-32 pb-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0" style="aspect-ratio: 4/3;">
    {% image "assets/img/fond-cedric.jpg", "Cédric Vonlanthen by the lake", "w-full h-full object-cover", "eager", "high", "1280", "960" %}
    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-[#648ED8]/70 to-[#648ED8]/90"></div>
  </div>
  <div class="relative z-10 max-w-2xl text-white space-y-8">
    <div class="space-y-4">
      <h1 class="text-4xl md:text-6xl font-semibold leading-tight">
        Release tension.<br>
        Free emotional overflow.<br>
        Relax and strengthen your body.
      </h1>
      <p class="text-lg md:text-xl text-white/90">
        Join a transformative movement based on a simple, playful, natural and liberating approach.<br><br>
        No equipment needed.<br>
        No prerequisites.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="{{ '/en/contact/' | relativeUrl }}" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center flex flex-col">
        <span>Try 2 liberating practices</span>
        <span class="text-sm font-normal opacity-90">online</span>
      </a>
      <a href="{{ '/en/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="btn-secondary border-white/80 text-white hover:bg-white/10 text-center flex flex-col">
        <span>Classes in Fribourg (Switzerland)</span>
        <span class="text-sm font-normal opacity-90">in-person</span>
      </a>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-[2fr_1fr] gap-8 items-center">
  <div class="text-left space-y-4">
    <h2 class="text-3xl md:text-4xl font-semibold text-[#0f172a]">What is Fluance?</h2>
    <p class="text-lg md:text-xl text-[#0f172a]/75">
      Fluance is a new approach to your relationship with your body and its tensions.<br><br>
      Through conscious movement and its playful aspect, it gradually rebalances your nervous system, brings mental clarity and provides vitality.
    </p>
  </div>
  <a href="{{ '/en/a-propos/approche-fluance/' | relativeUrl }}" class="section-card overflow-hidden max-w-xs mx-auto md:mx-0 block hover:opacity-90 transition-opacity">
    {% image "assets/img/approche-fluance.png", "Fluance approach diagram", "w-full h-auto object-contain", "lazy", "", "400", "400" %}
  </a>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-12">
  <div class="text-left space-y-4">
    <h3 class="text-2xl md:text-3xl font-semibold text-[#0f172a]">A fluid synthesis of ancestral wisdom</h3>
    <p class="text-lg text-[#0f172a]/75">
       Fluance draws inspiration from the roots of martial arts, Chi Gong, Tai-Chi and Yoga, but frees itself from rigid forms and imposed choreographies.<br /><br />
       Here, discipline gives way to listening: movement becomes organic, intuitive and entirely personalized. It's not about constraining your body into a posture, but letting the movement adapt to your anatomy and your feelings of the moment.
    </p>
  </div>
  <div class="grid md:grid-cols-[1fr_2fr] gap-8 items-center">
    <div class="section-card overflow-hidden max-w-xs mx-auto md:mx-0">
      {% image "assets/img/parcours-fluance.jpg", "Fluance journey", "w-full h-auto object-cover", "lazy", "", "500", "276" %}
    </div>
    <div class="text-left space-y-4">
      <h3 class="text-2xl md:text-3xl font-semibold text-[#0f172a]">Direct access to calm for restless minds</h3>
      <p class="text-lg text-[#0f172a]/75">
        It's often the ideal "back door" for those who find seated meditation difficult or frustrating.<br /><br />
        By going through the body rather than the mind, Fluance short-circuits inner agitation. After just a few practices, surprising results are observed: even without prior experience, it becomes possible to taste a state of deep grounding, absolute presence and calm, where immobility alone had failed.
      </p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-10">
  <div class="text-center space-y-4">
    <h2 class="text-3xl font-semibold text-[#82153e]">What they say</h2>
  </div>
  <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">"It does me so much good!"</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Sylvie Danielle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">"This week the pain really decreased."</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Monique</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">"Your method is so simple and fluid. It's pleasant and you don't feel like you have to make an effort."</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Isabelle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">"I enjoy reconnecting with my body."</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Claire</p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16">
  <div class="text-center space-y-4 mb-12">
    <h2 class="text-3xl font-semibold text-[#82153e]">Join the movement</h2>
  </div>
  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="{{ '/en/contact/' | relativeUrl }}" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center flex flex-col">
      <span>Try 2 liberating practices</span>
      <span class="text-sm font-normal opacity-90">online</span>
    </a>
    <a href="{{ '/en/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="btn-secondary border-[3px] border-[#82153e] text-[#0f172a] bg-gray-50 hover:bg-[#82153e] hover:text-white text-center font-bold shadow-lg flex flex-col">
      <span>Classes in Fribourg (Switzerland)</span>
      <span class="text-sm font-normal opacity-90">in-person</span>
    </a>
  </div>
</section>
