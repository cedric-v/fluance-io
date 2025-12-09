# Guide : Importer les vidéos du cours "21 jours" dans Firebase

Ce guide explique comment importer facilement les titres et codes embed des vidéos dans Firestore.

## Prérequis

1. **Node.js** installé
2. **Firebase Admin SDK** - Le script utilise `firebase-admin` qui est déjà installé dans `functions/`
3. **Fichier serviceAccountKey.json** - Clé de service Firebase (voir ci-dessous)

## Étape 1 : Obtenir la clé de service Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Cliquez sur l'icône ⚙️ (Settings) > **Project settings**
4. Allez dans l'onglet **Service accounts**
5. Cliquez sur **Generate new private key**
6. Téléchargez le fichier JSON
7. Renommez-le en `serviceAccountKey.json`
8. Placez-le dans le dossier `functions/` (à la racine du projet, au même niveau que `package.json`)

⚠️ **Important** : Ne commitez JAMAIS ce fichier dans Git ! Il est déjà dans `.gitignore`.

## Étape 2 : Préparer les données

### ⭐ Méthode recommandée : Fichier texte simple

1. Ouvrez le fichier `scripts/21jours-videos-data.txt`
2. Pour chaque jour, trouvez la section `=== JOUR X ===`
3. Collez directement votre code embed HTML après `EMBED:` (sur une ou plusieurs lignes)
4. **Aucun échappement nécessaire** - vous pouvez copier-coller le code HTML tel quel !

**Exemple :**
```
=== JOUR 1 ===
TITRE: Ancrage et épaules
EMBED:
<div style="position:relative;padding-top:56.25%;">
  <iframe src="https://iframe.mediadelivery.net/embed/..." 
          style="border:0;position:absolute;top:0;height:100%;width:100%;" 
          allowfullscreen="true"></iframe>
</div>
===
```

**Texte personnalisé pour les commentaires (optionnel) :**

Pour certains jours (comme le jour 0 et le jour 21), vous pouvez ajouter un texte personnalisé qui remplacera le texte par défaut au-dessus de la zone de commentaires :

```
=== JOUR 0 ===
TITRE: Déroulé
EMBED:
[code embed]
COMMENT_TEXT:
Bilan de départ :
partagez ici votre état de fluidité et de détente corporelle entre 0 et 10
(0 étant le pire, 10 le meilleur)
===
```

Si `COMMENT_TEXT:` n'est pas fourni, le texte par défaut sera utilisé : "Quelles améliorations avez-vous ressenties suite à la pratique du jour ?"

**Avantages :**
- ✅ Pas besoin d'échapper les guillemets
- ✅ Formatage libre (plusieurs lignes possibles)
- ✅ Copier-coller direct du code HTML

**Formats acceptés pour le code embed :**
- Code embed complet (iframe) : `<iframe src="..."></iframe>` ou `<div><iframe>...</iframe></div>`
- ID YouTube simple : `VIDEO_ID` (sera converti automatiquement en iframe YouTube)
- URL YouTube : `https://www.youtube.com/watch?v=VIDEO_ID` (sera converti automatiquement)

## Étape 3 : Installer les dépendances (si nécessaire)

Si `firebase-admin` n'est pas installé dans `functions/` :

```bash
cd functions
npm install firebase-admin
cd ..
```

## Étape 4 : Exécuter le script d'import

Depuis la racine du projet :

```bash
node scripts/import-21jours-videos.js
```

Le script va :
- ✅ Lire le fichier `21jours-videos-data.txt` (ou `.json` si le `.txt` n'existe pas)
- ✅ Générer le HTML formaté pour chaque vidéo
- ✅ Créer ou mettre à jour les documents dans Firestore
- ✅ Afficher un résumé des opérations

## Résultat attendu

Le script crée/met à jour les documents dans Firestore avec cette structure :

```
protectedContent/
  ├── 21jours-jour-0
  │   ├── product: "21jours"
  │   ├── day: 0
  │   ├── title: "Déroulé"
  │   └── content: "<div>...HTML formaté...</div>"
  ├── 21jours-jour-1
  │   ├── product: "21jours"
  │   ├── day: 1
  │   ├── title: "Ancrage et épaules"
  │   └── content: "<div>...HTML formaté...</div>"
  └── ...
```

## Vérification

Après l'import, vérifiez dans Firebase Console :

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Projet : **fluance-protected-content**
3. Firestore Database > collection `protectedContent`
4. Vérifiez que les documents `21jours-jour-0` à `21jours-jour-22` existent
5. Ouvrez un document pour vérifier que le contenu HTML est correct

## Dépannage

### Erreur : "serviceAccountKey.json introuvable"
- Vérifiez que le fichier est bien dans `functions/serviceAccountKey.json`
- Vérifiez que le chemin est correct dans le script (ligne 20)

### Erreur : "firebase-admin not found"
```bash
cd functions
npm install firebase-admin
cd ..
```

### Les vidéos ne s'affichent pas sur le site
- Vérifiez que le champ `product` est bien `"21jours"` (exactement, sans espaces)
- Vérifiez que le champ `day` est un nombre (pas une chaîne)
- Vérifiez que le code embed est valide

### Mettre à jour une vidéo existante
Le script met automatiquement à jour les documents existants. Relancez simplement le script après avoir modifié le fichier JSON.

## Notes importantes

- ⚠️ Le script **met à jour** les documents existants (ne les supprime pas)
- ⚠️ Les jours avec `"COLLER_LE_CODE_EMBED_ICI"` sont ignorés
- ⚠️ Le HTML généré utilise les classes Tailwind du site
- ⚠️ Les vidéos sont responsives (s'adaptent à la taille de l'écran)
