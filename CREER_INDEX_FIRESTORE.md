# Créer l'index Firestore pour les commentaires

## Problème

Si les commentaires ne se chargent pas et que vous voyez une erreur `failed-precondition` dans la console, c'est qu'un index Firestore est nécessaire pour la requête `orderBy("timestamp", "desc")` sur la sous-collection `messages`.

## Solution

### Option 1 : Via Firebase Console (recommandé)

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet **fluance-protected-content**
3. Allez dans **Firestore Database**
4. Cliquez sur l'onglet **Indexes**
5. Si vous voyez une erreur avec un lien "Create index", cliquez dessus
6. Sinon, cliquez sur **Create index**
7. Configurez l'index :
   - **Collection ID** : `messages` (collection group)
   - **Fields to index** :
     - `timestamp` : **Descending**
   - Cliquez sur **Create**

### Option 2 : Via Firebase CLI

Si vous avez Firebase CLI installé :

```bash
firebase deploy --only firestore:indexes --project fluance-protected-content
```

Le fichier `firestore.indexes.json` est déjà créé dans le projet.

## Vérification

Après la création de l'index :
1. Attendez quelques minutes que l'index soit construit (Firebase vous enverra un email quand c'est prêt)
2. Rechargez la page `https://fluance.io/cours-en-ligne/5jours/j1/`
3. Ouvrez la console du navigateur (F12)
4. Vous devriez voir les logs : "Chargement des commentaires pour pageId: ..." et "Commentaires reçus: X"
5. Les commentaires devraient s'afficher

## Note

L'index est nécessaire car Firestore nécessite un index pour toutes les requêtes avec `orderBy` sur des sous-collections.

