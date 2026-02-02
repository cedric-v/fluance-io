---
layout: base.njk
title: Réservation confirmée
description: "Votre réservation pour un cours Fluance est confirmée"
locale: fr
permalink: /presentiel/reservation-confirmee/
eleventyExcludeFromCollections: true
---

<section class="max-w-2xl mx-auto px-6 md:px-12 py-16 text-center">
  <div class="mb-8">
    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
      <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1 class="text-3xl font-semibold text-[#3E3A35] mb-4">Réservation confirmée !</h1>
    <p class="text-lg text-[#3E3A35]/70">
      Merci pour votre réservation. Un email de confirmation vous a été envoyé.
    </p>
  </div>

  <div class="bg-white rounded-2xl shadow-lg p-8 mb-8 text-left">
    <h2 class="text-xl font-semibold text-fluance mb-4">📧 Vérifiez votre email</h2>
    <p class="text-[#3E3A35]/70 mb-4">
      Vous recevrez un email avec :
    </p>
    <ul class="space-y-2 text-[#3E3A35]/80">
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>Le récapitulatif de votre réservation</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>L'adresse et les informations pratiques</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="text-fluance">✓</span>
        <span>Un lien pour ajouter le cours à votre calendrier</span>
      </li>
    </ul>
    <p class="text-sm text-[#3E3A35]/50 mt-4">
      Pensez à vérifier vos spams si vous ne trouvez pas l'email.
    </p>
  </div>

  <div class="bg-fluance/5 rounded-2xl p-6 mb-8">
    <h3 class="font-semibold text-[#3E3A35] mb-3">📍 Rappel du lieu</h3>
    <p class="text-[#3E3A35]/80">
      <strong>le duplex danse & bien-être</strong><br>
      Rte de Chantemerle 58d, 1763 Granges-Paccot
    </p>
    <a href="https://maps.app.goo.gl/2a3AZBFTjirjEfm99" 
       target="_blank" 
       rel="noopener noreferrer"
       class="inline-flex items-center gap-1 text-fluance mt-2 hover:underline">
      Voir sur Google Maps →
    </a>
  </div>

  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <a href="{{ '/presentiel/reserver/' | relativeUrl }}" 
       class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] px-6 py-3 rounded-full font-semibold">
      Réserver un autre cours
    </a>
    <a href="{{ '/' | relativeUrl }}" 
       class="px-6 py-3 rounded-full font-semibold border-2 border-fluance text-fluance hover:bg-fluance hover:text-white transition-colors">
      Retour à l'accueil
    </a>
  </div>
</section>

<script>
  // Vérifier le statut du paiement après le retour de Stripe
  (async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntent = urlParams.get('payment_intent');
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    const redirectStatus = urlParams.get('redirect_status');
    
    // Si Stripe indique explicitement que le paiement a été annulé ou a échoué
    if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
      // Rediriger vers la page d'annulation
      const bookingId = urlParams.get('booking_id');
      const cancelUrl = bookingId 
        ? `/presentiel/paiement-annule/?booking_id=${bookingId}`
        : '/presentiel/paiement-annule/';
      window.location.href = cancelUrl;
      return;
    }
    
    // Si on a un payment_intent mais pas de redirect_status, vérifier le statut
    if (paymentIntent && paymentIntentClientSecret && !redirectStatus) {
      try {
        // Vérifier le statut via notre API backend
        const response = await fetch(`https://europe-west1-fluance-protected-content.cloudfunctions.net/checkPaymentStatus?payment_intent=${paymentIntent}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'canceled' || data.status === 'requires_payment_method' || data.status === 'requires_action') {
            // Le paiement a été annulé ou nécessite une action
            const bookingId = urlParams.get('booking_id');
            const cancelUrl = bookingId 
              ? `/presentiel/paiement-annule/?booking_id=${bookingId}`
              : '/presentiel/paiement-annule/';
            window.location.href = cancelUrl;
            return;
          }
          
          // Si le statut est 'succeeded' ou 'processing', on reste sur cette page (confirmation)
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        // En cas d'erreur, on reste sur la page de confirmation
        // (mieux vaut afficher une confirmation que de perdre l'utilisateur)
      }
    }
    
    // Nettoyer l'URL après traitement (garder seulement les paramètres utiles)
    const cleanParams = new URLSearchParams();
    if (paymentIntent) cleanParams.set('payment_intent', paymentIntent);
    if (redirectStatus) cleanParams.set('redirect_status', redirectStatus);
    const bookingIdParam = urlParams.get('booking_id');
    if (bookingIdParam) cleanParams.set('booking_id', bookingIdParam);
    const cleanUrl = cleanParams.toString() 
      ? `${window.location.pathname}?${cleanParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    // Suivi de conversion Google Ads
    // Cas 1 : Paiement Stripe réussi (avec paymentIntent)
    // Cas 2 : Réservation sans paiement (cours gratuit ou espèces) avec bookingId
    const shouldTrackConversion = (paymentIntent && redirectStatus === 'succeeded') || bookingIdParam;
    
    if (shouldTrackConversion) {
      // Fonction pour charger Firebase Functions si nécessaire
      async function loadFirebaseFunctions() {
        return new Promise((resolve, reject) => {
          // Si Firebase Functions est déjà disponible
          if (typeof firebase !== 'undefined' && firebase.functions) {
            resolve();
            return;
          }

          // Configuration Firebase (chargée depuis les variables d'environnement via base.njk)
          const firebaseConfig = window.FLUANCE_FIREBASE_CONFIG;

          if (!firebaseConfig || !firebaseConfig.apiKey) {
            console.error("Firebase configuration is missing!");
            reject(new Error("Firebase configuration non trouvée"));
            return;
          }

          // Charger Firebase App
          const appScriptUrl = 'https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js';
          const functionsScriptUrl = 'https://www.gstatic.com/firebasejs/12.8.0/firebase-functions-compat.js';

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
                  reject(new Error('Firebase App n\'a pas pu être chargé'));
                  return;
                }
                if (!firebase.apps.length) {
                  firebase.initializeApp(firebaseConfig);
                }
                loadFunctions();
              }, 100);
            };
            appScript.onerror = () => reject(new Error('Erreur lors du chargement de Firebase App'));
            document.head.appendChild(appScript);
          }

          function loadFunctions() {
            if (document.querySelector(`script[src="${functionsScriptUrl}"]`)) {
              resolve();
            } else {
              const functionsScript = document.createElement('script');
              functionsScript.src = functionsScriptUrl;
              functionsScript.onload = () => resolve();
              functionsScript.onerror = () => reject(new Error('Erreur lors du chargement de Firebase Functions'));
              document.head.appendChild(functionsScript);
            }
          }
        });
      }

      try {
        // Charger Firebase Functions
        await loadFirebaseFunctions();
        
        // Utiliser firebase.app().functions() pour la version compat
        const app = firebase.app();
        const functions = app.functions('europe-west1');
        const getBookingDetails = functions.httpsCallable('getBookingDetails');
        
        // Appeler la fonction avec paymentIntentId ou bookingId selon ce qui est disponible
        const requestData = paymentIntent && redirectStatus === 'succeeded'
          ? { paymentIntentId: paymentIntent }
          : { bookingId: bookingIdParam };
        
        const result = await getBookingDetails(requestData);
        
        if (result.data && result.data.success) {
          const { product, productName, amount, currency, courseName, courseDate, courseTime, bookingId } = result.data;
          
          // Utiliser paymentIntent comme transaction_id si disponible, sinon bookingId
          const transactionId = paymentIntent || bookingId;
          
          // Envoyer les événements de conversion à Google Ads via dataLayer
          if (window.dataLayer) {
            // Événement e-commerce standard pour Google Analytics
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
            
            // Événement personnalisé pour les réservations de cours
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
        // Ne pas bloquer l'affichage de la page en cas d'erreur
      }
    }
  })();
</script>
