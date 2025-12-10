# Où trouver les fonctions de l'extension Firebase WebAuthn

## Où chercher

### 1. Firebase Console > Functions

1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Dans le menu de gauche, cliquez sur **Functions**
4. Cliquez sur **Functions** (sous-menu)

### 2. Vérifier la région

L'extension a été configurée pour `europe-west1`. Les fonctions devraient être dans cette région.

**Important** : Dans Firebase Console > Functions, vous pouvez filtrer par région. Assurez-vous de regarder **toutes les régions** ou spécifiquement **europe-west1**.

### 3. Nom de la fonction

Le nom de la fonction dépend du nom de l'instance que vous avez donné lors de l'installation.

Si vous avez utilisé le nom par défaut `firebase-web-authn-i84o`, la fonction devrait s'appeler :
- `ext-firebase-web-authn-i84o-api`

Si vous avez utilisé `firebase-web-authn`, la fonction devrait s'appeler :
- `ext-firebase-web-authn-api`

## Vérifications étape par étape

### Étape 1 : Vérifier que l'extension est installée

1. Firebase Console > **Extensions**
2. Cherchez **"Firebase WebAuthn"** ou **"firebase-web-authn-i84o"**
3. Vérifiez le statut :
   - ✅ **Installed** = Installée
   - ⚠️ **Error** = Erreur (consultez les logs)
   - ❌ **Not installed** = Non installée

### Étape 2 : Vérifier les logs de l'extension

Si l'extension est installée mais les fonctions n'apparaissent pas :

1. Firebase Console > Extensions > Firebase WebAuthn (ou le nom de votre instance)
2. Cliquez sur **View logs** ou **Voir les logs**
3. Cherchez des erreurs de déploiement

### Étape 3 : Vérifier dans Google Cloud Console

Les fonctions peuvent aussi être visibles dans Google Cloud Console :

1. Allez dans [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Dans le menu, allez dans **Cloud Functions** > **Functions**
4. Cherchez les fonctions commençant par `ext-firebase-web-authn-`

### Étape 4 : Vérifier via Firebase CLI

```bash
firebase functions:list
```

Cela liste toutes les fonctions, y compris celles créées par les extensions.

## Si les fonctions n'apparaissent toujours pas

### Vérifier le statut de l'extension

1. Firebase Console > Extensions > Firebase WebAuthn
2. Vérifiez la section **Status** ou **Statut**
3. Si c'est en erreur, notez le message d'erreur

### Vérifier les prérequis

Assurez-vous que :
1. ✅ Base Firestore `ext-firebase-web-authn` créée
2. ✅ Service account avec rôles IAM configurés
3. ✅ Authentification anonyme activée
4. ✅ Projet sur le plan **Blaze** (pay-as-you-go)

### Attendre le déploiement

Les fonctions peuvent prendre **10-15 minutes** à être déployées après l'installation. Attendez et vérifiez à nouveau.

## Nom exact de la fonction selon l'instance

Si votre instance s'appelle `firebase-web-authn-i84o`, la fonction sera :
```
ext-firebase-web-authn-i84o-api
```

Si votre instance s'appelle `firebase-web-authn`, la fonction sera :
```
ext-firebase-web-authn-api
```

Le format est toujours : `ext-{instance-name}-api`
