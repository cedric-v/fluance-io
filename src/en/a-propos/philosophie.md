---
layout: base.njk
title: Philosophy
description: "The philosophy of Fluance: guiding towards body and mind fluidity."
locale: en
permalink: /en/a-propos/philosophie/
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-28 mb-8 overflow-hidden" style="height: 300px;">
    <div class="absolute inset-0 z-0">
      {% image "assets/img/cedric-chapeau-montagne-reduit.jpg", "Cédric in the mountains", "w-full h-full object-cover object-position-philosophie" %}
      <div class="absolute inset-0" style="background: linear-gradient(to right, transparent, rgba(100, 142, 216, 0.7), rgba(100, 142, 216, 0.9));"></div>
    </div>
    <div class="relative z-10 h-full flex flex-col items-center justify-center px-6 md:px-12 text-center">
      <h1 class="text-4xl font-semibold text-[#F5F7F6] drop-shadow-lg">Philosophy</h1>
    </div>
  </header>

  <article class="prose prose-lg max-w-none space-y-8 text-[#1f1f1f]">
      <div class="space-y-4">
      <h2 class="text-2xl font-semibold text-fluance">Awakening doesn't require leaving the world, but fully inhabiting it.
      </h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Too often, we think that serenity or personal development requires withdrawing from society, isolating ourselves in a bubble of silence. Fluance's philosophy is to prove the opposite: your current life, with its challenges, is the ideal playground.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Your tensions are levers</h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Rather than fleeing stress, worries or daily tensions, we use them as raw material. Each friction becomes an opportunity to return to oneself, each moment of stress becomes a signal to readjust one's alignment. This is embodied spirituality, pragmatic and grounded in reality.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Everything is already within you</h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        There is nothing to acquire, everything is to be rediscovered. You already possess all the resources necessary to evolve. The secret lies in the fine listening of your feelings and the ability to follow what your body dictates to you.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">A joyful gateway</h2>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Cédric invites you to experience this return to yourself through a simple and accessible path: the gentle blend of movement, breathing and conscious play.
      </p>
      <p class="text-lg text-[#3E3A35] leading-relaxed">
        Fluance is the art of awakening without taking oneself seriously, but seriously living the moment.
      </p>
    </div>
  </article>

  <div class="pt-8 mt-8 border-t border-fluance/20">
    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
      <a href="{{ '/en/a-propos/approche-fluance/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex items-center justify-center min-h-[3.5rem]">
        Discover the Fluance approach
      </a>
      <a href="{{ '/en/a-propos/histoire-cedric/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex items-center justify-center min-h-[3.5rem]">
        Cédric's story
      </a>
    </div>
    <div class="pt-6 border-t border-fluance/10">
      <p class="text-center text-lg text-[#3E3A35] mb-4">To experience for yourself:</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a href="javascript://" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex flex-col items-center justify-center min-h-[3.5rem]" data-w-token="9241cb136525ee5e376e">
          <span>Receive a practice</span>
          <span class="text-sm font-normal opacity-90">online</span>
        </a>
        <a href="{{ '/en/presentiel/reserver/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] text-center flex flex-col items-center justify-center min-h-[3.5rem]">
          <span>Book an in-person class</span>
          <span class="text-sm font-normal opacity-90">Fribourg region (Switzerland)</span>
        </a>
      </div>
    </div>
  </div>
</section>

{% include "newsletter-popup.njk" %}

