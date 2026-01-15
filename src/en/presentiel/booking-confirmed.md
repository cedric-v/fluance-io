---
layout: base.njk
title: Booking Confirmed
description: "Your Fluance course booking is confirmed"
locale: en
permalink: /en/presentiel/booking-confirmed/
eleventyExcludeFromCollections: true
---

<section class="max-w-2xl mx-auto px-6 md:px-12 py-16 text-center">
  <div class="mb-8">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
      <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4">Booking Confirmed!</h1>
    <p class="text-lg text-[#3E3A35]/70">
      Thank you for your booking. A confirmation email has been sent to you.
    </p>
  </div>

  <div class="bg-white rounded-2xl shadow-lg p-8 mb-8 text-left">
    <h2 class="text-xl font-semibold text-fluance mb-4">📧 Check your email</h2>
    <p class="text-[#3E3A35]/70 mb-4">
      You will receive an email with:
    </p>
    <ul class="space-y-2 text-[#3E3A35]/80">
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>Your booking summary</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>Address and practical information</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>A link to add the class to your calendar</span>
      </li>
    </ul>
    <p class="text-sm text-[#3E3A35]/50 mt-4">
      Please check your spam folder if you can't find the email.
    </p>
  </div>

  <div class="bg-fluance/5 rounded-2xl p-6 mb-8">
    <h3 class="font-semibold text-[#3E3A35] mb-3">📍 Location reminder</h3>
    <p class="text-[#3E3A35]/80">
      <strong>le duplex danse & bien-être</strong><br>
      Rte de Chantemerle 58d, 1763 Granges-Paccot
    </p>
    <a href="https://maps.app.goo.gl/2a3AZBFTjirjEfm99" 
       target="_blank" 
       rel="noopener noreferrer"
       class="inline-flex items-center gap-1 text-fluance mt-2 hover:underline">
      View on Google Maps →
    </a>
  </div>

  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="{{ '/en/presentiel/reserver/' | relativeUrl }}" 
       class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-6 py-3 rounded-full font-semibold">
      Book another class
    </a>
    <a href="{{ '/en/' | relativeUrl }}" 
       class="px-6 py-3 rounded-full font-semibold border-2 border-fluance text-fluance hover:bg-fluance hover:text-white transition-colors">
      Back to home
    </a>
  </div>
</section>

<script>
  // Check payment status after return from Stripe
  (async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntent = urlParams.get('payment_intent');
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    const redirectStatus = urlParams.get('redirect_status');
    
    // If Stripe explicitly indicates payment was canceled or failed
    if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
      // Redirect to cancellation page
      const bookingId = urlParams.get('booking_id');
      const cancelUrl = bookingId 
        ? `/en/presentiel/payment-cancelled/?booking_id=${bookingId}`
        : '/en/presentiel/payment-cancelled/';
      window.location.href = cancelUrl;
      return;
    }
    
    // If we have a payment_intent but no redirect_status, check the status
    if (paymentIntent && paymentIntentClientSecret && !redirectStatus) {
      try {
        // Check status via our backend API
        const response = await fetch(`https://europe-west1-fluance-protected-content.cloudfunctions.net/checkPaymentStatus?payment_intent=${paymentIntent}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'canceled' || data.status === 'requires_payment_method' || data.status === 'requires_action') {
            // Payment was canceled or requires action
            const bookingId = urlParams.get('booking_id');
            const cancelUrl = bookingId 
              ? `/en/presentiel/payment-cancelled/?booking_id=${bookingId}`
              : '/en/presentiel/payment-cancelled/';
            window.location.href = cancelUrl;
            return;
          }
          
          // If status is 'succeeded' or 'processing', stay on this page (confirmation)
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        // On error, stay on confirmation page
        // (better to show confirmation than lose the user)
      }
    }
    
    // Clean URL after processing (keep only useful parameters)
    const cleanParams = new URLSearchParams();
    if (paymentIntent) cleanParams.set('payment_intent', paymentIntent);
    if (redirectStatus) cleanParams.set('redirect_status', redirectStatus);
    const bookingIdParam = urlParams.get('booking_id');
    if (bookingIdParam) cleanParams.set('booking_id', bookingIdParam);
    const cleanUrl = cleanParams.toString() 
      ? `${window.location.pathname}?${cleanParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    // Google Ads conversion tracking
    // Case 1: Successful Stripe payment (with paymentIntent)
    // Case 2: Booking without payment (free trial or cash) with bookingId
    const shouldTrackConversion = (paymentIntent && redirectStatus === 'succeeded') || bookingIdParam;
    
    if (shouldTrackConversion) {
      // Function to load Firebase Functions if needed
      async function loadFirebaseFunctions() {
        return new Promise((resolve, reject) => {
          // If Firebase Functions is already available
          if (typeof firebase !== 'undefined' && firebase.functions) {
            resolve();
            return;
          }

          // Firebase configuration
          const firebaseConfig = {
            apiKey: 'AIzaSyDJ-VlDMC5PUEMeILLZ8OmdYIhvhxIfhdM',
            authDomain: 'fluance-protected-content.firebaseapp.com',
            projectId: 'fluance-protected-content',
            storageBucket: 'fluance-protected-content.firebasestorage.app',
            messagingSenderId: '173938686776',
            appId: '1:173938686776:web:891caf76098a42c3579fcd',
          };

          // Load Firebase App
          const appScriptUrl = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js';
          const functionsScriptUrl = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions-compat.js';

          if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
              firebase.initializeApp(firebaseConfig);
            }
            loadFunctions();
          } else {
            const appScript = document.createElement('script');
            appScript.src = appScriptUrl;
            appScript.onload = () => {
              setTimeout(() => {
                if (typeof firebase === 'undefined') {
                  reject(new Error('Firebase App could not be loaded'));
                  return;
                }
                if (!firebase.apps.length) {
                  firebase.initializeApp(firebaseConfig);
                }
                loadFunctions();
              }, 100);
            };
            appScript.onerror = () => reject(new Error('Error loading Firebase App'));
            document.head.appendChild(appScript);
          }

          function loadFunctions() {
            if (document.querySelector(`script[src="${functionsScriptUrl}"]`)) {
              resolve();
            } else {
              const functionsScript = document.createElement('script');
              functionsScript.src = functionsScriptUrl;
              functionsScript.onload = () => resolve();
              functionsScript.onerror = () => reject(new Error('Error loading Firebase Functions'));
              document.head.appendChild(functionsScript);
            }
          }
        });
      }

      try {
        // Load Firebase Functions
        await loadFirebaseFunctions();
        
        const functions = firebase.functions('europe-west1');
        const getBookingDetails = functions.httpsCallable('getBookingDetails');
        
        // Call the function with paymentIntentId or bookingId depending on what's available
        const requestData = paymentIntent && redirectStatus === 'succeeded'
          ? { paymentIntentId: paymentIntent }
          : { bookingId: bookingIdParam };
        
        const result = await getBookingDetails(requestData);
        
        if (result.data && result.data.success) {
          const { product, productName, amount, currency, courseName, courseDate, courseTime, bookingId } = result.data;
          
          // Use paymentIntent as transaction_id if available, otherwise bookingId
          const transactionId = paymentIntent || bookingId;
          
          // Send conversion events to Google Ads via dataLayer
          if (window.dataLayer) {
            // Standard e-commerce event for Google Analytics
            window.dataLayer.push({
              event: 'purchase',
              transaction_id: transactionId,
              value: amount,
              currency: currency,
              items: [{
                item_id: product,
                item_name: productName,
                item_category: 'course_booking',
                price: amount,
                quantity: 1
              }]
            });
            
            // Custom event for course bookings
            window.dataLayer.push({
              event: 'course_booking_confirmed',
              booking_type: product,
              booking_name: productName,
              course_name: courseName,
              course_date: courseDate,
              course_time: courseTime,
              value: amount,
              currency: currency,
              transaction_id: transactionId
            });
            
            console.log('Conversion tracked:', { product, productName, amount, currency, transactionId });
          } else {
            console.warn('dataLayer not available - GTM may not be loaded');
          }
        }
      } catch (error) {
        console.error('Error tracking conversion:', error);
        // Don't block page display on error
      }
    }
  })();
</script>
