---
layout: base.njk
title: Accueil
description: "Fluance : libérez votre corps des tensions et retrouvez fluidité, mobilité et sérénité grâce à une approche simple basée sur le mouvement, le souffle et le jeu."
locale: fr
---

<section id="fond-cedric" class="relative min-h-screen flex items-center justify-end px-6 md:px-12 pt-32 pb-20 overflow-hidden -mt-28">
  <div class="absolute inset-0 z-0">
    {% image "assets/img/fond-cedric.jpg", "Cédric Vonlanthen au bord du lac", "w-full h-full object-cover object-center md:object-right", "eager", "high", "1280", "960" %}
    <div class="absolute inset-0 md:hidden" style="background-color: rgba(100, 142, 216, 0.8);"></div>
    <div class="hidden md:block absolute inset-0 bg-linear-to-r from-transparent via-[#648ED8]/70 to-[#648ED8]/90"></div>
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
      <a href="javascript://" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center flex flex-col" data-w-token="9241cb136525ee5e376e">
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
    <h2 class="text-3xl font-semibold text-fluance">Ce qu'ils en disent</h2>
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
    <h2 class="text-3xl font-semibold text-fluance">Rejoignez le mouvement</h2>
  </div>
  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="javascript://" class="btn-primary text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d] text-center flex flex-col" data-w-token="9241cb136525ee5e376e">
      <span>Essayer 2 pratiques libératrices</span>
      <span class="text-sm font-normal opacity-90">en ligne</span>
    </a>
    <a href="{{ '/presentiel/cours-hebdomadaires/' | relativeUrl }}" class="inline-flex flex-col items-center justify-center rounded-full border-[3px] border-fluance text-fluance bg-white hover:bg-fluance hover:text-white px-6 py-3 font-bold shadow-lg transition-all duration-200">
      <span>Cours à Fribourg (Suisse)</span>
      <span class="text-sm font-normal opacity-90">présentiel</span>
    </a>
  </div>
</section>

<!-- MailJet Pop-in Form -->
<iframe data-w-token="9241cb136525ee5e376e" data-w-type="pop-in" frameborder="0" scrolling="yes" marginheight="0" marginwidth="0" src="https://1sqw8.mjt.lu/wgt/1sqw8/0umk/form?c=5239e5a1" width="100%" style="height: 0;"></iframe>

<!-- MailJet Trigger -->
<iframe data-w-token="9241cb136525ee5e376e" data-w-type="trigger" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://1sqw8.mjt.lu/wgt/1sqw8/0umk/trigger?c=5715cb7f" width="100%" style="height: 0;"></iframe>

<script type="text/javascript" src="https://app.mailjet.com/pas-nc-pop-in-v1.js"></script>

<script>
  // Déclencher la pop-up MailJet au clic sur les boutons avec data-w-token
  document.addEventListener('DOMContentLoaded', function() {
    // Attendre que le script MailJet soit chargé
    setTimeout(function() {
      const buttons = document.querySelectorAll('[data-w-token="9241cb136525ee5e376e"]');
      buttons.forEach(function(button) {
        button.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Essayer différentes méthodes MailJet
          if (window.wjPopin && typeof window.wjPopin === 'function') {
            window.wjPopin();
          } else if (window.mjPopin && typeof window.mjPopin === 'function') {
            window.mjPopin();
          } else if (window.mjPopin && window.mjPopin.open) {
            window.mjPopin.open();
          } else if (window.mailjet && window.mailjet.showPopin) {
            window.mailjet.showPopin();
          } else {
            // Essayer de déclencher via l'iframe trigger
            const triggerIframe = document.querySelector('iframe[data-w-type="trigger"]');
            if (triggerIframe && triggerIframe.contentWindow) {
              try {
                triggerIframe.contentWindow.postMessage('open', '*');
              } catch (err) {
                console.error('Erreur MailJet:', err);
              }
            }
            console.log('API MailJet disponible:', {
              wjPopin: typeof window.wjPopin,
              mjPopin: typeof window.mjPopin,
              mailjet: typeof window.mailjet
            });
          }
        });
      });
    }, 500);
  });
</script>