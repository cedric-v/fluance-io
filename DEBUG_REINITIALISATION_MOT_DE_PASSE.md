# Déboguer la réinitialisation de mot de passe

## 🔍 Problème

L'email de réinitialisation de mot de passe n'arrive pas à l'utilisateur.

## ⚠️ Important : Firebase Auth ≠ Mailjet

**Les emails de réinitialisation de mot de passe sont envoyés directement par Firebase Auth**, pas par Mailjet.

- ✅ **Mailjet** : Utilisé uniquement pour les emails de **création de compte** (tokens d'inscription)
- ✅ **Firebase Auth** : Utilisé pour les emails de **réinitialisation de mot de passe** et **connexion passwordless**

## 📧 Domaine personnalisé pour les emails

Un domaine personnalisé est configuré pour l'envoi des emails Firebase Auth (ex: `actu.votre-domaine.io`).

**État actuel** : "Custom-domain verification in progress" (Vérification en cours)

Une fois la vérification terminée :
- Les emails seront envoyés depuis votre domaine personnalisé (ex: `support@votre-domaine.io`) au lieu de `noreply@[PROJECT_ID].firebaseapp.com`
- Cela améliore la délivrabilité et la confiance des utilisateurs
- **Aucune modification de code nécessaire** - Firebase gère cela automatiquement

## 🔧 Vérifications à faire

### 1. Vérifier que "Email/Password" est activé

1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet **fluance-protected-content**
3. Dans le menu de gauche, cliquez sur **Authentication** (ou **Build > Authentication**)
4. Cliquez sur l'onglet **Sign-in method**
5. Vérifiez que **"Email/Password"** est activé (toggle vert)
6. Si ce n'est pas le cas :
   - Cliquez sur **"Email/Password"**
   - Activez le toggle en haut
   - Cliquez sur **Enregistrer** / **Save**

### 2. Vérifier les templates d'email Firebase

1. Toujours dans **Authentication > Sign-in method**
2. Cliquez sur **"Email/Password"**
3. Faites défiler jusqu'à la section **"Email templates"**
4. Vérifiez que le template **"Password reset"** est configuré
5. **Important** : Cliquez sur **"Edit template"** et vérifiez :
   - Le sujet de l'email
   - Le contenu HTML
   - **CRITIQUE** : Le lien dans le template doit utiliser la variable `%LINK%` (ou `__LINK__` selon la version)
   - ❌ **NE PAS** utiliser une URL hardcodée comme `https://fluance-protected-content.firebaseapp.com/__/auth/action?mode=action&oobCode=code`
   - ✅ **UTILISER** : `%LINK%` qui sera automatiquement remplacé par Firebase avec l'URL configurée dans `actionCodeSettings`
   - Exemple de lien correct dans le template : `<a href="%LINK%">Réinitialiser mon mot de passe</a>`

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
   - **100 emails/jour** pour les emails de vérification/connexion/réinitialisation
   - Si vous avez dépassé cette limite, les emails ne seront pas envoyés

### 5. Vérifier les spams

Les emails Firebase peuvent être filtrés comme spam :
- ✅ Vérifiez votre dossier **spam/courrier indésirable**
- ✅ Vérifiez les filtres de votre boîte email
- ✅ **Expéditeur actuel** (pendant la vérification) : `noreply@[PROJECT_ID].firebaseapp.com`
- ✅ **Expéditeur après vérification** : `support@votre-domaine-personnalise.io` (une fois le domaine personnalisé vérifié)
- ✅ Ajoutez ces expéditeurs à vos contacts pour éviter les filtres
- ✅ Dans Gmail, recherchez : 
  - `from:noreply@[PROJECT_ID].firebaseapp.com` (actuel)
  - `from:support@votre-domaine-personnalise.io` (après vérification)

### 6. Vérifier que l'utilisateur existe

1. Dans Firebase Console, allez dans **Authentication > Users**
2. Recherchez l'email de l'utilisateur concerné (ex: `user@example.com`)
3. Vérifiez que l'utilisateur existe
4. Si l'utilisateur n'existe pas :
   - L'email de réinitialisation ne peut pas être envoyé
   - Firebase Auth retournera l'erreur `auth/user-not-found` (mais pour des raisons de sécurité, il peut aussi ne rien retourner)

## 🐛 Débogage dans le navigateur

Ouvrez la console du navigateur (F12) et vérifiez :

1. **Logs détaillés** :
   - Vous devriez voir : `[Firebase Auth] ===== sendPasswordResetEmail appelée =====`
   - Puis : `[Firebase Auth] ✅ Email de réinitialisation envoyé avec succès`
   - Ou : `[Firebase Auth] ❌ ERREUR lors de l'envoi de l'email de réinitialisation`

2. **Codes d'erreur Firebase** :
   - `auth/user-not-found` : Aucun compte trouvé avec cet email
   - `auth/invalid-email` : Format d'email invalide
   - `auth/too-many-requests` : Trop de tentatives (limite de sécurité)
   - `auth/operation-not-allowed` : La réinitialisation n'est pas activée

3. **Vérifier la configuration** :
   ```javascript
   // Vérifier si Firebase Auth est bien initialisé
   console.log('Firebase Auth:', firebase.auth());
   
   // Vérifier l'URL de réinitialisation
   console.log('Origin:', window.location.origin);
   ```

## 🔧 Solutions possibles

### Solution 1 : Corriger le template d'email

1. Dans **Authentication > Sign-in method > Email/Password**
2. Cliquez sur **"Email templates"**
3. Cliquez sur **"Password reset"**
4. Cliquez sur **"Edit template"**
5. **CRITIQUE** : Dans le contenu HTML du template, recherchez le lien
6. **Remplacez** toute URL hardcodée par la variable `%LINK%`
   - ❌ **MAUVAIS** : `https://fluance-protected-content.firebaseapp.com/__/auth/action?mode=action&oobCode=code`
   - ✅ **BON** : `%LINK%`
7. Exemple de lien correct dans le template :
   ```html
   <a href="%LINK%">Réinitialiser mon mot de passe</a>
   ```
8. **Note** : Firebase remplacera automatiquement `%LINK%` par l'URL configurée dans `actionCodeSettings` (qui pointe vers `fluance.io/reinitialiser-mot-de-passe`)
9. Cliquez sur **"Save"**

**Alternative** : Si vous ne trouvez pas `%LINK%`, essayez :
- `__LINK__` (double underscore)
- `{{LINK}}` (accolades)
- Ou utilisez le bouton "Reset to default" puis personnalisez uniquement le texte, pas le lien

### Solution 2 : Vérifier le domaine personnalisé pour les emails

**Domaine personnalisé configuré** : Votre domaine personnalisé (ex: `actu.votre-domaine.io`)

**État actuel** : "Custom-domain verification in progress"

#### Étapes de vérification :

1. **Dans Firebase Console** :
   - Allez dans **Authentication > Settings > Email templates**
   - Vérifiez l'état de la vérification de votre domaine personnalisé
   - Si "Custom-domain verification in progress", attendez la propagation DNS (jusqu'à 24h)

2. **Vérifier les enregistrements DNS** :
   - Connectez-vous à votre fournisseur DNS (registraire de domaine)
   - Vérifiez que les enregistrements TXT et CNAME fournis par Firebase sont bien configurés pour votre domaine personnalisé
   - Les enregistrements doivent être ajoutés au niveau du sous-domaine configuré

3. **Une fois la vérification terminée** :
   - Firebase affichera "Verification complete" ou "Verified"
   - Cliquez sur **"Apply custom domain"** pour activer le domaine
   - Les emails seront automatiquement envoyés depuis votre domaine personnalisé (ex: `support@votre-domaine.io`)
   - **Aucune modification de code nécessaire** - Firebase gère cela automatiquement

4. **Vérifier le domaine dans les templates** :
   - Dans **Authentication > Sign-in method > Email/Password > Email templates**
   - Pour chaque template (Password reset, Email verification, etc.)
   - Vérifiez que votre domaine personnalisé est sélectionné
   - Si ce n'est pas le cas, sélectionnez-le dans le menu déroulant "Custom domain"

#### Vérification du domaine pour les liens (Hosting) :

Si vous utilisez un domaine personnalisé (`fluance.io`) pour les liens de réinitialisation, vérifiez :
1. Que le domaine est bien configuré dans Firebase Hosting
2. Que les DNS sont correctement configurés
3. Que le domaine est dans la liste des domaines autorisés dans Authentication > Settings

### Solution 3 : Tester avec un autre email

Testez avec :
- Un email Gmail différent
- Un email Outlook
- Un email professionnel

Pour identifier si c'est un problème spécifique à votre fournisseur d'email.

### Solution 4 : Vérifier les logs Firebase

1. Dans Firebase Console, allez dans **Functions**
2. Cliquez sur l'onglet **Logs**
3. **Note** : Les emails Firebase Auth ne passent pas par Functions, donc vous ne verrez probablement rien ici
4. Les logs sont uniquement dans la console du navigateur

## 📋 Checklist de vérification

- [ ] "Email/Password" est activé dans Firebase Console
- [ ] Le template "Password reset" est configuré et contient un lien avec `%LINK%`
- [ ] Le domaine `fluance.io` est dans les domaines autorisés
- [ ] **Domaine personnalisé** : Vérification DNS en cours ou terminée
- [ ] Les quotas Firebase ne sont pas dépassés
- [ ] Vérifié les spams dans Gmail
- [ ] L'utilisateur existe dans Firebase Authentication
- [ ] Testé avec un autre email
- [ ] Vérifié la console du navigateur pour les erreurs
- [ ] Recherché l'email dans Gmail avec `from:support@votre-domaine-personnalise.io` (ou `from:noreply@[PROJECT_ID].firebaseapp.com` si pas encore vérifié)

## 💡 Prochaines étapes

1. **Attendre la vérification du domaine personnalisé** - Si votre domaine personnalisé est en cours de vérification, attendez que la vérification DNS soit terminée (jusqu'à 24h)
2. **Vérifier les domaines autorisés** (étape 3) - c'est souvent la cause
3. **Vérifier les spams** (étape 5) - les emails Firebase sont souvent filtrés
4. **Vérifier la console du navigateur** - les logs détaillés vous indiqueront le problème exact
5. **Vérifier les quotas** (étape 4) - si vous avez envoyé beaucoup d'emails récemment
6. **Vérifier le template d'email** (étape 2) - le lien doit utiliser `%LINK%` et non une URL hardcodée

## 🆘 Si rien ne fonctionne

1. **Vérifiez les quotas Firebase** :
   - Allez dans **Usage and billing**
   - Vérifiez que vous n'avez pas dépassé les limites d'envoi d'emails

2. **Contactez le support Firebase** :
   - Si le problème persiste, contactez le support Firebase
   - Fournissez les logs de la console du navigateur
   - Mentionnez que `sendPasswordResetEmail()` réussit mais que l'email n'arrive pas

3. **Alternative temporaire** :
   - Utilisez la connexion par **lien passwordless** en attendant
   - Les emails passwordless fonctionnent-ils ?

---

**Date de création** : 2025-12-11
