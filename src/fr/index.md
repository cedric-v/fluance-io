---
layout: base.njk
title: Accueil
description: Le développement au service des entrepreneurs.
locale: fr
---

<section id="hero" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 py-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/fond-cedric.jpg", "Cédric Vonlanthen au bord du lac", "w-full h-full object-cover" %}
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
        Aucun équipement nécessaire.<br><br>
        Aucun prérequis.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-4">
      <a href="{{ '/#contact' | url }}" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center">
        Essayer 2 pratiques libératrices
      </a>
      <a href="{{ '/cours-en-ligne/30-jours-mouvement/' | url }}" class="btn-secondary border-white/80 text-white hover:bg-white/10 text-center">
        Challenge de 30 jours pour remettre du mouvement
      </a>
    </div>
  </div>
</section>

<section id="chemins" class="max-w-6xl mx-auto px-6 md:px-12 py-16 space-y-10">
  <div class="text-center space-y-4">
    <p class="cta-pill bg-[#ffce2d]/20 text-[#82153e] mx-auto">Approche libératrice</p>
    <h2 class="text-3xl font-semibold text-[#82153e]">Pour apaiser le corps, clarifier l'esprit</h2>
    <p class="text-lg text-[#0f172a]/70">Fluance accompagne les particuliers à sortir des tensions, du flou et de la surcharge.</p>
  </div>
  <div class="max-w-2xl mx-auto">
    <article id="presentiel" class="section-card p-8 space-y-5 bg-white">
      <p class="text-sm font-semibold text-[#82153e] uppercase">Particuliers</p>
      <h3 class="text-2xl font-semibold text-[#0f172a]">Retrouver un corps souple et un esprit apaisé</h3>
      <p class="text-[#0f172a]/75">Pratiques courtes et efficaces pour relâcher les tensions, libérer la respiration et réinstaller la sérénité au quotidien.</p>
      <div class="space-y-4">
        <div class="quote-card">
          <p class="italic text-[#0f172a]/80">« Cela me fait un bien fou ! »</p>
          <p class="text-sm text-[#0f172a]/60 mt-2">— Sylvie Danielle</p>
        </div>
        <div class="quote-card">
          <p class="italic text-[#0f172a]/80">« Cette semaine les douleurs ont vraiment diminué. »</p>
          <p class="text-sm text-[#0f172a]/60 mt-2">— Monique</p>
        </div>
      </div>
      <a href="#contact" class="btn-primary inline-flex items-center justify-center">Recevoir les pratiques</a>
    </article>
  </div>
</section>

<section id="approche" class="max-w-6xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-2 gap-12 items-center">
  <div class="space-y-6">
    <p class="cta-pill bg-[#82153e]/10 text-[#82153e]">Approche globale</p>
    <h2 class="text-3xl font-semibold text-[#0f172a]">Fluidité corps & esprit</h2>
    <p class="text-lg text-[#0f172a]/75">Fluance réunit mouvement, respiration, méditation et accompagnement stratégique pour réinstaller la cohérence dans votre vie personnelle et professionnelle.</p>
    <ul class="space-y-4 text-[#0f172a]/80">
      <li class="flex gap-3">
        <span class="w-2 h-2 mt-2 rounded-full bg-[#ffce2d]"></span>
        Reconnecter le corps pour libérer la charge mentale et écouter l’intuition.
      </li>
      <li class="flex gap-3">
        <span class="w-2 h-2 mt-2 rounded-full bg-[#ffce2d]"></span>
        Clarifier les priorités pour retrouver la cohérence dans vos choix.
      </li>
      <li class="flex gap-3">
        <span class="w-2 h-2 mt-2 rounded-full bg-[#ffce2d]"></span>
        Avancer avec fluidité grâce à des pratiques simples et répétables.
      </li>
    </ul>
  </div>
  <div class="section-card overflow-hidden">
    {% image "assets/img/parcours-fluance.jpg", "Pratique Fluance", "w-full h-full object-cover" %}
  </div>
</section>

<section id="founder" class="max-w-5xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-2 gap-10">
  <div class="space-y-4">
    <p class="cta-pill bg-[#8bc34a]/20 text-[#0f172a]">Qui suis-je ?</p>
    <h2 class="text-3xl font-semibold text-[#82153e]">Cédric Vonlanthen</h2>
    <p class="text-[#0f172a]/75">Fondateur de Fluance, accompagnant d’entrepreneurs, mari et papa de deux enfants. Après 10 ans dans l’industrie (développeur, chef de produit puis chef de projet), Cédric s’est reconverti comme formateur en méditation pour retrouver du sens et transmettre la fluidité qu’il a expérimentée.</p>
    <p class="text-[#0f172a]/75">Instants Zen Sàrl a diffusé des dizaines de milliers d’accompagnements dans plus de 35 pays, avec 541 webinaires animés.</p>
    <div class="flex flex-wrap gap-4">
      <a href="#contact" class="btn-primary">Entrer en contact</a>
      <a href="tel:+33972133388" class="btn-secondary text-[#82153e] border-[#82153e]">+33 (0)9 72 13 33 88</a>
    </div>
  </div>
  <div class="section-card p-8 space-y-6 bg-white">
    <h3 class="text-xl font-semibold text-[#0f172a]">Ce que vous ressentirez</h3>
    <ul class="space-y-4 text-[#0f172a]/80">
      <li>• Un mental apaisé qui laisse davantage de place à votre intuition.</li>
      <li>• Un corps souple qui absorbe moins de tensions au quotidien.</li>
      <li>• Des décisions prises avec clarté, cohérence et fluidité.</li>
    </ul>
  </div>
</section>

<section id="contact" class="max-w-5xl mx-auto px-6 md:px-12 py-16 text-center space-y-6">
  <p class="cta-pill mx-auto bg-[#ffce2d]/30 text-[#0f172a]">Prêt·e à alléger votre charge mentale ?</p>
  <h2 class="text-3xl font-semibold text-[#0f172a]">Choisissez l’approche Fluance qui vous correspond</h2>
  <p class="text-lg text-[#0f172a]/70 max-w-3xl mx-auto">Remplissez le formulaire, recevez les pratiques offertes ou l’exercice de la journée idéale, et commençons à installer la fluidité dans votre quotidien.</p>
  <div class="flex flex-col md:flex-row gap-4 justify-center">
    <a href="mailto:contact@fluance.io" class="btn-primary inline-flex justify-center">Envoyer un message</a>
    <a href="https://fluance.io/#form" target="_blank" rel="noreferrer" class="btn-secondary inline-flex justify-center border-[#0f172a] text-[#0f172a]">Accéder au formulaire</a>
  </div>
</section>