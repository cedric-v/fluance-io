# Guide rapide : Configurer la clé API Firebase

## ⚠️ Problème actuel

L'erreur `API key not valid` indique que le fichier `src/assets/js/firebase-auth.js` contient encore les placeholders au lieu des vraies clés API Firebase.

## 🔧 Solution : Remplacer les placeholders

### Étape 1 : Obtenir la configuration Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **fluance-protected-content**
3. Cliquez sur l'icône ⚙️ (Paramètres du projet) en haut à gauche
4. Cliquez sur **Paramètres du projet** / **Project settings**
5. Faites défiler jusqu'à la section **Vos applications** / **Your apps**
6. Si aucune application web n'existe :
   - Cliquez sur **</>** (Ajouter une application) ou **Add app**
   - Donnez un nom : "Fluance Website"
   - Cliquez sur **Enregistrer** / **Register app**
7. Copiez la configuration affichée

### Étape 2 : Mettre à jour `src/assets/js/firebase-auth.js`

Ouvrez le fichier `src/assets/js/firebase-auth.js` et remplacez les lignes 9-16 :

**Avant (placeholders)** :
```javascript
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY_ICI",
  authDomain: "fluance-protected-content.firebaseapp.com",
  projectId: "fluance-protected-content",
  storageBucket: "fluance-protected-content.firebasestorage.app",
  messagingSenderId: "VOTRE_MESSAGING_SENDER_ID",
  appId: "VOTRE_APP_ID"
};
```

**Après (avec vos vraies clés)** :
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...", // Votre vraie clé API (commence par AIzaSy)
  authDomain: "fluance-protected-content.firebaseapp.com",
  projectId: "fluance-protected-content",
  storageBucket: "fluance-protected-content.firebasestorage.app",
  messagingSenderId: "123456789012", // Votre vrai ID numérique
  appId: "1:123456789012:web:abcdef123456" // Votre vrai App ID
};
```

### Étape 3 : Vérifier

1. Rechargez la page `/creer-compte/` ou `/connexion-membre/`
2. Ouvrez la console du navigateur (F12)
3. L'erreur `API key not valid` ne devrait plus apparaître
4. Testez la création de compte avec un code d'activation valide

## 📋 Où trouver chaque valeur

| Champ | Où le trouver |
|-------|---------------|
| `apiKey` | Dans la configuration Firebase, commence par `AIzaSy...` |
| `authDomain` | Généralement `{projectId}.firebaseapp.com` |
| `projectId` | `fluance-protected-content` (déjà correct) |
| `storageBucket` | Généralement `{projectId}.firebasestorage.app` |
| `messagingSenderId` | ID numérique dans la configuration Firebase |
| `appId` | Format `1:...:web:...` dans la configuration Firebase |

## ⚠️ Important

- Ces clés sont **publiques** (c'est normal, elles sont dans le code client)
- La sécurité est assurée par les **règles Firestore** et l'**authentification**
- Vous pouvez limiter l'utilisation de la clé API par domaine dans Firebase Console

## 🆘 Si vous ne trouvez pas la configuration

Voir le guide détaillé : `OBTENIR_CONFIGURATION_FIREBASE.md`

