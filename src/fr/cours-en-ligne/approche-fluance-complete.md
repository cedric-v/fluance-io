---
layout: base.njk
title: Approche Fluance complète et régulière
description: Programme complet et régulier pour intégrer l'approche Fluance dans votre vie.
locale: fr
permalink: /cours-en-ligne/approche-fluance-complete/
ogImage: assets/img/cedric-bord-mer.jpg
---

<section id="hero" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 pt-32 pb-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/cedric-bord-mer.jpg", "Cédric au bord de la mer", "w-full h-full object-cover" %}
    <div class="absolute inset-0 bg-linear-to-r from-transparent via-[#648ED8]/70 to-[#648ED8]/90 md:via-[#648ED8]/70 md:to-[#648ED8]/90"></div>
    <div class="absolute inset-0 bg-black/30 md:bg-transparent"></div>
  </div>
  <div class="relative z-10 max-w-2xl text-white space-y-8">
    <div class="space-y-4">
      <h1 class="text-3xl md:text-5xl font-semibold leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] md:drop-shadow-none">
        Augmentez votre énergie<br />
        Diminuez les tensions<br />
        Restez joyeux et en pleine forme<br />
      </h1>
      <p class="text-lg md:text-xl text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] md:drop-shadow-none">
        en seulement 2 à 5 minutes par jour, grâce à un élan continu et fluide vers vous-même.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="#choisissez-votre-abonnement" class="btn-primary inline-flex items-center gap-2 text-center text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d]">
        <span>Découvrir les 2 formules</span>
        <span>→</span>
      </a>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-12">
  <div class="bg-white rounded-lg p-8 shadow-lg">
    <h2 class="text-2xl font-semibold text-fluance mb-6">Ce que vous recevez en rejoignant :</h2>
    <ul class="space-y-4 text-lg text-[#0f172a]/90">
      <li class="flex items-start gap-3">
        <span class="text-fluance text-xl">✅</span>
        <span><strong>chaque semaine</strong>, <strong>une nouvelle mini-série de 2 à 5 minutes</strong>, en vidéo, pour vous <strong>redonner l'élan</strong> et <strong>améliorer le rapport à votre corps et à vos ressentis</strong></span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-fluance text-xl">✅</span>
        <span>la <strong>communauté motivante</strong> et de <strong>soutien</strong></span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-fluance text-xl">✅</span>
        <span>Accès à la <strong>bibliothèque des séries passées</strong>, pour <strong>pratiquer différemment, depuis chez vous,</strong> quand vous le souhaitez et vous donner de l'<strong>inspiration</strong></span>
      </li>
      <li class="flex items-start gap-3 mt-6">
        <span class="text-yellow-500 text-xl">⭐</span>
        <span><strong>Bonus 1 :</strong> <strong>remises</strong> sur les séminaires et ateliers présentiels</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="text-yellow-500 text-xl">⭐</span>
        <span><strong>Bonus 2 :</strong> pratique guidée exclusive pour vous <strong>détendre</strong>, vous <strong>ancrer</strong> et <strong>retrouver plus de clarté en moins de 5 minutes</strong>.</span>
      </li>
    </ul>
  </div>
</section>

<section id="choisissez-votre-abonnement" class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-8" style="scroll-margin-top: 100px;">
  <div class="text-center space-y-4 mb-12">
    <h2 class="text-3xl font-semibold text-fluance">Choisissez votre abonnement</h2>
    <p class="text-lg text-[#0f172a]/80">Deux options <strong>flexibles</strong> pour <strong>intégrer Fluance dans votre quotidien</strong></p>
  </div>

  <div class="flex flex-col md:flex-row gap-8">
    <!-- Option 1: Mensuel -->
    <div class="section-card p-8 bg-white border-2 border-fluance/20 hover:border-fluance/40 transition-all flex-1">
      <div class="space-y-4">
        <div class="text-center">
          <h3 class="text-2xl font-semibold text-fluance mb-2">Formule mensuelle</h3>
          <p class="text-3xl font-bold text-fluance">30 CHF</p>
          <p class="text-lg text-[#0f172a]/80">/ équivalent € par mois</p>
        </div>
        <div class="pt-4 border-t border-fluance/20">
          <p class="text-lg text-[#0f172a]/80 text-center mb-6">
            <strong class="text-fluance">Les 14 premiers jours sont offerts</strong>
          </p>
          <button onclick="window.FluancePayment.redirectToStripe('complet', 'mensuel', 'fr', event)" class="btn-primary w-full inline-flex items-center justify-center gap-2 text-center text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] mb-6">
            <span>S'abonner mensuellement</span>
            <span>→</span>
          </button>
          <p class="text-sm text-[#0f172a]/70 text-center mt-2">
            Résiliable à tout moment avec un simple e-mail à <a href="#" id="cancel-email-link-1" class="text-fluance hover:underline"></a>
          </p>
        </div>
      </div>
    </div>

    <!-- Option 2: Trimestriel -->
    <div class="section-card p-8 bg-white border-2 border-fluance hover:border-fluance/80 transition-all flex-1 relative">
      <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
        <span class="bg-fluance text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">La plus populaire</span>
      </div>
      <div class="space-y-4 pt-6">
        <div class="text-center">
          <h3 class="text-2xl font-semibold text-fluance mb-2">Formule trimestrielle</h3>
          <p class="text-3xl font-bold text-fluance">25 CHF</p>
          <p class="text-lg text-[#0f172a]/80">/ équivalent € par mois</p>
          <p class="text-sm text-[#0f172a]/60 mt-2">Réglé chaque trimestre (75 CHF / trimestre)</p>
        </div>
        <div class="pt-4 border-t border-fluance/20">
          <p class="text-lg text-[#0f172a]/80 text-center mb-6">
            <strong class="text-fluance">Les 14 premiers jours sont offerts</strong>
          </p>
          <button onclick="window.FluancePayment.redirectToStripe('complet', 'trimestriel', 'fr', event)" class="btn-primary w-full inline-flex items-center justify-center gap-2 text-center text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] mb-6">
            <span>S'abonner trimestriellement</span>
            <span>→</span>
          </button>
          <p class="text-sm text-[#0f172a]/70 text-center mt-2">
            Résiliable à tout moment avec un simple e-mail à <a href="#" id="cancel-email-link-2" class="text-fluance hover:underline"></a>
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
    const emailLink1 = document.getElementById('cancel-email-link-1');
    const emailLink2 = document.getElementById('cancel-email-link-2');
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
