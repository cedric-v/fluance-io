# Créer le service account pour l'extension Firebase WebAuthn

## Problème

Vous obtenez l'erreur : "Email addresses and domains must be associated with an active Google Account, Google Workspace account or Cloud Identity account."

Cela signifie que le service account `ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com` n'existe pas encore.

## Solution : Créer le service account manuellement

### Étape 1 : Accéder aux Service Accounts

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Dans le menu de gauche, allez dans **IAM & Admin** > **Service Accounts**

### Étape 2 : Créer le service account

1. Cliquez sur **Create Service Account** (bouton en haut de la page)
2. Remplissez le formulaire :

   **Service account details** :
   - **Service account name** : `ext-firebase-web-authn`
   - **Service account ID** : `ext-firebase-web-authn` (généré automatiquement à partir du nom)
   - **Description** (optionnel) : `Service account for Firebase WebAuthn extension`

3. Cliquez sur **Create and Continue**

### Étape 3 : Ignorer l'étape des rôles

1. Dans l'étape "Grant this service account access to project", **ne pas ajouter de rôles ici**
2. Cliquez sur **Continue**
3. Dans l'étape "Grant users access to this service account", **ne rien faire**
4. Cliquez sur **Done**

### Étape 4 : Vérifier la création

1. Vous devriez maintenant voir le service account dans la liste
2. L'email complet devrait être : `ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com`

### Étape 5 : Ajouter les rôles IAM

Maintenant que le service account existe, vous pouvez lui attribuer les rôles :

1. Allez dans **IAM & Admin** > **IAM**
2. Cliquez sur **Grant Access** ou **Add Principal**
3. Dans "New principals", entrez :
   ```
   ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com
   ```
4. Ajoutez les deux rôles :
   - `Service Account Token Creator`
   - `Service Usage Consumer`
5. Cliquez sur **Save**

## Vérification

Pour vérifier que tout est correct :

1. **Service Account créé** :
   - IAM & Admin > Service Accounts
   - Vous devriez voir `ext-firebase-web-authn`

2. **Rôles attribués** :
   - IAM & Admin > IAM
   - Cherchez `ext-firebase-web-authn@fluance-protected-content.iam.gserviceaccount.com`
   - Vous devriez voir les deux rôles listés

## Note importante

Le service account devrait normalement être créé automatiquement lors de l'installation de l'extension. Si ce n'est pas le cas, créez-le manuellement avec ces étapes.

Une fois créé et les rôles attribués, l'extension devrait fonctionner correctement.
