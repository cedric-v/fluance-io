# Exemple d'utilisation du contenu protégé

## Structure du contenu dans Firestore

> ℹ️ **Ce projet n'utilise PAS Firebase Storage** : le contenu protégé est
> stocké dans la collection Firestore `protectedContent`, sous forme de
> documents (un document = un contenu HTML).

Chaque document correspond à un contenu, identifié par son `contentId` :
## Format des fichiers HTML

Chaque fichier HTML peut contenir du contenu riche : vidéos, texte, images, etc.

### Exemple : `video-1.html`

```html
<div class="protected-video-content">
  <h2 class="text-2xl font-bold mb-4">Vidéo 1 : Introduction</h2>
  
  <div class="video-container mb-6">
    <!-- Exemple avec YouTube -->
    <iframe 
      width="560" 
      height="315" 
      src="https://www.youtube.com/embed/VIDEO_ID" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen>
    </iframe>
    
    <!-- Ou avec Vimeo -->
    <!--
    <iframe 
      src="https://player.vimeo.com/video/VIDEO_ID" 
      width="640" 
      height="360" 
      frameborder="0" 
      allow="autoplay; fullscreen; picture-in-picture" 
      allowfullscreen>
    </iframe>
    -->
  </div>
  
  <div class="content-text">
    <p class="mb-4">
      Voici le contenu de la vidéo 1. Vous pouvez ajouter du texte, 
      des images, et tout autre contenu HTML ici.
    </p>
    
    <h3 class="text-xl font-semibold mb-2">Points clés</h3>
    <ul class="list-disc list-inside mb-4">
      <li>Point 1</li>
      <li>Point 2</li>
      <li>Point 3</li>
    </ul>
  </div>
</div>

<style>
.protected-video-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;
  overflow: hidden;
}

.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
```

### Exemple : `cours-1.html`

```html
<div class="protected-course-content">
  <h1 class="text-3xl font-bold mb-6">Cours 1 : Titre du cours</h1>
  
  <div class="prose max-w-none">
    <p class="text-lg mb-4">
      Introduction au cours...
    </p>
    
    <h2 class="text-2xl font-semibold mt-8 mb-4">Section 1</h2>
    <p>
      Contenu de la section 1...
    </p>
    
    <h2 class="text-2xl font-semibold mt-8 mb-4">Section 2</h2>
    <p>
      Contenu de la section 2...
    </p>
    
    <!-- Vidéo intégrée -->
    <div class="my-8">
      <iframe 
        width="100%" 
        height="500" 
        src="https://www.youtube.com/embed/VIDEO_ID" 
        frameborder="0" 
        allowfullscreen>
      </iframe>
    </div>
  </div>
</div>
```

## Utilisation dans les pages Eleventy

### Méthode 1 : Shortcode (recommandé)

Dans un fichier `.md` ou `.njk` :

```nunjucks
---
layout: base.njk
title: Mon cours protégé
---

# Mon cours protégé

Voici l'introduction au cours...

{% protectedContent "video-1" %}

Contenu après la vidéo...

{% protectedContent "cours-1" %}
```

### Méthode 2 : HTML direct

```html
<div class="protected-content" data-content-id="video-1"></div>
<script type="module" src="/assets/js/firebase-auth.mjs"></script>
```

### Méthode 3 : JavaScript manuel

```html
<div id="my-content"></div>
<script type="module" src="/assets/js/firebase-auth.mjs"></script>
<script>
document.addEventListener('DOMContentLoaded', async function() {
  if (window.FluanceAuth.isAuthenticated()) {
    await window.FluanceAuth.displayProtectedContent(
      'video-1', 
      document.getElementById('my-content')
    );
  } else {
    document.getElementById('my-content').innerHTML = 
      '<p>Veuillez vous connecter pour accéder à ce contenu.</p>';
  }
});
</script>
```

## Ajout du contenu dans Firestore

> ℹ️ **Ce projet n'utilise PAS Firebase Storage** : tout le contenu protégé
> est stocké directement dans la collection Firestore `protectedContent`.

Chaque document de la collection `protectedContent` contient :

```
protectedContent/{contentId}
  ├── product: "21jours" | "complet" | "sos-dos-cervicales" | ...
  ├── title: "Jour 1 : Éveil du corps"
  ├── content: "<div>...code HTML complet...</div>"
  ├── day: 1            (pour le produit 21jours)
  ├── week: 2           (pour le produit complet)
  ├── commentText: "Texte personnalisé pour les commentaires"
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

### Via script Node.js (Admin SDK)

Créer un script `scripts/upload-content.js` :

```javascript
const admin = require('firebase-admin');

// Initialiser Firebase Admin (credentials par défaut du CLI)
admin.initializeApp({projectId: 'fluance-protected-content'});
const db = admin.firestore();

async function createContent(contentId, data) {
  await db.collection('protectedContent').doc(contentId).set({
    product: data.product,
    title: data.title,
    content: data.content, // HTML complet
    day: data.day || null,
    week: data.week || null,
    commentText: data.commentText || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅ Contenu ${contentId} créé dans Firestore`);
}
```

> ⚠️ **Accès client interdit** : la règle Firestore `protectedContent` refuse
> toute lecture/écriture côté client (`allow read, write: if false`). Le contenu
> est servi uniquement par la fonction callable `getProtectedContent` qui
> vérifie la possession du produit et la progression. Écriture : uniquement
> via Admin SDK (fonctions/Firebase) ou ce type de script.

## Bonnes pratiques

1. **Nommage des documents** : Utilisez des identifiants descriptifs et cohérents (`jour-1`, `semaine-2`, `sos-dos-intro`, etc.)

2. **Structure HTML** : Incluez toujours un conteneur principal avec une classe pour le styling

3. **Responsive** : Assurez-vous que les vidéos et le contenu sont responsives

4. **Performance** : Limitez la taille des champs `content` (1 MiB par document Firestore ; préférez les liens vers les vidéos plutôt que d'embarquer de gros fichiers)

5. **Sécurité** : Ne jamais inclure d'informations sensibles dans le contenu (tokens, clés API, etc.)

6. **Versioning** : Considérez ajouter un système de versioning si vous modifiez le contenu fréquemment

## Test

Pour tester le contenu protégé :

1. Créer un token de test via la fonction `createUserToken`
2. Créer un compte avec ce token
3. Ajouter un document de test dans la collection Firestore `protectedContent` (Admin SDK ou console Firebase)
4. Afficher le contenu dans une page avec `{% protectedContent "test" %}`
5. Vérifier que le contenu s'affiche correctement (connexion requise)






