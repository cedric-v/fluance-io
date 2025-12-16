---
layout: base.njk
title: Home
description: "Fluance: release tension, regain fluidity, mobility and serenity through a simple, natural approach based on movement, breath and play."
locale: en
---

<section id="fond-cedric" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 pt-32 pb-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/fond-cedric.jpg", "Cédric Vonlanthen by the lake", "w-full h-full object-cover object-center md:object-right", "eager", "high", "1280", "960" %}
    <div class="absolute inset-0 md:hidden" style="background-color: rgba(100, 142, 216, 0.8);"></div>
    <div class="hidden md:block absolute inset-0" style="background: linear-gradient(to right, transparent, rgba(100, 142, 216, 0.7), rgba(100, 142, 216, 0.9));"></div>
  </div>
  <div class="relative z-10 max-w-2xl text-[#F5F7F6] space-y-8">
    <div class="space-y-4">
      <h1 class="text-4xl md:text-6xl font-semibold leading-tight text-[#F5F7F6]">
        Release tension.<br>
        Free emotional overflow.<br>
        Relax and strengthen your body.
      </h1>
      <p class="text-lg md:text-xl text-[#F5F7F6]">
        Join a transformative movement based on a simple, playful, natural and liberating approach.<br><br>
        No equipment needed.<br>
        No prerequisites.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="{{ '/en/contact/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex flex-col">
        <span>Try 2 liberating practices</span>
        <span class="text-sm font-normal opacity-90">online</span>
      </a>
      <a href="{{ '/en/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="btn-secondary border-[3px] border-[#F5F7F6] bg-[#7A1F3D]/80 text-[#F5F7F6] hover:bg-[#7A1F3D]/90 text-center flex flex-col">
        <span>Classes in Fribourg (Switzerland)</span>
        <span class="text-sm font-normal opacity-90">in-person</span>
      </a>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-[2fr_1fr] gap-8 items-center">
  <div class="text-left space-y-4">
    <h2 class="text-3xl md:text-4xl font-semibold text-[#3E3A35]">What is Fluance?</h2>
    <p class="text-lg md:text-xl text-[#3E3A35]">
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
    <h3 class="text-2xl md:text-3xl font-semibold text-[#3E3A35]">A fluid synthesis of ancestral wisdom</h3>
    <p class="text-lg text-[#3E3A35]">
       Fluance draws inspiration from the roots of martial arts, Chi Gong, Tai-Chi and Yoga, but frees itself from rigid forms and imposed choreographies.<br /><br />
       Here, discipline gives way to listening: movement becomes organic, intuitive and entirely personalized. It's not about constraining your body into a posture, but letting the movement adapt to your anatomy and your feelings of the moment.
    </p>
  </div>
  <div class="grid md:grid-cols-[1fr_2fr] gap-8 items-center">
    <div class="section-card overflow-hidden max-w-xs mx-auto md:mx-0" style="aspect-ratio: 500/276;">
      {% image "assets/img/parcours-fluance.jpg", "Fluance journey", "w-full h-full object-cover", "lazy", "", "500", "276" %}
    </div>
    <div class="text-left space-y-4">
      <h3 class="text-2xl md:text-3xl font-semibold text-[#3E3A35]">Direct access to calm for restless minds</h3>
      <p class="text-lg text-[#3E3A35]">
        It's often the ideal "back door" for those who find seated meditation difficult or frustrating.<br /><br />
        By going through the body rather than the mind, Fluance short-circuits inner agitation. After just a few practices, surprising results are observed: even without prior experience, it becomes possible to taste a state of deep grounding, absolute presence and calm, where immobility alone had failed.
      </p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-10">
  <div class="text-center space-y-4">
    <h2 class="text-3xl font-semibold text-fluance">What they say</h2>
  </div>
  <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="quote-card">
      <p class="italic text-[#3E3A35]">"It does me <strong>so much good</strong>!"</p>
      <p class="text-sm text-[#3E3A35]/60 mt-2">— Sylvie Danielle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#3E3A35]">"This week the <strong>pain really decreased</strong>."</p>
      <p class="text-sm text-[#3E3A35]/60 mt-2">— Monique</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#3E3A35]">"Your method is so simple and fluid. It's <strong>pleasant</strong> and you <strong>don't feel like you have to make an effort</strong>."</p>
      <p class="text-sm text-[#3E3A35]/60 mt-2">— Isabelle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#3E3A35]">"I <strong>enjoy</strong> <strong>reconnecting with my body</strong>."</p>
      <p class="text-sm text-[#3E3A35]/60 mt-2">— Claire</p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16">
  <div class="text-center space-y-4 mb-12">
    <h2 class="text-3xl font-semibold text-fluance">Join the movement</h2>
  </div>
  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="{{ '/en/contact/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex flex-col">
      <span>Try 2 liberating practices</span>
      <span class="text-sm font-normal opacity-90">online</span>
    </a>
    <a href="{{ '/en/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="btn-secondary border-[3px] border-fluance text-[#3E3A35] bg-gray-50 hover:bg-fluance hover:text-[#F5F7F6] text-center font-bold shadow-lg flex flex-col">
      <span>Classes in Fribourg (Switzerland)</span>
      <span class="text-sm font-normal opacity-90">in-person</span>
    </a>
  </div>
</section>
