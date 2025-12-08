# Guide : Obtenir la configuration Firebase pour fluance-protected-content

Ce guide vous explique comment obtenir les clés de configuration Firebase nécessaires pour le nouveau projet.

## Étape 1 : Accéder aux paramètres du projet

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Cliquez sur l'icône ⚙️ (Paramètres du projet) en haut à gauche
4. Cliquez sur **Paramètres du projet** / **Project settings**

## Étape 2 : Obtenir la configuration Web

1. Dans les paramètres du projet, faites défiler jusqu'à la section **Vos applications** / **Your apps**
2. Si aucune application web n'existe, cliquez sur **</>** (Ajouter une application) ou **Add app**
3. Donnez un nom à l'application (ex: "Fluance Website")
4. Cliquez sur **Enregistrer** / **Register app**
5. Vous verrez la configuration Firebase avec les clés suivantes :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "fluance-protected-content.firebaseapp.com",
  projectId: "fluance-protected-content",
  storageBucket: "fluance-protected-content.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

## Étape 3 : Mettre à jour les fichiers

Une fois que vous avez obtenu la configuration, mettez à jour les fichiers suivants :

### 1. `src/assets/js/firebase-auth.js`

Remplacez la configuration Firebase (lignes 7-14) par votre nouvelle configuration.

### 2. Pages des 5 jours (NON NÉCESSAIRE)

⚠️ **Note** : Les pages des 5 jours (`5jours-j1.md` à `5jours-j5.md`) utilisent Firebase uniquement pour les commentaires avec l'ancien projet `owncommentsfluance`. Ne modifiez pas ces fichiers, ils fonctionnent indépendamment du nouveau projet pour le contenu protégé.

## Structure de la configuration

La configuration doit contenir ces champs :

- **apiKey** : Clé API publique (commence par `AIzaSy`)
- **authDomain** : `{projectId}.firebaseapp.com`
- **projectId** : `fluance-protected-content`
- **storageBucket** : `{projectId}.firebasestorage.app` (même si vous n'utilisez pas Storage)
- **messagingSenderId** : ID numérique
- **appId** : ID de l'application (format : `1:...:web:...`)

## Note importante

⚠️ **Ces clés sont publiques** et peuvent être exposées dans le code client. C'est normal et sécurisé car :
- Les règles de sécurité Firestore/Storage protègent les données
- L'authentification est requise pour accéder au contenu protégé
- Les clés API sont limitées par domaine dans les paramètres Firebase

## Vérification

Après avoir mis à jour la configuration, testez :

1. Ouvrez la console du navigateur (F12)
2. Vérifiez qu'il n'y a pas d'erreurs Firebase
3. Testez la connexion sur `/connexion-firebase`
4. Testez le chargement du contenu protégé

