---
layout: base.njk
title: Contact
description: Contact Fluance for questions about our courses, workshops, or to learn more about our approach to body and mind fluidity.
locale: en
permalink: /en/contact/
---

<section id="contact" class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <div class="section-card p-8 bg-white text-center space-y-6">
    <h1 class="text-3xl font-semibold text-fluance">Contact Cédric</h1>
    <p class="text-lg text-[#3E3A35]">
      Have a question? A request? Write to one of the addresses mentioned
    </p>
  </div>

  <div class="section-card p-8 bg-white space-y-6">
    <h2 class="text-xl font-semibold text-fluance mb-3">Send a message</h2>
    <p class="text-[#3E3A35] mb-4">
      Fill in the form below — I usually reply within 24 to 48&nbsp;hours on business days.
    </p>

    <form id="contact-form" class="space-y-4" autocomplete="off" data-form-type="other" data-1p-ignore="true" data-lpignore="true" data-lastpass-ignore="true" data-bwignore="true" novalidate>
      <!-- Honeypot anti-bot : champ invisible, jamais rempli par un humain. -->
      <div aria-hidden="true" style="position:absolute !important;left:-9999px !important;width:1px;height:1px;overflow:hidden;">
        <label for="contact-website">Website</label>
        <input type="text" id="contact-website" name="website" tabindex="-1" autocomplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="other" data-bwignore="true">
      </div>

      <input type="hidden" name="site_id" value="fluance">
      <input type="hidden" name="contact_started_at" id="contact-started-at" value="">

      <div>
        <label for="contact-name" class="block text-sm font-medium text-gray-700 mb-2">Your name <span class="text-red-500">*</span></label>
        <input type="text" id="contact-name" name="name" required maxlength="120" autocomplete="name" data-1p-ignore="true" data-lpignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#5B8A8F] focus:border-transparent">
      </div>

      <div>
        <label for="contact-email" class="block text-sm font-medium text-gray-700 mb-2">Your email <span class="text-red-500">*</span></label>
        <input type="email" id="contact-email" name="email" required maxlength="254" autocomplete="email" data-1p-ignore="true" data-lpignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#5B8A8F] focus:border-transparent">
      </div>

      <div>
        <label for="contact-subject" class="block text-sm font-medium text-gray-700 mb-2">Subject</label>
        <input type="text" id="contact-subject" name="subject" maxlength="200" data-1p-ignore="true" data-lpignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#5B8A8F] focus:border-transparent">
      </div>

      <div>
        <label for="contact-message" class="block text-sm font-medium text-gray-700 mb-2">Your message <span class="text-red-500">*</span></label>
        <textarea id="contact-message" name="message" required rows="6" maxlength="5000" data-1p-ignore="true" data-lpignore="true" data-form-type="other" data-bwignore="true" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#5B8A8F] focus:border-transparent"></textarea>
        <p class="text-xs text-gray-500 mt-1">Minimum 10 characters.</p>
      </div>

      <div id="contact-form-message" class="hidden text-sm" role="status" aria-live="polite"></div>

      <!-- Cloudflare Turnstile (rendu explicite par le script ci-dessous). -->
      <div id="contact-turnstile-widget" aria-label="Cloudflare Turnstile anti-bot verification" role="region"></div>
      <div id="contact-turnstile-loading" class="text-sm text-gray-600 mb-2" style="display:none;">⏳ Loading anti-bot verification…</div>
      <div id="contact-turnstile-error" class="text-sm text-yellow-600 mb-2 hidden">⚠️ The anti-bot verification is temporarily unavailable. Please refresh the page and try again.</div>

      <button type="submit" id="contact-submit-btn" class="w-full btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] py-3 px-6 rounded-md font-medium transition-colors">
        <span id="contact-submit-text">Send message</span>
        <span id="contact-submit-loading" class="hidden">Sending…</span>
      </button>

      <div class="text-xs text-gray-500 mt-4">
        Your data is used only to process your request and reply to you.
        See the <a href="/mentions-legales/" class="text-[#5B8A8F] hover:underline" target="_blank">legal notice and privacy policy</a>.
      </div>
    </form>
  </div>

  <div class="section-card p-8 bg-white space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-fluance mb-3">Instant messaging</h2>
      <p class="text-[#3E3A35] mb-4">
        Text or voice messages (no calls)
      </p>
      <div class="flex flex-col sm:flex-row gap-3">
        <a href="https://wa.me/message/J3EROZAQFOSJM1" id="whatsapp-link-en" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-full font-semibold hover:bg-[#20BA5A] transition-colors shadow-md no-underline cursor-pointer" style="background-color: #25D366; color: #F5F7F6; text-decoration: none;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          <span style="color: #F5F7F6; font-weight: 600;">WhatsApp</span>
        </a>
      </div>
    </div>

    <div class="pt-6 border-t border-fluance/20">
      <h2 class="text-xl font-semibold text-fluance mb-3">Email</h2>
      <p class="text-[#3E3A35]">
        <a href="#" id="contact-email-link-en" class="text-fluance hover:underline"></a>
      </p>
    </div>

    <div class="pt-6 border-t border-fluance/20">
      <h2 class="text-xl font-semibold text-fluance mb-3">Address</h2>
      <p class="text-[#3E3A35]">
        Instants Zen Sàrl<br>
        Case postale<br>
        1782 Belfaux<br>
        Switzerland
      </p>
    </div>
  </div>
</section>

<section id="testimonials" class="max-w-6xl mx-auto px-6 md:px-12 pb-16" aria-labelledby="testimonials-title">
  <div class="text-center space-y-4">
    <p class="cta-pill mx-auto bg-[#E6B84A]/20 text-fluance">What they say</p>
    <h2 id="testimonials-title" class="text-3xl md:text-4xl font-semibold text-fluance">
      What people who practise Fluance have to say
    </h2>
    <p class="max-w-2xl mx-auto text-[#3E3A35]/75">
      Feedback from participants in the online programmes, about movement, relaxation and reconnecting with the body.
    </p>
  </div>
  {% include "testimonials.njk" %}
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

<script>
// Robust contact form (anti-bot / anti-spam)
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const messageDiv = document.getElementById('contact-form-message');
  const submitBtn = document.getElementById('contact-submit-btn');
  const submitText = document.getElementById('contact-submit-text');
  const submitLoading = document.getElementById('contact-submit-loading');
  const turnstileWidget = document.getElementById('contact-turnstile-widget');
  const turnstileLoading = document.getElementById('contact-turnstile-loading');
  const turnstileError = document.getElementById('contact-turnstile-error');
  const startedAt = document.getElementById('contact-started-at');

  const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.endsWith('.local');

  // Anti-bot : the server rejects submissions made in under 3 s
  // (too fast) and forms left open for more than 12 h.
  startedAt.value = String(Date.now());

  let turnstileRendered = false;
  let turnstileWidgetId = null;

  function showMessage(text, type) {
    if (!messageDiv) return;
    messageDiv.textContent = text;
    messageDiv.className = 'text-sm ' + (type === 'success' ? 'text-green-600' : 'text-red-600');
    messageDiv.classList.remove('hidden');
  }

  function markTurnstileFailed() {
    if (turnstileLoading) turnstileLoading.style.display = 'none';
    if (turnstileError) {
      turnstileError.textContent = '⚠️ The anti-bot verification failed to load. Please refresh the page and try again.';
      turnstileError.classList.remove('hidden');
    }
    if (turnstileWidget) turnstileWidget.style.display = 'none';
  }

  if (turnstileWidget) {
    if (!isLocalhost && turnstileLoading) turnstileLoading.style.display = 'block';

    let loadTimeout = setTimeout(function() {
      if (!turnstileRendered) markTurnstileFailed();
    }, 3000);

    // Explicit rendering as soon as the Turnstile script is available.
    function initTurnstile() {
      if (typeof turnstile === 'undefined') {
        setTimeout(initTurnstile, 100);
        return;
      }
      if (turnstileRendered) return;
      if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }

      try {
        turnstileWidgetId = turnstile.render(turnstileWidget, {
          sitekey: isLocalhost ? '0x4AAAAAAABkMYinukE8K9X0' : '0x4AAAAAACF5HWhHHcGA5yJk',
          theme: 'light',
          size: 'normal',
          action: 'contact-submit',
          retry: 'auto',
          'refresh-expired': 'auto',
          callback: function() {
            if (turnstileLoading) turnstileLoading.style.display = 'none';
            if (turnstileError) turnstileError.classList.add('hidden');
          },
          'error-callback': function(error) {
            console.error('[Contact] Turnstile error:', error);
          },
        });
        turnstileRendered = true;
        turnstileWidget.style.display = 'block';
        if (turnstileLoading) turnstileLoading.style.display = 'none';
        if (turnstileError) turnstileError.classList.add('hidden');
      } catch (error) {
        console.error('[Contact] Turnstile render failed:', error);
        markTurnstileFailed();
      }
    }
    initTurnstile();
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = form.elements['name'].value.trim();
    const email = form.elements['email'].value.trim();
    const subject = form.elements['subject'].value.trim();
    const message = form.elements['message'].value.trim();

    if (!name) return showMessage('Please enter your name.', 'error');
    if (!email) return showMessage('Please enter your email.', 'error');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return showMessage('Please enter a valid email address.', 'error');
    if (message.length < 10) return showMessage('Your message must contain at least 10 characters.', 'error');
    const linkCount = (message.match(/https?:\/\//g) || []).length;
    if (linkCount > 3) return showMessage('Too many links in the message.', 'error');

    // The server requires a valid Turnstile token (no fallback).
    let turnstileToken = null;
    if (!isLocalhost) {
      const resp = document.querySelector('[name="cf-turnstile-response"]');
      if (!resp || !resp.value) {
        return showMessage('The anti-bot verification is temporarily unavailable. Please try again in a few moments.', 'error');
      }
      turnstileToken = resp.value;
    }

    submitBtn.disabled = true;
    submitText.classList.add('hidden');
    submitLoading.classList.remove('hidden');
    if (messageDiv) messageDiv.classList.add('hidden');

    try {
      const payload = {
        site_id: 'fluance',
        name: name,
        email: email,
        subject: subject,
        message: message,
        contact_started_at: startedAt.value,
      };
      if (turnstileToken) payload['cf-turnstile-response'] = turnstileToken;

      const endpoint = isLocalhost
        ? 'https://europe-west1-fluance-protected-content.cloudfunctions.net/sendContactEmail'
        : 'https://fluance.io/api/send-contact-email';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(function() { return {}; });

      if (response.ok && data.success) {
        form.reset();
        startedAt.value = String(Date.now());
        if (window.turnstile && turnstileWidgetId) window.turnstile.reset(turnstileWidgetId);
        showMessage('Thank you! Your message has been sent. I usually reply within 24 to 48 hours on business days.', 'success');
      } else {
        showMessage(data.error || 'An error occurred. Please try again.', 'error');
      }
    } catch (error) {
      console.error('[Contact] Error while sending:', error);
      showMessage('An error occurred. Please try again later.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitText.classList.remove('hidden');
      submitLoading.classList.add('hidden');
    }
  });
});
</script>

<!-- Cloudflare Turnstile Script -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

