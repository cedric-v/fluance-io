---
layout: base.njk
title: Accueil
ogTitle: "Libérez votre corps des tensions grâce au mouvement"
description: "Fluance : libérez votre corps des tensions et retrouvez fluidité, mobilité et sérénité. Approche simple basée sur le mouvement, le souffle et le jeu."
locale: fr
permalink: /fr/
ogImage: assets/img/accueil-miniature-FR.jpg
---

<section id="fond-cedric" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 pt-32 pb-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/fond-cedric.jpg", "Cédric Vonlanthen au bord du lac", "w-full h-full object-cover object-center md:object-right", "eager", "high", "1280", "960" %}
    <div class="absolute inset-0 md:hidden" style="background-color: rgba(100, 142, 216, 0.8);"></div>
    <div class="hidden md:block absolute inset-0" style="background: linear-gradient(to right, transparent, rgba(100, 142, 216, 0.7), rgba(100, 142, 216, 0.9));"></div>
  </div>
  <div class="relative z-10 max-w-2xl text-[#F5F7F6] space-y-8">
    <div class="space-y-4">
      <h1 class="text-4xl md:text-6xl font-semibold leading-tight text-[#F5F7F6]">
        Relâcher les tensions.<br>
        Libérer le trop-plein émotionnel.<br>
        Détendre et fortifier votre corps.
      </h1>
      <p class="text-lg md:text-xl text-[#F5F7F6]">
        Rejoignez un mouvement transformateur basé sur une approche simple, ludique, naturelle et libératrice.<br><br>
        Aucun équipement nécessaire.<br>
        Aucun prérequis.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="javascript://" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex flex-col" data-w-token="9241cb136525ee5e376e">
        <span>Essayer 2 pratiques libératrices</span>
        <span class="text-sm font-normal opacity-90">en ligne</span>
      </a>
      <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="btn-secondary border-[3px] border-[#F5F7F6] bg-[#7A1F3D]/80 text-[#F5F7F6] hover:bg-[#7A1F3D]/90 text-center flex flex-col">
        <span>Cours en présentiel, région Fribourg</span>
        <span class="text-sm font-normal opacity-90">(Suisse)</span>
      </a>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-[2fr_1fr] gap-8 items-center">
  <div class="text-left space-y-4">
    <h2 class="text-3xl md:text-4xl font-semibold text-[#3E3A35]">Qu'est-ce que Fluance ?</h2>
    <p class="text-lg md:text-xl text-[#3E3A35]">
      Fluance est une approche nouvelle du lien au corps et ses tensions.<br><br>
      Grâce à des mouvements en conscience et son aspect ludique, elle rééquilibre progressivement votre système nerveux, amène de la clarté mentale et procure de la vitalité.
    </p>
  </div>
  <a href="{{ '/a-propos/approche-fluance/' | relativeUrl }}" class="section-card overflow-hidden max-w-xs mx-auto md:mx-0 block hover:opacity-90 transition-opacity">
    {% image "assets/img/approche-fluance.png", "Schéma de l'approche Fluance", "w-full h-auto object-contain", "lazy", "", "400", "400" %}
  </a>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-12">
  <div class="text-left space-y-4">
    <h3 class="text-2xl md:text-3xl font-semibold text-[#3E3A35]">Une synthèse fluide des sagesses ancestrales</h3>
    <p class="text-lg text-[#3E3A35]">
       Fluance puise son inspiration aux racines des arts martiaux, du Chi Gong, du Tai-Chi et du Yoga, mais s'affranchit des formes rigides et des chorégraphies imposées.<br /><br />
       Ici, la discipline s'efface au profit de l'écoute : le mouvement devient organique, intuitif et entièrement personnalisé. Il ne s'agit pas de contraindre votre corps dans une posture, mais de laisser le mouvement s'adapter à votre anatomie et à vos ressentis de l'instant.
    </p>
  </div>
  <div class="grid md:grid-cols-[1fr_2fr] gap-8 items-center">
    <div class="section-card overflow-hidden max-w-xs mx-auto md:mx-0" style="aspect-ratio: 500/276;">
      {% image "assets/img/parcours-fluance.jpg", "Parcours Fluance", "w-full h-full object-cover", "lazy", "", "500", "276" %}
    </div>
    <div class="text-left space-y-4">
      <h3 class="text-2xl md:text-3xl font-semibold text-[#3E3A35]">L'accès direct au calme pour les esprits agités</h3>
      <p class="text-lg text-[#3E3A35]">
        Cette approche somatique est souvent la "porte dérobée" idéale pour ceux qui trouvent la méditation assise difficile ou frustrante.<br /><br />
        En passant par le corps plutôt que par le mental, Fluance court-circuite l'agitation intérieure. Après seulement quelques pratiques, on constate des résultats surprenants : même sans expérience préalable, il devient possible de goûter à un état d'ancrage profond, de présence absolue et de calme, là où l'immobilité seule avait échoué.
      </p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-10">
  <div class="text-center space-y-4">
    <h2 class="text-3xl font-semibold text-fluance">Ce qu'ils en disent</h2>
  </div>
  <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="quote-card">
      <p class="italic text-[#3E3A35]">« Cela me fait <strong>un bien fou</strong> ! »</p>
      <p class="text-sm text-[#3E3A35]/60 mt-2">— Sylvie Danielle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#3E3A35]">« Cette semaine les <strong>douleurs ont vraiment diminué</strong>. »</p>
      <p class="text-sm text-[#3E3A35]/60 mt-2">— Monique</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#3E3A35]">"Ta méthode est tellement simple et fluide. C'est <strong>agréable</strong> et on n'a <strong>pas le sentiment d'avoir un effort à faire</strong>."</p>
      <p class="text-sm text-[#3E3A35]/60 mt-2">— Isabelle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#3E3A35]">"J'ai du <strong>plaisir</strong> à <strong>recontacter mon corps</strong>."</p>
      <p class="text-sm text-[#3E3A35]/60 mt-2">— Claire</p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16">
  <div class="text-center space-y-4 mb-12">
    <h2 class="text-3xl font-semibold text-fluance">Rejoignez le mouvement</h2>
  </div>
  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="javascript://" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex flex-col" data-w-token="9241cb136525ee5e376e">
      <span>Essayer 2 pratiques libératrices</span>
      <span class="text-sm font-normal opacity-90">en ligne</span>
    </a>
    <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="inline-flex flex-col items-center justify-center rounded-full border-[3px] border-fluance text-fluance bg-[#F5F7F6]/30 hover:bg-fluance hover:text-[#F5F7F6] px-6 py-3 font-bold shadow-lg transition-all duration-200">
      <span>Cours en présentiel, région Fribourg</span>
      <span class="text-sm font-normal opacity-90">(Suisse)</span>
    </a>
  </div>
</section>

{% include "newsletter-popup.njk" %}