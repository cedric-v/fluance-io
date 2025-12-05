# Exemple d'utilisation du contenu protégé

## Structure du contenu dans Firebase Storage

Organisez vos fichiers HTML dans Firebase Storage selon cette structure :

```
protected-content/
  ├── Approche Fluance Complète/
  │   ├── video-1.html
  │   ├── video-2.html
  │   ├── introduction.html
  │   └── ...
  ├── Cours en ligne/
  │   ├── cours-1.html
  │   ├── cours-2.html
  │   └── ...
  └── Produit standard/
      └── ...
```

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
<script src="/assets/js/firebase-auth.js"></script>
```

### Méthode 3 : JavaScript manuel

```html
<div id="my-content"></div>
<script src="/assets/js/firebase-auth.js"></script>
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

## Upload des fichiers dans Firebase Storage

### Via la console Firebase

1. Aller dans **Storage** dans la console Firebase
2. Créer la structure de dossiers : `protected-content/Produit/`
3. Uploader les fichiers HTML

### Via Firebase CLI

```bash
# Installer Firebase CLI si pas déjà fait
npm install -g firebase-tools

# Se connecter
firebase login

# Uploader un fichier
firebase storage:upload ./video-1.html protected-content/Approche\ Fluance\ Complète/video-1.html
```

### Via script Node.js

Créer un script `scripts/upload-content.js` :

```javascript
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialiser Firebase Admin
const serviceAccount = require('./path/to/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'your-project.appspot.com'
});

const bucket = admin.storage().bucket();

async function uploadFile(localPath, remotePath) {
  await bucket.upload(localPath, {
    destination: remotePath,
    metadata: {
      contentType: 'text/html',
    },
  });
  console.log(`✅ Uploaded ${localPath} to ${remotePath}`);
}

// Exemple d'utilisation
async function main() {
  await uploadFile(
    './content/video-1.html',
    'protected-content/Approche Fluance Complète/video-1.html'
  );
}

main().catch(console.error);
```

## Bonnes pratiques

1. **Nommage des fichiers** : Utilisez des noms descriptifs et cohérents (`video-1`, `cours-introduction`, etc.)

2. **Structure HTML** : Incluez toujours un conteneur principal avec une classe pour le styling

3. **Responsive** : Assurez-vous que les vidéos et le contenu sont responsives

4. **Performance** : Limitez la taille des fichiers HTML (préférez les liens vers les vidéos plutôt que d'embarquer de gros fichiers)

5. **Sécurité** : Ne jamais inclure d'informations sensibles dans les fichiers HTML (tokens, clés API, etc.)

6. **Versioning** : Considérez ajouter un système de versioning si vous modifiez le contenu fréquemment

## Test

Pour tester le contenu protégé :

1. Créer un token de test via la fonction `createUserToken`
2. Créer un compte avec ce token
3. Uploader un fichier HTML de test dans Storage
4. Afficher le contenu dans une page avec `{% protectedContent "test" %}`
5. Vérifier que le contenu s'affiche correctement

