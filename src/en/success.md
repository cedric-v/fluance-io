---
layout: base.njk
title: Payment successful
description: Your payment has been processed successfully.
locale: en
permalink: /en/success/
eleventyExcludeFromCollections: true
robots: noindex, nofollow
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <div class="text-center space-y-4">
    <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
      <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1 class="text-4xl font-semibold text-[#3E3A35]">Payment successful!</h1>
    <p class="text-xl text-[#3E3A35]">Thank you for your purchase. You will receive a confirmation email shortly.</p>
  </div>

  <div id="loading" class="text-center py-8">
    <p class="text-gray-600">Loading...</p>
  </div>

  <div id="success-content" class="hidden">
    <div class="section-card p-8 bg-white space-y-6">
      <h2 class="text-2xl font-semibold text-fluance">Next steps</h2>
      <p class="text-lg text-[#3E3A35]">
        You will receive an email with your login information in a few minutes.
      </p>
      <div class="pt-4">
        <a href="/en/membre/" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] inline-block text-center">
          Access my member area
        </a>
      </div>
    </div>
  </div>
</section>

<script>
document.addEventListener('DOMContentLoaded', async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  
  if (!sessionId) {
    console.error('No session_id found in URL');
    document.getElementById('loading').innerHTML = '<p class="text-red-600">Error: session_id missing</p>';
    return;
  }

  try {
    // Load Firebase Functions
    if (typeof firebase === 'undefined') {
      console.error('Firebase not loaded');
      document.getElementById('loading').innerHTML = '<p class="text-red-600">Error: Firebase not loaded</p>';
      return;
    }
    
    const app = firebase.app();
    const functions = app.functions('europe-west1');
    const getSession = functions.httpsCallable('getStripeCheckoutSession');
    
    // Retrieve session details
    const result = await getSession({ sessionId });
    
    if (result.data && result.data.success) {
      const { product, productName, amount, currency } = result.data;
      
      // Show success content
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('success-content').classList.remove('hidden');
      
      // Send conversion events to Google Analytics
      if (window.dataLayer) {
        // Standard e-commerce event
        window.dataLayer.push({
          event: 'purchase',
          transaction_id: sessionId,
          value: amount,
          currency: currency,
          items: [{
            item_id: product,
            item_name: productName,
            price: amount,
            quantity: 1
          }]
        });
        
        // Custom Fluance event
        window.dataLayer.push({
          event: 'conversion_fluance',
          product: product,
          product_name: productName,
          value: amount,
          currency: currency,
          transaction_id: sessionId
        });
        
        console.log('Conversion tracked:', { product, productName, amount, currency });
      } else {
        console.warn('dataLayer not available - GTM may not be loaded');
      }
    } else {
      throw new Error('Failed to retrieve session details');
    }
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('loading').innerHTML = '<p class="text-red-600">Error loading details</p>';
  }
});
</script>
