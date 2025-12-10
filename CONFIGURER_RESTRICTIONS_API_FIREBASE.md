# Guide : Configurer les restrictions de domaine pour la clé API Firebase

## ⚠️ Pourquoi cette alerte Google ?

Google a détecté votre clé API Firebase dans le code source public. C'est **normal** pour Firebase côté client, mais il faut configurer des **restrictions de domaine** pour sécuriser l'utilisation de cette clé.

## ✅ Solution : Configurer les restrictions de domaine

### Étape 1 : Accéder à Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Dans le menu de gauche, allez dans **APIs & Services** > **Credentials**

### Étape 2 : Trouver votre clé API

1. Dans la liste des clés API, trouvez la clé
2. Cliquez sur le nom de la clé pour l'éditer

### Étape 3 : Configurer les restrictions

1. Dans la section **Application restrictions**, sélectionnez **HTTP referrers (web sites)**
2. Cliquez sur **Add an item**
3. Ajoutez les domaines autorisés :

**Option 1 : Production uniquement (recommandé pour la sécurité maximale)**
```
fluance.io/*
*.fluance.io/*
```

**Option 2 : Avec développement local (si vous développez localement)**
```
fluance.io/*
*.fluance.io/*
localhost:8080
localhost:3000
127.0.0.1:8080
127.0.0.1:3000
```

⚠️ **Important** : 
- **Option 1** est plus sécurisée - seuls les domaines de production sont autorisés
- **Option 2** permet le développement local mais expose la clé à tout développeur qui peut deviner les ports
- Si vous choisissez l'Option 2, utilisez des ports spécifiques (`localhost:8080`) plutôt que `localhost:*` pour limiter les risques

**Format exact à utiliser :**
- `fluance.io/*` - Pour le domaine principal
- `*.fluance.io/*` - Pour tous les sous-domaines
- `localhost:8080` - Pour le développement local sur le port 8080 (plus sécurisé que `localhost:*`)
- `127.0.0.1:8080` - Pour le développement local sur le port 8080 (IP)

### Étape 4 : Configurer les restrictions d'API (optionnel mais recommandé)

1. Dans la section **API restrictions**, sélectionnez **Restrict key**
2. Cochez uniquement les APIs Firebase nécessaires :
   - ✅ Firebase Authentication API
   - ✅ Cloud Firestore API
   - ✅ Firebase Realtime Database API (si utilisé)
   - ✅ Firebase Storage API (si utilisé)

### Étape 5 : Enregistrer

1. Cliquez sur **Save** en bas de la page
2. Attendez quelques minutes pour que les changements prennent effet

## 🔒 Sécurité supplémentaire

### Vérifier les règles Firestore

Assurez-vous que vos règles Firestore sont bien configurées dans `firestore.rules` :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Vos règles de sécurité ici
    // Les utilisateurs non authentifiés ne doivent pas pouvoir accéder aux données sensibles
  }
}
```

### Vérifier les règles d'authentification

Dans Firebase Console > Authentication > Settings :
- Vérifiez que seuls les domaines autorisés peuvent utiliser l'authentification
- Activez les restrictions de domaine si nécessaire

## ⚠️ Important

- **Ne supprimez PAS** la clé API du code source - elle doit rester publique pour fonctionner côté client
- Les restrictions de domaine empêchent l'utilisation de la clé depuis d'autres sites
- Les règles Firestore empêchent l'accès non autorisé aux données
- Les deux mesures sont complémentaires et nécessaires

## 🔒 Sécurité : localhost vs production

### Pourquoi éviter `localhost:*` ?

Autoriser `localhost:*` permet à **n'importe quel développeur** d'utiliser votre clé API depuis son ordinateur local. Bien que les règles Firestore limitent l'accès aux données, cela reste un risque.

### Recommandations

1. **Pour la production** : Utilisez uniquement les domaines de production
   ```
   fluance.io/*
   *.fluance.io/*
   ```

2. **Pour le développement** : 
   - **Option A (recommandée)** : Créez une clé API séparée pour le développement avec `localhost:*` uniquement
   - **Option B** : Utilisez des ports spécifiques (`localhost:8080`) plutôt que `localhost:*`
   - **Option C** : Développez directement sur un sous-domaine de test (`dev.fluance.io`)

3. **Alternative** : Utilisez des variables d'environnement pour le développement local et ne commitez pas la clé API dans le code (mais pour Firebase côté client, c'est difficile à éviter)

### Créer une clé API séparée pour le développement

Si vous avez besoin de développer localement :

1. Dans Google Cloud Console > APIs & Services > Credentials
2. Cliquez sur **Create Credentials** > **API key**
3. Configurez cette nouvelle clé avec :
   - Restrictions : `localhost:*` uniquement
   - Restrictions d'API : Identiques à la clé de production
4. Utilisez cette clé uniquement en local (ne la commitez pas)

## 🆘 Vérification

Après avoir configuré les restrictions :

1. Testez votre site sur `fluance.io` - cela devrait fonctionner
2. Testez depuis un autre domaine - cela devrait être bloqué
3. Vérifiez les logs dans Google Cloud Console > APIs & Services > Dashboard pour voir les tentatives d'utilisation

## 📚 Documentation officielle

- [Restreindre les clés API](https://cloud.google.com/docs/authentication/api-keys#restricting_api_keys)
- [Sécurité Firebase](https://firebase.google.com/docs/rules)

