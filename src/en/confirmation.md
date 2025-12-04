---
layout: base.njk
title: Registration Confirmation
description: Confirmation of your registration to the Fluance program.
locale: en
permalink: /en/confirmation/
eleventyExcludeFromCollections: true
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="space-y-4 text-center">
    <h1 class="text-4xl font-semibold text-[#0f172a]">Congratulations and thank you for your trust</h1>
    <p class="text-xl text-[#0f172a]/80 font-medium">I wish you a pleasant journey and look forward to seeing you soon.</p>
  </header>

  <article class="prose prose-lg max-w-none space-y-8 text-[#1f1f1f]">
    <div class="section-card p-8 bg-white space-y-4">
      <div class="flex items-start gap-4">
        <svg class="w-6 h-6 text-[#82153e] flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-[#82153e] mb-2">Your login information</h2>
          <p class="text-lg text-[#0f172a]/80">
            Your <strong>login information has just been sent to you by email</strong>. In case of payment by PayPal, they are sent to the email address registered on your PayPal account.
          </p>
          <p class="text-lg text-[#0f172a]/80 mt-4">
            If this is not the case, please check your spam folder and contact us if you have not received them within 2 hours.
          </p>
        </div>
      </div>
    </div>

    <div class="section-card p-8 bg-white space-y-6">
      <div class="text-center space-y-4">
        <h2 class="text-2xl font-semibold text-[#82153e]">As a welcome gift</h2>
        <p class="text-lg text-[#0f172a]/80">
          I invite you to join me virtually on a walk, sharing some refreshing moments in nature.
        </p>
        <p class="text-lg font-semibold text-[#82153e]">
          To receive it, simply click on the link below:
        </p>
        <div class="pt-4">
          <a href="{{ '/en/cadeau/' | relativeUrl }}" class="btn-primary inline-flex items-center gap-2 text-center">
            Access my welcome gift: some refreshing moments in nature
            <span>→</span>
          </a>
        </div>
      </div>
    </div>

    <div class="section-card p-8 bg-white space-y-6">
      <div class="flex items-start gap-4">
        <svg class="w-6 h-6 text-[#82153e] flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-[#82153e] mb-4">Would you like to share this adventure with someone close who might be inspired, helped or supported by it?</h2>
          <p class="text-lg text-[#0f172a]/80">
            Did you know that <em>people who follow a training with someone they know</em> tend to better put into practice the teachings offered and thus achieve <em>better results</em>?
          </p>
          <p class="text-lg text-[#0f172a]/80 mt-4">
            Simply talk to them about your choice to take this training and/or share with them the page or message that led you here.
          </p>
          <p class="text-lg text-[#0f172a]/80 mt-4">
            Or tell them to write to us or call us at the contact details below (section "Need help?").
          </p>
          <p class="text-lg text-[#0f172a]/80 mt-4">
            We will be happy to respond.
          </p>
        </div>
      </div>
    </div>

    <div class="text-center space-y-4 pt-8">
      <p class="text-xl text-[#0f172a]/80 font-medium">See you soon,</p>
      <p class="text-xl font-semibold text-[#82153e]">Cédric Vonlanthen</p>
      <p class="text-lg text-[#0f172a]/75 italic">Happy founder of Fluance.</p>
    </div>

    <div class="section-card p-8 bg-[#82153e]/5 border-l-4 border-[#82153e] rounded-r-lg space-y-4">
      <h2 class="text-xl font-semibold text-[#82153e]">Need help?</h2>
      <p class="text-[#0f172a]/80">
        Contact me via <a href="#" id="confirmation-email-link-en" class="text-[#82153e] font-semibold hover:underline"></a> or <a href="{{ '/en/contact/' | relativeUrl }}" class="text-[#82153e] font-semibold hover:underline">this page</a>.
      </p>
    </div>
  </article>
</section>

<script>
  // Protection anti-spam : construction dynamique de l'email
  (function() {
    const emailParts = ['support', 'fluance', 'io'];
    const email = emailParts[0] + '@' + emailParts[1] + '.' + emailParts[2];
    const emailLink = document.getElementById('confirmation-email-link-en');
    if (emailLink) {
      emailLink.href = 'mailto:' + email;
      emailLink.textContent = email;
    }
  })();
</script>

