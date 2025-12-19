# Configuration du suivi de conversions Google Analytics

Ce guide explique comment configurer le suivi des conversions pour les produits "21 jours" et "approche complète" sur Google Analytics.

## Vue d'ensemble

Le suivi des conversions est implémenté via :
1. **Google Tag Manager (GTM)** : Déjà configuré avec l'ID `GTM-FVTMPVN2`
2. **Page de succès** : `/success` qui récupère les détails de la session Stripe
3. **Événements GA4** : Envoi d'événements de conversion avec les détails du produit

## Architecture

### Flux de conversion

1. **Utilisateur clique sur "Acheter"** → Redirection vers Stripe Checkout
2. **Paiement réussi** → Redirection vers `/success?session_id={CHECKOUT_SESSION_ID}`
3. **Page success** :
   - Récupère le `session_id` depuis l'URL
   - Appelle une fonction Firebase pour récupérer les détails de la session
   - Envoie un événement de conversion à Google Analytics

### Événements Google Analytics

Deux événements sont envoyés :

#### 1. `purchase` (événement e-commerce standard)
```javascript
{
  event: 'purchase',
  transaction_id: 'cs_xxxxx', // Session ID Stripe
  value: 19.00, // Montant en CHF
  currency: 'CHF',
  items: [{
    item_id: '21jours', // ou 'complet'
    item_name: 'Défi 21 jours', // ou 'Approche Fluance complète'
    price: 19.00, // ou 30.00 pour complet
    quantity: 1
  }]
}
```

#### 2. `conversion_fluance` (événement personnalisé)
```javascript
{
  event: 'conversion_fluance',
  product: '21jours', // ou 'complet'
  product_name: 'Défi 21 jours', // ou 'Approche Fluance complète'
  value: 19.00, // Montant en CHF
  currency: 'CHF',
  transaction_id: 'cs_xxxxx'
}
```

## Configuration

### Étape 1 : Créer la fonction Firebase pour récupérer la session

Ajoutez cette fonction dans `functions/index.js` :

```javascript
/**
 * Récupère les détails d'une session Stripe Checkout
 * Utilisé pour le suivi de conversion Google Analytics
 */
exports.getStripeCheckoutSession = functions.region('europe-west1').runWith({
  secrets: ['STRIPE_SECRET_KEY'],
}).https.onCall(async (data, context) => {
  const { sessionId } = data;
  
  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'sessionId is required');
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer'],
    });

    // Extraire les informations nécessaires
    const product = session.metadata?.product || null;
    const amount = session.amount_total ? session.amount_total / 100 : 0; // Convertir de centimes en unités
    const currency = session.currency?.toUpperCase() || 'CHF';
    const lineItems = session.line_items?.data || [];
    
    // Déterminer le nom du produit
    let productName = '';
    if (product === '21jours') {
      productName = 'Défi 21 jours';
    } else if (product === 'complet') {
      // Déterminer si c'est mensuel ou trimestriel depuis les line_items
      const priceId = lineItems[0]?.price?.id;
      // Vous pouvez ajouter une logique pour déterminer mensuel vs trimestriel
      productName = 'Approche Fluance complète';
    }

    return {
      success: true,
      sessionId: session.id,
      product: product,
      productName: productName,
      amount: amount,
      currency: currency,
      customerEmail: session.customer_details?.email || session.customer_email,
    };
  } catch (error) {
    console.error('Error retrieving Stripe session:', error);
    throw new functions.https.HttpsError('internal', `Error retrieving session: ${error.message}`);
  }
});
```

### Étape 2 : Créer la page de succès

Créez `src/fr/success.md` et `src/en/success.md` :

**src/fr/success.md** :
```markdown
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
```

### Étape 3 : Configurer Google Analytics 4

**⚠️ IMPORTANT : Configuration automatique vs manuelle**

#### Ce qui se passe automatiquement (dès le premier achat) :
- ✅ Les événements `purchase` et `conversion_fluance` sont **automatiquement envoyés** à Google Analytics via `dataLayer`
- ✅ L'événement `purchase` est **automatiquement compté comme conversion** (c'est un événement e-commerce standard de GA4)
- ✅ Vous verrez ces événements dans **Rapports** → **Engagement** → **Événements** dès le premier achat

#### Ce qui nécessite une configuration manuelle (optionnel) :
- 📝 Pour que `conversion_fluance` apparaisse dans les **rapports de conversions** (Admin → Conversions), vous devez le marquer manuellement :
  1. Allez dans **Admin** → **Événements**
  2. Trouvez l'événement `conversion_fluance` dans la liste
  3. Activez le toggle "Marquer comme conversion"

**Recommandation :**
- Vous pouvez commencer sans cette configuration manuelle
- Les données seront collectées automatiquement dès le premier achat
- Vous pourrez marquer `conversion_fluance` comme conversion plus tard si vous souhaitez l'utiliser dans vos rapports de conversions
- L'événement `purchase` fonctionnera déjà comme conversion sans configuration supplémentaire

### Étape 4 : Tester

1. Effectuez un achat test
2. Vérifiez dans Google Analytics que les événements sont bien enregistrés
3. Vérifiez dans la console du navigateur que les événements sont bien envoyés à `dataLayer`

## Événements envoyés

### Événement `purchase` (e-commerce standard)
- Utilisé pour le suivi e-commerce standard de GA4
- Compatible avec les rapports e-commerce de Google Analytics

### Événement `conversion_fluance` (personnalisé)
- Événement spécifique pour Fluance
- Permet un suivi plus détaillé des conversions par produit
- Peut être marqué comme "événement de conversion" dans GA4

## Suivi des opt-in (2 pratiques et 5 jours)

### Événements d'opt-in

Deux événements supplémentaires sont envoyés pour suivre les opt-in :

#### 1. `generate_lead_2_pratiques` (opt-in 2 pratiques)
- **Envoyé depuis** : `src/fr/confirm.md` et `src/en/confirm.md` après confirmation par email
- **Source** : `newsletter_optin`
- **Moment** : Après confirmation réussie de l'opt-in pour les 2 pratiques offertes

#### 2. `generate_lead_5_jours` (opt-in 5 jours)
- **Envoyé depuis** :
  - `src/fr/confirm.md` après confirmation par email (source: `newsletter_optin`)
  - `src/_includes/newsletter-popup-5jours.njk` après inscription directe (source: `newsletter_popup`)
- **Moment** : Après confirmation réussie ou inscription directe pour les 5 jours offerts

### Format des événements

```javascript
// Opt-in 2 pratiques
window.dataLayer.push({
  event: 'generate_lead_2_pratiques',
  source: 'newsletter_optin',
  optin_type: '2pratiques'
});

// Opt-in 5 jours
window.dataLayer.push({
  event: 'generate_lead_5_jours',
  source: 'newsletter_optin' | 'newsletter_popup',
  optin_type: '5joursofferts'
});
```

### Configuration dans Google Analytics 4

1. Les événements sont **automatiquement envoyés** dès le premier opt-in confirmé
2. Pour les marquer comme conversions :
   - Allez dans **Admin** → **Événements**
   - Trouvez `generate_lead_2_pratiques` et `generate_lead_5_jours`
   - Activez le toggle "Marquer comme conversion" (étoile) pour chacun

## Notes importantes

- ⚠️ Les événements ne sont envoyés que si `window.dataLayer` existe (GTM chargé)
- ⚠️ Les événements ne sont envoyés que si le consentement aux cookies a été donné
- ⚠️ Pour les ventes : Le `session_id` doit être présent dans l'URL pour que le tracking fonctionne
- ⚠️ Pour les opt-in : Les événements sont envoyés uniquement après confirmation réussie (pas juste à la visite de la page)
