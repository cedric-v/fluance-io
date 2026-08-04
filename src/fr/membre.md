---
layout: base.njk
title: Espace client
description: Accédez à votre contenu protégé Fluance
locale: fr
permalink: /membre/
robots: noindex, nofollow
eleventyExcludeFromCollections: true
---

<section class="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-16">
  <div class="bg-white rounded-lg shadow-lg p-5 md:p-8 space-y-6 md:space-y-8">
    <header class="flex flex-col-reverse gap-4 md:flex-row md:items-start md:justify-between md:pt-8">
      <div class="w-full text-center md:text-left">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Bienvenue dans l'espace client de Fluance</h1>
        <p class="text-gray-600">
          Accédez à votre contenu protégé et suivez votre progression.
        </p>
      </div>
      <button
        id="logout-button"
        class="hidden mx-auto md:mx-0 text-sm text-gray-600 hover:text-fluance transition-colors underline"
        onclick="handleLogout()"
      >
        Se déconnecter
      </button>
    </header>

    <div id="auth-required" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center hidden">
      <p class="text-yellow-800 mb-4">Veuillez vous connecter pour accéder à votre espace client.</p>
      <a href="/connexion-membre/?return={{ '/membre/' | url }}" 
         class="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
        Se connecter
      </a>
    </div>

    <div id="content-container" class="hidden">
      <!-- Le contenu sera chargé dynamiquement ici -->
    </div>
  </div>
</section>

<script type="module" src="/assets/js/firebase-auth.mjs"></script>
<script src="/assets/js/protected-content.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  const authRequired = document.getElementById('auth-required');
  const contentContainer = document.getElementById('content-container');
  const logoutButton = document.getElementById('logout-button');
  
  function checkAuthAndLoad() {
    if (typeof window.FluanceAuth !== 'undefined') {
      const isAuth = window.FluanceAuth.isAuthenticated();
      const user = window.FluanceAuth.getCurrentUser();
      
      if (isAuth && user) {
        // Afficher le bouton de déconnexion
        if (logoutButton) {
          logoutButton.classList.remove('hidden');
        }
        // Charger le contenu disponible
        loadUserContent();
      } else {
        // Cacher le bouton de déconnexion
        if (logoutButton) {
          logoutButton.classList.add('hidden');
        }
        authRequired.classList.remove('hidden');
        contentContainer.classList.add('hidden');
      }
    }
  }
  
  async function loadUserContent() {
    if (!window.FluanceAuth || !window.FluanceAuth.isAuthenticated()) {
      return;
    }

    // Cacher la section de connexion et afficher le conteneur
    authRequired.classList.add('hidden');
    contentContainer.classList.remove('hidden');

    try {
      const result = await window.FluanceAuth.loadProtectedContent();
      
      if (!result.success) {
        let errorHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-6">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3 flex-1">
                <h3 class="text-sm font-medium text-red-800 mb-2">Erreur de chargement</h3>
                <p class="text-sm text-red-700 mb-3">${result.error || 'Une erreur est survenue lors du chargement du contenu.'}</p>
        `;
        
        // Ajouter le code d'erreur si disponible
        if (result.errorCode) {
          errorHTML += `
                <p class="text-xs text-red-600 mb-3">
                  <span class="font-mono bg-red-100 px-2 py-1 rounded">Code: ${result.errorCode}</span>
                </p>
          `;
        }
        
        // Ajouter la suggestion si disponible
        if (result.suggestion) {
          errorHTML += `
                <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                  <p class="text-sm text-yellow-800">
                    <strong>💡 Suggestion :</strong> ${result.suggestion}
                  </p>
                </div>
          `;
        }
        
        errorHTML += `
              </div>
            </div>
          </div>
        `;
        
        contentContainer.innerHTML = errorHTML;
        contentContainer.classList.remove('hidden');
        return;
      }

      // Nouveau format : result.products[] ou ancien format : result.product pour compatibilité
      let products = result.products || [];
      const product = result.product; // Pour compatibilité
      
      // Migration automatique si products est vide mais product existe
      // Cela peut arriver si loadProtectedContent retourne l'ancien format
      if (products.length === 0 && product) {
        console.log('[Espace Membre] Migration automatique depuis product:', product);
        console.log('[Espace Membre] Résultat avant migration:', result);
        
        // Si result.contents existe, c'est l'ancien format
        if (result.contents && Array.isArray(result.contents)) {
          products = [{
            name: product,
            startDate: result.daysSinceRegistration !== null ? 
              new Date(Date.now() - (result.daysSinceRegistration * 24 * 60 * 60 * 1000)) : 
              new Date(),
            contents: result.contents,
            daysSinceStart: result.daysSinceRegistration || 0,
            weeksSinceStart: null,
          }];
          console.log('[Espace Membre] Produits après migration:', products);
        } else {
          // Si pas de contents, créer un produit vide (les contenus seront chargés plus tard)
          // ou recharger depuis loadProtectedContent
          console.warn('[Espace Membre] Pas de contents dans result, rechargement nécessaire');
          // Recharger avec loadProtectedContent pour obtenir les contenus
          try {
            const reloadResult = await window.FluanceAuth.loadProtectedContent();
            if (reloadResult.success && reloadResult.products) {
              products = reloadResult.products;
              console.log('[Espace Membre] Produits rechargés:', products);
            }
          } catch (reloadError) {
            console.error('[Espace Membre] Erreur lors du rechargement:', reloadError);
          }
        }
      }
      
      console.log('[Espace Membre] Produits chargés:', products);
      console.log('[Espace Membre] Résultat complet:', result);
      
      // DIAGNOSTIC : Loguer les noms des produits pour vérifier les correspondances
      console.log('[Espace Membre] Noms des produits possédés:', products.map(p => typeof p === 'string' ? p : p.name));
      
      // Stocker les produits dans une variable accessible aux event listeners
      window.currentUserProducts = products;
      
      // Définir les produits disponibles et leurs URLs de vente
      const allProducts = [
        {
          id: '21jours',
          name: 'Défi 21 jours',
          url: 'https://fluance.io/cours-en-ligne/21-jours-mouvement/',
          description: 'Retrouvez <strong>légèreté</strong>, <strong>mobilité</strong> et <strong>sérénité</strong> en seulement <strong>2 à 5 minutes par jour</strong>.<br><br>Prêt pour ces <strong>21 jours</strong> avec vous-même ?'
        },
        {
          id: 'complet',
          name: 'Approche Fluance Complète',
          url: 'https://fluance.io/cours-en-ligne/approche-fluance-complete/',
          description: 'Accès à une <strong>nouvelle mini-série</strong> de pratiques <strong>chaque semaine.</strong><br><br>Pour <strong>garder l\'élan</strong> et <strong>continuer à prendre soin</strong> de votre <strong>corps</strong> et de <strong>vos ressentis</strong>.'
        },
        {
          id: 'sos-dos-cervicales',
          name: 'SOS dos & cervicales',
          url: 'https://buy.stripe.com/aFadR2bSl7ePaeA8PK8k80p',
          description: 'Effacez les tensions de la posture "Ordinateur". Ajoutez la pratique SOS dos & cervicales (15 min) pour dérouler votre colonne et soulager la nuque après une journée assise.'
        },
        {
          id: 'communaute',
          name: '👥 Communauté',
          url: null, // Pas de page de vente
          description: null, // Pas de description pour l'onglet communauté
          isCommunity: true // Marqueur pour identifier l'onglet communauté
        }
      ];
      
      // Vérifier si un onglet est sauvegardé dans localStorage
      const savedTab = localStorage.getItem('fluance-active-product-tab');
      let activeProductId;
      
      if (savedTab && allProducts.some(p => p.id === savedTab)) {
        // Vérifier que l'utilisateur a accès à ce produit
        const hasAccess = products.some(p => p.name === savedTab);
        if (hasAccess) {
          activeProductId = savedTab;
        }
      }
      
      // Si pas d'onglet sauvegardé ou pas d'accès, utiliser le dernier produit démarré
      if (!activeProductId) {
        let lastStartedProduct = null;
        if (products.length > 0) {
          lastStartedProduct = products.reduce((latest, current) => {
            const currentDate = current.startDate?.toDate ? current.startDate.toDate() : new Date(current.startDate);
            const latestDate = latest.startDate?.toDate ? latest.startDate.toDate() : new Date(latest.startDate);
            return currentDate > latestDate ? current : latest;
          });
        }
        
        // Si aucun produit démarré, utiliser le premier produit acheté ou le premier disponible (pas communauté)
        activeProductId = lastStartedProduct?.name || (products.length > 0 ? products[0].name : allProducts.find(p => !p.isCommunity)?.id || allProducts[0].id);
      }
      
      // Sauvegarder l'onglet actif
      localStorage.setItem('fluance-active-product-tab', activeProductId);
      
      // Créer les onglets
      let tabsHTML = '<div class="border-b border-gray-200 mb-6 w-full overflow-hidden scroll-rail-wrap" data-rail-wrap="tabs">';
      tabsHTML += '<nav class="flex space-x-4 overflow-x-auto flex-nowrap pb-3 scrollbar-hide touch-pan-x scroll-rail" role="tablist" data-rail>';
      
      allProducts.forEach((prod, index) => {
        // Pour l'onglet communauté, toujours accessible
        if (prod.isCommunity) {
          const isActive = prod.id === activeProductId;
          tabsHTML += `
            <button 
              role="tab"
              aria-selected="${isActive}"
              data-product-id="${prod.id}"
              class="px-4 py-3 font-semibold text-sm border-b-4 transition-all duration-200 whitespace-nowrap
                     ${isActive ? 'border-fluance text-fluance bg-fluance/5' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
              onclick="switchProductTab('${prod.id}')">
              ${prod.name}
            </button>
          `;
          return;
        }
        
        // Chercher le produit dans la liste des produits de l'utilisateur
        const userProduct = products.find(p => {
          const productName = typeof p === 'string' ? p : p.name;
          return productName === prod.id;
        });
        const isActive = prod.id === activeProductId;
        // Un produit est acheté si on le trouve dans la liste OU si c'est le product retourné
        const isPurchased = !!userProduct || (product && product === prod.id);
        
        console.log(`[Espace Membre] Produit ${prod.id}:`, {
          userProduct,
          isActive,
          isPurchased,
          productFromResult: product,
          productsList: products.map(p => typeof p === 'string' ? p : p.name)
        });
        
        tabsHTML += `
          <button 
            role="tab"
            aria-selected="${isActive}"
            data-product-id="${prod.id}"
            class="px-4 py-3 font-semibold text-sm border-b-4 transition-all duration-200 whitespace-nowrap
                   ${isActive ? 'border-fluance text-fluance bg-fluance/5' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
                   ${isPurchased ? '' : 'opacity-50 grayscale'}"
            onclick="switchProductTab('${prod.id}')">
            ${prod.name}
            ${isPurchased ? '<span class="ml-2 text-green-600">✓</span>' : ''}
          </button>
        `;
      });
      
      tabsHTML += '</nav>';
      tabsHTML += '<div class="scroll-rail-edge left" data-rail-edge="left"></div>';
      tabsHTML += '<div class="scroll-rail-edge right" data-rail-edge="right"></div>';
      tabsHTML += '<div class="swipe-hint-overlay" data-swipe-hint>Glissez <span class="swipe-chev">›</span></div>';
      tabsHTML += '</div>';
      
      // Créer le contenu pour chaque produit
      let contentHTML = tabsHTML + '<div class="space-y-6" id="product-content">';
      
      allProducts.forEach((prod) => {
        // Gérer l'onglet communauté (toujours accessible)
        if (prod.isCommunity) {
          const isActive = prod.id === activeProductId;
          contentHTML += `
            <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
              <div class="bg-gradient-to-r from-fluance/10 to-fluance/5 rounded-lg p-8">
                <h2 class="text-2xl font-semibold text-fluance mb-6">Communauté Fluance</h2>
                <p class="text-gray-700 mb-6 text-lg">
                  Partagez vos expériences et gardez la motivation en échangeant avec des personnes dans la même démarche que vous.
                </p>
                <p class="text-gray-700 mb-8">
                  Cliquez sur le bouton ci-dessous pour rejoindre le groupe WhatsApp de la communauté Fluance :
                </p>
                <a href="https://chat.whatsapp.com/GAGCKlYTDBGDVlMC0udkvu" 
                   target="_blank"
                   rel="noopener noreferrer"
                   class="flex w-full max-w-full sm:inline-flex sm:w-auto items-center justify-center gap-3 bg-[#25D366] text-white px-4 sm:px-8 py-4 rounded-lg hover:bg-[#20BA5A] transition-colors font-semibold text-base sm:text-lg text-center shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Rejoindre la communauté WhatsApp
                </a>
              </div>
            </div>
          `;
          return;
        }
        
        // Chercher le produit dans la liste des produits de l'utilisateur
        const userProduct = products.find(p => {
          const productName = typeof p === 'string' ? p : p.name;
          return productName === prod.id;
        });
        const isActive = prod.id === activeProductId;
        // Un produit est acheté si on le trouve dans la liste OU si c'est le product retourné
        const isPurchased = !!userProduct || (product && product === prod.id);
        
        console.log(`[Espace Membre] Affichage contenu ${prod.id}:`, {
          userProduct,
          isActive,
          isPurchased,
          productFromResult: product,
          hasContents: userProduct?.contents?.length > 0,
          userProductType: typeof userProduct
        });
        
        if (!isPurchased) {
          // Produit non acheté : afficher un bouton d'achat
          contentHTML += `
            <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
              <div class="bg-gradient-to-r from-fluance/10 to-fluance/5 rounded-lg p-8 text-center">
                <h2 class="text-2xl font-semibold text-fluance mb-4">${prod.name}</h2>
                <p class="text-gray-700 mb-6">${prod.description}</p>
                <a href="${prod.url}" 
                   class="inline-block bg-fluance text-[#F5F7F6] px-8 py-3 rounded-lg hover:bg-fluance/90 transition-colors font-semibold">
                  ${
                    prod.id === 'complet'
                      ? 'Découvrir et acquérir l\'approche Fluance complète'
                      : prod.id === '21jours'
                        ? 'Découvrir et acquérir le défi 21 jours pour remettre du mouvement'
                        : prod.id === 'sos-dos-cervicales'
                          ? "Obtenir l'accès à SOS dos & cervicales"
                          : `Découvrir et acquérir ${prod.name}`
                  }
                </a>
              </div>
            </div>
          `;
        } else {
          // Produit acheté : afficher le contenu
          const contents = userProduct.contents || [];
          
          if (contents.length === 0) {
            contentHTML += `
              <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p class="text-blue-800">Aucun contenu disponible pour le moment.</p>
                </div>
              </div>
            `;
          } else if (prod.id === '21jours') {
            // Pour 21jours, afficher avec navigation par jour
            const daysSinceStart = userProduct.daysSinceStart || 0;
            
            // Calculer le nombre total de jours (incluant le bonus jour 22)
            const maxDay = Math.max(...userProduct.contents.map(c => c.day || 0), 21);
            const totalDays = maxDay >= 22 ? 23 : 22; // 23 si bonus jour 22 existe, sinon 22
            const currentDay = Math.min(daysSinceStart + 1, totalDays);
            
            contentHTML += `
              <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
                <!-- Navigation des jours : juste sous le menu de sélection, sticky sur mobile -->
                <div class="sticky-nav" data-sticky-nav>
                  <div class="scroll-rail-wrap">
                    <div class="flex overflow-x-auto gap-2 pb-3 -mx-1 px-1 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none scrollbar-hide touch-pan-x" data-day-rail data-rail>
                      ${(() => {
                        // Jour actuel = dernier contenu débloqué
                        const currentNavContent = userProduct.contents
                          .filter(c => c.isAccessible)
                          .sort((a, b) => (b.day || 0) - (a.day || 0))[0];
                        return userProduct.contents.map(content => {
                          const dayLabel = content.day === 0 ? 'Déroulé' : `Jour ${content.day}`;
                          const isLocked = !content.isAccessible;
                          const isCurrent = content.id === currentNavContent?.id;
                          
                          return `
                            <a href="#" 
                               data-content-id="${content.id}"
                               data-product="${prod.id}"
                               ${isCurrent ? 'data-current-day="true"' : ''}
                               class="snap-start shrink-0 w-[7.5rem] md:w-40 block p-3 rounded-lg text-center text-sm transition-colors
                                      ${isCurrent ? 'bg-fluance text-white font-semibold' : isLocked ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                               ${isLocked ? 'onclick="return false;"' : ''}>
                              <div class="font-semibold truncate">${dayLabel}</div>
                              <div class="text-xs mt-1 truncate">${content.title}</div>
                              ${isLocked && content.daysRemaining !== null ? `<div class="text-xs mt-1">🔒 +${content.daysRemaining}j</div>` : ''}
                            </a>
                          `;
                        }).join('');
                      })()}
                    </div>
                    <div class="scroll-rail-edge left" data-rail-edge="left"></div>
                    <div class="scroll-rail-edge right" data-rail-edge="right"></div>
                    <div class="swipe-hint-overlay" data-swipe-hint>Glissez <span class="swipe-chev">›</span></div>
                  </div>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 mt-6">
                  <p class="text-blue-800 font-semibold">Vous êtes au jour ${currentDay} sur ${totalDays}</p>
                  <p class="text-blue-700 text-sm mt-1">Continuez votre parcours vers la détente et la mobilité.</p>
                </div>

                ${(() => {
                  // Trouver le contenu du jour actuel
                  let currentDayContent = null;
                  if (currentDay === 1) {
                    currentDayContent = userProduct.contents.find(c => c.day === 0);
                  } else if (currentDay <= 22) {
                    currentDayContent = userProduct.contents.find(c => c.day === currentDay - 1);
                  } else if (currentDay === 23) {
                    currentDayContent = userProduct.contents.find(c => c.day === 22);
                  }
                  
                  if (!currentDayContent) {
                    currentDayContent = userProduct.contents
                      .filter(c => c.isAccessible)
                      .sort((a, b) => (b.day || 0) - (a.day || 0))[0];
                  }
                  
                  return currentDayContent ? `
                    <div class="mb-6" id="current-day-content-${prod.id}">
                      <div class="protected-content" data-content-id="${currentDayContent.id}">
                        <div class="bg-gray-100 rounded-lg p-8 text-center">
                          <div class="inline-flex items-center gap-2 text-gray-500 mb-4">
                            <svg class="animate-spin h-4 w-4 text-fluance" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Chargement du contenu…</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ` : '';
                })()}
              </div>
            `;
          } else if (prod.id === 'complet') {
            // Pour complet, afficher avec navigation par semaine
            const weeksSinceStart = userProduct.weeksSinceStart || 0;
            const calculatedWeek = weeksSinceStart + 1;
            
            // Limiter la semaine affichée au nombre de contenus disponibles
            // maxWeek = la semaine la plus élevée dans les contenus (ex: 6 si on a week 0-6)
            const maxWeek = Math.max(...userProduct.contents.map(c => c.week || 0), 0);
            // Si maxWeek = 6, on a les semaines 0-6, donc on affiche au maximum "semaine 6"
            // Mais si calculatedWeek dépasse maxWeek, on limite à maxWeek
            const currentWeek = Math.min(calculatedWeek, maxWeek > 0 ? maxWeek : 1);
            
            // Contenu de bienvenue (si défini)
            const welcomeContent = userProduct.contents.find(c => c.type === 'welcome' || c.id === 'complet-bienvenue');

            contentHTML += `
              <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
                <!-- Navigation des semaines : juste sous le menu de sélection, sticky sur mobile -->
                <div class="sticky-nav" data-sticky-nav>
                  <div class="scroll-rail-wrap">
                    <div class="flex overflow-x-auto gap-2 pb-3 -mx-1 px-1 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none scrollbar-hide touch-pan-x" data-day-rail data-rail>
                      ${(() => {
                        // Semaine actuelle = dernière semaine débloquée (hors bienvenue)
                        const currentNavContent = userProduct.contents
                          .filter(c => c.isAccessible && c.type !== 'welcome')
                          .sort((a, b) => (b.week || 0) - (a.week || 0))[0]
                          || userProduct.contents.find(c => c.type === 'welcome' && c.isAccessible);
                        return [welcomeContent, ...userProduct.contents.filter(content => content.type !== 'welcome')]
                        .filter(Boolean)
                        .map(content => {
                          const weekLabel = content.type === 'welcome'
                            ? 'Bienvenue'
                            : content.week === 0
                              ? 'Bonus'
                              : `Semaine ${content.week}`;
                          const isLocked = !content.isAccessible;
                          const isCurrent = content.id === currentNavContent?.id;
                          
                          return `
                            <a href="#" 
                               data-content-id="${content.id}"
                               data-product="${prod.id}"
                               ${isCurrent ? 'data-current-day="true"' : ''}
                               class="snap-start shrink-0 w-[7.5rem] md:w-40 block p-3 rounded-lg text-center text-sm transition-colors
                                      ${isCurrent ? 'bg-fluance text-white font-semibold' : isLocked ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                               ${isLocked ? 'onclick="return false;"' : ''}>
                              <div class="font-semibold truncate">${weekLabel}</div>
                              <div class="text-xs mt-1 truncate">${content.title}</div>
                              ${isLocked && content.weeksRemaining !== null ? `<div class="text-xs mt-1">🔒 +${content.weeksRemaining}s</div>` : ''}
                            </a>
                          `;
                        }).join('');
                      })()}
                    </div>
                    <div class="scroll-rail-edge left" data-rail-edge="left"></div>
                    <div class="scroll-rail-edge right" data-rail-edge="right"></div>
                    <div class="swipe-hint-overlay" data-swipe-hint>Glissez <span class="swipe-chev">›</span></div>
                  </div>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 mt-6">
                  <p class="text-blue-800 font-semibold">Vous êtes à la semaine ${currentWeek}</p>
                  <p class="text-blue-700 text-sm mt-1">Un nouveau contenu se débloque chaque semaine.</p>
                </div>

                ${(() => {
                  // Filtrer les contenus de type \"semaine\" (exclure le contenu de bienvenue)
                  const weeklyContents = userProduct.contents.filter(c => c.type !== 'welcome');

                  // Trouver le contenu affiché dans la zone principale
                  let currentWeekContent = null;

                  // Lors de la première semaine, afficher d'abord le contenu de bienvenue s'il existe
                  if (welcomeContent && weeksSinceStart === 0) {
                    currentWeekContent = welcomeContent;
                  } else {
                    if (currentWeek === 1) {
                      currentWeekContent = weeklyContents.find(c => c.week === 0); // Bonus
                    } else if (currentWeek <= 15) {
                      currentWeekContent = weeklyContents.find(c => c.week === currentWeek - 1);
                    }
                    
                    if (!currentWeekContent) {
                      currentWeekContent = weeklyContents
                        .filter(c => c.isAccessible)
                        .sort((a, b) => (b.week || 0) - (a.week || 0))[0];
                    }
                  }
                  
                  return currentWeekContent ? `
                    <div class="mb-6" id="current-week-content-${prod.id}">
                      <div class="protected-content" data-content-id="${currentWeekContent.id}">
                        <div class="bg-gray-100 rounded-lg p-8 text-center">
                          <div class="inline-flex items-center gap-2 text-gray-500 mb-4">
                            <svg class="animate-spin h-4 w-4 text-fluance" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Chargement du contenu…</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ` : '';
                })()}
              </div>
            `;
          } else {
            // Pour les autres produits (comme sos-dos-cervicales), afficher le contenu directement
            const firstContent = contents.find(c => c.isAccessible) || contents[0];
            
            if (firstContent) {
              contentHTML += `
                <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
                  <div class="mb-6">
                    <div class="protected-content" data-content-id="${firstContent.id}">
                      <div class="bg-gray-100 rounded-lg p-8 text-center">
                        <div class="inline-flex items-center gap-2 text-gray-500 mb-4">
                          <svg class="animate-spin h-4 w-4 text-fluance" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Chargement du contenu…</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            } else {
              contentHTML += `
                <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-blue-800">Aucun contenu disponible pour le moment.</p>
                  </div>
                </div>
              `;
            }
          }
        }
      });

      contentHTML += '</div>';
      console.log('[Espace Membre] HTML généré, longueur:', contentHTML.length);
      console.log('[Espace Membre] Produit actif:', activeProductId);
      contentContainer.innerHTML = contentHTML;
      contentContainer.classList.remove('hidden');
      
      // Vérifier que le HTML a bien été inséré
      const insertedTab = contentContainer.querySelector(`.product-tab-content[data-product="${activeProductId}"]`);
      console.log('[Espace Membre] Onglet inséré trouvé:', insertedTab);
      if (insertedTab) {
        const insertedProtected = insertedTab.querySelectorAll('.protected-content[data-content-id]');
        console.log('[Espace Membre] Éléments protégés dans le HTML inséré:', insertedProtected.length);
      }

      // Charger les contenus protégés de l'onglet actif uniquement
      setTimeout(() => {
        // Initialiser les affordances de scroll horizontal (fades + indices)
        initScrollRails();
        updateStickyOffset();
        updateStuckNav();

        // Centrer la carte du jour/semaine actuel dans le rail (mobile)
        centerActiveDayRail();

        const activeTabContent = contentContainer.querySelector(`.product-tab-content[data-product="${activeProductId}"]:not(.hidden)`);
        console.log('[Espace Membre] Onglet actif trouvé:', activeTabContent, 'pour produit:', activeProductId);
        
        if (activeTabContent) {
          const protectedElements = activeTabContent.querySelectorAll('.protected-content[data-content-id]');
          console.log('[Espace Membre] Éléments protégés trouvés:', protectedElements.length);
          
          protectedElements.forEach((element, index) => {
            const contentId = element.getAttribute('data-content-id');
            console.log(`[Espace Membre] Chargement contenu ${index + 1}/${protectedElements.length}:`, contentId);
            
            if (contentId && window.FluanceAuth && window.FluanceAuth.displayProtectedContent) {
              window.FluanceAuth.displayProtectedContent(contentId, element).catch(err => {
                console.error('[Espace Membre] Erreur lors du chargement du contenu:', err);
                element.innerHTML = `
                  <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-800 text-sm">Erreur lors du chargement</p>
                  </div>
                `;
              });
            } else {
              console.warn('[Espace Membre] Impossible de charger le contenu:', {
                contentId,
                hasFluanceAuth: !!window.FluanceAuth,
                hasDisplayMethod: !!(window.FluanceAuth && window.FluanceAuth.displayProtectedContent)
              });
            }
          });
        } else {
          console.warn('[Espace Membre] Onglet actif non trouvé pour produit:', activeProductId);
        }
      }, 100);

      // Ajouter les listeners pour la navigation et le changement d'onglets
      setTimeout(() => {
        // Navigation par contenu (jours/semaines)
        const links = contentContainer.querySelectorAll('a[data-content-id]');
        links.forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const contentId = link.getAttribute('data-content-id');
            const productId = link.getAttribute('data-product');
            
            // Trouver le produit et son contenu depuis les données chargées
            const productData = window.currentUserProducts.find(p => p.name === productId);
            if (!productData) return;
            
            const content = productData.contents.find(c => c.id === contentId);
            if (!content) return;
            
            if (!content.isAccessible) {
              if (content.daysRemaining !== null) {
                alert(`Ce contenu sera disponible dans ${content.daysRemaining} jour${content.daysRemaining > 1 ? 's' : ''}.`);
              } else if (content.weeksRemaining !== null) {
                alert(`Ce contenu sera disponible dans ${content.weeksRemaining} semaine${content.weeksRemaining > 1 ? 's' : ''}.`);
              }
              return;
            }

            // Mettre à jour le contenu affiché selon le produit
            let contentSection;
            if (productId === '21jours') {
              contentSection = contentContainer.querySelector(`#current-day-content-${productId}`);
            } else if (productId === 'complet') {
              contentSection = contentContainer.querySelector(`#current-week-content-${productId}`);
            }
            
            if (contentSection) {
              const titleElement = contentSection.querySelector('h2');
              const protectedElement = contentSection.querySelector('.protected-content');
              
              if (titleElement) {
                titleElement.textContent = content.title;
              }
              
              if (protectedElement) {
                protectedElement.setAttribute('data-content-id', content.id);
                protectedElement.innerHTML = '<div class="bg-gray-100 rounded-lg p-8 text-center"><div class="inline-flex items-center gap-2 text-gray-500 mb-4"><svg class="animate-spin h-4 w-4 text-fluance" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Chargement du contenu…</span></div></div>';
                
                if (window.FluanceAuth && window.FluanceAuth.displayProtectedContent) {
                  window.FluanceAuth.displayProtectedContent(content.id, protectedElement).catch(err => {
                    console.error('Error loading content:', err);
                    protectedElement.innerHTML = `
                      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-800 text-sm">Erreur lors du chargement</p>
                      </div>
                    `;
                  });
                }
              }
              
              // Scroller vers le contenu affiché après un court délai pour laisser le DOM se mettre à jour
              // Prendre en compte la hauteur du header fixe + la sous-navigation sticky si collée
              setTimeout(() => {
                const header = document.getElementById('main-header');
                const headerH = header ? header.getBoundingClientRect().height : 112;
                const stickyNav = contentContainer.querySelector('.product-tab-content:not(.hidden) [data-sticky-nav]');
                const stickyH = (stickyNav && stickyNav.classList.contains('is-stuck')) ? stickyNav.getBoundingClientRect().height : 0;
                const headerOffset = headerH + stickyH + 12;
                const elementPosition = contentSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                  top: offsetPosition,
                  behavior: 'smooth'
                });
              }, 100);
            }

            // Mettre à jour la navigation (désactiver tous, activer celui cliqué)
            contentContainer.querySelectorAll(`a[data-product="${productId}"]`).forEach(l => {
              l.classList.remove('bg-fluance', 'text-white', 'font-semibold');
              l.removeAttribute('data-current-day');
              if (!l.classList.contains('bg-gray-200')) {
                l.classList.add('bg-gray-100', 'text-gray-700');
              }
            });
            link.classList.add('bg-fluance', 'text-white', 'font-semibold');
            link.classList.remove('bg-gray-100', 'text-gray-700');
            link.setAttribute('data-current-day', 'true');

            // Recentrer le rail sur le jour sélectionné (mobile)
            centerActiveDayRail();
          });
        });
      }, 100);
    } catch (error) {
      console.error('Error loading user content:', error);
      contentContainer.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-800">Erreur lors du chargement du contenu : ${error.message || error}</p>
        </div>
      `;
      contentContainer.classList.remove('hidden');
    }
  }
  
  // Vérifier l'authentification immédiatement
  checkAuthAndLoad();
  
  // Vérifier après un délai (au cas où le script se charge plus tard)
  setTimeout(checkAuthAndLoad, 1000);
  
  // Écouter les changements d'authentification
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => {
      checkAuthAndLoad();
    });
  }
  
  // Suivre la hauteur du header fixe (qui se compacte au scroll) pour la sous-navigation sticky
  let stickyTicking = false;
  function onMemberScroll() {
    if (stickyTicking) return;
    stickyTicking = true;
    window.requestAnimationFrame(() => {
      updateStickyOffset();
      updateStuckNav();
      stickyTicking = false;
    });
  }
  window.addEventListener('scroll', onMemberScroll, { passive: true });
  window.addEventListener('resize', onMemberScroll, { passive: true });
});

// Fonction pour centrer la carte du jour/semaine actuel dans le rail (mobile et desktop)
function centerActiveDayRail() {
  const activeTabContent = document.querySelector('#content-container .product-tab-content:not(.hidden)');
  if (!activeTabContent) return;
  const rail = activeTabContent.querySelector('[data-day-rail]');
  if (!rail) return;
  const activeCard = rail.querySelector('a[data-current-day]');
  if (!activeCard) return;
  // Position cible calculée relativement au rail (robuste, indépendant de l'offsetParent)
  const target = (activeCard.getBoundingClientRect().left - rail.getBoundingClientRect().left) + rail.scrollLeft - rail.clientWidth / 2 + activeCard.offsetWidth / 2;
  rail.scrollLeft = Math.max(0, Math.min(target, rail.scrollWidth - rail.clientWidth));
}

// Affordances de scroll horizontal : fades de bordure + indice « Glissez » + chevrons
function updateRailEdges(rail) {
  const wrap = rail.closest('.scroll-rail-wrap');
  if (!wrap) return;
  const leftEdge = wrap.querySelector('.scroll-rail-edge.left');
  const rightEdge = wrap.querySelector('.scroll-rail-edge.right');
  const leftBtn = wrap.querySelector('.rail-nav-btn.left');
  const rightBtn = wrap.querySelector('.rail-nav-btn.right');

  const hasOverflow = rail.scrollWidth > rail.clientWidth + 1;
  if (!hasOverflow) {
    if (leftEdge) leftEdge.classList.remove('visible');
    if (rightEdge) rightEdge.classList.remove('visible');
    if (leftBtn) leftBtn.classList.add('is-hidden');
    if (rightBtn) rightBtn.classList.add('is-hidden');
    return;
  }

  // Fade/chevron visible uniquement côté où il reste du contenu à dévoiler
  const atStart = rail.scrollLeft <= 2;
  const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
  if (leftEdge) leftEdge.classList.toggle('visible', !atStart);
  if (rightEdge) rightEdge.classList.toggle('visible', !atEnd);
  if (leftBtn) leftBtn.classList.toggle('is-hidden', atStart);
  if (rightBtn) rightBtn.classList.toggle('is-hidden', atEnd);
}

// Boutons chevron (desktop) : injectés une fois par rail, scrollent d'une page
function injectRailNavButtons(rail) {
  const wrap = rail.closest('.scroll-rail-wrap');
  if (!wrap || wrap.querySelector('.rail-nav-btn')) return;

  const makeBtn = (dir, label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rail-nav-btn ' + dir;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = dir === 'left'
      ? '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>';
    btn.addEventListener('click', () => {
      const sign = dir === 'left' ? -1 : 1;
      rail.scrollBy({ left: sign * rail.clientWidth * 0.85, behavior: 'smooth' });
    });
    wrap.appendChild(btn);
    return btn;
  };

  makeBtn('left', 'Faire défiler vers la gauche');
  makeBtn('right', 'Faire défiler vers la droite');
}

function initScrollRails(scope) {
  const container = scope || document.getElementById('content-container');
  if (!container) return;

  container.querySelectorAll('[data-rail]').forEach((rail) => {
    if (rail.__fluanceRailInit) return;
    // Ne pas initialiser un rail dans un onglet masqué : ses dimensions sont inexactes
    // (il sera initialisé lors de l'activation de l'onglet via switchProductTab)
    const tab = rail.closest('.product-tab-content');
    if (tab && tab.classList.contains('hidden')) return;
    rail.__fluanceRailInit = true;

    const wrap = rail.closest('.scroll-rail-wrap');
    const hint = wrap ? wrap.querySelector('[data-swipe-hint]') : null;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;

    // Indice « Glissez » : uniquement mobile ET si le rail déborde réellement
    if (hint && (isDesktop || rail.scrollWidth <= rail.clientWidth + 1)) {
      hint.classList.add('is-hidden');
    }

    // Chevrons de navigation (desktop)
    injectRailNavButtons(rail);

    rail.addEventListener('scroll', () => {
      updateRailEdges(rail);
      if (hint && !isDesktop) hint.classList.add('is-hidden');
    }, { passive: true });

    window.addEventListener('resize', () => updateRailEdges(rail), { passive: true });
    updateRailEdges(rail);
  });
}

// Sous-navigation sticky : offset dynamique sous le header fixe (qui se compacte au scroll)
function updateStickyOffset() {
  const header = document.getElementById('main-header');
  const offset = header ? header.getBoundingClientRect().height + 8 : 120;
  document.documentElement.style.setProperty('--sticky-nav-offset', offset + 'px');
}

function updateStuckNav() {
  const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-nav-offset')) || 120;
  const nav = document.querySelector('#content-container .product-tab-content:not(.hidden) [data-sticky-nav]');
  if (!nav) {
    // Aucune sous-navigation visible (onglet sans rail) : retirer l'état « collé »
    document.querySelectorAll('#content-container [data-sticky-nav]').forEach(n => n.classList.remove('is-stuck'));
    return;
  }
  // « Collé » quand le haut de l'élément atteint l'offset sticky
  const rect = nav.getBoundingClientRect();
  nav.classList.toggle('is-stuck', rect.top <= offset + 2);
}

// Fonction globale pour changer d'onglet produit
function switchProductTab(productId) {
  const contentContainer = document.getElementById('content-container');
  if (!contentContainer) return;
  
  // Sauvegarder l'onglet actif dans localStorage
  localStorage.setItem('fluance-active-product-tab', productId);
  
  // Mettre à jour les onglets
  contentContainer.querySelectorAll('button[data-product-id]').forEach(btn => {
    const isActive = btn.getAttribute('data-product-id') === productId;
    if (isActive) {
      btn.classList.add('border-fluance', 'text-fluance', 'bg-fluance/5');
      btn.classList.remove('border-transparent', 'text-gray-500', 'bg-gray-50');
    } else {
      btn.classList.remove('border-fluance', 'text-fluance', 'bg-fluance/5');
      btn.classList.add('border-transparent', 'text-gray-500', 'bg-gray-50');
    }
  });
  
  // Afficher/masquer le contenu correspondant
  contentContainer.querySelectorAll('.product-tab-content').forEach(content => {
    if (content.getAttribute('data-product') === productId) {
      content.classList.remove('hidden');
      
      // Charger les contenus protégés de l'onglet activé
      const protectedElements = content.querySelectorAll('.protected-content[data-content-id]');
      protectedElements.forEach(element => {
        const contentId = element.getAttribute('data-content-id');
        if (contentId && window.FluanceAuth && window.FluanceAuth.displayProtectedContent) {
          // Vérifier si le contenu n'est pas déjà chargé
          if (element.querySelector('.bg-gray-100')) {
            window.FluanceAuth.displayProtectedContent(contentId, element).catch(err => {
              console.error('Error loading content:', err);
              element.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p class="text-red-800 text-sm">Erreur lors du chargement</p>
                </div>
              `;
            });
          }
        }
      });
    } else {
      content.classList.add('hidden');
    }
  });

  // Réinitialiser les affordances de scroll + offset sticky
  initScrollRails();
  updateStickyOffset();
  updateStuckNav();

  // Recentrer la carte du jour/semaine actuel dans le rail (mobile)
  setTimeout(centerActiveDayRail, 50);
}

// Fonction globale pour gérer la déconnexion
async function handleLogout() {
  if (!window.FluanceAuth || !window.FluanceAuth.signOut) {
    console.error('FluanceAuth.signOut is not available');
    return;
  }

  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    try {
      const result = await window.FluanceAuth.signOut();
      if (result.success) {
        // Rediriger vers la page d'accueil après déconnexion
        window.location.href = '/';
      } else {
        alert('Erreur lors de la déconnexion : ' + (result.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('Error during logout:', error);
      alert('Erreur lors de la déconnexion. Veuillez réessayer.');
    }
  }
}
</script>
