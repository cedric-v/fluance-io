---
layout: base.njk
title: Approche Fluance
description: Découvrez l'approche globale de Fluance pour la fluidité corps et esprit.
locale: fr
permalink: /a-propos/approche-fluance/
ogImage: assets/img/cedric-dehors-fluance-reduit.jpeg
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-28 mb-8 overflow-hidden" style="height: 300px;">
    <div class="absolute inset-0 z-0">
      <img src="{{ '/assets/img/cedric-dehors-fluance-reduit.jpeg' | url }}" alt="Cédric en montagne" class="w-full h-full object-cover object-position-mobile" loading="lazy">
      <div class="absolute inset-0" style="background: linear-gradient(to right, transparent, rgba(100, 142, 216, 0.7), rgba(100, 142, 216, 0.9));"></div>
    </div>
    <div class="relative z-10 h-full flex flex-col items-center justify-center px-6 md:px-12 text-center">
      <h1 class="text-4xl font-semibold text-[#F5F7F6] drop-shadow-lg">L'approche Fluance</h1>
    </div>
  </header>

  <article class="prose prose-lg max-w-none space-y-8 text-[#1f1f1f]">
    <div class="space-y-6">
      <h2 class="text-2xl font-semibold text-fluance text-center">Le trépied de la vitalité :</h2>
      <p class="text-xl text-[#3E3A35] font-medium text-center">
        Mouvement, Souffle, Jeu
      </p>
      
      <div class="flex justify-center my-8">
        <div class="max-w-md w-full">
          {% image "assets/img/approche-fluance.png", "Le trépied de la vitalité : Mouvement, Souffle, Jeu", "w-full h-auto rounded-lg", "lazy", "", "400", "400" %}
        </div>
      </div>
      
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        L'approche Fluance repose sur une synergie unique conçue pour libérer le corps et l'esprit. Elle ne cherche pas la performance, mais la fluidité.
      </p>
    </div>

    <div class="space-y-6 pt-6 border-t border-fluance/10">
      <div class="space-y-3">
        <h3 class="text-xl font-semibold text-fluance">Mouvement :</h3>
        <p class="text-lg text-[#3E3A35] leading-relaxed">
          pour délier les tensions et remettre l'énergie en circulation.
        </p>
      </div>

      <div class="space-y-3">
        <h3 class="text-xl font-semibold text-fluance">Souffle :</h3>
        <p class="text-lg text-[#3E3A35] leading-relaxed">
          pour ancrer la présence et apaiser le système nerveux.
        </p>
      </div>

      <div class="space-y-3">
        <h3 class="text-xl font-semibold text-fluance">Jeu :</h3>
        <p class="text-lg text-[#3E3A35] leading-relaxed">
          pour retrouver la spontanéité et la joie simple d'être vivant.
        </p>
      </div>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Des pratiques simples, puissantes et libératrices</h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Pas besoin de postures complexes ou de prérequis athlétiques. Les pratiques proposées sont accessibles à tous et conçues pour procurer un soulagement immédiat et un sentiment de liberté intérieure. C'est une invitation à lâcher le mental pour revenir dans l'intelligence du corps.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">La magie de la régularité</h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Comme une goutte d'eau qui finit par sculpter la pierre, c'est la répétition qui crée la transformation profonde.
      </p>
      
      <div class="bg-fluance/5 border-l-4 border-fluance p-6 rounded-r-lg mt-6">
        <p class="text-lg text-[#3E3A35] italic leading-relaxed">
          Le conseil de Cédric : « Pour bénéficier des bienfaits cumulés, l'essentiel n'est pas l'intensité, mais la constance. Pratiquez quelques mouvements chaque jour, même si ce n'est que pour quelques minutes. C'est dans ces petits instants que se crée le grand changement. »
        </p>
      </div>
    </div>
  </article>

  <div class="pt-8 mt-8 border-t border-fluance/20">
    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
      <a href="{{ '/a-propos/philosophie/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center">
        Philosophie
      </a>
      <a href="{{ '/a-propos/histoire-cedric/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center">
        L'histoire de Cédric
      </a>
      <a href="javascript://" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center" data-w-token="9241cb136525ee5e376e">
        Recevoir une pratique
      </a>
    </div>
  </div>
</section>

{% include "newsletter-popup.njk" %}

