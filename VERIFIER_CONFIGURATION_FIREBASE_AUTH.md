# Vérifier la configuration Firebase Auth pour les emails

## ✅ État actuel

Les logs montrent que **le code fonctionne correctement** :
- ✅ La fonction `sendSignInLink` est appelée
- ✅ Firebase Auth est initialisé
- ✅ `auth.sendSignInLinkToEmail()` est appelé et réussit
- ❌ **Mais l'email n'arrive pas**

Cela signifie que le problème est dans la **configuration Firebase Auth**, pas dans votre code.

## 🔍 Vérifications à faire dans Firebase Console

### 1. Vérifier que "Email link (passwordless)" est activé

1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet **fluance-protected-content**
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
5. **Important** : Cliquez sur **"Edit template"** et vérifiez :
   - Le sujet de l'email
   - Le contenu HTML
   - Que le lien est bien présent dans le template

### 3. Vérifier les domaines autorisés

1. Dans **Authentication**, cliquez sur l'onglet **Settings**
2. Faites défiler jusqu'à **"Authorized domains"**
3. Vérifiez que ces domaines sont présents :
   - ✅ `fluance.io`
   - ✅ `localhost` (pour les tests locaux)
   - ✅ `fluance-protected-content.firebaseapp.com` (domaine Firebase par défaut)
4. Si `fluance.io` n'est pas présent :
   - Cliquez sur **"Add domain"**
   - Ajoutez `fluance.io`
   - Cliquez sur **"Add"**

### 4. Vérifier les quotas Firebase

1. Dans Firebase Console, allez dans **Usage and billing**
2. Vérifiez que vous n'avez pas dépassé les limites d'envoi d'emails
3. Le plan gratuit Firebase permet :
   - **100 emails/jour** pour les emails de vérification/connexion
   - Si vous avez dépassé cette limite, les emails ne seront pas envoyés

### 5. Vérifier les spams

Les emails Firebase peuvent être filtrés comme spam :
- ✅ Vérifiez votre dossier **spam/courrier indésirable**
- ✅ Vérifiez les filtres de votre boîte email Gmail
- ✅ L'expéditeur est généralement : `noreply@fluance-protected-content.firebaseapp.com`
- ✅ Ajoutez cet expéditeur à vos contacts pour éviter les filtres

### 6. Tester avec un autre email

Testez avec :
- Un email Gmail différent
- Un email Outlook
- Un email professionnel

Pour identifier si c'est un problème spécifique à votre fournisseur d'email.

## 🐛 Débogage avancé

### Vérifier les logs Firebase

1. Dans Firebase Console, allez dans **Functions**
2. Cliquez sur l'onglet **Logs**
3. Cherchez des erreurs liées à l'envoi d'emails
4. **Note** : Les emails Firebase Auth ne passent pas par Functions, donc vous ne verrez probablement rien ici

### Vérifier l'email dans Gmail

1. Allez dans Gmail
2. Utilisez la recherche : `from:noreply@fluance-protected-content.firebaseapp.com`
3. Vérifiez si l'email est présent mais filtré

### Tester la réinitialisation de mot de passe

Pour vérifier si le problème est spécifique aux liens passwordless :
1. Allez sur `/reinitialiser-mot-de-passe`
2. Entrez votre email
3. Vérifiez si vous recevez l'email de réinitialisation
4. Si oui → le problème est spécifique aux liens passwordless
5. Si non → le problème est général avec les emails Firebase Auth

## 🔧 Solutions possibles

### Solution 1 : Réinitialiser le template d'email

1. Dans **Authentication > Sign-in method > Email link**
2. Cliquez sur **"Email templates"**
3. Cliquez sur **"Email link sign-in"**
4. Cliquez sur **"Reset to default"** (si disponible)
5. Personnalisez le template si nécessaire
6. Cliquez sur **"Save"**

### Solution 2 : Vérifier le domaine personnalisé

Si vous utilisez un domaine personnalisé (`fluance.io`), vérifiez :
1. Que le domaine est bien configuré dans Firebase Hosting
2. Que les DNS sont correctement configurés
3. Que le domaine est dans la liste des domaines autorisés

### Solution 3 : Contacter le support Firebase

Si rien ne fonctionne :
1. Allez dans Firebase Console
2. Cliquez sur **Support** (en bas à gauche)
3. Créez un ticket de support
4. Mentionnez :
   - Que `sendSignInLinkToEmail()` réussit mais que l'email n'arrive pas
   - Votre projet : `fluance-protected-content`
   - L'email testé : `cedricjourney@gmail.com`
   - Les logs montrent que l'appel réussit

## 📋 Checklist de vérification

- [ ] "Email link (passwordless)" est activé dans Firebase Console
- [ ] Le template d'email est configuré et contient un lien
- [ ] Le domaine `fluance.io` est dans les domaines autorisés
- [ ] Les quotas Firebase ne sont pas dépassés
- [ ] Vérifié les spams dans Gmail
- [ ] Testé avec un autre email
- [ ] Testé la réinitialisation de mot de passe (pour comparer)
- [ ] Recherché l'email dans Gmail avec `from:noreply@...`

## 💡 Prochaines étapes

1. **Commencez par vérifier les domaines autorisés** (étape 3) - c'est souvent la cause
2. **Vérifiez les spams** (étape 5) - les emails Firebase sont souvent filtrés
3. **Testez avec un autre email** (étape 6) - pour isoler le problème
4. **Vérifiez les quotas** (étape 4) - si vous avez envoyé beaucoup d'emails récemment

---

**Date de création** : 2025-12-09

