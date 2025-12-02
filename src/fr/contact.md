---
layout: base.njk
title: Contact
description: Contactez-nous pour toute question ou besoin d'aide.
locale: fr
permalink: /contact/
---

<section id="contact" class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <div class="section-card p-8 bg-white text-center space-y-6">
    <h1 class="text-3xl font-semibold text-[#82153e]">Contactez-nous</h1>
    <p class="text-lg text-[#0f172a]/80">
      Une question ? Besoin d'aide ? N'hésitez pas à nous contacter.
    </p>
    <button onclick="document.getElementById('helpBtn')?.click()" class="btn-primary inline-flex">
      Poser une question
    </button>
  </div>

  <div class="section-card p-8 bg-white space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Adresse</h2>
      <p class="text-[#0f172a]/80">
        Instants Zen Sàrl<br>
        Case postale<br>
        1782 Belfaux<br>
        Suisse
      </p>
    </div>

    <div class="pt-6 border-t border-[#82153e]/20">
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Téléphone</h2>
      <p class="text-[#0f172a]/80">
        Contactez ma collègue au <a href="tel:+33972133388" class="text-[#82153e] hover:underline">+33 (0)9 72 13 33 88</a> du lundi au vendredi de 9h à 11h.
      </p>
    </div>

    <div class="pt-6 border-t border-[#82153e]/20">
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Email</h2>
      <p class="text-[#0f172a]/80">
        <a href="#" id="contact-email-link" class="text-[#82153e] hover:underline"></a>
      </p>
    </div>
  </div>
</section>

<script>
  // Protection anti-spam : construction dynamique de l'email
  (function() {
    const emailParts = ['support', 'fluance', 'io'];
    const email = emailParts[0] + '@' + emailParts[1] + '.' + emailParts[2];
    const emailLink = document.getElementById('contact-email-link');
    if (emailLink) {
      emailLink.href = 'mailto:' + email;
      emailLink.textContent = email;
    }
  })();
</script>

