---
layout: base.njk
title: Défi 21 jours
description: Retrouvez légèreté, mobilité et sérénité en seulement 2 à 5 minutes par jour, durant 21 jours.
locale: fr
permalink: /cours-en-ligne/21jours/
---

<section class="max-w-6xl mx-auto px-6 py-16">
  <div class="bg-white rounded-lg shadow-lg p-8 space-y-8">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Défi 21 jours</h1>
      <p class="text-gray-600 text-lg">
        Retrouvez légèreté, mobilité et sérénité en seulement 2 à 5 minutes par jour, durant 21 jours.
      </p>
    </header>

    <div id="auth-required" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center hidden">
      <p class="text-yellow-800 mb-4">Veuillez vous connecter pour accéder au contenu du défi.</p>
      <a href="/connexion-firebase?return={{ '/cours-en-ligne/21jours/' | url }}" 
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
document.addEventListener('DOMContentLoaded', async function() {
  const authRequired = document.getElementById('auth-required');
  const contentContainer = document.getElementById('content-container');
  
  // Attendre que Firebase soit initialisé
  await new Promise((resolve) => {
    if (typeof window.FluanceAuth !== 'undefined' && 
        typeof firebase !== 'undefined' && 
        firebase.apps.length > 0) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (typeof window.FluanceAuth !== 'undefined' && 
            typeof firebase !== 'undefined' && 
            firebase.apps.length > 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    }
  });

  function checkAuthAndLoad() {
    if (!window.FluanceAuth || !window.FluanceAuth.isAuthenticated()) {
      authRequired.classList.remove('hidden');
      contentContainer.classList.add('hidden');
      return;
    }

    authRequired.classList.add('hidden');
    contentContainer.classList.remove('hidden');

    // Charger la liste des contenus disponibles
    window.FluanceAuth.loadProtectedContent().then(result => {
      if (!result.success) {
        contentContainer.innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-800">Erreur : ${result.error}</p>
          </div>
        `;
        return;
      }

      if (result.product !== '21jours') {
        contentContainer.innerHTML = `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p class="text-yellow-800">Cette page est réservée au produit "21jours".</p>
          </div>
        `;
        return;
      }

      const contents = result.contents || [];
      const daysSinceRegistration = result.daysSinceRegistration || 0;
      const currentDay = daysSinceRegistration + 1; // Jour actuel (1-23 si bonus)

      // Trouver le contenu du jour actuel
      let currentDayContent = null;
      if (currentDay === 1) {
        // Jour 1 = déroulé (jour 0)
        currentDayContent = contents.find(c => c.day === 0);
      } else if (currentDay <= 22) {
        // Jours 2-22 = jours 1-21 du programme
        currentDayContent = contents.find(c => c.day === currentDay - 1);
      } else if (currentDay === 23) {
        // Jour 23 = bonus (jour 22)
        currentDayContent = contents.find(c => c.day === 22);
      }

      // Si pas de contenu pour aujourd'hui, prendre le dernier accessible
      if (!currentDayContent) {
        currentDayContent = contents
          .filter(c => c.isAccessible)
          .sort((a, b) => (b.day || 0) - (a.day || 0))[0];
      }

      // Afficher le contenu du jour
      if (currentDayContent) {
        contentContainer.innerHTML = `
          <div class="mb-6">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p class="text-blue-800 font-semibold">Jour ${currentDay} sur 22</p>
              <p class="text-blue-700 text-sm">${currentDayContent.title}</p>
            </div>
            
            <div class="protected-content" data-content-id="${currentDayContent.id}">
              <div class="bg-gray-100 rounded-lg p-8 text-center">
                <p class="text-gray-600 mb-4">Chargement du contenu...</p>
              </div>
            </div>
          </div>
        `;

        // Charger le contenu
        if (window.FluanceAuth && window.FluanceAuth.displayProtectedContent) {
          const element = contentContainer.querySelector('.protected-content[data-content-id]');
          if (element) {
            window.FluanceAuth.displayProtectedContent(currentDayContent.id, element);
          }
        }
      } else {
        contentContainer.innerHTML = `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p class="text-yellow-800">Aucun contenu disponible pour le moment.</p>
          </div>
        `;
      }

      // Afficher la navigation des jours
      if (contents.length > 0) {
        const navigationHTML = `
          <div class="border-t pt-6 mt-6">
            <h2 class="text-xl font-semibold mb-4">Navigation des jours</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              ${contents.map(content => {
                const dayLabel = content.day === 0 ? 'Déroulé' : `Jour ${content.day}`;
                const isCurrent = content.id === currentDayContent?.id;
                const isLocked = !content.isAccessible;
                
                return `
                  <a href="#" 
                     data-content-id="${content.id}"
                     class="block p-3 rounded-lg text-center text-sm transition-colors
                            ${isCurrent ? 'bg-green-600 text-white font-semibold' : ''}
                            ${isLocked ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                            ${!isLocked && !isCurrent ? 'hover:bg-gray-200' : ''}"
                     ${isLocked ? 'onclick="return false;"' : ''}>
                    <div class="font-semibold">${dayLabel}</div>
                    <div class="text-xs mt-1">${content.title}</div>
                    ${isLocked && content.daysRemaining !== null ? `<div class="text-xs mt-1">+${content.daysRemaining}j</div>` : ''}
                  </a>
                `;
              }).join('')}
            </div>
          </div>
        `;
        contentContainer.innerHTML += navigationHTML;

        // Ajouter les listeners pour la navigation
        contentContainer.querySelectorAll('a[data-content-id]').forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const contentId = link.getAttribute('data-content-id');
            const content = contents.find(c => c.id === contentId);
            
            if (!content || !content.isAccessible) {
              return;
            }

            // Charger le contenu sélectionné
            contentContainer.querySelector('.protected-content')?.remove();
            const contentHTML = `
              <div class="mb-6">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p class="text-blue-800 font-semibold">${content.day === 0 ? 'Déroulé' : `Jour ${content.day}`}</p>
                  <p class="text-blue-700 text-sm">${content.title}</p>
                </div>
                
                <div class="protected-content" data-content-id="${content.id}">
                  <div class="bg-gray-100 rounded-lg p-8 text-center">
                    <p class="text-gray-600 mb-4">Chargement du contenu...</p>
                  </div>
                </div>
              </div>
            `;
            contentContainer.insertAdjacentHTML('afterbegin', contentHTML);

            // Charger le contenu
            const element = contentContainer.querySelector('.protected-content[data-content-id]');
            if (element && window.FluanceAuth && window.FluanceAuth.displayProtectedContent) {
              window.FluanceAuth.displayProtectedContent(content.id, element);
            }

            // Mettre à jour la navigation
            contentContainer.querySelectorAll('a[data-content-id]').forEach(l => {
              l.classList.remove('bg-green-600', 'text-white', 'font-semibold');
              l.classList.add('bg-gray-100', 'text-gray-700');
            });
            link.classList.add('bg-green-600', 'text-white', 'font-semibold');
            link.classList.remove('bg-gray-100', 'text-gray-700');
          });
        });
      }
    }).catch(err => {
      console.error('Error loading protected content:', err);
      contentContainer.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-800">Erreur lors du chargement : ${err.message || err}</p>
        </div>
      `;
    });
  }

  // Vérifier l'authentification immédiatement
  if (typeof firebase !== 'undefined' && firebase.auth) {
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
      checkAuthAndLoad();
    } else {
      // Écouter les changements d'authentification
      firebase.auth().onAuthStateChanged((user) => {
        checkAuthAndLoad();
      });
    }
  } else {
    setTimeout(checkAuthAndLoad, 1000);
  }
});
</script>

