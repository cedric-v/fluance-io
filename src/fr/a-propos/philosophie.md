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
      {% image "assets/img/cedric-chapeau-montagne-reduit.jpg", "Cédric en montagne", "w-full h-full object-cover object-position-mobile" %}
      <div class="absolute inset-0 bg-linear-to-r from-transparent via-[#648ED8]/70 to-[#648ED8]/90"></div>
    </div>
    <div class="relative z-10 h-full flex flex-col items-center justify-center px-6 md:px-12 text-center">
      <h1 class="text-4xl font-semibold text-white drop-shadow-lg">Philosophie</h1>
    </div>
  </header>

  <article class="prose prose-lg max-w-none space-y-8 text-[#1f1f1f]">
      <div class="space-y-4">
      <h2 class="text-2xl font-semibold text-fluance">L'éveil ne demande pas de quitter le monde, mais de l'habiter pleinement.
      </h2>
      <p class="text-lg text-[#0f172a]/75 leading-relaxed">
        Trop souvent, nous pensons que la sérénité ou le développement personnel nécessitent de se retirer de la société, de s'isoler dans une bulle de silence. La philosophie de Fluance est de prouver le contraire : votre vie actuelle, avec ses défis, est le terrain de jeu idéal.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Vos tensions sont des leviers</h2>
      <p class="text-lg text-[#0f172a]/75 leading-relaxed">
        Plutôt que de fuir le stress, les inquiétudes ou les tensions du quotidien, nous les utilisons comme matière première. Chaque friction devient une opportunité de revenir à soi, chaque moment de stress devient un signal pour réajuster son alignement. C'est une spiritualité incarnée, pragmatique et ancrée dans le réel.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Tout est déjà en vous</h2>
      <p class="text-lg text-[#0f172a]/75 leading-relaxed">
        Il n'y a rien à acquérir, tout est à redécouvrir. Vous possédez déjà toutes les ressources nécessaires pour évoluer. Le secret réside dans l'écoute fine de vos ressentis et la capacité à suivre ce que votre corps vous dicte.
      </p>
    </div>

    <div class="space-y-4 pt-6 border-t border-fluance/10">
      <h2 class="text-2xl font-semibold text-fluance">Une porte d'accès joyeuse</h2>
      <p class="text-lg text-[#0f172a]/75 leading-relaxed">
        Cédric vous invite à expérimenter ce retour à soi par une voie simple et accessible : le doux mélange du mouvement, de la respiration et de l'amusement en conscience.
      </p>
      <p class="text-lg text-[#0f172a]/75 leading-relaxed">
        Fluance, c'est l'art de s'éveiller sans se prendre au sérieux, mais en vivant sérieusement l'instant.
      </p>
    </div>
  </article>

  <div class="pt-8 mt-8 border-t border-fluance/20">
    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
      <a href="{{ '/a-propos/approche-fluance/' | relativeUrl }}" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center">
        Découvrir l'approche Fluance
      </a>
      <a href="{{ '/a-propos/histoire-cedric/' | relativeUrl }}" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center">
        L'histoire de Cédric
      </a>
      <a href="javascript://" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center" data-w-token="9241cb136525ee5e376e">
        Recevoir une pratique
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
    function tryOpenMailJet() {
      if (window.ml && typeof window.ml.open === 'function') {
        window.ml.open();
        return true;
      }
      if (window.wjPopin && typeof window.wjPopin === 'function') {
        window.wjPopin();
        return true;
      }
      if (window.mjPopin && typeof window.mjPopin === 'function') {
        window.mjPopin();
        return true;
      }
      const triggerIframe = document.querySelector('iframe[data-w-type="trigger"]');
      if (triggerIframe && triggerIframe.contentWindow) {
        try {
          triggerIframe.contentWindow.postMessage({ action: 'open', token: '9241cb136525ee5e376e' }, '*');
        } catch (err) {
          console.error('Erreur MailJet:', err);
        }
      }
      return false;
    }
    
    let attempts = 0;
    const checkMailJet = setInterval(function() {
      attempts++;
      if (window.ml || attempts >= 20) {
        clearInterval(checkMailJet);
        const buttons = document.querySelectorAll('[data-w-token="9241cb136525ee5e376e"]');
        buttons.forEach(function(button) {
          button.addEventListener('click', function(e) {
            e.preventDefault();
            tryOpenMailJet();
          });
        });
      }
    }, 100);
  });
</script>

