---
layout: base.njk
title: Contact
description: Contact us for any questions or help.
locale: en
permalink: /en/contact/
---

<section id="contact" class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <div class="section-card p-8 bg-white text-center space-y-6">
    <h1 class="text-3xl font-semibold text-[#82153e]">Contact us</h1>
    <p class="text-lg text-[#0f172a]/80">
      Have a question? Need help? Don't hesitate to contact us.
    </p>
    <button onclick="document.getElementById('helpBtn')?.click()" class="btn-primary inline-flex">
      Ask a question
    </button>
  </div>

  <div class="section-card p-8 bg-white space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Address</h2>
      <p class="text-[#0f172a]/80">
        Instants Zen Sàrl<br>
        Case postale<br>
        1782 Belfaux<br>
        Switzerland
      </p>
    </div>

    <div class="pt-6 border-t border-[#82153e]/20">
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Phone</h2>
      <p class="text-[#0f172a]/80">
        Contact my colleague at <a href="tel:+33972133388" class="text-[#82153e] hover:underline">+33 (0)9 72 13 33 88</a> Monday to Friday from 9am to 11am.
      </p>
    </div>

    <div class="pt-6 border-t border-[#82153e]/20">
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Email</h2>
      <p class="text-[#0f172a]/80">
        Email : <a href="#" id="contact-email-link-en" class="text-[#82153e] hover:underline"></a>
      </p>
    </div>
  </div>
</section>

<script>
  // Protection anti-spam : construction dynamique de l'email
  (function() {
    const emailParts = ['support', 'fluance', 'io'];
    const email = emailParts[0] + '@' + emailParts[1] + '.' + emailParts[2];
    const emailLink = document.getElementById('contact-email-link-en');
    if (emailLink) {
      emailLink.href = 'mailto:' + email;
      emailLink.textContent = email;
    }
  })();
</script>

