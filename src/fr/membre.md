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

      const product = result.product;
      const contents = result.contents || [];

      if (contents.length === 0) {
        contentContainer.innerHTML = `
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-blue-800">Aucun contenu disponible pour le moment.</p>
          </div>
        `;
        contentContainer.classList.remove('hidden');
        return;
      }

      // Afficher les contenus disponibles
      let contentHTML = '<div class="space-y-6">';
      
      if (product === '21jours') {
        // Pour 21jours, afficher avec navigation par jour
        const daysSinceRegistration = result.daysSinceRegistration || 0;
        const currentDay = daysSinceRegistration + 1;
        
        // Calculer le nombre total de jours (incluant le bonus jour 22)
        const maxDay = Math.max(...contents.map(c => c.day || 0), 21);
        const totalDays = maxDay >= 22 ? 23 : 22; // 23 si bonus jour 22 existe, sinon 22
        
        contentHTML += `
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p class="text-blue-800 font-semibold">Vous êtes au jour ${currentDay} sur ${totalDays}</p>
            <p class="text-blue-700 text-sm mt-1">Continuez votre parcours vers la détente et la mobilité.</p>
          </div>
        `;

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

        if (!currentDayContent) {
          currentDayContent = contents
            .filter(c => c.isAccessible)
            .sort((a, b) => (b.day || 0) - (a.day || 0))[0];
        }

        if (currentDayContent) {
          contentHTML += `
            <div class="mb-6" id="current-day-content">
              <h2 class="text-2xl font-semibold mb-4">${currentDayContent.title}</h2>
              <div class="protected-content" data-content-id="${currentDayContent.id}">
                <div class="bg-gray-100 rounded-lg p-8 text-center">
                  <p class="text-gray-600 mb-4">Chargement du contenu...</p>
                </div>
              </div>
            </div>
          `;
        }

        // Navigation des jours
        if (contents.length > 0) {
          contentHTML += `
            <div class="border-t pt-6 mt-6">
              <h3 class="text-lg font-semibold mb-4">Navigation des jours</h3>
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
        }
      } else {
        // Pour les autres produits, afficher la liste des contenus
        contentHTML += '<h2 class="text-2xl font-semibold mb-4">Vos contenus disponibles</h2>';
        contentHTML += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
        
        contents.forEach(content => {
          contentHTML += `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h3 class="font-semibold mb-2">${content.title}</h3>
              <div class="protected-content" data-content-id="${content.id}">
                <div class="bg-gray-100 rounded-lg p-4 text-center">
                  <p class="text-gray-600 text-sm">Chargement...</p>
                </div>
              </div>
            </div>
          `;
        });
        
        contentHTML += '</div>';
      }

      contentHTML += '</div>';
      contentContainer.innerHTML = contentHTML;
      contentContainer.classList.remove('hidden');

      // Charger les contenus protégés
      const protectedElements = contentContainer.querySelectorAll('.protected-content[data-content-id]');
      protectedElements.forEach(element => {
        const contentId = element.getAttribute('data-content-id');
        if (window.FluanceAuth && window.FluanceAuth.displayProtectedContent) {
          window.FluanceAuth.displayProtectedContent(contentId, element).catch(err => {
            console.error('Error loading content:', err);
            element.innerHTML = `
              <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-800 text-sm">Erreur lors du chargement</p>
              </div>
            `;
          });
        }
      });

      // Ajouter les listeners pour la navigation (21jours uniquement)
      if (product === '21jours') {
        // Attendre que le DOM soit mis à jour
        setTimeout(() => {
          const links = contentContainer.querySelectorAll('a[data-content-id]');
          console.log('Found navigation links:', links.length);
          
          links.forEach(link => {
            link.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const contentId = link.getAttribute('data-content-id');
              console.log('Clicked on content:', contentId);
              const content = contents.find(c => c.id === contentId);
              
              if (!content) {
                console.warn('Content not found for ID:', contentId, 'Available contents:', contents.map(c => c.id));
                return;
              }
              
              console.log('Content found:', content.id, 'isAccessible:', content.isAccessible);
              
              if (!content.isAccessible) {
                console.warn('Content not accessible:', contentId);
                alert(`Ce contenu sera disponible dans ${content.daysRemaining} jour${content.daysRemaining > 1 ? 's' : ''}.`);
                return;
              }

            // Mettre à jour le contenu affiché
            const contentSection = contentContainer.querySelector('#current-day-content');
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
            } else {
              console.error('Content section not found');
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
        }, 100);
      }
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

