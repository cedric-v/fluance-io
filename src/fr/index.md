---
layout: base.njk
title: Accueil
description: Le développement au service des entrepreneurs.
locale: fr
---

<section id="fond-cedric" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 pt-32 pb-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/fond-cedric.jpg", "Cédric Vonlanthen au bord du lac", "w-full h-full object-cover object-center md:object-right", "eager", "high", "1280", "960" %}
    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-[#648ED8]/70 to-[#648ED8]/90"></div>
  </div>
  <div class="relative z-10 max-w-2xl text-white space-y-8">
    <div class="space-y-4">
      <h1 class="text-4xl md:text-6xl font-semibold leading-tight">
        Relâcher les tensions.<br>
        Libérer le trop-plein émotionnel.<br>
        Détendre et fortifier votre corps.
      </h1>
      <p class="text-lg md:text-xl text-white/90">
        Rejoignez un mouvement transformateur basé sur une approche simple, ludique, naturelle et libératrice.<br><br>
        Aucun équipement nécessaire.<br>
        Aucun prérequis.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="javascript://" data-opf-trigger="p2c27119f1412" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center flex flex-col">
        <span>Essayer 2 pratiques libératrices</span>
        <span class="text-sm font-normal opacity-90">en ligne</span>
      </a>
      <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="btn-secondary border-white/80 text-white hover:bg-white/10 text-center flex flex-col">
        <span>Cours à Fribourg (Suisse)</span>
        <span class="text-sm font-normal opacity-90">présentiel</span>
      </a>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-[2fr_1fr] gap-8 items-center">
  <div class="text-left space-y-4">
    <h2 class="text-3xl md:text-4xl font-semibold text-[#0f172a]">Qu'est-ce que Fluance ?</h2>
    <p class="text-lg md:text-xl text-[#0f172a]/75">
      Fluance est une approche nouvelle de lien au corps et ses tensions.<br><br>
      Grâce à des mouvements en conscience et son aspect ludique, elle rééquilibre progressivement votre système nerveux, amène de la clarté mentale et procure de la vitalité.
    </p>
  </div>
  <a href="{{ '/a-propos/approche-fluance/' | relativeUrl }}" class="section-card overflow-hidden max-w-xs mx-auto md:mx-0 block hover:opacity-90 transition-opacity">
    {% image "assets/img/approche-fluance.png", "Schéma de l'approche Fluance", "w-full h-auto object-contain", "lazy", "", "400", "400" %}
  </a>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-12">
  <div class="text-left space-y-4">
    <h3 class="text-2xl md:text-3xl font-semibold text-[#0f172a]">Une synthèse fluide des sagesses ancestrales</h3>
    <p class="text-lg text-[#0f172a]/75">
       Fluance puise son inspiration aux racines des arts martiaux, du Chi Gong, du Tai-Chi et du Yoga, mais s'affranchit des formes rigides et des chorégraphies imposées.<br /><br />
       Ici, la discipline s'efface au profit de l'écoute : le mouvement devient organique, intuitif et entièrement personnalisé. Il ne s'agit pas de contraindre votre corps dans une posture, mais de laisser le mouvement s'adapter à votre anatomie et à vos ressentis de l'instant.
    </p>
  </div>
  <div class="grid md:grid-cols-[1fr_2fr] gap-8 items-center">
    <div class="section-card overflow-hidden max-w-xs mx-auto md:mx-0" style="aspect-ratio: 500/276;">
      {% image "assets/img/parcours-fluance.jpg", "Parcours Fluance", "w-full h-full object-cover", "lazy", "", "500", "276" %}
    </div>
    <div class="text-left space-y-4">
      <h3 class="text-2xl md:text-3xl font-semibold text-[#0f172a]">L'accès direct au calme pour les esprits agités</h3>
      <p class="text-lg text-[#0f172a]/75">
        C'est souvent la "porte dérobée" idéale pour ceux qui trouvent la méditation assise difficile ou frustrante.<br /><br />
        En passant par le corps plutôt que par le mental, Fluance court-circuite l'agitation intérieure. Après seulement quelques pratiques, on constate des résultats surprenants : même sans expérience préalable, il devient possible de goûter à un état d'ancrage profond, de présence absolue et de calme, là où l'immobilité seule avait échoué.
      </p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-10">
  <div class="text-center space-y-4">
    <h2 class="text-3xl font-semibold text-[#82153e]">Ce qu'ils en disent</h2>
  </div>
  <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">« Cela me fait <strong>un bien fou</strong> ! »</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Sylvie Danielle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">« Cette semaine les <strong>douleurs ont vraiment diminué</strong>. »</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Monique</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">"Ta méthode est tellement simple et fluide. C'est <strong>agréable</strong> et on n'a <strong>pas le sentiment d'avoir un effort à faire</strong>."</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Isabelle</p>
    </div>
    <div class="quote-card">
      <p class="italic text-[#0f172a]/80">"J'ai du <strong>plaisir</strong> à <strong>recontacter mon corps</strong>."</p>
      <p class="text-sm text-[#0f172a]/60 mt-2">— Claire</p>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16">
  <div class="text-center space-y-4 mb-12">
    <h2 class="text-3xl font-semibold text-[#82153e]">Rejoignez le mouvement</h2>
  </div>
  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="javascript://" data-opf-trigger="p2c27119f1412" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center flex flex-col">
      <span>Essayer 2 pratiques libératrices</span>
      <span class="text-sm font-normal opacity-90">en ligne</span>
    </a>
    <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="inline-flex flex-col items-center justify-center rounded-full border-[3px] border-[#82153e] text-[#82153e] bg-white hover:bg-[#82153e] hover:text-white px-6 py-3 font-bold shadow-lg transition-all duration-200">
      <span>Cours à Fribourg (Suisse)</span>
      <span class="text-sm font-normal opacity-90">présentiel</span>
    </a>
  </div>
</section>

<script type="text/javascript" async="true" src="https://app.ontraport.com/js/ontraport/opt_assets/drivers/opf.js" data-opf-uid="p2c27119f1412" data-opf-params="borderColor=#8bc34a&borderSize=5px&formHeight=466&formWidth=40%&popPosition=mc&instance=n1809873346"></script>