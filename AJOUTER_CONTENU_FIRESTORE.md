# Guide : Ajouter du contenu protégé dans Firestore

Ce guide explique comment ajouter du contenu protégé directement dans Firestore (sans utiliser Storage).

## Structure Firestore

Le contenu est stocké dans la collection `protectedContent` avec cette structure :

```
protectedContent/
  ├── video-1 (document ID) - produit "complet"
  │   ├── product: "complet"
  │   ├── title: "Vidéo 1 : Introduction"
  │   ├── content: "<div>...code HTML complet...</div>"
  │   ├── createdAt: Timestamp (requis pour tri)
  │   └── updatedAt: Timestamp (optionnel)
  ├── 21jours-jour-1 (document ID) - produit "21jours"
  │   ├── product: "21jours"
  │   ├── day: 1 (requis)
  │   ├── title: "Ancrage et épaules"
  │   ├── content: "<div>...code HTML...</div>"
  │   └── (createdAt et updatedAt non nécessaires)
  └── ...
```

## Méthode 1 : Via la console Firebase (recommandé pour commencer)

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Cliquez sur **Firestore Database**
4. Cliquez sur **Commencer** / **Start collection** (si c'est la première fois)
5. Nom de la collection : `protectedContent`
6. Document ID : `video-1` (ou un autre ID unique)
7. Ajoutez les champs suivants :

### Pour le produit "complet"

| Champ | Type | Valeur | Requis |
|-------|------|--------|--------|
| `product` | string | `"complet"` | ✅ Oui |
| `title` | string | `"Vidéo 1 : Introduction"` | ✅ Oui |
| `content` | string | `"<div>...votre code HTML...</div>"` | ✅ Oui |
| `createdAt` | timestamp | Date actuelle | ✅ Oui (pour le tri) |
| `updatedAt` | timestamp | Date actuelle | ❌ Non (optionnel) |

### Pour le produit "21jours"

| Champ | Type | Valeur | Requis |
|-------|------|--------|--------|
| `product` | string | `"21jours"` | ✅ Oui |
| `day` | number | `0` (déroulé) ou `1-22` (jours) | ✅ Oui |
| `title` | string | Titre du jour (voir STRUCTURE_21JOURS.md) | ✅ Oui |
| `content` | string | `"<div>...votre code HTML...</div>"` | ✅ Oui |
| `createdAt` | timestamp | - | ❌ **Non** (non utilisé) |
| `updatedAt` | timestamp | - | ❌ **Non** (non utilisé) |

**Note** : Pour "21jours", seuls `product`, `day`, `title` et `content` sont nécessaires. La question et la zone de commentaires sont ajoutées automatiquement.

8. Cliquez sur **Enregistrer** / **Save**

## Méthode 2 : Via Firebase CLI

Créez un fichier JSON pour chaque contenu :

**Pour le produit "complet" - video-1.json** :
```json
{
  "product": "complet",
  "title": "Vidéo 1 : Introduction",
  "content": "<div><h2>Introduction</h2><p>Contenu HTML...</p></div>",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Pour le produit "21jours" - 21jours-jour-1.json** :
```json
{
  "product": "21jours",
  "day": 1,
  "title": "Ancrage et épaules",
  "content": "<div><h2>Jour 1</h2><iframe src='...'></iframe></div>"
}
```

**Note** : Pour "21jours", `createdAt` et `updatedAt` ne sont pas nécessaires.

Puis utilisez Firebase CLI :

```bash
# Installer Firebase CLI si pas déjà fait
npm install -g firebase-tools

# Se connecter
firebase login

# Ajouter le document
firebase firestore:set protectedContent/video-1 video-1.json
```

## Méthode 3 : Via script Node.js (pour plusieurs contenus)

Créez un script `scripts/add-content.js` :

```javascript
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialiser Firebase Admin
const serviceAccount = require('./path/to/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addContent(contentId, product, title, htmlContent, day = null) {
  const docRef = db.collection('protectedContent').doc(contentId);
  
  const data = {
    product: product,
    title: title,
    content: htmlContent
  };
  
  // Pour "21jours", ajouter le champ day
  if (product === '21jours' && day !== null) {
    data.day = day;
    // createdAt et updatedAt ne sont pas nécessaires pour 21jours
  } else if (product === 'complet') {
    // Pour "complet", ajouter createdAt pour le tri
    data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  }
  
  await docRef.set(data);
  
  console.log(`✅ Contenu ajouté : ${contentId}`);
}

// Exemple d'utilisation
async function main() {
  const htmlContent = `
    <div class="protected-video-content">
      <h2 class="text-2xl font-bold mb-4">Vidéo 1 : Introduction</h2>
      
      <div class="video-container mb-6">
        <iframe 
          width="560" 
          height="315" 
          src="https://www.youtube.com/embed/VIDEO_ID" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
      
      <div class="content-text">
        <p class="mb-4">Voici le contenu de la vidéo 1.</p>
      </div>
    </div>
  `;
  
  // Exemple pour le produit "complet"
  await addContent(
    'video-1',
    'complet',
    'Vidéo 1 : Introduction',
    htmlContent
  );
  
  // Exemple pour le produit "21jours"
  await addContent(
    '21jours-jour-1',
    '21jours',
    'Ancrage et épaules',
    htmlContent,
    1 // numéro du jour (0-22)
  );
}

main().catch(console.error);
```

## Format du contenu HTML

Le champ `content` peut contenir :

- **Code embed vidéos** (YouTube, Vimeo, etc.)
- **Texte formaté** avec HTML
- **CSS inline** ou classes Tailwind
- **JavaScript** (scripts inline)

### Exemple complet

```html
<div class="protected-video-content">
  <h2 class="text-2xl font-bold mb-4">Titre de la vidéo</h2>
  
  <!-- Embed YouTube -->
  <div class="video-container mb-6">
    <iframe 
      width="560" 
      height="315" 
      src="https://www.youtube.com/embed/VIDEO_ID" 
      frameborder="0" 
      allowfullscreen>
    </iframe>
  </div>
  
  <!-- Texte -->
  <div class="content-text">
    <p class="mb-4">Description du contenu.</p>
    <ul class="list-disc list-inside">
      <li>Point 1</li>
      <li>Point 2</li>
    </ul>
  </div>
</div>

<style>
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

## Limites importantes

⚠️ **Taille maximale** : 1 MiB par document Firestore

Si votre contenu dépasse cette limite :
- Réduisez le HTML
- Utilisez des liens vers des vidéos externes plutôt que d'embarquer du contenu
- Divisez le contenu en plusieurs documents

## Vérification

Pour vérifier que le contenu est bien ajouté :

1. Allez dans Firebase Console > Firestore Database
2. Ouvrez la collection `protectedContent`
3. Vérifiez que le document existe avec les bons champs

## Utilisation dans le site

Une fois le contenu ajouté dans Firestore, il sera automatiquement accessible via :

```nunjucks
{% protectedContent "video-1" %}
```

Ou manuellement :

```html
<div class="protected-content" data-content-id="video-1"></div>
<script src="/assets/js/firebase-auth.js"></script>
```

Le code JavaScript chargera automatiquement le contenu depuis Firestore pour les utilisateurs authentifiés ayant accès au produit correspondant.

