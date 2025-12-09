# Activer le template "Email link sign-in" dans Firebase

## 🔍 Problème

Le template **"Email link sign-in"** n'apparaît pas dans la liste des templates d'email Firebase.

## ✅ Solution : Activer "Email link (passwordless sign-in)"

Le template "Email link sign-in" n'apparaît que si la méthode **"Email link (passwordless sign-in)"** est activée dans les méthodes de connexion.

### Étapes à suivre

1. **Dans Firebase Console**, allez dans **Authentication** (ou **Build > Authentication**)

2. **Cliquez sur l'onglet "Sign-in method"** (pas "Templates")

3. **Cherchez "Email link (passwordless sign-in)"** dans la liste des fournisseurs :
   - Si vous ne le voyez pas, faites défiler la liste complète
   - Il devrait être dans la section des méthodes d'authentification

4. **Cliquez sur "Email link (passwordless sign-in)"**

5. **Activez le toggle en haut** (il doit passer au vert)

6. **Cliquez sur "Enregistrer" / "Save"**

7. **Retournez dans l'onglet "Templates"** (ou **Email templates**)

8. **Le template "Email link sign-in" devrait maintenant apparaître** dans la liste

## 📝 Configuration du template

Une fois le template visible :

1. **Cliquez sur "Email link sign-in"**

2. **Vérifiez/Configurez** :
   - **Subject** : Le sujet de l'email (ex: "Connexion à Fluance")
   - **Message** : Le contenu de l'email avec le lien de connexion
   - **From** : L'adresse d'expédition (peut être personnalisée)

3. **Important** : Le lien dans le template doit contenir :
   ```
   %LINK%
   ```
   C'est la variable qui sera remplacée par le vrai lien de connexion.

4. **Cliquez sur "Save"** pour enregistrer

## 🔧 Si le template n'apparaît toujours pas

### Option 1 : Vérifier que la méthode est bien activée

1. Retournez dans **Sign-in method**
2. Vérifiez que **"Email link (passwordless sign-in)"** a un toggle **vert** (activé)
3. Si ce n'est pas le cas, activez-le et sauvegardez

### Option 2 : Rafraîchir la page

1. Rafraîchissez la page Firebase Console (F5)
2. Retournez dans **Templates**
3. Le template devrait apparaître

### Option 3 : Vérifier les permissions

1. Assurez-vous d'avoir les permissions **Owner** ou **Editor** sur le projet Firebase
2. Les utilisateurs avec des permissions limitées peuvent ne pas voir tous les templates

### Option 4 : Utiliser l'API Firebase

Si le template n'apparaît toujours pas dans l'interface, il est possible qu'il soit créé automatiquement lors du premier envoi. Testez en envoyant un lien de connexion depuis votre site.

## ✅ Vérification

Après activation, vous devriez voir dans **Templates** :
- ✅ Email address verification
- ✅ Password reset
- ✅ **Email link sign-in** ← **Celui-ci doit apparaître**
- ✅ Email address change
- ✅ Multi-factor enrolment notification

## 🧪 Test

1. Une fois le template activé et configuré
2. Testez l'envoi d'un lien de connexion depuis votre site
3. Vérifiez que l'email arrive (pensez à vérifier les spams)

---

**Date de création** : 2025-12-09

