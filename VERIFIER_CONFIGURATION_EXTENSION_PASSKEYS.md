# Vérifier la configuration de l'extension Firebase WebAuthn

## Prérequis de l'extension

Selon la [documentation officielle](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn), l'extension nécessite :

### ✅ Ce qui est probablement déjà configuré

1. **Firestore** - ✅ Configuré
   - `firestore.rules` existe
   - `firestore.indexes.json` existe
   - Base de données principale configurée

2. **Functions** - ✅ Configuré
   - `functions/index.js` existe
   - Firebase Functions déployées

### ⚠️ Ce qui doit être vérifié/configuré

1. **App Check avec reCAPTCHA Enterprise ou v3** - ❓ À vérifier
   - Nécessaire pour sécuriser l'API
   - Peut ne pas être strictement nécessaire si vous n'utilisez pas App Check

2. **Authentication avec le fournisseur anonyme** - ❓ À vérifier
   - Doit être activé dans Firebase Console > Authentication > Sign-in method
   - Nécessaire pour l'extension

3. **Base Firestore dédiée `ext-firebase-web-authn`** - ❓ À vérifier
   - Base de données séparée pour stocker les credentials WebAuthn
   - Peut être créée avec : `firebase firestore:databases:create ext-firebase-web-authn --location eur3 --delete-protection ENABLED`

4. **Rôles IAM pour le service account** - ❓ À vérifier
   - `Service Account Token Creator`
   - `Service Usage Consumer`
   - À accorder dans Google Cloud Console > IAM

5. **Rewrite dans firebase.json** - ❌ **MANQUANT**
   - Doit ajouter un rewrite pour `/firebase-web-authn-api`

## Configuration manquante critique

### 1. Ajouter le rewrite dans firebase.json

**Actuellement** :
```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**Doit être** :
```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/firebase-web-authn-api",
        "function": "ext-firebase-web-authn-api"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**⚠️ IMPORTANT** : Le rewrite pour `/firebase-web-authn-api` doit être **AVANT** le rewrite générique `**` pour être prioritaire.

## Vérifications à faire

### 1. Vérifier App Check

1. Allez dans Firebase Console > App Check
2. Vérifiez si App Check est configuré
3. Si non configuré, vous pouvez :
   - Soit l'activer avec reCAPTCHA v3 (recommandé pour la sécurité)
   - Soit tester sans App Check d'abord (peut fonctionner selon la version de l'extension)

### 2. Vérifier l'authentification anonyme

1. Allez dans Firebase Console > Authentication > Sign-in method
2. Vérifiez si "Anonymous" est activé
3. Si non, activez-le

### 3. Vérifier la base Firestore `ext-firebase-web-authn`

1. Allez dans Firebase Console > Firestore Database
2. Vérifiez s'il existe une base de données nommée `ext-firebase-web-authn`
3. Si non, créez-la :
   ```bash
   firebase firestore:databases:create ext-firebase-web-authn --location eur3 --delete-protection ENABLED
   ```
   Ou `nam5` pour l'Amérique du Nord.

### 4. Vérifier les rôles IAM

1. Allez dans [Google Cloud Console](https://console.cloud.google.com/) > IAM & Admin > IAM
2. Cherchez le service account : `ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com`
3. Vérifiez qu'il a les rôles :
   - ✅ Service Account Token Creator
   - ✅ Service Usage Consumer
4. Si manquants, ajoutez-les :
   - Cliquez sur "Grant Access" ou "Add Principal"
   - Dans "New principals", entrez : **`ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com`**
     - ⚠️ **Important** : Utilisez le format email complet, pas juste `ext-firebase-web-authn`
   - Ajoutez les deux rôles :
     - `Service Account Token Creator`
     - `Service Usage Consumer`
   - Cliquez sur "Save"

## Est-ce vraiment nécessaire ?

### Ce qui est **absolument nécessaire** :

1. ✅ **Rewrite dans firebase.json** - **CRITIQUE** pour que l'extension fonctionne
2. ✅ **Base Firestore `ext-firebase-web-authn`** - Nécessaire pour stocker les credentials

### Ce qui est **recommandé mais peut fonctionner sans** :

1. ⚠️ **App Check** - Recommandé pour la sécurité, mais peut fonctionner sans (selon la version)
2. ⚠️ **Authentification anonyme** - Nécessaire selon la doc, mais à vérifier si vraiment utilisé

### Ce qui est **nécessaire pour le déploiement** :

1. ✅ **Rôles IAM** - Nécessaires pour que l'extension puisse créer des custom auth providers

## Test rapide

Pour savoir si tout fonctionne :

1. Allez sur `/connexion-membre/`
2. Cliquez sur l'onglet "🔐 Clé d'accès"
3. Essayez de créer un compte avec passkey
4. Vérifiez la console du navigateur pour les erreurs

**Si vous voyez une erreur 404 sur `/firebase-web-authn-api`** → Le rewrite manque dans `firebase.json`

**Si vous voyez une erreur de permissions** → Les rôles IAM manquent

**Si vous voyez une erreur Firestore** → La base `ext-firebase-web-authn` n'existe pas
