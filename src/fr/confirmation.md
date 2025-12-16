---
layout: base.njk
title: Confirmation d'inscription
description: Confirmation de votre inscription au parcours Fluance.
locale: fr
permalink: /confirmation/
eleventyExcludeFromCollections: true
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="space-y-4 text-center">
    <h1 class="text-4xl font-semibold text-[#3E3A35]">Félicitations et merci de votre confiance</h1>
    <p class="text-xl text-[#3E3A35] font-medium">Je vous souhaite un agréable parcours et me réjouis de vous retrouver prochainement.</p>
  </header>

  <article class="prose prose-lg max-w-none space-y-8 text-[#1f1f1f]">
    <div class="section-card p-8 bg-white space-y-4">
      <div class="flex items-start gap-4">
        <svg class="w-6 h-6 text-fluance shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-fluance mb-2">Vos informations de connexion</h2>
          <p class="text-lg text-[#3E3A35]">
            Vos <strong>informations de connexion viennent de vous être envoyées par e-mail</strong>. Dans le cas d'un paiement par PayPal elles sont envoyées à l'adresse e-mail enregistrée sur votre compte PayPal.
          </p>
          <p class="text-lg text-[#3E3A35] mt-4">
            Si ce n'est pas le cas, veuillez vérifier dans vos courriers indésirables (spams) et nous écrire s'ils n'ont pas été reçus dans les 2 heures à venir.
          </p>
        </div>
      </div>
    </div>

    <div class="section-card p-8 bg-white space-y-6">
      <div class="text-center space-y-4">
        <h2 class="text-2xl font-semibold text-fluance">En guise de cadeau de bienvenue</h2>
        <p class="text-lg text-[#3E3A35]">
          Je vous invite à venir virtuellement en balade avec moi, en vous partageant quelques moments ressourçant en nature.
        </p>
        <p class="text-lg font-semibold text-fluance">
          Pour l'obtenir, il vous suffit de cliquer sur le lien ci-dessous :
        </p>
        <div class="pt-4">
          <a href="{{ '/cadeau/' | relativeUrl }}" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] inline-flex items-center gap-2 text-center">
            Accéder à mon cadeau de bienvenue : quelques moments ressourçant en nature
            <span>→</span>
          </a>
        </div>
      </div>
    </div>

    <div class="section-card p-8 bg-white space-y-6">
      <div class="flex items-start gap-4">
        <svg class="w-6 h-6 text-fluance shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-fluance mb-4">Envie de partager cette aventure avec un proche que cela pourrait inspirer, aider ou soutenir ?</h2>
          <p class="text-lg text-[#3E3A35]">
            Savez-vous que <em>les personnes qui suivent une formation avec une connaissance</em> ont tendance à mieux mettre en pratique les partages proposés et ainsi obtenir de <em>meilleurs résultats</em> ?
          </p>
          <p class="text-lg text-[#3E3A35] mt-4">
            Il vous suffit simplement de lui parler de votre choix de réaliser cette formation et/ou de lui transmettre la page ou le message qui vous a permis d'arriver ici.
          </p>
          <p class="text-lg text-[#3E3A35] mt-4">
            Ou encore de lui dire de nous écrire ou de nous appeler aux coordonnées ci-dessous (section "Besoin d'aide ?").
          </p>
          <p class="text-lg text-[#3E3A35] mt-4">
            Nous lui répondrons avec joie.
          </p>
        </div>
      </div>
    </div>

    <div class="text-center space-y-4 pt-8">
      <p class="text-xl text-[#3E3A35] font-medium">A bientôt,</p>
      <p class="text-xl font-semibold text-fluance">Cédric Vonlanthen</p>
      <p class="text-lg text-[#3E3A35] italic">Heureux fondateur de Fluance.</p>
    </div>

    <div class="section-card p-8 bg-fluance/5 border-l-4 border-fluance rounded-r-lg space-y-4">
      <h2 class="text-xl font-semibold text-fluance">Besoin d'aide ?</h2>
      <p class="text-[#3E3A35]">
        Contactez-moi via <a href="#" id="confirmation-email-link" class="text-fluance font-semibold hover:underline"></a> ou <a href="{{ '/contact/' | relativeUrl }}" class="text-fluance font-semibold hover:underline">cette page</a>.
      </p>
    </div>
  </article>
</section>

<script>
  // Protection anti-spam : construction dynamique de l'email
  (function() {
    const emailParts = ['support', 'fluance', 'io'];
    const email = emailParts[0] + '@' + emailParts[1] + '.' + emailParts[2];
    const emailLink = document.getElementById('confirmation-email-link');
    if (emailLink) {
      emailLink.href = 'mailto:' + email;
      emailLink.textContent = email;
    }
  })();
</script>

