---
layout: base.njk
title: Espace client
description: Accédez à votre contenu protégé Fluance
locale: fr
permalink: /membre/
---

<section class="max-w-6xl mx-auto px-6 py-16">
  <div class="bg-white rounded-lg shadow-lg p-8 space-y-8">
    <header class="relative pt-8">
      <button
        id="logout-button"
        class="hidden absolute top-0 right-0 text-sm text-gray-600 hover:text-fluance transition-colors underline"
        onclick="handleLogout()"
      >
        Se déconnecter
      </button>
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900 mb-4">Bienvenue dans l'espace client de Fluance</h1>
        <p class="text-gray-600">
          Accédez à votre contenu protégé et suivez votre progression.
        </p>
      </div>
    </header>

    <div id="auth-required" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center hidden">
      <p class="text-yellow-800 mb-4">Veuillez vous connecter pour accéder à votre espace client.</p>
      <a href="/connexion-membre?return={{ '/membre/' | url }}" 
         class="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
        Se connecter
      </a>
    </div>

    <div id="content-container" class="hidden">
      <!-- Le contenu sera chargé dynamiquement ici -->
    </div>
  </div>
</section>

<script src="/assets/js/firebase-auth.js"></script>
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
      
      // Stocker les produits dans une variable accessible aux event listeners
      window.currentUserProducts = products;
      
      // Définir les produits disponibles et leurs URLs de vente
      const allProducts = [
        {
          id: '21jours',
          name: 'Défi 21 jours',
          url: '/cours-en-ligne/21jours/',
          description: 'Retrouvez légèreté, mobilité et sérénité en seulement 2 à 5 minutes par jour, durant 21 jours.'
        },
        {
          id: 'complet',
          name: 'Approche Fluance Complète',
          url: '/cours-en-ligne/approche-fluance-complete/',
          description: 'Accès à une <strong>nouvelle mini-série</strong> de pratiques <strong>chaque semaine.</strong><br><br>Pour <strong>garder l\'élan</strong> et <strong>continuer à prendre soin</strong> de votre <strong>corps</strong> et de <strong>vos ressentis</strong>.'
        }
      ];
      
      // Déterminer le dernier produit démarré (date de démarrage la plus récente)
      let lastStartedProduct = null;
      if (products.length > 0) {
        lastStartedProduct = products.reduce((latest, current) => {
          const currentDate = current.startDate?.toDate ? current.startDate.toDate() : new Date(current.startDate);
          const latestDate = latest.startDate?.toDate ? latest.startDate.toDate() : new Date(latest.startDate);
          return currentDate > latestDate ? current : latest;
        });
      }
      
      // Si aucun produit démarré, utiliser le premier produit acheté ou le premier disponible
      const activeProductId = lastStartedProduct?.name || (products.length > 0 ? products[0].name : allProducts[0].id);
      
      // Créer les onglets
      let tabsHTML = '<div class="border-b border-gray-200 mb-6">';
      tabsHTML += '<nav class="flex space-x-4" role="tablist">';
      
      allProducts.forEach((prod, index) => {
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
            data-product-id="${prod.id}"
            class="px-4 py-2 font-medium text-sm border-b-2 transition-colors
                   ${isActive ? 'border-fluance text-fluance' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                   ${isPurchased ? '' : 'opacity-60'}"
            onclick="switchProductTab('${prod.id}')">
            ${prod.name}
            ${isPurchased ? '<span class="ml-2 text-green-600">✓</span>' : ''}
          </button>
        `;
      });
      
      tabsHTML += '</nav></div>';
      
      // Créer le contenu pour chaque produit
      let contentHTML = tabsHTML + '<div class="space-y-6" id="product-content">';
      
      allProducts.forEach((prod) => {
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
                   class="inline-block bg-fluance text-white px-8 py-3 rounded-lg hover:bg-fluance/90 transition-colors font-semibold">
                  ${prod.id === 'complet' ? 'Découvrir et acquérir l\'approche Fluance complète' : `Découvrir et acquérir ${prod.name}`}
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
            const currentDay = daysSinceStart + 1;
            
            // Calculer le nombre total de jours (incluant le bonus jour 22)
            const maxDay = Math.max(...userProduct.contents.map(c => c.day || 0), 21);
            const totalDays = maxDay >= 22 ? 23 : 22; // 23 si bonus jour 22 existe, sinon 22
            
            contentHTML += `
              <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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
                      <h2 class="text-2xl font-semibold mb-4">${currentDayContent.title}</h2>
                      <div class="protected-content" data-content-id="${currentDayContent.id}">
                        <div class="bg-gray-100 rounded-lg p-8 text-center">
                          <p class="text-gray-600 mb-4">Chargement du contenu...</p>
                        </div>
                      </div>
                    </div>
                  ` : '';
                })()}

                <div class="border-t pt-6 mt-6">
                  <h3 class="text-lg font-semibold mb-4">Navigation des jours</h3>
                  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    ${userProduct.contents.map(content => {
                      const dayLabel = content.day === 0 ? 'Déroulé' : `Jour ${content.day}`;
                      const isLocked = !content.isAccessible;
                      
                      return `
                        <a href="#" 
                           data-content-id="${content.id}"
                           data-product="${prod.id}"
                           class="block p-3 rounded-lg text-center text-sm transition-colors
                                  ${isLocked ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                           ${isLocked ? 'onclick="return false;"' : ''}>
                          <div class="font-semibold">${dayLabel}</div>
                          <div class="text-xs mt-1">${content.title}</div>
                          ${isLocked && content.daysRemaining !== null ? `<div class="text-xs mt-1">+${content.daysRemaining}j</div>` : ''}
                        </a>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>
            `;
          } else if (prod.id === 'complet') {
            // Pour complet, afficher avec navigation par semaine
            const weeksSinceStart = userProduct.weeksSinceStart || 0;
            const currentWeek = weeksSinceStart + 1;
            
            contentHTML += `
              <div class="product-tab-content ${isActive ? '' : 'hidden'}" data-product="${prod.id}">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p class="text-blue-800 font-semibold">Vous êtes à la semaine ${currentWeek}</p>
                  <p class="text-blue-700 text-sm mt-1">Un nouveau contenu se débloque chaque semaine.</p>
                </div>

                ${(() => {
                  // Trouver le contenu de la semaine actuelle
                  let currentWeekContent = null;
                  if (currentWeek === 1) {
                    currentWeekContent = userProduct.contents.find(c => c.week === 0); // Bonus
                  } else if (currentWeek <= 15) {
                    currentWeekContent = userProduct.contents.find(c => c.week === currentWeek - 1);
                  }
                  
                  if (!currentWeekContent) {
                    currentWeekContent = userProduct.contents
                      .filter(c => c.isAccessible)
                      .sort((a, b) => (b.week || 0) - (a.week || 0))[0];
                  }
                  
                  return currentWeekContent ? `
                    <div class="mb-6" id="current-week-content-${prod.id}">
                      <h2 class="text-2xl font-semibold mb-4">${currentWeekContent.title}</h2>
                      <div class="protected-content" data-content-id="${currentWeekContent.id}">
                        <div class="bg-gray-100 rounded-lg p-8 text-center">
                          <p class="text-gray-600 mb-4">Chargement du contenu...</p>
                        </div>
                      </div>
                    </div>
                  ` : '';
                })()}

                <div class="border-t pt-6 mt-6">
                  <h3 class="text-lg font-semibold mb-4">Navigation des semaines</h3>
                  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    ${userProduct.contents.map(content => {
                      const weekLabel = content.week === 0 ? 'Bonus' : `Semaine ${content.week}`;
                      const isLocked = !content.isAccessible;
                      
                      return `
                        <a href="#" 
                           data-content-id="${content.id}"
                           data-product="${prod.id}"
                           class="block p-3 rounded-lg text-center text-sm transition-colors
                                  ${isLocked ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                           ${isLocked ? 'onclick="return false;"' : ''}>
                          <div class="font-semibold">${weekLabel}</div>
                          <div class="text-xs mt-1">${content.title}</div>
                          ${isLocked && content.weeksRemaining !== null ? `<div class="text-xs mt-1">+${content.weeksRemaining}s</div>` : ''}
                        </a>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>
            `;
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
                protectedElement.innerHTML = '<div class="bg-gray-100 rounded-lg p-8 text-center"><p class="text-gray-600 mb-4">Chargement du contenu...</p></div>';
                
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
            }

            // Mettre à jour la navigation (désactiver tous, activer celui cliqué)
            contentContainer.querySelectorAll(`a[data-product="${productId}"]`).forEach(l => {
              l.classList.remove('bg-green-600', 'text-white', 'font-semibold');
              if (!l.classList.contains('bg-gray-200')) {
                l.classList.add('bg-gray-100', 'text-gray-700');
              }
            });
            link.classList.add('bg-green-600', 'text-white', 'font-semibold');
            link.classList.remove('bg-gray-100', 'text-gray-700');
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
});

// Fonction globale pour changer d'onglet produit
function switchProductTab(productId) {
  const contentContainer = document.getElementById('content-container');
  if (!contentContainer) return;
  
  // Mettre à jour les onglets
  contentContainer.querySelectorAll('button[data-product-id]').forEach(btn => {
    const isActive = btn.getAttribute('data-product-id') === productId;
    if (isActive) {
      btn.classList.add('border-fluance', 'text-fluance');
      btn.classList.remove('border-transparent', 'text-gray-500');
    } else {
      btn.classList.remove('border-fluance', 'text-fluance');
      btn.classList.add('border-transparent', 'text-gray-500');
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

