# Configurer les rôles IAM pour l'extension Firebase WebAuthn

## Format du service account

Pour ajouter les rôles IAM, vous devez utiliser le **format email complet** du service account :

```
ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com
```

⚠️ **Ne pas utiliser** juste `ext-firebase-web-authn` - cela générera une erreur.

## Étapes détaillées

### 1. Accéder à IAM

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Dans le menu de gauche, allez dans **IAM & Admin** > **IAM**

### 2. Ajouter le principal

1. Cliquez sur **Grant Access** ou **Add Principal** (en haut de la page)
2. Dans le champ **New principals**, entrez :
   ```
   ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com
   ```
3. Si vous voyez une erreur "Email addresses and domains must be associated with an active Google Account", vérifiez que :
   - Vous avez bien utilisé le format email complet
   - Le service account existe (il est créé automatiquement lors de l'installation de l'extension)

### 3. Ajouter les rôles

Dans la section **Assign Roles**, ajoutez les deux rôles suivants :

#### Rôle 1 : Service Account Token Creator
- **Description** : "Impersonate service accounts (create OAuth2 access tokens, sign blobs or JWTs, etc.)"
- **Pourquoi** : Nécessaire pour que l'extension puisse créer des custom auth providers

#### Rôle 2 : Service Usage Consumer
- **Description** : "Ability to inspect service states and operations, and consume quota and billing for a consumer project"
- **Pourquoi** : Nécessaire pour utiliser les services Firebase

### 4. Sauvegarder

1. Cliquez sur **Save** en bas de la page
2. Attendez quelques secondes pour que les changements prennent effet

## Vérification

Pour vérifier que les rôles sont bien assignés :

1. Dans IAM & Admin > IAM, cherchez `ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com`
2. Vous devriez voir les deux rôles listés :
   - ✅ Service Account Token Creator
   - ✅ Service Usage Consumer

## Si vous obtenez l'erreur "Email addresses must be associated with an active Google Account"

Cette erreur signifie que le service account n'existe pas encore. Voici comment le résoudre :

### Solution 1 : Vérifier que l'extension est bien installée et déployée

1. Allez dans Firebase Console > Extensions
2. Vérifiez que "Firebase WebAuthn" est installée et **déployée**
3. Si l'extension est installée mais pas déployée, attendez quelques minutes

### Solution 2 : Créer le service account manuellement

Le service account doit être créé manuellement avant de pouvoir lui attribuer des rôles :

1. Allez dans [Google Cloud Console](https://console.cloud.google.com/) > **IAM & Admin** > **Service Accounts**
2. Cliquez sur **Create Service Account** (en haut de la page)
3. Remplissez le formulaire :
   - **Service account name** : `ext-firebase-web-authn`
   - **Service account ID** : `ext-firebase-web-authn` (généré automatiquement)
   - **Description** : `Service account for Firebase WebAuthn extension`
4. Cliquez sur **Create and Continue**
5. **Ne pas ajouter de rôles ici** - nous les ajouterons dans IAM
6. Cliquez sur **Done**

### Solution 3 : Attendre la création automatique

Parfois, le service account est créé automatiquement lors du déploiement de l'extension. Attendez 5-10 minutes après l'installation de l'extension, puis réessayez.

### Solution 4 : Vérifier que le service account existe

Pour vérifier si le service account existe :

1. Allez dans **IAM & Admin** > **Service Accounts**
2. Cherchez `ext-firebase-web-authn`
3. Si vous le trouvez, notez son email complet (il devrait être `ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com`)
4. Si vous ne le trouvez pas, créez-le avec la Solution 2

### Une fois le service account créé

Après avoir créé le service account, retournez dans **IAM & Admin** > **IAM** et ajoutez les rôles comme décrit dans les étapes précédentes.

## Format générique

Pour référence, le format générique est :
```
ext-firebase-web-authn@${PROJECT_ID}.iam.gserviceaccount.com
```

Où `${PROJECT_ID}` est l'ID de votre projet Firebase (dans votre cas : `fluance-protected-content`).
