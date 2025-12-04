---
layout: base.njk
title: Complete and Regular Fluance Approach
description: Complete and regular program to integrate the Fluance approach into your life.
locale: en
permalink: /en/cours-en-ligne/approche-fluance-complete/
ogImage: assets/img/cedric-bord-mer.jpg
---

<section id="hero" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 pt-32 pb-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/cedric-bord-mer.jpg", "Cédric by the sea", "w-full h-full object-cover" %}
    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-[#648ED8]/70 to-[#648ED8]/90"></div>
  </div>
  <div class="relative z-10 max-w-2xl text-white space-y-8">
    <div class="space-y-4">
      <h1 class="text-3xl md:text-5xl font-semibold leading-relaxed">
        Increase your energy<br />
        Reduce tension<br />
        Stay joyful and in great shape<br />
      </h1>
      <p class="text-lg md:text-xl text-white/90">
        in just 2 to 5 minutes a day, thanks to a continuous and fluid momentum towards yourself.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="#choose-your-subscription" class="btn-primary inline-flex items-center gap-2 text-center text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d]">
        <span>Discover the 2 options</span>
        <span>→</span>
      </a>
    </div>
  </div>
</section>

<section id="choose-your-subscription" class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-8" style="scroll-margin-top: 100px;">
  <div class="text-center space-y-4 mb-12">
    <h2 class="text-3xl font-semibold text-[#82153e]">Choose your subscription</h2>
    <p class="text-lg text-[#0f172a]/80">Two flexible options to integrate Fluance into your daily life</p>
  </div>

  <div class="flex flex-col md:flex-row gap-8">
    <!-- Option 1: Monthly -->
    <div class="section-card p-8 bg-white border-2 border-[#82153e]/20 hover:border-[#82153e]/40 transition-all flex-1">
      <div class="space-y-4">
        <div class="text-center">
          <h3 class="text-2xl font-semibold text-[#82153e] mb-2">Monthly plan</h3>
          <p class="text-3xl font-bold text-[#82153e]">30 CHF</p>
          <p class="text-lg text-[#0f172a]/80">/ equivalent € per month</p>
        </div>
        <div class="pt-4 border-t border-[#82153e]/20">
          <p class="text-lg text-[#0f172a]/80 text-center mb-6">
            <strong class="text-[#82153e]">The first 14 days are free</strong>
          </p>
          <a href="https://espace.fluance.io/par/abo/bdc/mens" class="btn-primary w-full inline-flex items-center justify-center gap-2 text-center text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] mb-6">
            <span>Subscribe monthly</span>
            <span>→</span>
          </a>
          <p class="text-sm text-[#0f172a]/70 text-center mt-2">
            Cancelable at any time with a simple email to <a href="#" id="cancel-email-link-en-1" class="text-[#82153e] hover:underline"></a>
          </p>
        </div>
      </div>
    </div>

    <!-- Option 2: Quarterly -->
    <div class="section-card p-8 bg-white border-2 border-[#82153e] hover:border-[#82153e]/80 transition-all flex-1 relative">
      <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
        <span class="bg-[#82153e] text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">Most popular</span>
      </div>
      <div class="space-y-4 pt-6">
        <div class="text-center">
          <h3 class="text-2xl font-semibold text-[#82153e] mb-2">Quarterly plan</h3>
          <p class="text-3xl font-bold text-[#82153e]">25 CHF</p>
          <p class="text-lg text-[#0f172a]/80">/ equivalent € per month</p>
          <p class="text-sm text-[#0f172a]/60 mt-2">Paid quarterly (75 CHF / quarter)</p>
        </div>
        <div class="pt-4 border-t border-[#82153e]/20">
          <p class="text-lg text-[#0f172a]/80 text-center mb-6">
            <strong class="text-[#82153e]">The first 14 days are free</strong>
          </p>
          <a href="https://espace.fluance.io/par/abo/bdc/tri" class="btn-primary w-full inline-flex items-center justify-center gap-2 text-center text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] mb-6">
            <span>Subscribe quarterly</span>
            <span>→</span>
          </a>
          <p class="text-sm text-[#0f172a]/70 text-center mt-2">
            Cancelable at any time with a simple email to <a href="#" id="cancel-email-link-en-2" class="text-[#82153e] hover:underline"></a>
          </p>
        </div>
      </div>
    </div>
  </div>
</section>

<script>
  // Protection anti-spam : construction dynamique de l'email
  (function() {
    const emailParts = ['support', 'fluance', 'io'];
    const email = emailParts[0] + '@' + emailParts[1] + '.' + emailParts[2];
    const emailLink1 = document.getElementById('cancel-email-link-en-1');
    const emailLink2 = document.getElementById('cancel-email-link-en-2');
    if (emailLink1) {
      emailLink1.href = 'mailto:' + email;
      emailLink1.textContent = email;
    }
    if (emailLink2) {
      emailLink2.href = 'mailto:' + email;
      emailLink2.textContent = email;
    }
  })();
</script>
