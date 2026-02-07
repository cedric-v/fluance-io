---
layout: base.njk
title: Philosophie
description: "La philosophie de Fluance : accompagner vers la fluidité corps et esprit."
locale: fr
permalink: /a-propos/philosophie/
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-28 mb-8 overflow-hidden" style="height: 300px;">
    <div class="absolute inset-0 z-0">
      {% image "assets/img/cedric-chapeau-montagne-reduit.jpg", "Cédric en montagne", "w-full h-full object-cover object-position-philosophie" %}
      <div class="absolute inset-0" style="background: linear-gradient(to right, transparent, rgba(100, 142, 216, 0.7), rgba(100, 142, 216, 0.9));"></div>
    </div>
    <div class="relative z-10 h-full flex flex-col items-center justify-center px-6 md:px-12 text-center">
      <h1 class="text-4xl font-semibold text-[#F5F7F6] drop-shadow-lg">Philosophie</h1>
    </div>
  </header>

  <article class="prose prose-lg max-w-none space-y-8 text-[#1f1f1f]">
      <div class="space-y-4">
      <h2 class="text-2xl font-semibold text-fluance">L'éveil ne demande pas de quitter le monde, mais de l'habiter pleinement.
      </h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Trop souvent, nous pensons que la sérénité ou le développement personnel nécessitent de se retirer de la société, de s'isoler dans une bulle de silence. La philosophie de Fluance est de prouver le contraire : votre vie actuelle, avec ses défis, est le terrain de jeu idéal.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Vos tensions sont des leviers</h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Plutôt que de fuir le stress, les inquiétudes ou les tensions du quotidien, nous les utilisons comme matière première. Chaque friction devient une opportunité de revenir à soi, chaque moment de stress devient un signal pour réajuster son alignement. C'est une spiritualité incarnée, pragmatique et ancrée dans le réel.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Tout est déjà en vous</h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Il n'y a rien à acquérir, tout est à redécouvrir. Vous possédez déjà toutes les ressources nécessaires pour évoluer. Le secret réside dans l'écoute fine de vos ressentis et la capacité à suivre ce que votre corps vous dicte.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Une porte d'accès joyeuse</h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Cédric vous invite à expérimenter ce retour à soi par une voie simple et accessible : le doux mélange du mouvement, de la respiration et de l'amusement en conscience.
      </p>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Fluance, c'est l'art de s'éveiller sans se prendre au sérieux, mais en vivant sérieusement l'instant.
      </p>
    </div>
  </article>

  <div class="pt-8 mt-8 border-t border-fluance/20">
    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
      <a href="{{ '/a-propos/approche-fluance/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex items-center justify-center min-h-[3.5rem]">
        Découvrir l'approche Fluance
      </a>
      <a href="{{ '/a-propos/histoire-cedric/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex items-center justify-center min-h-[3.5rem]">
        L'histoire de Cédric
      </a>
    </div>
    <div class="pt-6 border-t border-fluance/10">
      <p class="text-center text-lg text-[#3E3A35] mb-4">Pour expérimenter par vous-même :</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a href="javascript://" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex flex-col items-center justify-center min-h-[3.5rem]" data-w-token="9241cb136525ee5e376e">
          <span>Recevoir une pratique</span>
          <span class="text-sm font-normal opacity-90">en ligne</span>
        </a>
        <a href="{{ '/presentiel/reserver/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex flex-col items-center justify-center min-h-[3.5rem]">
          <span>Réserver un cours présentiel</span>
          <span class="text-sm font-normal opacity-90">région Fribourg (Suisse)</span>
        </a>
      </div>
    </div>
  </div>
</section>

{% include "newsletter-popup.njk" %}

