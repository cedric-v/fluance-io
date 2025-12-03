---
layout: base.njk
title: Contact
description: Contact us for any questions or help.
locale: en
permalink: /en/contact/
---

<section id="contact" class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <div class="section-card p-8 bg-white text-center space-y-6">
    <h1 class="text-3xl font-semibold text-[#82153e]">Contact Cédric</h1>
    <p class="text-lg text-[#0f172a]/80">
      Have a question? A request? Write to one of the addresses mentioned
    </p>
    <button onclick="document.getElementById('helpBtn')?.click()" class="btn-primary inline-flex">
      Ask a question
    </button>
  </div>

  <div class="section-card p-8 bg-white space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Messaging</h2>
      <p class="text-[#0f172a]/80 mb-4">
        Text or voice messages (no calls)
      </p>
      <div class="flex flex-col sm:flex-row gap-3">
        <a href="https://wa.me/41793768173" id="whatsapp-link-en" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-full font-semibold hover:bg-[#20BA5A] transition-colors shadow-md no-underline cursor-pointer" style="background-color: #25D366; color: white; text-decoration: none;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          <span style="color: white; font-weight: 600;">WhatsApp</span>
        </a>
        <a href="https://signal.me/#p/41793768173" id="signal-link-en" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#3A76F0] text-white rounded-full font-semibold hover:bg-[#2E5FD9] transition-colors shadow-md no-underline cursor-pointer" style="background-color: #3A76F0; color: white; text-decoration: none;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221c-.169 0-.349.018-.538.038v-.038c0-1.275-.96-2.32-2.16-2.32h-.04c-.6 0-1.14.24-1.54.64-.4-.4-.94-.64-1.54-.64h-.04c-1.2 0-2.16 1.045-2.16 2.32v.038c-.189-.02-.369-.038-.538-.038-1.275 0-2.32 1.045-2.32 2.32 0 1.275 1.045 2.32 2.32 2.32.169 0 .349-.018.538-.038v.038c0 1.275.96 2.32 2.16 2.32h.04c.6 0 1.14-.24 1.54-.64.4.4.94.64 1.54.64h.04c1.2 0 2.16-1.045 2.16-2.32v-.038c.189.02.369.038.538.038 1.275 0 2.32-1.045 2.32-2.32 0-1.275-1.045-2.32-2.32-2.32zm-5.894 7.68c-1.275 0-2.32-1.045-2.32-2.32s1.045-2.32 2.32-2.32 2.32 1.045 2.32 2.32-1.045 2.32-2.32 2.32z"/>
          </svg>
          <span style="color: white; font-weight: 600;">Signal</span>
        </a>
      </div>
    </div>

    <div class="pt-6 border-t border-[#82153e]/20">
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Email</h2>
      <p class="text-[#0f172a]/80">
        <a href="#" id="contact-email-link-en" class="text-[#82153e] hover:underline"></a>
      </p>
    </div>

    <div class="pt-6 border-t border-[#82153e]/20">
      <h2 class="text-xl font-semibold text-[#82153e] mb-3">Address</h2>
      <p class="text-[#0f172a]/80">
        Instants Zen Sàrl<br>
        Case postale<br>
        1782 Belfaux<br>
        Switzerland
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

  // Protection anti-scraping : construction dynamique des numéros WhatsApp et Signal
  (function() {
    function initMessaging() {
      const countryCode = '41';
      const phoneParts = ['793', '768', '173'];
      const phoneNumber = countryCode + phoneParts[0] + phoneParts[1] + phoneParts[2];
      
      const whatsappLink = document.getElementById('whatsapp-link-en');
      if (whatsappLink && whatsappLink.href.includes('wa.me')) {
        whatsappLink.href = 'https://wa.me/' + phoneNumber;
      }
      
      const signalLink = document.getElementById('signal-link-en');
      if (signalLink && signalLink.href.includes('signal.me')) {
        signalLink.href = 'https://signal.me/#p/' + phoneNumber;
      }
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMessaging);
    } else {
      initMessaging();
    }
  })();
</script>

