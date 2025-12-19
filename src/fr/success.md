---
layout: base.njk
title: Paiement réussi
description: Votre paiement a été traité avec succès.
locale: fr
permalink: /success/
eleventyExcludeFromCollections: true
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <div class="text-center space-y-4">
    <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
      <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1 class="text-4xl font-semibold text-[#3E3A35]">Paiement réussi !</h1>
    <p class="text-xl text-[#3E3A35]">Merci pour votre achat. Vous allez recevoir un email de confirmation sous peu.</p>
  </div>

  <div id="loading" class="text-center py-8">
    <p class="text-gray-600">Chargement...</p>
  </div>

  <div id="success-content" class="hidden">
    <div class="section-card p-8 bg-white space-y-6">
      <h2 class="text-2xl font-semibold text-fluance">Prochaines étapes</h2>
      <p class="text-lg text-[#3E3A35]">
        Vous allez recevoir un email avec vos informations de connexion dans quelques minutes.
      </p>
      <div class="pt-4">
        <a href="/membre/" class="btn-primary !text-[#7A1F3D] bg-[#E6B84A] hover:bg-[#E8C15A] inline-block text-center">
          Accéder à mon espace membre
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
    document.getElementById('loading').innerHTML = '<p class="text-red-600">Erreur : session_id manquant</p>';
    return;
  }

  try {
    // Charger Firebase Functions
    if (typeof firebase === 'undefined') {
      console.error('Firebase not loaded');
      document.getElementById('loading').innerHTML = '<p class="text-red-600">Erreur : Firebase non chargé</p>';
      return;
    }
    
    const app = firebase.app();
    const functions = app.functions('europe-west1');
    const getSession = functions.httpsCallable('getStripeCheckoutSession');
    
    // Récupérer les détails de la session
    const result = await getSession({ sessionId });
    
    if (result.data && result.data.success) {
      const { product, productName, amount, currency } = result.data;
      
      // Afficher le contenu de succès
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('success-content').classList.remove('hidden');
      
      // Envoyer les événements de conversion à Google Analytics
      if (window.dataLayer) {
        // Événement e-commerce standard
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
        
        // Événement personnalisé Fluance
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
    document.getElementById('loading').innerHTML = '<p class="text-red-600">Erreur lors du chargement des détails</p>';
  }
});
</script>
