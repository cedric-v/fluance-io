---
layout: base.njk
title: Fluance Approach
description: Discover Fluance's holistic approach for body and mind fluidity.
locale: en
permalink: /en/a-propos/approche-fluance/
ogImage: assets/img/cedric-dehors-fluance-reduit.jpeg
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-28 mb-8 overflow-hidden" style="height: 300px;">
    <div class="absolute inset-0 z-0">
      <img src="{{ '/assets/img/cedric-dehors-fluance-reduit.jpeg' | url }}" alt="Cédric in the mountains" class="w-full h-full object-cover object-position-mobile" loading="lazy">
      <div class="absolute inset-0 bg-linear-to-r from-transparent via-[#648ED8]/70 to-[#648ED8]/90"></div>
    </div>
    <div class="relative z-10 h-full flex flex-col items-center justify-center px-6 md:px-12 text-center">
      <h1 class="text-4xl font-semibold text-white drop-shadow-lg">The Fluance Approach</h1>
    </div>
  </header>

  <article class="prose prose-lg max-w-none space-y-8 text-[#1f1f1f]">
    <div class="space-y-6">
      <h2 class="text-2xl font-semibold text-fluance text-center">The tripod of vitality:</h2>
      <p class="text-xl text-[#0f172a]/80 font-medium text-center">
        Movement, Breath, Play
      </p>
      
      <div class="flex justify-center my-8">
        <div class="max-w-md w-full">
          {% image "assets/img/approche-fluance.png", "The tripod of vitality: Movement, Breath, Play", "w-full h-auto rounded-lg", "lazy", "", "400", "400" %}
        </div>
      </div>
      
      <p class="text-lg text-[#0f172a]/75 leading-relaxed">
        The Fluance approach is based on a unique synergy designed to free the body and mind. It doesn't seek performance, but fluidity.
      </p>
    </div>

    <div class="space-y-6 pt-6 border-t border-fluance/10">
      <div class="space-y-3">
        <h3 class="text-xl font-semibold text-fluance">Movement:</h3>
        <p class="text-lg text-[#0f172a]/75 leading-relaxed">
          to release tensions and restore energy circulation.
        </p>
      </div>

      <div class="space-y-3">
        <h3 class="text-xl font-semibold text-fluance">Breath:</h3>
        <p class="text-lg text-[#0f172a]/75 leading-relaxed">
          to anchor presence and calm the nervous system.
        </p>
      </div>

      <div class="space-y-3">
        <h3 class="text-xl font-semibold text-fluance">Play:</h3>
        <p class="text-lg text-[#0f172a]/75 leading-relaxed">
          to rediscover spontaneity and the simple joy of being alive.
        </p>
      </div>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Simple, powerful and liberating practices</h2>
      <p class="text-lg text-[#0f172a]/75 leading-relaxed">
        No need for complex postures or athletic prerequisites. The practices offered are accessible to everyone and designed to provide immediate relief and a sense of inner freedom. It's an invitation to let go of the mind to return to the body's intelligence.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">The magic of regularity</h2>
      <p class="text-lg text-[#0f172a]/75 leading-relaxed">
        Like a drop of water that eventually sculpts the stone, it's repetition that creates deep transformation.
      </p>
      
      <div class="bg-fluance/5 border-l-4 border-fluance p-6 rounded-r-lg mt-6">
        <p class="text-lg text-[#0f172a]/80 italic leading-relaxed">
          Cédric's advice: "To benefit from cumulative benefits, the essential is not intensity, but consistency. Practice a few movements every day, even if it's only for a few minutes. It's in these small moments that great change is created."
        </p>
      </div>
    </div>
  </article>

  <div class="pt-8 mt-8 border-t border-fluance/20">
    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
      <a href="{{ '/en/a-propos/philosophie/' | relativeUrl }}" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center">
        Philosophy
      </a>
      <a href="{{ '/en/a-propos/histoire-cedric/' | relativeUrl }}" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center">
        Cédric's story
      </a>
      <a href="javascript://" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center" data-w-token="9241cb136525ee5e376e">
        Receive a practice
      </a>
    </div>
  </div>
</section>

<!-- MailJet Pop-in Form -->
<iframe data-w-token="9241cb136525ee5e376e" data-w-type="pop-in" frameborder="0" scrolling="yes" marginheight="0" marginwidth="0" src="https://1sqw8.mjt.lu/wgt/1sqw8/0umk/form?c=5239e5a1" width="100%" style="height: 0;"></iframe>

<!-- MailJet Trigger -->
<iframe data-w-token="9241cb136525ee5e376e" data-w-type="trigger" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://1sqw8.mjt.lu/wgt/1sqw8/0umk/trigger?c=5715cb7f" width="100%" style="height: 0;"></iframe>

<script type="text/javascript" src="https://app.mailjet.com/pas-nc-pop-in-v1.js"></script>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      const buttons = document.querySelectorAll('[data-w-token="9241cb136525ee5e376e"]');
      const popinIframe = document.querySelector('iframe[data-w-type="pop-in"]');
      
      buttons.forEach(function(button) {
        button.addEventListener('click', function(e) {
          e.preventDefault();
          
          if (popinIframe) {
            let overlay = document.getElementById('mailjet-overlay');
            if (!overlay) {
              overlay = document.createElement('div');
              overlay.id = 'mailjet-overlay';
              overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9998; display: flex; align-items: center; justify-content: center;';
              overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                  overlay.style.display = 'none';
                  popinIframe.style.cssText = 'height: 0;';
                }
              });
              document.body.appendChild(overlay);
            }
            
            popinIframe.style.cssText = 'position: relative; width: 90%; max-width: 600px; height: 500px; z-index: 9999; border: none;';
            overlay.style.display = 'flex';
          }
        });
      });
    }, 1000);
  });
</script>

