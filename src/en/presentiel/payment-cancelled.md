---
layout: base.njk
title: Payment Cancelled
description: "Your payment has been cancelled"
locale: en
permalink: /en/presentiel/payment-cancelled/
eleventyExcludeFromCollections: true
---

<section class="max-w-2xl mx-auto px-6 md:px-12 py-16 text-center">
  <div class="mb-8">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-6">
      <svg class="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </div>
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4">Payment Cancelled</h1>
    <p class="text-lg text-[#3E3A35]/70 mb-2">
      Your payment has been cancelled and your booking has not been confirmed.
    </p>
    <p class="text-[#3E3A35]/60 text-sm">
      No amount has been charged to your account.
    </p>
  </div>

  <div class="bg-white rounded-2xl shadow-lg p-8 mb-8">
    <h2 class="text-xl font-semibold text-fluance mb-4">💡 What to do now?</h2>
    <p class="text-[#3E3A35]/70 mb-4">
      You can:
    </p>
    <ul class="space-y-3 text-[#3E3A35]/80 text-left max-w-md mx-auto">
      <li class="flex items-start gap-2">
        <span class="text-fluance mt-1">→</span>
        <span><strong>Retry the payment</strong> by going back to the booking page</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-fluance mt-1">→</span>
        <span><strong>Choose another time slot</strong> if this one no longer suits you</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="text-fluance mt-1">→</span>
        <span><strong>Opt for cash payment</strong> on site (exact amount required)</span>
      </li>
    </ul>
  </div>

  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="{{ '/en/presentiel/reserver/' | relativeUrl }}" 
       id="retry-booking-link"
       class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-6 py-3 rounded-full font-semibold">
      Retry booking
    </a>
    <a href="{{ '/en/' | relativeUrl }}" 
       class="px-6 py-3 rounded-full font-semibold border-2 border-fluance text-fluance hover:bg-fluance hover:text-white transition-colors">
      Back to home
    </a>
  </div>
</section>

<script>
  // If a bookingId is present in the URL, we can offer to retry directly
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('booking_id');
  
  if (bookingId) {
    // Optional: we could pre-fill the form with booking info
    // For now, we just redirect to the booking page
    const retryLink = document.getElementById('retry-booking-link');
    if (retryLink) {
      // Link stays to the general booking page
      // User will need to make a new booking
    }
  }
  
  // Clean URL after processing
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
</script>
