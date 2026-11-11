---
layout: base.njk
title: Désinscription des e-mails promotionnels
description: Confirmez la désinscription de vos e-mails promotionnels Fluance.
locale: fr
permalink: /desinscription/
robots: noindex, follow
translationAvailable: false
eleventyExcludeFromCollections: true
---

<section class="max-w-3xl mx-auto px-6 md:px-12 py-12 space-y-8">
  <header class="space-y-2 text-center">
    <p class="cta-pill bg-fluance/10 text-fluance inline-flex">Préférences e-mail</p>
    <h1 class="text-3xl font-semibold text-[#3E3A35]">Désinscription</h1>
  </header>

  <div id="unsubscribe-status" class="legal-text space-y-4 text-[#1f1f1f]" role="status" aria-live="polite">
    <p>Traitement de votre demande…</p>
  </div>

  <p class="text-sm text-[#3E3A35]/70">
    La désinscription concerne uniquement les communications promotionnelles de Fluance.
    Les e-mails nécessaires à votre compte, à vos achats, à vos réservations ou à vos
    abonnements peuvent continuer à vous être adressés. Pour toute question, écrivez-nous à
    <a href="mailto:support@fluance.io" class="text-fluance hover:underline">support@fluance.io</a>.
  </p>
</section>

<script>
  (function () {
    const status = new URLSearchParams(window.location.search).get('status');
    const container = document.getElementById('unsubscribe-status');
    if (!container) return;

    const messages = {
      confirmed: {
        title: 'Votre désinscription est confirmée',
        body: 'Vous ne recevrez plus de communications promotionnelles de Fluance.',
      },
      invalid: {
        title: 'Ce lien de désinscription n’est pas valide',
        body: 'Le lien est peut-être incomplet ou déjà expiré. Vous pouvez toujours nous demander de vous désinscrire à support@fluance.io.',
      },
      expired: {
        title: 'Ce lien de désinscription a expiré',
        body: 'Pour que nous puissions vérifier votre demande, écrivez à support@fluance.io.',
      },
      error: {
        title: 'Nous n’avons pas pu finaliser la désinscription',
        body: 'Réessayez dans quelques instants. Si le problème persiste, écrivez à support@fluance.io.',
      },
    };

    const message = messages[status] || {
      title: 'Désinscription des e-mails promotionnels',
      body: 'Si vous souhaitez vous désinscrire, utilisez le lien reçu dans l’e-mail promotionnel concerné.',
    };

    container.innerHTML = '';
    const heading = document.createElement('h2');
    heading.className = 'text-xl font-semibold text-[#3E3A35]';
    heading.textContent = message.title;
    const paragraph = document.createElement('p');
    paragraph.textContent = message.body;
    container.appendChild(heading);
    container.appendChild(paragraph);
  })();
</script>
