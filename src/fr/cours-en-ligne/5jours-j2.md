---
layout: base.njk
title: Jour 2 - Lâcher-prise
description: Deuxième pratique de la série de 5 jours pour libérer les tensions et retrouver votre calme intérieur. Lâcher-prise.
locale: fr
permalink: /cours-en-ligne/5jours/j2/
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="text-center space-y-6">
    <h1 class="text-4xl md:text-5xl font-semibold text-[#0f172a] leading-tight">
      Libérez les tensions<br>
      et retrouvez votre calme intérieur
    </h1>
    
    <div class="flex flex-wrap justify-center gap-4 text-lg font-semibold text-fluance">
      <a href="{{ '/cours-en-ligne/5jours/j1/' | relativeUrl }}" class="px-4 py-2 hover:bg-fluance/10 rounded-full transition">Jour 1<br><span class="text-base font-normal">S'ancrer et détendre</span></a>
      <span class="px-4 py-2 bg-fluance/10 rounded-full">Jour 2<br><span class="text-base font-normal">Lâcher-prise</span></span>
      <a href="{{ '/cours-en-ligne/5jours/j3/' | relativeUrl }}" class="px-4 py-2 hover:bg-fluance/10 rounded-full transition">Jour 3<br><span class="text-base font-normal">Libérer le dos</span></a>
      <a href="{{ '/cours-en-ligne/5jours/j4/' | relativeUrl }}" class="px-4 py-2 hover:bg-fluance/10 rounded-full transition">Jour 4<br><span class="text-base font-normal">Fluidité et Emotions</span></a>
      <a href="{{ '/cours-en-ligne/5jours/j5/' | relativeUrl }}" class="px-4 py-2 hover:bg-fluance/10 rounded-full transition">Jour 5<br><span class="text-base font-normal">Harmonie</span></a>
    </div>
  </header>

  <div class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-fluance text-center">Lâcher-prise :</h2>
    
    <div class="aspect-video w-full max-w-3xl mx-auto rounded-lg overflow-hidden">
      <div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/25452/b67d8444-c388-44bc-b593-4176366f343f?autoplay=false&amp;loop=false&amp;muted=false&amp;preload=true&amp;responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true" captions="FR"></iframe></div>
    </div>
  </div>

  <div class="section-card p-8 bg-white space-y-6">
    <div class="max-w-md mx-auto space-y-4">
      <p class="text-lg text-[#0f172a]/80 text-center">
        <strong>Notez de 1 à 10 votre état de détente de votre haut du corps avant et après :</strong>
      </p>
      <p class="text-sm text-[#0f172a]/60 text-center italic">
        (1 = catastrophique, 10 = tout est fluide)
      </p>
      <h3 class="text-xl font-semibold text-[#0f172a]">Ajouter un commentaire</h3>
      <form id="comment-form">
        <input type="text" id="name" placeholder="Votre prénom" required="" class="w-full p-3 mb-3 border-2 border-fluance/20 rounded-lg focus:border-fluance focus:outline-hidden text-[#0f172a]">
        <textarea id="text" placeholder="Votre commentaire" required="" rows="4" class="w-full p-3 mb-3 border-2 border-fluance/20 rounded-lg focus:border-fluance focus:outline-hidden text-[#0f172a]"></textarea>
        <button type="submit" class="btn-primary w-full text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d]">Envoyer</button>
      </form>
      <div id="comments-container"></div>
      <div id="pagination-controls" style="margin-top:10px;"></div>

      <script>
      function escapeHTML(str) {
        var amp = String.fromCharCode(38);
        var lt = String.fromCharCode(60);
        var gt = String.fromCharCode(62);
        var quot = String.fromCharCode(34);
        var apos = String.fromCharCode(39);
        var aposEntity = String.fromCharCode(38) + String.fromCharCode(35) + String.fromCharCode(51) + String.fromCharCode(57) + String.fromCharCode(59);
        return String(str)
          .replace(new RegExp(amp, 'g'), String.fromCharCode(38) + 'amp;')
          .replace(new RegExp(lt, 'g'), String.fromCharCode(38) + 'lt;')
          .replace(new RegExp(gt, 'g'), String.fromCharCode(38) + 'gt;')
          .replace(new RegExp(quot, 'g'), String.fromCharCode(38) + 'quot;')
          .replace(new RegExp(apos, 'g'), aposEntity);
      }

      // Utiliser le projet Firebase principal (fluance-protected-content)
      // Si Firebase n'est pas déjà initialisé, l'initialiser avec le projet principal
      if (typeof firebase === 'undefined') {
        // Charger Firebase SDK
        var script1 = document.createElement('script');
        script1.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js';
        document.head.appendChild(script1);
        
        var script2 = document.createElement('script');
        script2.src = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore-compat.js';
        document.head.appendChild(script2);
        
        script2.onload = function() {
          var firebaseConfig = {
            apiKey: "AIzaSyDJ-VlDMC5PUEMeILLZ8OmdYIhvhxIfhdM",
            authDomain: "fluance-protected-content.firebaseapp.com",
            projectId: "fluance-protected-content",
            storageBucket: "fluance-protected-content.firebasestorage.app",
            messagingSenderId: "173938686776",
            appId: "1:173938686776:web:891caf76098a42c3579fcd",
            measurementId: "G-CWPNXDQEYR"
          };
          if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
          }
          initComments();
        };
      } else {
        // Firebase déjà initialisé, utiliser l'instance existante
        if (!firebase.apps.length) {
          var firebaseConfig = {
            apiKey: "AIzaSyDJ-VlDMC5PUEMeILLZ8OmdYIhvhxIfhdM",
            authDomain: "fluance-protected-content.firebaseapp.com",
            projectId: "fluance-protected-content",
            storageBucket: "fluance-protected-content.firebasestorage.app",
            messagingSenderId: "173938686776",
            appId: "1:173938686776:web:891caf76098a42c3579fcd",
            measurementId: "G-CWPNXDQEYR"
          };
          firebase.initializeApp(firebaseConfig);
        }
        initComments();
      }

      function initComments() {
      var db = firebase.firestore();
      var pageId = encodeURIComponent(window.location.origin + window.location['pathname']);
      var COMMENTS_PER_PAGE = 20;
      var allComments = [];
      var currentPage = 1;

      document.getElementById("comment-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("name").value.trim();
        var text = document.getElementById("text").value.trim();
        if (!name || !text) return;
        if (/[<>]/.test(name) || /[<>]/.test(text)) {
          alert("Les caractères < et > ne sont pas autorisés.");
          return;
        }
        db.collection("comments").doc(pageId).collection("messages").add({
          name: name,
          text: text,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function() {
          document.getElementById("comment-form").reset();
        });
      });

      function renderCommentsPage(page) {
        var container = document.getElementById("comments-container");
        if (!container) return;
        
        // Vider le conteneur
        container.innerHTML = '';
        
        // Créer le titre
        var title = document.createElement('h3');
        title.textContent = 'Commentaires';
        container.appendChild(title);
        
        if (allComments.length === 0) {
          var emptyMsg = document.createElement('p');
          emptyMsg.style.color = '#666';
          emptyMsg.style.fontStyle = 'italic';
          emptyMsg.textContent = 'Aucun commentaire pour le moment. Soyez le premier à partager votre expérience !';
          container.appendChild(emptyMsg);
          renderPaginationControls(page);
          return;
        }
        
        var start = (page - 1) * COMMENTS_PER_PAGE;
        var end = start + COMMENTS_PER_PAGE;
        var pageComments = allComments.slice(start, end);
        for (var i = 0; i < pageComments.length; i++) {
          var c = pageComments[i];
          var text = escapeHTML(c.text);
          var name = escapeHTML(c.name);
          
          // Créer le conteneur du commentaire
          var commentDiv = document.createElement('div');
          commentDiv.style.borderBottom = '1px solid #ccc';
          commentDiv.style.marginBottom = '10px';
          commentDiv.style.paddingBottom = '10px';
          
          // Créer le nom en gras
          var nameStrong = document.createElement('strong');
          nameStrong.textContent = name;
          commentDiv.appendChild(nameStrong);
          
          // Créer le saut de ligne
          commentDiv.appendChild(document.createElement('br'));
          
          // Créer le paragraphe avec le texte
          var textP = document.createElement('p');
          textP.textContent = text;
          commentDiv.appendChild(textP);
          
          container.appendChild(commentDiv);
        }
        renderPaginationControls(page);
      }

      function renderPaginationControls(page) {
        var controls = document.getElementById("pagination-controls");
        var totalPages = Math.ceil(allComments.length / COMMENTS_PER_PAGE);
        if (totalPages <= 1) {
          controls.innerHTML = '';
          return;
        }
        
        // Vider le conteneur
        controls.innerHTML = '';
        
        // Bouton précédent
        if (page > 1) {
          var prevBtn = document.createElement('button');
          prevBtn.id = 'prev-page';
          prevBtn.textContent = '< Précédent';
          prevBtn.onclick = function() {
            currentPage--;
            renderCommentsPage(currentPage);
          };
          controls.appendChild(prevBtn);
          controls.appendChild(document.createTextNode(' '));
        }
        
        // Texte de pagination
        controls.appendChild(document.createTextNode('Page ' + page + ' / ' + totalPages));
        
        // Bouton suivant
        if (page < totalPages) {
          controls.appendChild(document.createTextNode(' '));
          var nextBtn = document.createElement('button');
          nextBtn.id = 'next-page';
          nextBtn.textContent = 'Suivant >';
          nextBtn.onclick = function() {
            currentPage++;
            renderCommentsPage(currentPage);
          };
          controls.appendChild(nextBtn);
        }
      }

      if (db) {
        console.log("Chargement des commentaires pour pageId:", pageId);
        db.collection("comments").doc(pageId).collection("messages")
          .orderBy("timestamp", "desc")
          .onSnapshot(function(snapshot) {
            console.log("Commentaires reçus:", snapshot.size);
            allComments = [];
            snapshot.forEach(function(doc) {
              allComments.push(doc.data());
            });
            allComments.sort(function(a, b) {
              if (a.timestamp && b.timestamp) {
                try {
                  var timeA = a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                  var timeB = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                  return timeB - timeA;
                } catch (e) {
                  return 0;
                }
              }
              return 0;
            });
            currentPage = 1;
            renderCommentsPage(currentPage);
          }, function(error) {
            console.error("Erreur Firestore :", error);
            console.error("Code d'erreur:", error.code);
            console.error("Message:", error.message);
            var container = document.getElementById("comments-container");
            if (container) {
              container.innerHTML = '';
              var errorP = document.createElement('p');
              errorP.style.color = 'red';
              if (error.code === 'failed-precondition') {
                errorP.textContent = 'Erreur : Un index Firestore est requis. Vérifiez la console pour le lien de création.';
              } else {
                errorP.textContent = 'Erreur lors du chargement des commentaires : ' + error.message;
              }
              container.appendChild(errorP);
            }
          });
      } else {
        console.error("Firestore n'est pas initialisé");
      }
      }
      </script>
    </div>
  </div>

  <div class="section-card p-8 bg-white space-y-6">
    <div class="space-y-4">
      <p class="text-xl text-[#0f172a]/80 text-center">
        5 minutes par jour durant 5 jours <strong>d'expériences intuitives et puissantes pour :</strong>
      </p>

      <div class="flex flex-col gap-3 text-left max-w-2xl mx-auto">
        <div class="flex items-start gap-3">
          <span class="text-[#8bc34a] text-xl font-bold mt-1">☑️</span>
          <p class="text-lg text-[#0f172a]/80"><strong>Relâcher</strong> la pression quotidienne</p>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-[#8bc34a] text-xl font-bold mt-1">☑️</span>
          <p class="text-lg text-[#0f172a]/80"><strong>Libérer</strong> les tensions physiques et émotionnelles</p>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-[#8bc34a] text-xl font-bold mt-1">☑️</span>
          <p class="text-lg text-[#0f172a]/80">Développer une <strong>présence calme et confiante</strong></p>
        </div>
      </div>
    </div>
    
    <p class="text-lg text-[#0f172a]/80 text-center">
      Vous êtes guidé par <strong>Cédric Vonlanthen</strong>, enseignant de méditation depuis plus de 13 ans et fondateur de Fluance.
    </p>
    
    <div class="pt-4 border-t border-fluance/20">
      <p class="text-lg text-[#0f172a]/80 text-center">
        Pour inviter votre entourage à ces 5 jours vers la détente, transmettez-leur l'adresse fluance.io
      </p>
    </div>
  </div>
</section>

