# Déboguer les emails de connexion Firebase (passwordless)

## 🔍 Problème

Vous voyez le message "Un lien de connexion a été envoyé à votre email" mais aucun email n'arrive dans Mailjet.

## ⚠️ Important : Firebase Auth ≠ Mailjet

**Les emails de connexion passwordless Firebase sont envoyés directement par Firebase Auth**, pas par Mailjet.

- ✅ **Mailjet** : Utilisé uniquement pour les emails de **création de compte** (tokens d'inscription)
- ✅ **Firebase Auth** : Utilisé pour les emails de **connexion passwordless** et **réinitialisation de mot de passe**

## 🔧 Vérifications à faire

### 1. Vérifier que "Email link (passwordless)" est activé

1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet **fluance-io**
3. Dans le menu de gauche, cliquez sur **Authentication** (ou **Build > Authentication**)
4. Cliquez sur l'onglet **Sign-in method**
5. Vérifiez que **"Email link (passwordless sign-in)"** est activé (toggle vert)
6. Si ce n'est pas le cas :
   - Cliquez sur **"Email link (passwordless sign-in)"**
   - Activez le toggle en haut
   - Cliquez sur **Enregistrer** / **Save**

### 2. Vérifier les templates d'email Firebase

1. Toujours dans **Authentication > Sign-in method**
2. Cliquez sur **"Email link (passwordless sign-in)"**
3. Faites défiler jusqu'à la section **"Email templates"**
4. Vérifiez que le template **"Email link sign-in"** est configuré
5. Si nécessaire, personnalisez le template (sujet, contenu HTML)

### 3. Vérifier les domaines autorisés

1. Dans **Authentication**, cliquez sur l'onglet **Settings**
2. Faites défiler jusqu'à **"Authorized domains"**
3. Vérifiez que votre domaine est présent :
   - `fluance.io`
   - `localhost` (pour les tests locaux)
   - Tous les sous-domaines nécessaires

### 4. Vérifier les logs Firebase

1. Dans Firebase Console, allez dans **Functions**
2. Cliquez sur l'onglet **Logs**
3. Cherchez des erreurs liées à l'envoi d'emails
4. Note : Les emails Firebase Auth ne passent pas par Functions, donc vous ne verrez rien ici

### 5. Vérifier les spams

Les emails Firebase peuvent être filtrés comme spam :
- ✅ Vérifiez votre dossier **spam/courrier indésirable**
- ✅ Vérifiez les filtres de votre boîte email
- ✅ Ajoutez `noreply@[PROJECT_ID].firebaseapp.com` à vos contacts

### 6. Tester avec un autre email

Testez avec :
- Un email Gmail
- Un email Outlook
- Un email professionnel

Pour identifier si c'est un problème spécifique à votre fournisseur d'email.

## 🐛 Débogage dans le navigateur

Ouvrez la console du navigateur (F12) et vérifiez :

1. **Erreurs JavaScript** :
   ```javascript
   // Vérifiez s'il y a des erreurs dans la console
   console.error('Send sign in link error:', error);
   ```

2. **Code d'erreur Firebase** :
   - `auth/invalid-email` : Email invalide
   - `auth/user-disabled` : Compte désactivé
   - `auth/user-not-found` : Utilisateur non trouvé (normal pour passwordless)
   - `auth/too-many-requests` : Trop de requêtes

## 🔄 Solution : Utiliser Mailjet pour les emails de connexion

Si vous voulez absolument que les emails passent par Mailjet, il faudrait :

1. **Créer une Cloud Function** qui intercepte l'envoi
2. **Désactiver l'envoi automatique Firebase Auth**
3. **Envoyer l'email via Mailjet** avec un lien personnalisé

⚠️ **C'est complexe** et nécessite de gérer manuellement :
- La génération des liens de connexion
- La validation des liens
- La sécurité (expiration, usage unique)

**Recommandation** : Utilisez Firebase Auth pour les emails de connexion (c'est plus simple et sécurisé).

## 📝 Vérification rapide

Exécutez cette commande dans la console du navigateur après avoir cliqué sur "Envoyer le lien" :

```javascript
// Vérifier si Firebase Auth est bien initialisé
console.log('Firebase Auth:', firebase.auth());

// Vérifier l'email stocké dans localStorage
console.log('Email for sign in:', localStorage.getItem('emailForSignIn'));
```

## ✅ Checklist de résolution

- [ ] "Email link (passwordless)" est activé dans Firebase Console
- [ ] Le template d'email est configuré
- [ ] Le domaine est autorisé dans Firebase
- [ ] Vérifié les spams
- [ ] Testé avec un autre email
- [ ] Vérifié la console du navigateur pour les erreurs
- [ ] Vérifié que l'email n'est pas déjà utilisé avec un autre compte

## 🆘 Si rien ne fonctionne

1. **Vérifiez les quotas Firebase** :
   - Allez dans **Usage and billing**
   - Vérifiez que vous n'avez pas dépassé les limites d'envoi d'emails

2. **Contactez le support Firebase** :
   - Si le problème persiste, contactez le support Firebase
   - Fournissez les logs de la console du navigateur

3. **Alternative temporaire** :
   - Utilisez la connexion par **mot de passe** en attendant
   - Les emails de réinitialisation de mot de passe fonctionnent-ils ?

---

**Date de création** : 2025-12-09

