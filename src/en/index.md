---
layout: base.njk
title: Home
description: Development at the service of entrepreneurs.
locale: en
---

<section id="hero" class="relative min-h-[70vh] flex items-center justify-end max-w-7xl mx-auto px-6 md:px-12 py-20 mt-4 rounded-[32px] overflow-hidden">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/hero-cedric.jpg", "Cédric Vonlanthen by the lake", "w-full h-full object-cover" %}
    <div class="absolute inset-0 bg-gradient-to-r from-[#82153e]/90 via-[#82153e]/70 to-transparent"></div>
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
        No equipment needed.<br><br>
        No prerequisites.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="{{ '/#contact' | url }}" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center">
        Try 2 liberating practices
      </a>
      <a href="{{ '/cours-en-ligne/30-jours-mouvement/' | url }}" class="btn-secondary border-white/80 text-white hover:bg-white/10 text-center">
        30-day challenge to get moving
      </a>
    </div>
  </div>
</section>

<section id="chemins" class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-10">
  <div class="text-center space-y-4">
    <p class="cta-pill bg-[#ffce2d]/20 text-[#82153e] mx-auto">Liberating approach</p>
    <h2 class="text-3xl font-semibold text-[#82153e]">Soothe the body, clarify the mind</h2>
    <p class="text-lg text-[#0f172a]/70">Fluance guides individuals out of tension, fog, and overload so they can move with ease.</p>
  </div>
  <div class="max-w-2xl mx-auto">
    <article id="presentiel" class="section-card p-8 space-y-5 bg-white">
      <p class="text-sm font-semibold text-[#82153e] uppercase">Individuals</p>
      <h3 class="text-2xl font-semibold text-[#0f172a]">A supple body & serene mind</h3>
      <p class="text-[#0f172a]/75">Short, effective practices to release tension, free your breathing, and reinstall calm throughout the day.</p>
      <div class="space-y-4">
        <div class="quote-card">
          <p class="italic text-[#0f172a]/80">“It does me so much good!”</p>
          <p class="text-sm text-[#0f172a]/60 mt-2">— Sylvie Danielle</p>
        </div>
        <div class="quote-card">
          <p class="italic text-[#0f172a]/80">“This week the pain really decreased.”</p>
          <p class="text-sm text-[#0f172a]/60 mt-2">— Monique</p>
        </div>
      </div>
      <a href="#contact" class="btn-primary inline-flex items-center justify-center">Receive the practices</a>
    </article>
  </div>
</section>

<section id="approche" class="max-w-6xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-2 gap-12 items-center">
  <div class="space-y-6">
    <p class="cta-pill bg-[#82153e]/10 text-[#82153e]">Holistic approach</p>
    <h2 class="text-3xl font-semibold text-[#0f172a]">Fluidity in body & mind</h2>
    <p class="text-lg text-[#0f172a]/75">Fluance blends movement, breath, meditation, and strategic guidance to reinstall coherence in both personal and professional life.</p>
    <ul class="space-y-4 text-[#0f172a]/80">
      <li class="flex gap-3">
        <span class="w-2 h-2 mt-2 rounded-full bg-[#ffce2d]"></span>
        Reconnect the body to release mental overload and listen to intuition.
      </li>
      <li class="flex gap-3">
        <span class="w-2 h-2 mt-2 rounded-full bg-[#ffce2d]"></span>
        Clarify priorities and restore coherence in your choices.
      </li>
      <li class="flex gap-3">
        <span class="w-2 h-2 mt-2 rounded-full bg-[#ffce2d]"></span>
        Move forward with simple, repeatable practices that bring fluidity.
      </li>
    </ul>
  </div>
  <div class="section-card overflow-hidden">
    {% image "assets/img/parcours-fluance.jpg", "Fluance practice", "w-full h-full object-cover" %}
  </div>
</section>

<section id="founder" class="max-w-5xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-2 gap-10">
  <div class="space-y-4">
    <p class="cta-pill bg-[#8bc34a]/20 text-[#0f172a]">Meet the founder</p>
    <h2 class="text-3xl font-semibold text-[#82153e]">Cédric Vonlanthen</h2>
    <p class="text-[#0f172a]/75">Founder of Fluance, entrepreneur coach, husband, and father of two. After 10 years in the tech industry as developer, product manager, and project manager, Cédric retrained as a meditation teacher to bring more meaning and transmit the fluidity he experienced.</p>
    <p class="text-[#0f172a]/75">Instants Zen Sàrl has delivered tens of thousands of programs in 35+ countries, fueled by 541 webinars.</p>
    <div class="flex flex-wrap gap-4">
      <a href="#contact" class="btn-primary">Get in touch</a>
      <a href="tel:+33972133388" class="btn-secondary text-[#82153e] border-[#82153e]">+33 (0)9 72 13 33 88</a>
    </div>
  </div>
  <div class="section-card p-8 space-y-6 bg-white">
    <h3 class="text-xl font-semibold text-[#0f172a]">What you’ll feel</h3>
    <ul class="space-y-4 text-[#0f172a]/80">
      <li>• A calmer mind that makes space for intuition.</li>
      <li>• A supple body that absorbs less tension daily.</li>
      <li>• Decisions taken with clarity, coherence, and flow.</li>
    </ul>
  </div>
</section>

<section id="contact" class="max-w-5xl mx-auto px-6 md:px-12 py-16 text-center space-y-6">
  <p class="cta-pill mx-auto bg-[#ffce2d]/30 text-[#0f172a]">Ready to lighten your load?</p>
  <h2 class="text-3xl font-semibold text-[#0f172a]">Choose the Fluance path that fits you</h2>
  <p class="text-lg text-[#0f172a]/70 max-w-3xl mx-auto">Fill out the form, receive the complimentary practices or the ideal-day exercise, and let’s bring fluidity back into your everyday life.</p>
  <div class="flex flex-col md:flex-row gap-4 justify-center">
    <a href="mailto:contact@fluance.io" class="btn-primary inline-flex justify-center">Send a message</a>
    <a href="https://fluance.io/#form" target="_blank" rel="noreferrer" class="btn-secondary inline-flex justify-center border-[#0f172a] text-[#0f172a]">Open the form</a>
  </div>
</section>


