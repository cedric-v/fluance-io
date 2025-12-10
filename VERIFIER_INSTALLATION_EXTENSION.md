# Vérifier l'installation de l'extension Firebase WebAuthn

## Problème

Les fonctions de l'extension (`ext-firebase-web-authn-*`) n'apparaissent pas dans Firebase Console > Functions.

Cela signifie que l'extension n'est **pas correctement installée** ou que ses fonctions ne sont **pas déployées**.

## Vérifications à faire

### 1. Vérifier que l'extension est installée

1. Allez dans Firebase Console > **Extensions**
2. Cherchez l'extension **Firebase WebAuthn** (par gavinsawyer)
3. Vérifiez son statut :
   - ✅ **Installed** / **Installée** = L'extension est installée
   - ⚠️ **Not installed** / **Non installée** = L'extension n'est pas installée

### 2. Si l'extension n'est pas installée

#### Option A : Installation via Firebase Console

1. Dans Firebase Console > Extensions, cliquez sur **Browse** ou **Parcourir**
2. Recherchez "Firebase WebAuthn" ou "firebase-web-authn"
3. Cliquez sur l'extension par **gavinsawyer**
4. Cliquez sur **Install** ou **Installer**
5. Suivez les étapes de configuration :
   - **Location** : `europe-west1` (ou la région de votre choix)
   - **Relying Party ID** : `fluance.io`
   - **Relying Party Name** : `Fluance`
   - **Relying Party Origins** :
     ```
     https://fluance.io
     https://www.fluance.io
     https://fluance-protected-content.firebaseapp.com
     ```
   - **Authenticator Attachment** : `any`
   - **Authenticator Attachment for Secondary Passkeys (2FA)** : `platform`
   - **User Verification Requirement** : `preferred`
6. Cliquez sur **Install** pour finaliser

#### Option B : Installation via Firebase CLI

```bash
# 1. Se connecter à Firebase
firebase login

# 2. Sélectionner le projet
firebase use fluance-protected-content

# 3. Installer l'extension
firebase ext:install gavinsawyer/firebase-web-authn
```

Lors des prompts, configurez :
- **Location** : `europe-west1`
- **Relying Party ID** : `fluance.io`
- **Relying Party Name** : `Fluance`
- **Relying Party Origins** : `https://fluance.io`, `https://www.fluance.io`, `https://fluance-protected-content.firebaseapp.com`
- **Authenticator Attachment** : `any`
- **Authenticator Attachment for Secondary Passkeys (2FA)** : `platform`
- **User Verification Requirement** : `preferred`

### 3. Si l'extension est installée mais les fonctions n'apparaissent pas

#### Vérifier le statut de l'extension

1. Dans Firebase Console > Extensions > Firebase WebAuthn
2. Vérifiez la section **Status** ou **Statut**
3. Si l'extension est en erreur, consultez les logs :
   - Cliquez sur **View logs** ou **Voir les logs**
   - Identifiez les erreurs

#### Attendre le déploiement

Les fonctions peuvent prendre 5-10 minutes à être déployées après l'installation. Attendez et vérifiez à nouveau.

#### Redéployer l'extension

Si les fonctions ne se déploient pas :

1. Dans Firebase Console > Extensions > Firebase WebAuthn
2. Cliquez sur **Reconfigure** ou **Reconfigurer**
3. Vérifiez la configuration
4. Sauvegardez
5. Attendez 5-10 minutes

### 4. Vérifier les prérequis

Assurez-vous que tous les prérequis sont remplis :

1. ✅ **Base Firestore `ext-firebase-web-authn`** créée
2. ✅ **Service account** créé avec les rôles IAM
3. ✅ **Authentification anonyme** activée (Firebase Console > Authentication > Sign-in method)
4. ⚠️ **App Check** (optionnel mais recommandé)

Voir [VERIFIER_CONFIGURATION_EXTENSION_PASSKEYS.md](./VERIFIER_CONFIGURATION_EXTENSION_PASSKEYS.md) pour les détails.

## Fonctions attendues

Une fois l'extension correctement installée, vous devriez voir dans Firebase Console > Functions :

- `ext-firebase-web-authn-api` (fonction principale)
- Ou des fonctions avec des noms similaires commençant par `ext-firebase-web-authn-`

**Note** : Les noms exacts peuvent varier selon la version de l'extension. Consultez la documentation de l'extension pour les noms exacts.

## Après l'installation

Une fois les fonctions visibles :

1. Vérifiez que les fonctions utilisent **Node.js 20** (Configuration > Runtime)
2. Testez les passkeys sur `/connexion-membre/`
3. Vérifiez la console du navigateur pour les erreurs

## Support

Si l'extension ne s'installe toujours pas :

1. Vérifiez les logs dans Firebase Console > Extensions > Firebase WebAuthn > Logs
2. Vérifiez que votre projet est sur le plan **Blaze** (pay-as-you-go)
3. Consultez la [documentation officielle](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn)
