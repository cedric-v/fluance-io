---
layout: base.njk
title: Book a Class - In-Person Classes
description: "Book your spot for Fluance in-person classes in Fribourg"
locale: en
permalink: /en/presentiel/reserver/
---

<section class="max-w-6xl mx-auto px-6 md:px-12 py-16">
  <header class="text-center mb-12">
    <h1 class="text-4xl font-semibold text-[#3E3A35] mb-4">Book a Class</h1>
    <p class="text-lg text-[#3E3A35]/70 max-w-2xl mx-auto">
      Choose the time slot that suits you and book your spot in just a few clicks.
    </p>
  </header>

  <!-- List of available courses -->
  <div id="courses-list" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
    <div class="col-span-full text-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-fluance border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-[#3E3A35]/60">Loading available classes...</p>
    </div>
  </div>

  <!-- Pricing information -->
  <div class="bg-white rounded-2xl shadow-lg p-8 mb-12">
    <h2 class="text-2xl font-semibold text-fluance mb-6 text-center">Our Pricing Options</h2>
    <div class="grid md:grid-cols-4 gap-6 mb-8">
      <div class="text-center p-4 rounded-xl border-2 border-green-200 bg-green-50">
        <span class="inline-block bg-green-500 text-white text-xs px-3 py-1 rounded-full mb-3">FREE</span>
        <h3 class="font-semibold text-[#3E3A35] mb-1">Trial Class</h3>
        <p class="text-2xl font-bold text-green-600 mb-2">Free</p>
        <p class="text-sm text-[#3E3A35]/60">First session offered</p>
      </div>
      <div class="text-center p-4 rounded-xl border-2 border-gray-200">
        <h3 class="font-semibold text-[#3E3A35] mb-1">À la carte</h3>
        <p class="text-2xl font-bold text-fluance mb-2">25 CHF</p>
        <p class="text-sm text-[#3E3A35]/60">Single session</p>
      </div>
      <div class="text-center p-4 rounded-xl border-2 border-fluance bg-fluance/5 relative">
        <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-fluance text-white text-xs px-3 py-1 rounded-full">POPULAR</span>
        <h3 class="font-semibold text-[#3E3A35] mb-1">Flow Pass</h3>
        <p class="text-2xl font-bold text-fluance mb-2">210 CHF</p>
        <p class="text-sm text-[#3E3A35]/60">10 sessions at your own pace (valid for 12 months)</p>
      </div>
      <div class="text-center p-4 rounded-xl border-2 border-[#E6B84A] bg-[#E6B84A]/5 relative">
        <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E6B84A] text-[#7A1F3D] text-xs px-3 py-1 rounded-full font-semibold">UNLIMITED</span>
        <h3 class="font-semibold text-[#3E3A35] mb-1">Semester Pass</h3>
        <p class="text-2xl font-bold text-[#E6B84A] mb-2">340 CHF</p>
        <p class="text-sm text-[#3E3A35]/60">Unlimited for 6 months</p>
      </div>
    </div>
    <div class="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
      <p class="text-[#3E3A35]"><strong>Special launch offer for retirees:</strong> -50% on Flow Pass and Semester Pass with the code <span class="bg-yellow-200 px-2 py-0.5 rounded font-mono font-bold text-fluance">RETRAITE50</span></p>
    </div>
  </div>

  <!-- Payment methods -->
  <div class="text-center mb-8">
    <p class="text-sm text-[#3E3A35]/60 mb-4">Accepted payment methods</p>
    <div class="flex flex-wrap items-center justify-center gap-4">
      <img src="{{ '/assets/img/payment-logos/visa.svg' | relativeUrl }}" alt="VISA" class="h-8 object-contain" loading="lazy">
      <img src="{{ '/assets/img/payment-logos/mastercard.svg' | relativeUrl }}" alt="Mastercard" class="h-8 object-contain" loading="lazy">
      <img src="{{ '/assets/img/payment-logos/twint.svg' | relativeUrl }}" alt="TWINT" class="h-8 object-contain" loading="lazy">
      <img src="{{ '/assets/img/payment-logos/apple-pay.svg' | relativeUrl }}" alt="Apple Pay" class="h-8 object-contain" loading="lazy">
      <img src="{{ '/assets/img/payment-logos/google-pay.svg' | relativeUrl }}" alt="Google Pay" class="h-8 object-contain" loading="lazy">
      <span class="text-[#3E3A35]/60 text-sm">or cash on site</span>
    </div>
    <p class="text-xs text-[#3E3A35]/50 mt-3">💡 For cash payments, please bring the exact amount</p>
  </div>
</section>

<!-- Booking modal (content generated dynamically by JavaScript) -->
<div id="booking-modal" class="hidden fixed inset-0 z-50 bg-black/50 items-center justify-center p-4">
  <div class="modal-content bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
    <!-- Content is generated dynamically by booking.js -->
  </div>
</div>

<!-- Booking script -->
{% stripeConfig %}
<script src="https://js.stripe.com/v3/"></script>
<script src="{{ '/assets/js/booking.js' | relativeUrl }}"></script>
