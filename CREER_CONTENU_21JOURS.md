# Guide rapide : Créer du contenu pour le produit "21jours"

## Problème actuel

Vous voyez l'erreur "Contenu non trouvé" car le document `test-video-1` n'existe pas dans Firestore, ou il existe mais avec un produit différent.

## Solution : Créer le contenu dans Firestore

### Étape 1 : Aller dans Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Cliquez sur **Firestore Database** dans le menu de gauche

### Étape 2 : Créer le document

1. Cliquez sur **Commencer** / **Start collection** (si c'est la première fois)
2. Nom de la collection : `protectedContent`
3. Document ID : `test-video-1` (ou un autre ID unique)
4. Cliquez sur **Suivant** / **Next**

### Étape 3 : Ajouter les champs

Ajoutez les champs suivants :

| Champ | Type | Valeur |
|-------|------|--------|
| `product` | **string** | `21jours` ⚠️ **IMPORTANT : doit être exactement "21jours"** |
| `title` | **string** | `Test Vidéo 1` |
| `content` | **string** | Votre HTML (voir exemple ci-dessous) |
| `createdAt` | **timestamp** | Cliquez sur l'icône horloge pour la date actuelle |
| `updatedAt` | **timestamp** | Cliquez sur l'icône horloge pour la date actuelle |

### Étape 4 : Exemple de contenu HTML

Pour le champ `content`, vous pouvez utiliser :

```html
<div class="protected-video-content">
  <h2 class="text-2xl font-bold mb-4">Vidéo de test pour 21 jours</h2>
  
  <div class="video-container mb-6">
    <iframe 
      width="560" 
      height="315" 
      src="https://www.youtube.com/embed/VOTRE_VIDEO_ID" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen>
    </iframe>
  </div>
  
  <div class="content-text">
    <p class="mb-4">Bienvenue dans le défi 21 jours !</p>
  </div>
</div>
```

### Étape 5 : Enregistrer

Cliquez sur **Enregistrer** / **Save**

## Vérification

1. Rechargez la page `/membre/`
2. Le contenu devrait maintenant s'afficher

## Structure Firestore attendue

```
protectedContent/
  └── test-video-1
      ├── product: "21jours"  ← Doit correspondre au produit de l'utilisateur
      ├── title: "Test Vidéo 1"
      ├── content: "<div>...HTML...</div>"
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp
```

## Notes importantes

- ⚠️ Le champ `product` doit être **exactement** `"21jours"` (sans espaces, en minuscules)
- ⚠️ Le Document ID (`test-video-1`) doit correspondre à celui utilisé dans le shortcode : `{% protectedContent "test-video-1" %}`
- Le contenu HTML peut contenir du code embed, du texte, du CSS, etc.
- Taille maximale : 1 MiB par document

## Autres produits

Pour le produit `"complet"`, créez un document avec `product: "complet"` au lieu de `"21jours"`.

