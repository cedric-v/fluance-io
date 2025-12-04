---
layout: base.njk
title: Jour 5 - Harmonie
description: Cinquième pratique de la série de 5 jours pour libérer les tensions et retrouver votre calme intérieur. Harmonie.
locale: fr
permalink: /cours-en-ligne/5jours/j5/
---

<section class="max-w-4xl mx-auto px-6 md:px-12 py-16 space-y-8">
  <header class="text-center space-y-6">
    <h1 class="text-4xl md:text-5xl font-semibold text-[#0f172a] leading-tight">
      Libérez les tensions<br>
      et retrouvez votre calme intérieur
    </h1>
    
    <div class="flex flex-wrap justify-center gap-4 text-lg font-semibold text-[#82153e]">
      <a href="{{ '/cours-en-ligne/5jours/j1/' | relativeUrl }}" class="px-4 py-2 hover:bg-[#82153e]/10 rounded-full transition">Jour 1<br><span class="text-base font-normal">S'ancrer et détendre</span></a>
      <a href="{{ '/cours-en-ligne/5jours/j2/' | relativeUrl }}" class="px-4 py-2 hover:bg-[#82153e]/10 rounded-full transition">Jour 2<br><span class="text-base font-normal">Lâcher-prise</span></a>
      <a href="{{ '/cours-en-ligne/5jours/j3/' | relativeUrl }}" class="px-4 py-2 hover:bg-[#82153e]/10 rounded-full transition">Jour 3<br><span class="text-base font-normal">Libérer le dos</span></a>
      <a href="{{ '/cours-en-ligne/5jours/j4/' | relativeUrl }}" class="px-4 py-2 hover:bg-[#82153e]/10 rounded-full transition">Jour 4<br><span class="text-base font-normal">Fluidité et Emotions</span></a>
      <span class="px-4 py-2 bg-[#82153e]/10 rounded-full">Jour 5<br><span class="text-base font-normal">Harmonie</span></span>
    </div>
  </header>

  <div class="section-card p-8 bg-white space-y-6">
    <h2 class="text-2xl font-semibold text-[#82153e] text-center">Harmonie :</h2>
    
    <div class="aspect-video w-full max-w-3xl mx-auto rounded-lg overflow-hidden">
      <div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/25452/1fc4e0f7-4c07-4fdc-9908-8b24755624d3?autoplay=false&amp;loop=false&amp;muted=false&amp;preload=true&amp;responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true" captions="FR"></iframe></div>
    </div>
  </div>

  <div class="section-card p-8 bg-white space-y-6">
    <div class="max-w-md mx-auto space-y-4">
      <p class="text-lg text-[#0f172a]/80 text-center">
        <strong>Notez de 1 à 10 l'état de votre présence et votre état général de détente.</strong>
      </p>
      <p class="text-lg text-[#0f172a]/80 text-center">
        <strong>Avec pour les 2, un point avant et après la pratique.</strong>
      </p>
      <p class="text-sm text-[#0f172a]/60 text-center italic">
        (1 = catastrophique, 10 = idéal)
      </p>
      <h3 class="text-xl font-semibold text-[#0f172a]">Ajouter un commentaire</h3>
      <form id="comment-form">
        <input type="text" id="name" placeholder="Votre prénom" required="" class="w-full p-3 mb-3 border-2 border-[#82153e]/20 rounded-lg focus:border-[#82153e] focus:outline-none text-[#0f172a]">
        <textarea id="text" placeholder="Votre commentaire" required="" rows="4" class="w-full p-3 mb-3 border-2 border-[#82153e]/20 rounded-lg focus:border-[#82153e] focus:outline-none text-[#0f172a]"></textarea>
        <button type="submit" class="btn-primary w-full text-[#0f172a] bg-[#ffce2d] hover:bg-[#ffd84d]">Envoyer</button>
      </form>
      <div id="comments-container"></div>
      <div id="pagination-controls" style="margin-top:10px;"></div>
      
      <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
      <script>
      function escapeHTML(str) {
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }
      </script>
      <script>
      var firebaseConfig = {
        apiKey: "AIzaSyDF7lpMAEaZxOajdiHFWft-Hary1RtQM2c",
        authDomain: "owncommentsfluance.firebaseapp.com",
        projectId: "owncommentsfluance",
        storageBucket: "owncommentsfluance.firebasestorage.app",
        messagingSenderId: "561599480401",
        appId: "1:561599480401:web:e1ad00b17fb27392126e70",
        measurementId: "G-TK4FQPTXCL"
      };
      firebase.initializeApp(firebaseConfig);
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
        container.innerHTML = "<h3>Commentaires</h3>";
        var start = (page - 1) * COMMENTS_PER_PAGE;
        var end = start + COMMENTS_PER_PAGE;
        var pageComments = allComments.slice(start, end);
        for (var i = 0; i < pageComments.length; i++) {
          var c = pageComments[i];
          var text = escapeHTML(c.text);
          var name = escapeHTML(c.name);
          container.innerHTML += '<div style="border-bottom:1px solid #ccc; margin-bottom:10px; padding-bottom:10px;"><strong>' + name + '</strong><br /><p>' + text + '</p></div>';
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
        var html = '';
        if (page > 1) {
          html += '<button id="prev-page">&lt; Précédent</button> ';
        }
        html += 'Page ' + page + ' / ' + totalPages;
        if (page < totalPages) {
          html += ' <button id="next-page">Suivant &gt;</button>';
        }
        controls.innerHTML = html;
        if (page > 1) {
          document.getElementById("prev-page").onclick = function() {
            currentPage--;
            renderCommentsPage(currentPage);
          };
        }
        if (page < totalPages) {
          document.getElementById("next-page").onclick = function() {
            currentPage++;
            renderCommentsPage(currentPage);
          };
        }
      }
      
      db.collection("comments").doc(pageId).collection("messages")
        .orderBy("timestamp", "desc")
        .onSnapshot(function(snapshot) {
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
        });
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
    
    <div class="pt-4 border-t border-[#82153e]/20">
      <p class="text-lg text-[#0f172a]/80 text-center">
        Pour inviter votre entourage à ces 5 jours vers la détente, transmettez-leur l'adresse fluance.io
      </p>
    </div>
  </div>
</section>

